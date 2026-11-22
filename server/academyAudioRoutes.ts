import fs from 'node:fs';
import type express from 'express';
import {
  ACADEMY_LOOKUP_FILE,
  ACADEMY_MANIFEST_FILE,
  diagnoseGeminiTtsAvailability,
  getAcademyBatchStatus,
  requestStopAcademyBatch,
  startAcademyAudioBatchGeneration,
  syncAndValidateAcademyManifest,
} from './academyAudioService';
import type { AcademyAudioManifestDocument } from './academyAudioManifestBuilder';
import type { AuthenticatedRequest } from './dbTypes';
import { isAdminRole } from './security';
import { FALLBACK_TTS_MODEL, PRIMARY_TTS_MODEL } from './ttsService';

interface AcademyAudioRouteDeps {
  app: express.Express;
}

function isAuthorizedBatchOperator(req: AuthenticatedRequest): boolean {
  if (req.authSession && isAdminRole(req.authSession.user.role)) {
    return true;
  }
  // Allow direct loopback maintenance CLI on 127.0.0.1 (no proxy header)
  const forwarded = req.headers['x-forwarded-for'];
  const remote = req.socket?.remoteAddress || '';
  if (
    !forwarded &&
    (remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1')
  ) {
    return true;
  }
  return false;
}

export function registerAcademyAudioRoutes({ app }: AcademyAudioRouteDeps) {
  app.get('/api/academy/tts-status', (_req, res) => {
    let validCount = 0;
    let totalAssets = 0;
    if (fs.existsSync(ACADEMY_MANIFEST_FILE)) {
      try {
        const doc = JSON.parse(fs.readFileSync(ACADEMY_MANIFEST_FILE, 'utf8')) as Partial<AcademyAudioManifestDocument>;
        validCount = doc.validCount || 0;
        totalAssets = doc.totalAssets || 0;
      } catch {
        // ignore
      }
    }
    res.json({
      configured: Boolean(process.env.GEMINI_API_KEY),
      academyAudioMode: 'pregenerated-mp3',
      runtimeTtsDisabledForAcademy: true,
      primaryModel: PRIMARY_TTS_MODEL,
      fallbackModel: FALLBACK_TTS_MODEL,
      manifestSummary: {
        totalAssets,
        validCount,
        lookupReady: fs.existsSync(ACADEMY_LOOKUP_FILE),
      },
    });
  });

  app.get('/api/academy/audio/diagnose-models', async (req: AuthenticatedRequest, res) => {
    if (!isAuthorizedBatchOperator(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    try {
      const diag = await diagnoseGeminiTtsAvailability();
      return res.json(diag);
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Model diagnosis failed',
      });
    }
  });

  app.get('/api/academy/audio-manifest', async (req, res) => {
    try {
      let doc: AcademyAudioManifestDocument;
      if (fs.existsSync(ACADEMY_MANIFEST_FILE) && req.query.rescan !== '1') {
        doc = JSON.parse(fs.readFileSync(ACADEMY_MANIFEST_FILE, 'utf8')) as AcademyAudioManifestDocument;
      } else {
        doc = await syncAndValidateAcademyManifest({
          checkVolume: req.query.checkVolume === '1',
          migrateLegacy: true,
        });
      }
      const includeItems = req.query.includeItems === '1';
      res.json({
        version: doc.version,
        generatedAt: doc.generatedAt,
        totalAssets: doc.totalAssets,
        arabicAssets: doc.arabicAssets,
        englishAssets: doc.englishAssets,
        readyCount: doc.readyCount,
        validCount: doc.validCount,
        missingCount: doc.missingCount,
        invalidCount: doc.invalidCount,
        ...(includeItems ? { items: doc.items } : {}),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to inspect Academy audio manifest',
      });
    }
  });

  app.get('/api/academy/audio/batch-status', (_req, res) => {
    res.json(getAcademyBatchStatus());
  });

  app.post('/api/academy/audio/prepare-batch', async (req: AuthenticatedRequest, res) => {
    if (!isAuthorizedBatchOperator(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const body = (req.body || {}) as {
      limit?: number;
      delayMs?: number;
      validateExisting?: boolean;
      syncOnly?: boolean;
      awaitCompletion?: boolean;
      preferredModel?: string;
      singleModelOnly?: boolean;
      stopOn429?: boolean;
      language?: 'ar' | 'en';
      minTextLength?: number;
    };

    if (body.syncOnly) {
      const doc = await syncAndValidateAcademyManifest({
        checkVolume: Boolean(body.validateExisting),
        migrateLegacy: true,
      });
      return res.json({
        ok: true,
        totalAssets: doc.totalAssets,
        validCount: doc.validCount,
        missingCount: doc.missingCount,
        invalidCount: doc.invalidCount,
      });
    }

    const promise = startAcademyAudioBatchGeneration({
      limit: typeof body.limit === 'number' ? body.limit : undefined,
      delayMs: typeof body.delayMs === 'number' ? body.delayMs : undefined,
      validateExisting: Boolean(body.validateExisting),
      preferredModel: typeof body.preferredModel === 'string' ? body.preferredModel : undefined,
      singleModelOnly: Boolean(body.singleModelOnly),
      stopOn429: typeof body.stopOn429 === 'boolean' ? body.stopOn429 : true,
      language: body.language === 'ar' || body.language === 'en' ? body.language : undefined,
      minTextLength: typeof body.minTextLength === 'number' ? body.minTextLength : undefined,
    });

    if (body.awaitCompletion) {
      const result = await promise;
      return res.json(result);
    }

    return res.status(202).json({
      accepted: true,
      status: getAcademyBatchStatus(),
    });
  });

  app.post('/api/academy/audio/stop-batch', (req: AuthenticatedRequest, res) => {
    if (!isAuthorizedBatchOperator(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    requestStopAcademyBatch();
    return res.json({ ok: true, status: getAcademyBatchStatus() });
  });

  // Academy uses pre-generated static MP3 assets exclusively — never runtime Gemini TTS
  app.post('/api/academy/tts', (_req, res) => {
    return res.status(410).json({
      error: 'Academy audio now uses pre-generated MP3 assets exclusively; runtime TTS is disabled.',
      code: 'ACADEMY_PREGENERATED_ONLY',
      retryable: false,
    });
  });
}
