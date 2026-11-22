import crypto from 'node:crypto';
import {
  ACADEMY_COLORS,
  ACADEMY_SHAPES,
  ARABIC_ALPHABET,
  COLOR_MIX_RECIPES,
  ENGLISH_ALPHABET,
  PARENT_OFFLINE_ACTIVITIES,
} from '../src/data/academyData';
import {
  buildArabicDeepJourney,
  buildColorDeepJourney,
  buildEnglishDeepJourney,
  MATH_DEEP_UNITS,
  VALIDATED_EXAM_BANK,
} from '../src/data/deepCurriculum';
import { ALL_LEVEL1_LESSONS } from '../src/data/level1Curriculum';
import { LEVEL1_QUESTION_BANK } from '../src/data/level1QuestionBank';
import {
  type AcademyAudioLang,
  normalizeAcademyAudioText,
  resolveLevel1VocabSpokenText,
} from '../src/utils/academyAudioText';

export interface AcademyAudioManifestItem {
  assetId: string;
  legacyCacheKey: string;
  text: string;
  language: AcademyAudioLang;
  screens: string[];
  lessonIds: string[];
  activityOrStageIds: string[];
  mp3Path: string;
  audioUrl: string;
  generationStatus: 'pending' | 'ready' | 'failed';
  validationStatus: 'pending' | 'valid' | 'invalid' | 'missing';
  bytes: number;
  durationSeconds: number | null;
  maxVolumeDb: number | null;
  model?: string;
  voiceName?: string;
  lastError?: string;
  updatedAt?: string;
}

export interface AcademyAudioManifestDocument {
  version: number;
  generatedAt: string;
  totalAssets: number;
  arabicAssets: number;
  englishAssets: number;
  readyCount: number;
  validCount: number;
  missingCount: number;
  invalidCount: number;
  items: AcademyAudioManifestItem[];
}

export function computeAcademyAssetId(text: string, language: AcademyAudioLang): string {
  const normalized = normalizeAcademyAudioText(text);
  const hash = crypto
    .createHash('sha256')
    .update(`academy|${language}|${normalized}`)
    .digest('hex')
    .slice(0, 16);
  return `${language}_${hash}`;
}

export function computeLegacyAcademyCacheKey(text: string, language: AcademyAudioLang): string {
  const normalized = normalizeAcademyAudioText(text);
  return crypto
    .createHash('sha256')
    .update(`academy|${language}|${normalized}`)
    .digest('hex')
    .slice(0, 28);
}

const CVC_WORDS = ['CAT', 'BAT', 'SUN', 'DOG', 'MAP', 'PEN', 'RED', 'BOX', 'HAT', 'CUP'];

export function buildFullAcademyAudioManifest(
  existingItems: AcademyAudioManifestItem[] = [],
): AcademyAudioManifestDocument {
  const existingByKey = new Map<string, AcademyAudioManifestItem>();
  for (const prev of existingItems) {
    existingByKey.set(`${prev.language}|${normalizeAcademyAudioText(prev.text)}`, prev);
  }

  const acc = new Map<
    string,
    {
      text: string;
      language: AcademyAudioLang;
      screens: Set<string>;
      lessonIds: Set<string>;
      activityOrStageIds: Set<string>;
    }
  >();

  const add = (
    rawText: string | undefined | null,
    language: AcademyAudioLang,
    screen: string,
    lessonId: string,
    activityOrStageId: string,
  ) => {
    const clean = normalizeAcademyAudioText(rawText || '');
    if (!clean) return;
    const key = `${language}|${clean}`;
    let entry = acc.get(key);
    if (!entry) {
      entry = {
        text: clean,
        language,
        screens: new Set(),
        lessonIds: new Set(),
        activityOrStageIds: new Set(),
      };
      acc.set(key, entry);
    }
    entry.screens.add(screen);
    entry.lessonIds.add(lessonId);
    entry.activityOrStageIds.add(activityOrStageId);
  };

  // 1. Arabic Alphabet (AcademyScreen Tab + Daily Path)
  for (const ar of ARABIC_ALPHABET) {
    add(`${ar.nameAr}، ${ar.word}`, 'ar', 'AcademyScreen:arabic', ar.id, 'letter-word-pair');
    add(ar.char, 'ar', 'AcademyScreen:arabic', ar.id, 'letter-char');
    add(ar.nameAr, 'ar', 'AcademyScreen:arabic', ar.id, 'letter-name');
    add(ar.word, 'ar', 'AcademyScreen:arabic', ar.id, 'letter-word');
  }

  // 2. English Alphabet & CVC Words (AcademyScreen Tab + Daily Path)
  for (const en of ENGLISH_ALPHABET) {
    add(`${en.upper}. ${en.word}`, 'en', 'AcademyScreen:english', en.id, 'letter-word-pair');
    add(en.upper, 'en', 'AcademyScreen:english', en.id, 'letter-upper');
    add(en.lower, 'en', 'AcademyScreen:english', en.id, 'letter-lower');
    add(en.word, 'en', 'AcademyScreen:english', en.id, 'letter-word');
  }
  for (const cvc of CVC_WORDS) {
    add(cvc, 'en', 'AcademyScreen:english', `cvc-${cvc}`, 'cvc-builder');
  }

  // 3. Numbers (0..20 AR & EN)
  for (let n = 0; n <= 20; n++) {
    add(String(n), 'ar', 'AcademyScreen:numbers', `num-${n}`, 'number-tap');
    add(String(n), 'en', 'AcademyScreen:numbers', `num-${n}`, 'number-tap');
  }

  // 4. Colors, Mixing Lab & Shapes (AcademyScreen Tab + Daily Path)
  for (const col of ACADEMY_COLORS) {
    add(col.name.ar, 'ar', 'AcademyScreen:colors-shapes', `color-${col.id}`, 'color-card');
    add(col.name.en, 'en', 'AcademyScreen:colors-shapes', `color-${col.id}`, 'color-card');
  }
  for (const recipe of COLOR_MIX_RECIPES) {
    add(recipe.explanation.ar, 'ar', 'AcademyScreen:colors-shapes', `mix-${recipe.a}-${recipe.b}`, 'color-mix-explanation');
    add(recipe.explanation.en, 'en', 'AcademyScreen:colors-shapes', `mix-${recipe.a}-${recipe.b}`, 'color-mix-explanation');
  }
  for (const sh of ACADEMY_SHAPES) {
    add(sh.name.ar, 'ar', 'AcademyScreen:colors-shapes', `shape-${sh.id}`, 'shape-card');
    add(sh.name.en, 'en', 'AcademyScreen:colors-shapes', `shape-${sh.id}`, 'shape-card');
  }

  // 5. Daily Path & Offline Activities
  for (const act of PARENT_OFFLINE_ACTIVITIES) {
    add(`${act.title.ar}. ${act.desc.ar}`, 'ar', 'AcademyScreen:daily', act.id, 'offline-discovery');
    add(`${act.title.en}. ${act.desc.en}`, 'en', 'AcademyScreen:daily', act.id, 'offline-discovery');
  }

  // 6. All 75 Level 1 Lessons (Level1LessonRunner stages 1-9)
  for (const ls of ALL_LEVEL1_LESSONS) {
    const langsForLesson: AcademyAudioLang[] =
      ls.subject === 'arabic'
        ? ['ar']
        : ls.subject === 'english'
          ? ['en']
          : ['ar', 'en'];

    for (const lg of langsForLesson) {
      add(ls.characterIntro[lg], lg, 'Level1LessonRunner', ls.id, 'stage1-intro');
      add(ls.title[lg], lg, 'Level1LessonRunner', ls.id, 'stage3-normal-title');
      add(ls.explanation[lg], lg, 'Level1LessonRunner', ls.id, 'stage2-explanation');

      if (ls.subject === 'colors') {
        const targetColor = lg === 'en' ? ls.secondarySymbol || ls.targetSymbol : ls.targetSymbol;
        const firstVocab = ls.teachingVocab[0]
          ? resolveLevel1VocabSpokenText(ls.subject, ls.teachingVocab[0], lg, ls.numberValue, ls.secondarySymbol)
          : '';
        add(targetColor, lg, 'Level1LessonRunner', ls.id, 'stage5-listen-select');
        if (firstVocab) {
          add(
            lg === 'en' ? `${targetColor}. ${firstVocab}` : `${targetColor}، ${firstVocab}`,
            lg,
            'Level1LessonRunner',
            ls.id,
            'stage3-slow-cue',
          );
        }
      } else if (ls.subject === 'numbers') {
        const targetNumWord = lg === 'ar'
          ? ls.secondarySymbol || String(ls.numberValue ?? ls.targetSymbol)
          : String(ls.numberValue ?? ls.targetSymbol);
        const firstVocab = ls.teachingVocab[0]
          ? resolveLevel1VocabSpokenText(ls.subject, ls.teachingVocab[0], lg, ls.numberValue, ls.secondarySymbol)
          : '';
        add(targetNumWord, lg, 'Level1LessonRunner', ls.id, 'stage5-listen-select');
        if (firstVocab && firstVocab !== targetNumWord) {
          add(
            lg === 'en' ? `${targetNumWord}. ${firstVocab}` : `${targetNumWord}، ${firstVocab}`,
            lg,
            'Level1LessonRunner',
            ls.id,
            'stage3-slow-cue',
          );
        }
      } else {
        add(ls.targetSymbol, lg, 'Level1LessonRunner', ls.id, 'stage5-listen-select');
        const firstVocab = ls.teachingVocab[0]?.text || '';
        if (firstVocab) {
          add(
            lg === 'en' ? `${ls.targetSymbol}. ${firstVocab}` : `${ls.targetSymbol}، ${firstVocab}`,
            lg,
            'Level1LessonRunner',
            ls.id,
            'stage3-slow-cue',
          );
        }
      }

      for (const v of [...ls.teachingVocab, ...ls.unseenVocab]) {
        const spoken = resolveLevel1VocabSpokenText(
          ls.subject,
          v,
          lg,
          ls.numberValue,
          ls.secondarySymbol,
        );
        add(spoken, lg, 'Level1LessonRunner', ls.id, `vocab-${v.id}`);
      }
    }
  }

  // 7. All 750 Level 1 Question Bank items (Stage 10 assessment)
  for (const q of LEVEL1_QUESTION_BANK) {
    if (q.audioText) {
      add(q.audioText, q.audioLang || 'ar', 'Level1LessonRunner:stage10', q.lessonId, `quiz-${q.id}`);
    }
  }

  // 8. Deep Journey — Color (8 Colors × AR & EN)
  for (const col of ACADEMY_COLORS) {
    const cd = buildColorDeepJourney(col.id);
    const lid = `deep-color-${col.id}`;
    add(cd.introLine.ar, 'ar', 'DeepLessonEngine:color', lid, 'stage1-intro');
    add(cd.introLine.en, 'en', 'DeepLessonEngine:color', lid, 'stage1-intro');
    for (const ex of cd.realWorldExamples) {
      add(ex.label.ar, 'ar', 'DeepLessonEngine:color', lid, 'stage2-examples');
      add(ex.label.en, 'en', 'DeepLessonEngine:color', lid, 'stage2-examples');
    }
    add(col.name.ar, 'ar', 'DeepLessonEngine:color', lid, 'stage3-listen');
    add(col.name.en, 'en', 'DeepLessonEngine:color', lid, 'stage3-listen');
    for (const ua of cd.unseenAssessment) {
      add(ua.prompt.ar, 'ar', 'DeepLessonEngine:color', lid, 'stage10-assessment');
      add(ua.prompt.en, 'en', 'DeepLessonEngine:color', lid, 'stage10-assessment');
    }
  }

  // 9. Deep Journey — Arabic Letters (28 Letters)
  for (const ar of ARABIC_ALPHABET) {
    const ad = buildArabicDeepJourney(ar.id);
    const lid = `deep-ar-${ar.id}`;
    add(ad.introLine.ar, 'ar', 'DeepLessonEngine:arabic', lid, 'stage1-intro');
    add(ad.nameAr, 'ar', 'DeepLessonEngine:arabic', lid, 'stage2-name');
    for (const ex of ad.examples) {
      add(ex.word, 'ar', 'DeepLessonEngine:arabic', lid, 'stage2-5-word');
    }
    add(ad.readingSentences['1-2'].ar, 'ar', 'DeepLessonEngine:arabic', lid, 'stage10-reading-1-2');
    add(ad.readingSentences['2-3'].ar, 'ar', 'DeepLessonEngine:arabic', lid, 'stage10-reading-2-3');
    add(ad.readingSentences['3-4'].ar, 'ar', 'DeepLessonEngine:arabic', lid, 'stage10-reading-3-4');
    add(ad.unseenAssessmentWord.word, 'ar', 'DeepLessonEngine:arabic', lid, 'stage11-assessment');
  }

  // 10. Deep Journey — English Letters (26 Letters)
  for (const en of ENGLISH_ALPHABET) {
    const ed = buildEnglishDeepJourney(en.id);
    const lid = `deep-en-${en.id}`;
    add(`${ed.upper}. ${ed.word}`, 'en', 'DeepLessonEngine:english', lid, 'stage1-2-intro');
    add(ed.word, 'en', 'DeepLessonEngine:english', lid, 'stage5-9-word');
    add(ed.cvcWord, 'en', 'DeepLessonEngine:english', lid, 'stage9-cvc');
    add(ed.readingSentence['1-2'].en, 'en', 'DeepLessonEngine:english', lid, 'stage10-reading-1-2');
    add(ed.readingSentence['2-3'].en, 'en', 'DeepLessonEngine:english', lid, 'stage10-reading-2-3');
    add(ed.readingSentence['3-4'].en, 'en', 'DeepLessonEngine:english', lid, 'stage10-reading-3-4');
  }

  // 11. Deep Journey — Math Units (3 Units × AR & EN)
  for (const mu of MATH_DEEP_UNITS) {
    add(mu.explanation.ar, 'ar', 'DeepLessonEngine:math', mu.id, 'stage1-explanation');
    add(mu.explanation.en, 'en', 'DeepLessonEngine:math', mu.id, 'stage1-explanation');
    add(mu.operationPrompt.ar, 'ar', 'DeepLessonEngine:math', mu.id, 'stage4-operation-prompt');
    add(mu.operationPrompt.en, 'en', 'DeepLessonEngine:math', mu.id, 'stage4-operation-prompt');
    add(mu.wordProblem.prompt.ar, 'ar', 'DeepLessonEngine:math', mu.id, 'stage5-6-word-problem');
    add(mu.wordProblem.prompt.en, 'en', 'DeepLessonEngine:math', mu.id, 'stage5-6-word-problem');
  }

  // 12. Validated Exam Bank (ExamsScreen) — ensures official Academy exams also use pre-recorded MP3s
  for (const eq of VALIDATED_EXAM_BANK) {
    if (eq.audioText) {
      add(eq.audioText, eq.audioLang || 'ar', 'ExamsScreen', eq.lessonRefId, `exam-${eq.id}`);
    }
  }

  // Convert accumulated map to sorted manifest items, preserving existing statuses
  const items: AcademyAudioManifestItem[] = [];
  for (const [key, val] of acc.entries()) {
    const assetId = computeAcademyAssetId(val.text, val.language);
    const legacyCacheKey = computeLegacyAcademyCacheKey(val.text, val.language);
    const mp3Path = `public/assets/audio/academy/${val.language}/${assetId}.mp3`;
    const audioUrl = `/assets/audio/academy/${val.language}/${assetId}.mp3`;
    const prev = existingByKey.get(key);

    items.push({
      assetId,
      legacyCacheKey,
      text: val.text,
      language: val.language,
      screens: Array.from(val.screens).sort(),
      lessonIds: Array.from(val.lessonIds).sort(),
      activityOrStageIds: Array.from(val.activityOrStageIds).sort(),
      mp3Path,
      audioUrl,
      generationStatus: prev?.generationStatus || 'pending',
      validationStatus: prev?.validationStatus || 'pending',
      bytes: prev?.bytes || 0,
      durationSeconds: prev?.durationSeconds ?? null,
      maxVolumeDb: prev?.maxVolumeDb ?? null,
      model: prev?.model,
      voiceName: prev?.voiceName,
      lastError: prev?.lastError,
      updatedAt: prev?.updatedAt,
    });
  }

  items.sort((a, b) => {
    if (a.language !== b.language) return a.language.localeCompare(b.language);
    return a.assetId.localeCompare(b.assetId);
  });

  const arabicAssets = items.filter((i) => i.language === 'ar').length;
  const englishAssets = items.filter((i) => i.language === 'en').length;
  const readyCount = items.filter((i) => i.generationStatus === 'ready').length;
  const validCount = items.filter((i) => i.validationStatus === 'valid').length;
  const missingCount = items.filter((i) => i.validationStatus === 'missing' || i.validationStatus === 'pending').length;
  const invalidCount = items.filter((i) => i.validationStatus === 'invalid').length;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalAssets: items.length,
    arabicAssets,
    englishAssets,
    readyCount,
    validCount,
    missingCount,
    invalidCount,
    items,
  };
}
