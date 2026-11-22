import crypto from 'crypto';
import type express from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AppScreen,
  NonoAiChatRequest,
  NonoAiChatResponse,
  NonoMood,
  SkillId,
} from '../src/types/nonoland';
import { SKILL_LABELS } from '../src/i18n/translations';
import { sanitizeShortText } from '../src/utils/validation';
import { recordAuditEvent } from './auditLog';
import type { AuthenticatedRequest, ServerDb, StoredChildRecord } from './dbTypes';
import {
  createDefaultContentPolicy,
  createDefaultPrivacySettings,
  ensureChildFamilyAndGarden,
  ensureFamilyCollections,
  isChildOrStudentRole,
  recordFamilyEvent,
} from './familyHelpers';
import { getClientIp } from './security';
import { checkRateLimitPg } from './pgStore';
import {
  FALLBACK_TTS_MODEL,
  PRIMARY_TTS_MODEL,
  synthesizeSpeechAudio,
  verifyAndGetEphemeralClip,
} from './ttsService';

class AiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiTimeoutError';
  }
}

async function withTimeout<T>(
  factory: (abortSignal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      factory(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new AiTimeoutError(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Gemini TTS models return raw linear PCM (audio/L16;codec=pcm;rate=24000) without a RIFF header.
 * Wrap raw PCM in a 44-byte 16-bit mono WAV header so HTMLAudioElement decodes cleanly on Android WebView & Chrome.
 */
export function ensureWavContainerIfRawPcm(
  base64Data: string,
  upstreamMimeType?: string,
): { audioBase64: string; mimeType: string } {
  const rawBuf = Buffer.from(base64Data, 'base64');
  if (rawBuf.length >= 12) {
    const riff = rawBuf.subarray(0, 4).toString('ascii');
    const wave = rawBuf.subarray(8, 12).toString('ascii');
    if (riff === 'RIFF' && wave === 'WAVE') {
      return { audioBase64: base64Data, mimeType: 'audio/wav' };
    }
    const ogg = rawBuf.subarray(0, 4).toString('ascii');
    if (ogg === 'OggS') {
      return { audioBase64: base64Data, mimeType: 'audio/ogg' };
    }
    const id3 = rawBuf.subarray(0, 3).toString('ascii');
    if (id3 === 'ID3' || (rawBuf[0] === 0xff && (rawBuf[1] & 0xe0) === 0xe0)) {
      return { audioBase64: base64Data, mimeType: 'audio/mpeg' };
    }
  }

  const rateMatch = String(upstreamMimeType || '').match(/rate=(\d+)/i);
  const sampleRate = rateMatch ? Math.max(8000, Math.min(96000, Number(rateMatch[1]))) : 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = rawBuf.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM subchunk size
  header.writeUInt16LE(1, 20); // PCM audio format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return {
    audioBase64: Buffer.concat([header, rawBuf]).toString('base64'),
    mimeType: 'audio/wav',
  };
}

interface NonoAiRouteDeps {
  app: express.Express;
  getDb: () => ServerDb;
  saveDb: (db: ServerDb) => void;
  requireAuth: (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => void;
  assertChildAccess: (
    req: AuthenticatedRequest,
    res: express.Response,
    childId: string,
  ) => StoredChildRecord | null | 'untracked-sample';
}

const DAILY_AI_LIMIT_PER_CHILD = 40;

const PII_PATTERNS = [
  /\b(phone\s*number|my\s*phone|address|street|home\s*address|password|credit\s*card|bank|ssn|national\s*id|whatsapp)\b/i,
  /(رقم\s*الهاتف|رقم\s*التليفون|عنوان\s*البيت|كلمة\s*السر|المرور|بطاقة\s*بنك|فيزا)/i,
];

const MUTATION_OR_PURCHASE_PATTERNS = [
  /\b(buy|purchase|checkout|pay|upgrade\s*plan|change\s*role|make\s*me\s*admin|give\s*me\s*\d+\s*stars|add\s*stars|delete\s*account)\b/i,
  /(اشترِ|ادفع|اشترك|أضف\s*نجوم|اجعلني\s*مشرف|احذف\s*الحساب|تغيير\s*الصلاحية)/i,
];

const UNSAFE_OR_EXTERNAL_PATTERNS = [
  /\b(kill|weapon|gun|bomb|drugs|alcohol|sex|porn|suicide|self\s*harm|hate|horror|browse\s*the\s*web|open\s*url|http:\/\/|https:\/\/)\b/i,
  /(قتل|سلاح|مخدرات|إباحي|انتحار|كراهية|تصفح\s*الإنترنت|افتح\s*رابط)/i,
];

function detectUnsafeOrDisallowedTopic(text: string): { blocked: boolean; reason?: string; kind?: 'pii' | 'mutation' | 'unsafe' } {
  const clean = text.trim();
  if (PII_PATTERNS.some((re) => re.test(clean))) {
    return { blocked: true, reason: 'Blocked personal information request', kind: 'pii' };
  }
  if (MUTATION_OR_PURCHASE_PATTERNS.some((re) => re.test(clean))) {
    return { blocked: true, reason: 'Blocked account mutation or purchase request', kind: 'mutation' };
  }
  if (UNSAFE_OR_EXTERNAL_PATTERNS.some((re) => re.test(clean))) {
    return { blocked: true, reason: 'Blocked unsafe or unrestricted browsing request', kind: 'unsafe' };
  }
  return { blocked: false };
}

function getRemainingDailyQuota(db: ServerDb, childId: string): number {
  const dayKey = `${childId}:${new Date().toISOString().slice(0, 10)}`;
  db.aiUsageDaily = db.aiUsageDaily || {};
  const used = db.aiUsageDaily[dayKey] || 0;
  return Math.max(0, DAILY_AI_LIMIT_PER_CHILD - used);
}

function incrementDailyQuota(db: ServerDb, childId: string): number {
  const dayKey = `${childId}:${new Date().toISOString().slice(0, 10)}`;
  db.aiUsageDaily = db.aiUsageDaily || {};
  db.aiUsageDaily[dayKey] = (db.aiUsageDaily[dayKey] || 0) + 1;
  return Math.max(0, DAILY_AI_LIMIT_PER_CHILD - db.aiUsageDaily[dayKey]);
}

function appendAiUsageLog(
  db: ServerDb,
  childId: string,
  entry: { mode: string; language: 'ar' | 'en'; topic?: string; blocked: boolean; voiceUsed: boolean },
) {
  ensureFamilyCollections(db);
  const existing = db.aiUsageRecords![childId] || [];
  db.aiUsageRecords![childId] = [
    {
      id: `aiu_${crypto.randomBytes(4).toString('hex')}`,
      childId,
      mode: entry.mode,
      language: entry.language,
      topic: entry.topic,
      blocked: entry.blocked,
      voiceUsed: entry.voiceUsed,
      createdAt: new Date().toISOString(),
    },
    ...existing,
  ].slice(0, 60);
}

export function registerNonoAiRoutes({
  app,
  getDb,
  saveDb,
  requireAuth,
  assertChildAccess,
}: NonoAiRouteDeps) {
  app.get('/api/ai/status', (_req, res) => {
    res.json({
      configured: Boolean(process.env.GEMINI_API_KEY),
      model: 'gemini-4-hydrogen',
      ttsModel: PRIMARY_TTS_MODEL,
      ttsFallbackModel: FALLBACK_TTS_MODEL,
      voiceSynthesisSupported: Boolean(process.env.GEMINI_API_KEY),
      dailyLimitPerChild: DAILY_AI_LIMIT_PER_CHILD,
    });
  });

  app.put('/api/parent/children/:id/ai-settings', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = req.authSession!.user;
    if (isChildOrStudentRole(user.role) || user.role === 'teacher') {
      return res.status(403).json({ error: 'Only parents or administrators may change AI settings.' });
    }
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }

    const { aiAssistantEnabled } = req.body as { aiAssistantEnabled?: boolean };
    if (typeof aiAssistantEnabled !== 'boolean') {
      return res.status(400).json({ error: 'aiAssistantEnabled boolean is required' });
    }

    const previous = child.aiAssistantEnabled !== false;
    child.aiAssistantEnabled = aiAssistantEnabled;

    recordAuditEvent(db, {
      eventType: 'PARENT_SETTING_CHANGE',
      actorId: user.id,
      actorRole: user.role,
      actionType: 'UPDATE_AI_SETTING',
      recordType: 'child_ai_setting',
      recordId: child.id,
      previousValue: { aiAssistantEnabled: previous },
      newValue: { aiAssistantEnabled },
      reason: 'Parent toggled Nono AI Assistant permission',
      ip: getClientIp(req),
      summary: `Parent set aiAssistantEnabled=${aiAssistantEnabled} for child ${child.id}`,
    });
    saveDb(db);

    res.json({
      childId: child.id,
      aiAssistantEnabled: child.aiAssistantEnabled,
      child,
    });
  });

  app.post('/api/ai/nono-chat', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const user = req.authSession!.user;
    const ip = getClientIp(req);

    if (user.role === 'teacher') {
      return res.status(403).json({ error: 'Teachers do not have access to student Nono AI chat.' });
    }

    const body = (req.body || {}) as Partial<NonoAiChatRequest>;
    const childId = typeof body.childId === 'string' ? body.childId.trim() : '';
    if (!childId) {
      return res.status(400).json({ error: 'childId is required' });
    }

    const child = assertChildAccess(req, res, childId);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') {
        return res.status(403).json({ error: 'Please select a valid child profile.' });
      }
      return;
    }

    const familyId = ensureChildFamilyAndGarden(db, child);
    const contentPolicy = db.contentPolicies![familyId] || createDefaultContentPolicy(familyId);
    const privacySettings = db.privacySettings![familyId] || createDefaultPrivacySettings(familyId);

    // Enforce parent toggle + family content policy + explicit privacy AI consent
    if (
      child.aiAssistantEnabled === false ||
      !contentPolicy.aiCompanionEnabled ||
      !privacySettings.aiFeaturesConsent
    ) {
      recordAuditEvent(db, {
        eventType: 'ACCESS_DENIED',
        actorId: user.id,
        actorRole: user.role,
        actionType: 'AI_CHAT_DENIED',
        recordType: 'child_ai',
        recordId: child.id,
        reason: !privacySettings.aiFeaturesConsent
          ? 'AI privacy consent withdrawn'
          : 'Nono AI Assistant disabled by parent',
        outcome: 'denied',
        ip,
        summary: `Blocked AI chat for child ${child.id}: disabled by parent or consent withdrawn`,
      });
      saveDb(db);
      return res.status(403).json({
        error: 'Nono AI Assistant is currently turned off by parent settings or privacy consent.',
        code: 'AI_DISABLED_BY_PARENT',
      });
    }

    // Rate limit per user+child and daily quota
    if (!(await checkRateLimitPg(`ai-chat:${user.id}:${child.id}`, 18, 10 * 60_000))) {
      return res.status(429).json({
        error: 'Too many messages in a short time. Let us take a gentle 5-minute break!',
        code: 'AI_RATE_LIMITED',
      });
    }

    const remaining = getRemainingDailyQuota(db, child.id);
    if (remaining <= 0) {
      return res.status(429).json({
        error: 'Daily Nono AI learning limit reached for today. Come back tomorrow!',
        code: 'AI_DAILY_QUOTA_EXCEEDED',
      });
    }

    const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';
    if (!rawMessage || rawMessage.length > 350) {
      return res.status(400).json({ error: 'Message must be between 1 and 350 characters.' });
    }

    // Child safety & scope guardrails BEFORE external call
    const safety = detectUnsafeOrDisallowedTopic(rawMessage);
    if (safety.blocked) {
      const lang = body.language === 'en' || child.language === 'en' ? 'en' : 'ar';
      appendAiUsageLog(db, child.id, {
        mode: body.mode || 'explain',
        language: lang,
        topic: 'safety-blocked',
        blocked: true,
        voiceUsed: false,
      });
      recordFamilyEvent(db, {
        familyId,
        category: 'ai',
        actionType: 'AI_SAFETY_BLOCKED',
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        childId: child.id,
        childName: child.displayName,
        severity: 'warning',
        title: { ar: 'حماية نونو الذكي من طلب غير مناسب', en: 'Nono AI blocked unsafe/private prompt' },
        description: {
          ar: `أعاد نونو توجيه محادثة الطفل ${child.displayName} بأمان إلى موضوع تعليمي`,
          en: `Nono AI safely redirected ${child.displayName}'s prompt back to educational topics`,
        },
        ip,
        securityEventType: 'AI_SAFETY_BLOCK',
      });
      recordAuditEvent(db, {
        eventType: 'AI_SAFETY_BLOCK',
        actorId: user.id,
        actorRole: user.role,
        actionType: 'AI_SAFETY_BLOCK',
        recordType: 'child_ai',
        recordId: child.id,
        reason: safety.reason,
        outcome: 'blocked',
        ip,
        summary: `Nono AI safety blocked ${safety.kind} prompt for child ${child.id}`,
      });
      saveDb(db);

      const safePayload: NonoAiChatResponse = {
        blocked: true,
        safeRedirect: true,
        mood: 'encouraging',
        recommendedScreen: 'academy',
        usageRemaining: remaining,
        reply:
          lang === 'ar'
            ? 'أنا نونو صديقك للتعلم اللطيف فقط! لا نشارك معلومات شخصية أو طلبات شراء هنا. هيا نستكشف الحروف والأرقام والعلوم معاً!'
            : 'I am Nono, your gentle learning buddy! I do not handle personal details, shopping, or outside web links. Let us explore letters, numbers, or science together!',
        followUpQuestion:
          lang === 'ar'
            ? 'هل نبدأ بتحدي حرف ممتع أم لعبة أرقام ذكية؟'
            : 'Would you like a fun letter puzzle or a smart number challenge?',
      };
      return res.json(safePayload);
    }

    // Strict honesty rule: NEVER fake AI responses if GEMINI_API_KEY is missing
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'Nono AI Assistant requires a server GEMINI_API_KEY configuration.',
        code: 'AI_KEY_MISSING',
      });
    }

    const lang = body.language === 'en' ? 'en' : child.language === 'en' ? 'en' : 'ar';
    const weakSkills = (Object.keys(child.skillProgress) as SkillId[])
      .filter((k) => child.skillProgress[k].attempts > 0 && child.skillProgress[k].accuracy < 75)
      .slice(0, 3)
      .map((k) => SKILL_LABELS[k][lang]);
    const strongSkills = (Object.keys(child.skillProgress) as SkillId[])
      .filter((k) => child.skillProgress[k].accuracy >= 80)
      .slice(0, 3)
      .map((k) => SKILL_LABELS[k][lang]);

    const cleanTopic = sanitizeShortText(body.currentTopic || '', 80);
    const cleanQuestionPrompt = sanitizeShortText(body.currentQuestionPrompt || '', 160);
    const attemptCount = Math.max(0, Math.min(10, Number(body.attemptCount || 0)));
    const mode = body.mode || 'explain';

    const systemInstruction = [
      'You are Nono, a warm, gentle educational companion for Little Explorers (ages 1–4) in NonoLand.',
      `Only use ONLY this single child profile context: Name=${sanitizeShortText(child.displayName, 30)}, Stage=${child.ageGroup}, Language=${lang}, Level=${child.level}.`,
      strongSkills.length > 0 ? `Strong areas: ${strongSkills.join(', ')}.` : '',
      weakSkills.length > 0 ? `Gentle practice areas: ${weakSkills.join(', ')}.` : '',
      'STRICT RULES:',
      '1. Stay strictly within safe child-friendly educational topics: Arabic letters, English phonics, counting/math, colors/shapes, animals, science, reading, creative play, positive habits.',
      '2. NEVER ask for personal information (full name, phone, address, school, email).',
      '3. NEVER tell the child to make a purchase or alter account settings.',
      '4. If helping with a question, give a PROGRESSIVE HINT first — DO NOT reveal the final direct answer immediately unless attemptCount >= 2.',
      `5. Respond in ${lang === 'ar' ? 'simple warm Arabic suitable for children' : 'simple warm English suitable for children'}.`,
      '6. Keep replies concise (2-4 short sentences for kids) and follow the JSON response schema strictly.',
    ]
      .filter(Boolean)
      .join('\n');

    const userPrompt = [
      `Mode: ${mode}, AttemptCount: ${attemptCount}`,
      cleanTopic ? `Topic: ${cleanTopic}` : '',
      cleanQuestionPrompt ? `Active question context: ${cleanQuestionPrompt}` : '',
      `Child message: ${rawMessage}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const jsonSchemaConfig = {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          hint: { type: Type.STRING },
          explanation: { type: Type.STRING },
          followUpQuestion: { type: Type.STRING },
          recommendedScreen: { type: Type.STRING },
          mood: { type: Type.STRING },
        },
        required: ['reply', 'mood'],
      };

      const callPrimaryHydrogen = () =>
        withTimeout(
          (abortSignal) =>
            ai.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents: userPrompt,
              config: {
                abortSignal,
                systemInstruction,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                responseMimeType: 'application/json',
                responseSchema: jsonSchemaConfig,
              },
            }),
          15000,
          'Primary Gemini model (gemini-4-hydrogen) timed out after 15s',
        );

      const callLiteFallback = () =>
        withTimeout(
          (abortSignal) =>
            ai.models.generateContent({
              model: 'gemini-3.1-flash-lite',
              contents: userPrompt,
              config: {
                abortSignal,
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: jsonSchemaConfig,
              },
            }),
          18000,
          'Nono AI response timed out',
        );

      let response;
      try {
        response = await callPrimaryHydrogen();
      } catch (firstErr) {
        const msg = firstErr instanceof Error ? firstErr.message : String(firstErr ?? '');
        const status =
          typeof (firstErr as { status?: unknown })?.status === 'number'
            ? (firstErr as { status: number }).status
            : undefined;
        console.warn(
          `[NonoAI Chat] primary gemini-4-hydrogen ${firstErr instanceof AiTimeoutError ? 'timeout' : 'error'} (${msg.slice(0, 100)}), trying gemini-3.1-flash-lite`,
        );
        const shouldFallback =
          firstErr instanceof AiTimeoutError ||
          status === 503 ||
          status === 429 ||
          status === 500 ||
          status === 404 ||
          msg.includes('503') ||
          msg.includes('429') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('Too Many Requests') ||
          msg.includes('high demand') ||
          msg.includes('404') ||
          msg.includes('NOT_FOUND') ||
          msg.includes('500');
        if (shouldFallback) {
          response = await callLiteFallback();
        } else {
          throw firstErr;
        }
      }

      const rawText = (response.text || '').trim();
      let parsed: Partial<NonoAiChatResponse> = {};
      try {
        parsed = JSON.parse(rawText) as Partial<NonoAiChatResponse>;
      } catch {
        parsed = {
          reply: rawText.slice(0, 400) || (lang === 'ar' ? 'أهلاً بك يا بطل! لنتعلم خطوة بخطوة.' : 'Hello explorer! Let us learn step by step.'),
        };
      }

      const validScreens = new Set<AppScreen>([
        'academy',
        'reading-adventure',
        'discovery-lab',
        'stories',
        'entertainment-hub',
        'home',
      ]);
      const validMoods = new Set<NonoMood>([
        'idle',
        'thinking',
        'excited',
        'encouraging',
        'celebrating',
        'waving',
      ]);

      const nextRemaining = incrementDailyQuota(db, child.id);
      appendAiUsageLog(db, child.id, {
        mode,
        language: lang,
        topic: cleanTopic || 'general',
        blocked: false,
        voiceUsed: false,
      });
      recordAuditEvent(db, {
        eventType: 'AI_CHAT',
        actorId: user.id,
        actorRole: user.role,
        actionType: 'AI_TUTOR_RESPONSE',
        recordType: 'child_ai',
        recordId: child.id,
        newValue: { mode, topic: cleanTopic || 'general' },
        reason: 'Child-safe Nono AI educational reply delivered',
        ip,
        summary: `Nono AI replied (${mode}) for child ${child.id}`,
      });
      saveDb(db);

      const safeResult: NonoAiChatResponse = {
        reply: sanitizeShortText(parsed.reply || '', 500),
        hint: parsed.hint ? sanitizeShortText(parsed.hint, 260) : undefined,
        explanation: parsed.explanation ? sanitizeShortText(parsed.explanation, 320) : undefined,
        followUpQuestion: parsed.followUpQuestion
          ? sanitizeShortText(parsed.followUpQuestion, 200)
          : undefined,
        recommendedScreen:
          parsed.recommendedScreen && validScreens.has(parsed.recommendedScreen)
            ? parsed.recommendedScreen
            : 'academy',
        mood: parsed.mood && validMoods.has(parsed.mood) ? parsed.mood : 'encouraging',
        blocked: false,
        usageRemaining: nextRemaining,
      };
      return res.json(safeResult);
    } catch (err) {
      const isTimeout = err instanceof AiTimeoutError;
      const msg = err instanceof Error ? err.message : 'Upstream AI error';
      console.error(`[NonoAI Chat] ${isTimeout ? 'timeout' : 'upstream_error'}: ${msg.slice(0, 140)}`);
      recordAuditEvent(db, {
        eventType: 'AI_CHAT',
        actorId: user.id,
        actorRole: user.role,
        actionType: isTimeout ? 'AI_TUTOR_TIMEOUT' : 'AI_TUTOR_ERROR',
        recordType: 'child_ai',
        recordId: child.id,
        reason: msg.slice(0, 120),
        outcome: 'error',
        ip,
        summary: `Nono AI ${isTimeout ? 'timeout' : 'upstream error'} for child ${child.id}`,
      });
      saveDb(db);
      if (isTimeout) {
        return res.status(504).json({
          error: 'Nono AI took a little too long to reply. Please try asking again.',
          code: 'AI_TIMEOUT',
        });
      }
      return res.status(502).json({
        error: 'Nono AI service is temporarily unavailable right now. Please try again in a moment.',
        code: 'AI_UPSTREAM_ERROR',
      });
    }
  });

  // Signed ephemeral TTS audio clip delivery (GET/HEAD + RFC-7233 206 byte-range support for Android WebView)
  app.get('/api/ai/tts-clip/:clipFile', (req, res) => {
    const rawFile = String(req.params.clipFile || '').trim();
    const match = /^([a-f0-9]{16,40})(?:\.(mp3|wav|ogg))?$/i.exec(rawFile);
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!match || !token) {
      return res.status(400).json({ error: 'Invalid or missing clip token.' });
    }

    const clip = verifyAndGetEphemeralClip(match[1], token);
    if (!clip) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ error: 'Audio clip expired or not found.' });
    }

    const buf = clip.buffer;
    const total = buf.length;
    res.setHeader('Content-Type', clip.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');

    const rangeHeader = req.headers.range;
    if (typeof rangeHeader === 'string' && rangeHeader.trim()) {
      const m = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
      if (!m || (!m[1] && !m[2])) {
        res.setHeader('Content-Range', `bytes */${total}`);
        return res.status(416).end();
      }
      let start = m[1] ? Number.parseInt(m[1], 10) : 0;
      let end = m[2] ? Number.parseInt(m[2], 10) : total - 1;
      if (!m[1] && m[2]) {
        const suffixLen = Number.parseInt(m[2], 10);
        start = Math.max(0, total - suffixLen);
        end = total - 1;
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= total || total === 0) {
        res.setHeader('Content-Range', `bytes */${total}`);
        return res.status(416).end();
      }
      end = Math.min(end, total - 1);
      const slice = buf.subarray(start, end + 1);
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', String(slice.length));
      if (req.method === 'HEAD') {
        return res.end();
      }
      return res.end(slice);
    }

    res.status(200);
    res.setHeader('Content-Length', String(total));
    if (req.method === 'HEAD') {
      return res.end();
    }
    return res.end(buf);
  });

  // Optional Gemini Voice Companion TTS Synthesis (Server-side key, privacy/voice consent enforced)
  app.post('/api/ai/tts', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const user = req.authSession!.user;
    if (user.role === 'teacher') {
      return res.status(403).json({ error: 'Teachers do not use student voice companion.' });
    }

    const { childId, text, voiceName, language } = (req.body || {}) as {
      childId?: string;
      text?: string;
      voiceName?: string;
      language?: 'ar' | 'en';
    };

    const child = childId ? assertChildAccess(req, res, childId) : null;
    if (child && child !== 'untracked-sample') {
      const familyId = ensureChildFamilyAndGarden(db, child);
      const policy = db.contentPolicies![familyId] || createDefaultContentPolicy(familyId);
      const privacy = db.privacySettings![familyId] || createDefaultPrivacySettings(familyId);
      if (
        child.aiAssistantEnabled === false ||
        !policy.aiCompanionEnabled ||
        !policy.voiceInteractionEnabled ||
        !privacy.aiFeaturesConsent ||
        !privacy.voiceInteractionConsent
      ) {
        return res.status(403).json({
          error: 'Nono Voice Companion is turned off by parent controls or privacy consent.',
          code: 'VOICE_DISABLED_BY_PARENT',
        });
      }
    } else if (!childId) {
      return res.status(400).json({ error: 'childId is required' });
    }

    const cleanText = sanitizeShortText(text || '', 320);
    if (!cleanText) {
      return res.status(400).json({ error: 'text is required', code: 'INVALID_TTS_INPUT' });
    }

    if (!(await checkRateLimitPg(`ai-tts:${user.id}`, 30, 10 * 60_000))) {
      return res.status(429).json({
        error: 'Voice rate limit reached. Try again shortly.',
        code: 'TTS_RATE_LIMITED',
        retryable: true,
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: 'Server voice synthesis requires GEMINI_API_KEY.',
        code: 'AI_KEY_MISSING',
        retryable: false,
      });
    }

    const requestId = `tts_${crypto.randomBytes(6).toString('hex')}`;
    const lang = language === 'en' ? 'en' : 'ar';
    const chosenVoice =
      voiceName && new Set(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']).has(voiceName)
        ? voiceName
        : 'Zephyr';

    const style =
      lang === 'ar'
        ? 'Warm, gentle, friendly Arabic companion voice for young children ages 1 to 4.'
        : 'Warm, gentle, friendly English companion voice for young children ages 1 to 4.';

    const synth = await synthesizeSpeechAudio({
      text: cleanText,
      voiceName: chosenVoice,
      language: lang,
      style,
      requestId,
      routeTag: '/api/ai/tts',
      allowMemoryCache: true,
      withEphemeralClip: true,
    });

    if (!synth.ok) {
      return res.status(synth.httpStatus).json({
        error: synth.message,
        code: synth.code,
        retryable: synth.retryable,
        requestId: synth.requestId,
        model: synth.model,
        httpStatus: synth.httpStatus,
        detail: synth.sanitizedDetail,
      });
    }

    if (child && child !== 'untracked-sample') {
      appendAiUsageLog(db, child.id, {
        mode: 'voice-tts',
        language: lang,
        topic: synth.voiceName,
        blocked: false,
        voiceUsed: true,
      });
      saveDb(db);
    }

    const ext = synth.mimeType === 'audio/mpeg' ? 'mp3' : synth.mimeType === 'audio/ogg' ? 'ogg' : 'wav';
    const audioUrl =
      synth.clipId && synth.clipToken
        ? `/api/ai/tts-clip/${synth.clipId}.${ext}?token=${encodeURIComponent(synth.clipToken)}`
        : undefined;

    return res.json({
      audioUrl,
      audioBase64: synth.audioBase64,
      mimeType: synth.mimeType,
      voiceName: synth.voiceName,
      model: synth.model,
      requestId: synth.requestId,
      cached: synth.cached,
      bytes: synth.bytes,
    });
  });
}
