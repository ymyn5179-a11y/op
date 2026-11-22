import crypto from 'crypto';
import type express from 'express';
import { evaluateSkillUpdate } from '../src/engine/adaptiveEngine';
import type {
  AdaptiveDifficultyTier,
  AgeGroupId,
  AppScreen,
  AssessmentResult,
  EmotionalFeedbackPayload,
  Language,
  LocalizedText,
  OfficialCharacterId,
  SkillId,
  SmartAssessmentFormat,
  SmartAssessmentQuestionPublic,
  SmartAssessmentStartResponse,
  SmartAssessmentSubmitResponse,
  StoredAgeGroupId,
  WorldId,
} from '../src/types/nonoland';
import {
  getInternalAgeBand,
  isContentAppropriateForChild,
  UNIFIED_STAGE_ID,
} from '../src/utils/ageAdaptation';
import { recordAuditEvent } from './auditLog';
import type { AuthenticatedRequest, ServerDb, StoredChildRecord } from './dbTypes';
import { getClientIp } from './security';

interface SmartAssessmentRouteDeps {
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

interface InternalSmartQuestion extends SmartAssessmentQuestionPublic {
  correctOptionId?: string;
  correctPairs?: Record<string, string>; // pairId -> right value
  correctSortMap?: Record<string, string>; // visual -> bucketId
  correctSequence?: string[];
  hintText: LocalizedText;
  workedExample: { visual: string; explanation: LocalizedText };
  simplifiedSteps: LocalizedText[];
  revisionScreen: AppScreen;
  worldId: WorldId;
}

const SMART_BANK: InternalSmartQuestion[] = [
  // 1. MCQ
  {
    id: 'sa-mcq-ar-alef',
    format: 'mcq',
    domain: 'arabic',
    skillId: 'arabic-literacy',
    difficulty: 'easy',
    ageGroups: ['1-4'],
    recommendedAgeRange: '2-3',
    worldId: 'arabic-letters',
    revisionScreen: 'reading-adventure',
    prompt: { ar: 'أي كلمة تبدأ بحرف الألف (أ)؟', en: 'Which word starts with the Arabic letter Alef (أ)?' },
    visualCue: 'أ',
    options: [
      { id: 'opt-lion', label: { ar: 'أسد', en: 'Asad (Lion)' }, visual: '🦁' },
      { id: 'opt-duck', label: { ar: 'بطة', en: 'Batta (Duck)' }, visual: '🦆' },
      { id: 'opt-apple', label: { ar: 'تفاحة', en: 'Tuffaha (Apple)' }, visual: '🍎' },
    ],
    correctOptionId: 'opt-lion',
    hintText: { ar: 'اسمع أول صوت في الكلمة: أَ.. أَ.. أَسَد!', en: 'Listen to the first sound: A.. A.. Asad!' },
    workedExample: {
      visual: 'أ ⬅️ 🦁 أسد',
      explanation: { ar: 'حرف الألف (أ) يبدأ بصوت "أَ" مثل كلمة أسد.', en: 'Alef (أ) begins with the "A" sound as in Asad (Lion).' },
    },
    simplifiedSteps: [
      { ar: 'انطق اسم الصورة بصوت هادئ.', en: 'Say each picture name softly.' },
      { ar: 'ابحث عن الصوت "أَ" في البداية: أَسَد.', en: 'Find the "A" sound at the start: Asad.' },
    ],
  },
  // 2. IMAGE RECOGNITION
  {
    id: 'sa-img-planet',
    format: 'image-recognition',
    domain: 'science',
    skillId: 'science-discovery',
    difficulty: 'easy',
    ageGroups: ['1-4'],
    recommendedAgeRange: '1-4',
    worldId: 'science-galaxy',
    revisionScreen: 'discovery-lab',
    prompt: { ar: 'أي صورة تمثل الكوكب الذي نعيش عليه؟', en: 'Which picture shows the planet Earth we live on?' },
    options: [
      { id: 'opt-earth', label: { ar: 'الأرض', en: 'Earth' }, visual: '🌍' },
      { id: 'opt-sun', label: { ar: 'الشمس', en: 'Sun' }, visual: '☀️' },
      { id: 'opt-moon', label: { ar: 'الهلال', en: 'Moon' }, visual: '🌙' },
    ],
    correctOptionId: 'opt-earth',
    hintText: { ar: 'كوكبنا أزرق بالبحار وأخضر باليابسة!', en: 'Our home planet is blue with oceans and green with land!' },
    workedExample: {
      visual: '🌍 = ماء 💧 + يابسة 🌿',
      explanation: { ar: 'الأرض كوكب أزرق وأخضر يدور حول الشمس.', en: 'Earth is our blue-and-green planet orbiting the Sun.' },
    },
    simplifiedSteps: [
      { ar: 'الشمس نجم مضيء، أما الأرض فهي كوكبنا الأزرق.', en: 'The Sun shines like a star, while Earth is blue and green.' },
    ],
  },
  // 3. LISTENING
  {
    id: 'sa-listen-en-b',
    format: 'listening',
    domain: 'english',
    skillId: 'english-literacy',
    difficulty: 'easy',
    ageGroups: ['1-4'],
    recommendedAgeRange: '1-4',
    worldId: 'english-letters',
    revisionScreen: 'reading-adventure',
    prompt: { ar: 'استمع جيداً واختر الحرف أو الكلمة المطابقة: "Ball"', en: 'Listen carefully and choose the matching word: "Ball"' },
    audioText: 'Buh, Buh, Ball',
    audioLang: 'en',
    options: [
      { id: 'opt-ball', label: { ar: 'كرة (Ball)', en: 'Ball' }, visual: '⚽' },
      { id: 'opt-cat', label: { ar: 'قطة (Cat)', en: 'Cat' }, visual: '🐱' },
      { id: 'opt-sun', label: { ar: 'شمس (Sun)', en: 'Sun' }, visual: '☀️' },
    ],
    correctOptionId: 'opt-ball',
    hintText: { ar: 'تبدأ بصوت حرف B مثل /ب/.', en: 'It begins with the letter B sound (/b/).' },
    workedExample: {
      visual: 'B ⬅️ ⚽ Ball',
      explanation: { ar: 'B تُنطق /ب/ وتبدأ بها كلمة Ball.', en: 'B makes the /b/ sound at the start of Ball.' },
    },
    simplifiedSteps: [
      { ar: 'اضغط زر الاستماع ببطء.', en: 'Tap the slow listen button.' },
      { ar: 'طابق الصوت الأول /ب/ مع صورة الكرة.', en: 'Match the /b/ sound with the ball.' },
    ],
  },
  // 4. MATCHING
  {
    id: 'sa-match-animals-homes',
    format: 'matching',
    domain: 'science',
    skillId: 'early-recognition',
    difficulty: 'medium',
    ageGroups: ['1-4'],
    recommendedAgeRange: '2-3',
    worldId: 'animal-jungle',
    revisionScreen: 'entertainment-hub',
    prompt: { ar: 'طابق كل كائن ببيئته أو طعامه المناسب', en: 'Match each animal with its right match' },
    pairs: [
      { id: 'p1', left: '🐝 النحلة', rightOptions: ['🍯 العسل', '🌊 البحر', '🥕 الجزر'] },
      { id: 'p2', left: '🐟 السمكة', rightOptions: ['🍯 العسل', '🌊 البحر', '🥕 الجزر'] },
      { id: 'p3', left: '🐰 الأرنب', rightOptions: ['🍯 العسل', '🌊 البحر', '🥕 الجزر'] },
    ],
    correctPairs: { p1: '🍯 العسل', p2: '🌊 البحر', p3: '🥕 الجزر' },
    hintText: { ar: 'أين تسبح السمكة؟ وماذا يصنع النحل؟', en: 'Where does a fish swim, and what do bees make?' },
    workedExample: {
      visual: '🐝➡️🍯 | 🐟➡️🌊 | 🐰➡️🥕',
      explanation: { ar: 'كل كائن له غذاء أو موطن يناسبه.', en: 'Each creature connects naturally to its food or home.' },
    },
    simplifiedSteps: [
      { ar: 'ابدأ بالأسهل: السمكة تعيش في البحر 🌊.', en: 'Start easy: Fish lives in the Sea 🌊.' },
      { ar: 'الأرنب يحب الجزر 🥕، والنحلة تصنع العسل 🍯.', en: 'Rabbit loves carrots 🥕, and Bee makes honey 🍯.' },
    ],
  },
  // 5. SORTING
  {
    id: 'sa-sort-healthy-shapes',
    format: 'sorting',
    domain: 'colors-shapes',
    skillId: 'life-health',
    difficulty: 'medium',
    ageGroups: ['1-4'],
    recommendedAgeRange: '1-4',
    worldId: 'healthy-body',
    revisionScreen: 'entertainment-hub',
    prompt: { ar: 'صنّف العناصر إلى فواكه أم خضروات', en: 'Sort each food into Fruits or Vegetables' },
    sortBuckets: [
      { id: 'fruits', label: { ar: 'فواكه', en: 'Fruits' }, emoji: '🍓' },
      { id: 'veggies', label: { ar: 'خضروات', en: 'Vegetables' }, emoji: '🥦' },
    ],
    sortItems: [
      { id: 'i1', label: { ar: 'تفاح', en: 'Apple' }, visual: '🍎' },
      { id: 'i2', label: { ar: 'جزر', en: 'Carrot' }, visual: '🥕' },
      { id: 'i3', label: { ar: 'موز', en: 'Banana' }, visual: '🍌' },
      { id: 'i4', label: { ar: 'بروكلي', en: 'Broccoli' }, visual: '🥦' },
    ],
    correctSortMap: { '🍎': 'fruits', '🍌': 'fruits', '🥕': 'veggies', '🥦': 'veggies' },
    hintText: { ar: 'التفاح والموز فاكهة حلوة؛ الجزر والبروكلي خضروات!', en: 'Apples and bananas are sweet fruits; carrots and broccoli are veggies!' },
    workedExample: {
      visual: '🍓: 🍎🍌 | 🥦: 🥕🥦',
      explanation: { ar: 'تصنيف الطعام يساعدنا على بناء وجبة صحية متوازنة.', en: 'Sorting food helps us build balanced healthy meals.' },
    },
    simplifiedSteps: [
      { ar: 'ضع الفاكهة الحلوة (🍎🍌) في سلة الفواكه.', en: 'Put sweet fruits (🍎🍌) in the Fruits basket.' },
      { ar: 'ضع الجزر والبروكلي (🥕🥦) في سلة الخضروات.', en: 'Put carrot and broccoli (🥕🥦) in Vegetables.' },
    ],
  },
  // 6. SEQUENCING
  {
    id: 'sa-seq-numbers',
    format: 'sequencing',
    domain: 'math',
    skillId: 'logic-patterns',
    difficulty: 'medium',
    ageGroups: ['1-4'],
    recommendedAgeRange: '2-3',
    worldId: 'numbers-kingdom',
    revisionScreen: 'academy',
    prompt: { ar: 'رتّب الأرقام من الأصغر إلى الأكبر', en: 'Put the numbers in order from smallest to largest' },
    sequencePool: ['4', '1', '3', '2'],
    correctSequence: ['1', '2', '3', '4'],
    hintText: { ar: 'ابدأ بالرقم ١ ثم عدّ تصاعدياً!', en: 'Start with 1 and count upward!' },
    workedExample: {
      visual: '1 ⬅️ 2 ⬅️ 3 ⬅️ 4',
      explanation: { ar: 'العدّ التصاعدي يزيد بمقدار ١ في كل خطوة.', en: 'Counting up adds 1 at each step.' },
    },
    simplifiedSteps: [
      { ar: 'أصغر رقم هو ١، يليه ٢، ثم ٣، ثم ٤.', en: 'Smallest is 1, then 2, then 3, then 4.' },
    ],
  },
  // 7. MEMORY CHALLENGE
  {
    id: 'sa-memory-pairs',
    format: 'memory',
    domain: 'logic',
    skillId: 'memory-focus',
    difficulty: 'medium',
    ageGroups: ['1-4'],
    recommendedAgeRange: '1-4',
    worldId: 'intelligence-castle',
    revisionScreen: 'brain-games',
    prompt: { ar: 'لعبة الذاكرة: اقلب البطاقات وطابق كل زوج متشابه!', en: 'Memory check: flip and match all identical pairs!' },
    memoryTiles: [
      { id: 'm1', visual: '🌟', pairKey: 'star' },
      { id: 'm2', visual: '🦋', pairKey: 'butterfly' },
      { id: 'm3', visual: '🌟', pairKey: 'star' },
      { id: 'm4', visual: '🦋', pairKey: 'butterfly' },
    ],
    hintText: { ar: 'تذكر مكان النجمة 🌟 والفراشة 🦋 عند قلب البطاقة.', en: 'Remember where 🌟 and 🦋 sit as you flip!' },
    workedExample: {
      visual: '🌟=🌟  |  🦋=🦋',
      explanation: { ar: 'التركيز في أماكن البطاقات يقوّي الذاكرة البصرية.', en: 'Remembering tile spots strengthens visual memory.' },
    },
    simplifiedSteps: [
      { ar: 'افتح بطاقة واحفظ شكلها ثم ابحث عن توأمها.', en: 'Open one card, remember its picture, and find its twin.' },
    ],
  },
  // 8. PHONICS & LETTER SOUND
  {
    id: 'sa-phonics-cat',
    format: 'phonics',
    domain: 'english',
    skillId: 'english-literacy',
    difficulty: 'medium',
    ageGroups: ['1-4'],
    recommendedAgeRange: '3-4',
    worldId: 'english-letters',
    revisionScreen: 'reading-adventure',
    prompt: { ar: 'أكمل الصوت الناقص لكلمة _AT (قطة):', en: 'Pick the missing starting phonics sound for _AT (🐱):' },
    visualCue: '🐱 _ A T',
    audioText: 'Cuh, Cuh, Cat',
    audioLang: 'en',
    options: [
      { id: 'c', label: { ar: 'C (/ك/)', en: 'C' }, visual: 'C' },
      { id: 'm', label: { ar: 'M (/م/)', en: 'M' }, visual: 'M' },
      { id: 's', label: { ar: 'S (/س/)', en: 'S' }, visual: 'S' },
    ],
    correctOptionId: 'c',
    hintText: { ar: 'كلمة Cat تبدأ بصوت C مثل /ك/.', en: 'Cat begins with the hard C sound!' },
    workedExample: {
      visual: 'C + AT = CAT 🐱',
      explanation: { ar: 'دمج الصوت C مع AT يكوّن كلمة CAT.', en: 'Blending C + AT makes CAT.' },
    },
    simplifiedSteps: [
      { ar: 'قل: كْ + آت = كات (CAT).', en: 'Blend slowly: C + at = Cat.' },
    ],
  },
  // 9. COUNTING & SIMPLE MATH
  {
    id: 'sa-math-apples',
    format: 'counting-math',
    domain: 'math',
    skillId: 'numeracy',
    difficulty: 'easy',
    ageGroups: ['1-4'],
    recommendedAgeRange: '1-4',
    worldId: 'numbers-kingdom',
    revisionScreen: 'academy',
    prompt: { ar: 'عدّ التفاحات وأوجد المجموع الكلي:', en: 'Count the apples and find the total:' },
    countingPrompt: { emoji: '🍎', groupA: 3, groupB: 2, op: '+' },
    options: [
      { id: 'n4', label: { ar: '٤', en: '4' }, visual: '4' },
      { id: 'n5', label: { ar: '٥', en: '5' }, visual: '5' },
      { id: 'n6', label: { ar: '٦', en: '6' }, visual: '6' },
    ],
    correctOptionId: 'n5',
    hintText: { ar: 'عدّ ٣ تفاحات أولاً ثم أضف تفاحتين: ٤، ٥!', en: 'Count 3 apples first, then count 2 more: 4, 5!' },
    workedExample: {
      visual: '🍎🍎🍎 + 🍎🍎 = 5',
      explanation: { ar: '٣ + ٢ يساوي ٥ تفاحات.', en: '3 + 2 equals 5 apples.' },
    },
    simplifiedSteps: [
      { ar: 'أشر بإصبعك: ١، ٢، ٣... ثم ٤، ٥!', en: 'Point and count: 1, 2, 3... then 4, 5!' },
    ],
  },
  // 10. AGE-BASED LOGIC CHALLENGE (GENTLE COUNTING PATTERN FOR AGES 3-4)
  {
    id: 'sa-challenge-pattern',
    format: 'age-challenge',
    domain: 'logic',
    skillId: 'math-reasoning',
    difficulty: 'advanced',
    ageGroups: ['1-4'],
    recommendedAgeRange: '3-4',
    worldId: 'intelligence-castle',
    revisionScreen: 'brain-games',
    prompt: { ar: 'تحدي الأذكياء: ما الرقم الناقص في السلسلة 1، 2، 3، __؟', en: 'Smart Challenge: What number completes the sequence 1, 2, 3, __?' },
    visualCue: '1 → 2 → 3 → ?',
    options: [
      { id: 'n4', label: { ar: '٤', en: '4' }, visual: '4' },
      { id: 'n5', label: { ar: '٥', en: '5' }, visual: '5' },
      { id: 'n2', label: { ar: '٢', en: '2' }, visual: '2' },
    ],
    correctOptionId: 'n4',
    hintText: { ar: 'نعدّ تصاعدياً خطوة واحدة (+1) بعد ٣!', en: 'Count forward one step (+1) after 3!' },
    workedExample: {
      visual: '1 (+1)→ 2 (+1)→ 3 (+1)→ 4',
      explanation: { ar: '٣ + ١ = ٤.', en: '3 + 1 = 4.' },
    },
    simplifiedSteps: [
      { ar: 'عدّ: ١، ٢، ٣...', en: 'Count: 1, 2, 3...' },
      { ar: 'الرقم التالي مباشرة هو ٤!', en: 'The very next number is 4!' },
    ],
  },
];

function toPublicQuestion(q: InternalSmartQuestion): SmartAssessmentQuestionPublic {
  return {
    id: q.id,
    format: q.format,
    domain: q.domain,
    skillId: q.skillId,
    difficulty: q.difficulty,
    ageGroups: q.ageGroups,
    recommendedAgeRange: q.recommendedAgeRange,
    prompt: q.prompt,
    audioText: q.audioText,
    audioLang: q.audioLang,
    visualCue: q.visualCue,
    options: q.options,
    pairs: q.pairs,
    sortBuckets: q.sortBuckets,
    sortItems: q.sortItems,
    sequencePool: q.sequencePool,
    memoryTiles: q.memoryTiles,
    countingPrompt: q.countingPrompt,
  };
}

function selectNextAdaptiveQuestion(
  ageGroup: StoredAgeGroupId,
  targetTier: AdaptiveDifficultyTier,
  askedIds: string[],
  preferredFormats?: SmartAssessmentFormat[],
  childContext?: Pick<StoredChildRecord, 'ageGroup' | 'birthYear' | 'birthMonth'>,
): InternalSmartQuestion | null {
  const unasked = SMART_BANK.filter((q) => !askedIds.includes(q.id));
  if (unasked.length === 0) return null;

  const normalizedStage: AgeGroupId = ageGroup === '3-4' ? UNIFIED_STAGE_ID : '1-4';
  const stageMatched = unasked.filter((q) => q.ageGroups.includes(normalizedStage));
  const bandFiltered = childContext
    ? stageMatched.filter((q) => isContentAppropriateForChild(q, childContext))
    : stageMatched;
  const pool = bandFiltered.length > 0 ? bandFiltered : stageMatched.length > 0 ? stageMatched : unasked;

  // Prefer unseen format first if requested, or match difficulty tier
  if (preferredFormats && preferredFormats.length > 0) {
    const fmtPool = pool.filter((q) => preferredFormats.includes(q.format));
    if (fmtPool.length > 0) {
      const tierFmt = fmtPool.filter((q) => q.difficulty === targetTier);
      return (tierFmt.length > 0 ? tierFmt : fmtPool)[0];
    }
  }

  const tierPool = pool.filter((q) => q.difficulty === targetTier);
  return (tierPool.length > 0 ? tierPool : pool)[0];
}

function gradeSubmission(
  q: InternalSmartQuestion,
  answerPayload: unknown,
): boolean {
  if (q.format === 'matching' && q.correctPairs) {
    if (!answerPayload || typeof answerPayload !== 'object') return false;
    const ans = answerPayload as Record<string, string>;
    return Object.entries(q.correctPairs).every(([pid, expected]) => ans[pid] === expected);
  }
  if (q.format === 'sorting' && q.correctSortMap) {
    if (!answerPayload || typeof answerPayload !== 'object') return false;
    const ans = answerPayload as Record<string, string>;
    return Object.entries(q.correctSortMap).every(([visual, bucket]) => ans[visual] === bucket);
  }
  if (q.format === 'sequencing' && q.correctSequence) {
    if (!Array.isArray(answerPayload)) return false;
    return (
      answerPayload.length === q.correctSequence.length &&
      q.correctSequence.every((val, idx) => String(answerPayload[idx]) === val)
    );
  }
  if (q.format === 'memory') {
    if (typeof answerPayload === 'object' && answerPayload !== null && 'completed' in answerPayload) {
      return Boolean((answerPayload as { completed?: boolean }).completed);
    }
    return answerPayload === 'completed' || answerPayload === true;
  }
  if (q.correctOptionId) {
    return String(answerPayload || '') === q.correctOptionId;
  }
  return false;
}

function buildEmotionalFeedback(
  q: InternalSmartQuestion,
  correct: boolean,
  consecutiveMistakes: number,
  streak: number,
): EmotionalFeedbackPayload {
  const cast: OfficialCharacterId[] = ['nono', 'lolo', 'leo', 'ellie', 'titi', 'bobo'];
  const characterId = correct
    ? cast[streak % cast.length]
    : consecutiveMistakes >= 2
      ? 'nono'
      : 'ellie';

  if (correct) {
    return {
      tone: 'celebrate',
      characterId,
      title: {
        ar: streak >= 2 ? 'سلسلة ذكاء رائعة! 🌟' : 'إجابة موفّقة يا بطل! ✨',
        en: streak >= 2 ? 'Amazing Smart Streak! 🌟' : 'Awesome Answer, Explorer! ✨',
      },
      message: {
        ar: 'تركيزك رائع! خطوة جديدة تقرّبك من الإتقان.',
        en: 'Great focus! Every thoughtful try helps your skills grow.',
      },
    };
  }

  if (consecutiveMistakes >= 2) {
    return {
      tone: 'simplify',
      characterId: 'nono',
      title: { ar: 'لنحلّها معاً خطوة بخطوة 💛', en: 'Let us solve it together step by step 💛' },
      message: {
        ar: 'لا بأس أبداً! الأخطاء تصنع العقول الكبيرة. شاهد المثال البسيط أولاً:',
        en: 'No worries at all! Mistakes help our brains grow. Look at this gentle example:',
      },
      hintStep: q.hintText,
      workedExample: q.workedExample,
      simplifiedSteps: q.simplifiedSteps,
      recommendedRevisionScreen: q.revisionScreen,
    };
  }

  return {
    tone: 'encourage',
    characterId,
    title: { ar: 'قريب جداً! حاول بهذه الفكرة 💡', en: 'So close! Try this gentle clue 💡' },
    message: {
      ar: 'محاولة شجاعة! فكّر في التلميح التالي:',
      en: 'Brave try! Use this helpful hint:',
    },
    hintStep: q.hintText,
  };
}

export function registerSmartAssessmentRoutes({
  app,
  getDb,
  saveDb,
  requireAuth,
  assertChildAccess,
}: SmartAssessmentRouteDeps) {
  app.post('/api/assessment/start', (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const body = (req.body || {}) as {
      childId?: string;
      ageGroup?: StoredAgeGroupId;
      mode?: 'diagnostic' | 'practice';
      questionCount?: number;
    };

    const childId = typeof body.childId === 'string' && body.childId.trim() ? body.childId.trim() : 'demo-sample';
    let resolvedAge: StoredAgeGroupId = body.ageGroup === '3-4' ? '1-4' : body.ageGroup || '1-4';
    let initialTier: AdaptiveDifficultyTier = 'easy';
    let childForContext: StoredChildRecord | undefined;

    if (req.authSession) {
      if (req.authSession.user.role === 'teacher') {
        return res.status(403).json({ error: 'Teachers cannot start student self-assessments' });
      }
      const checked = assertChildAccess(req, res, childId);
      if (!checked) return;
      if (checked !== 'untracked-sample') {
        childForContext = checked;
        resolvedAge = checked.ageGroup;
        const internalBand = getInternalAgeBand(checked);
        initialTier = internalBand === '3-4' ? 'medium' : 'easy';
        const avgTier = checked.skillProgress['early-recognition']?.difficultyTier;
        if (avgTier) initialTier = avgTier;
      }
    } else if (!childId.startsWith('demo-') && !childId.startsWith('child-')) {
      return res.status(401).json({ error: 'Authentication required for saved child assessments' });
    }

    const totalQuestions = Math.min(SMART_BANK.length, Math.max(5, Number(body.questionCount || 8)));
    const firstQ = selectNextAdaptiveQuestion(resolvedAge, initialTier, [], undefined, childForContext);
    if (!firstQ) {
      return res.status(500).json({ error: 'Assessment bank unavailable' });
    }

    const sessionId = `sas_${crypto.randomBytes(6).toString('hex')}`;
    db.smartAssessmentSessions = db.smartAssessmentSessions || {};
    db.smartAssessmentSessions[sessionId] = {
      id: sessionId,
      childId,
      parentId: req.authSession?.user.id,
      ageGroup: resolvedAge,
      difficultyTier: initialTier,
      totalQuestions,
      askedQuestionIds: [firstQ.id],
      results: [],
      streak: 0,
      consecutiveMistakes: 0,
      hintsUsed: 0,
      finished: false,
      createdAt: new Date().toISOString(),
    };
    saveDb(db);

    const payload: SmartAssessmentStartResponse = {
      sessionId,
      childId,
      difficultyTier: initialTier,
      totalQuestions,
      currentIndex: 0,
      question: toPublicQuestion(firstQ),
    };
    res.status(201).json(payload);
  });

  app.post('/api/assessment/hint', (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const { sessionId, questionId } = (req.body || {}) as { sessionId?: string; questionId?: string };
    const session = sessionId ? db.smartAssessmentSessions?.[sessionId] : undefined;
    if (!session) {
      return res.status(404).json({ error: 'Assessment session not found' });
    }
    if (session.parentId && (!req.authSession || (req.authSession.user.id !== session.parentId && req.authSession.user.linkedChildId !== session.childId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const q = SMART_BANK.find((item) => item.id === questionId);
    if (!q) return res.status(404).json({ error: 'Question not found' });

    session.hintsUsed += 1;
    saveDb(db);

    res.json({
      hint: q.hintText,
      simplifiedSteps: session.consecutiveMistakes >= 1 ? q.simplifiedSteps : undefined,
      workedExample: session.consecutiveMistakes >= 2 ? q.workedExample : undefined,
    });
  });

  app.post('/api/assessment/submit-item', (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const { sessionId, questionId, answer, responseTimeMs } = (req.body || {}) as {
      sessionId?: string;
      questionId?: string;
      answer?: unknown;
      responseTimeMs?: number;
    };

    const session = sessionId ? db.smartAssessmentSessions?.[sessionId] : undefined;
    if (!session) {
      return res.status(404).json({ error: 'Assessment session not found' });
    }
    if (session.parentId && (!req.authSession || (req.authSession.user.id !== session.parentId && req.authSession.user.linkedChildId !== session.childId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (session.finished) {
      return res.status(400).json({ error: 'Assessment session is already finished' });
    }

    const q = SMART_BANK.find((item) => item.id === questionId);
    if (!q) return res.status(404).json({ error: 'Question not found' });

    const alreadyAnswered = session.results.some((r) => r.questionId === q.id);
    if (alreadyAnswered) {
      return res.status(409).json({ error: 'Duplicate answer for the same question is not allowed' });
    }

    const correct = gradeSubmission(q, answer);
    const cleanDuration = Math.max(500, Math.min(180_000, Number(responseTimeMs || 5000)));
    session.results.push({
      questionId: q.id,
      format: q.format,
      skillId: q.skillId,
      correct,
      responseTimeMs: cleanDuration,
      difficulty: q.difficulty,
    });

    if (correct) {
      session.streak += 1;
      session.consecutiveMistakes = 0;
      if (session.streak >= 2 && session.difficultyTier === 'easy') session.difficultyTier = 'medium';
      else if (session.streak >= 4 && session.difficultyTier === 'medium') session.difficultyTier = 'advanced';
    } else {
      session.streak = 0;
      session.consecutiveMistakes += 1;
      if (session.consecutiveMistakes >= 2 && session.difficultyTier === 'advanced') session.difficultyTier = 'medium';
      else if (session.consecutiveMistakes >= 2 && session.difficultyTier === 'medium') session.difficultyTier = 'easy';
    }

    const emotionalFeedback = buildEmotionalFeedback(
      q,
      correct,
      session.consecutiveMistakes,
      session.streak,
    );

    const hasMore = session.results.length < session.totalQuestions;
    const childContext = db.children[session.childId];
    const nextQ = hasMore
      ? selectNextAdaptiveQuestion(session.ageGroup, session.difficultyTier, session.askedQuestionIds, undefined, childContext)
      : null;

    if (nextQ) {
      session.askedQuestionIds.push(nextQ.id);
      saveDb(db);
      const resp: SmartAssessmentSubmitResponse = {
        correct,
        difficultyTier: session.difficultyTier,
        streak: session.streak,
        consecutiveMistakes: session.consecutiveMistakes,
        emotionalFeedback,
        finished: false,
        nextIndex: session.results.length,
        nextQuestion: toPublicQuestion(nextQ),
      };
      return res.json(resp);
    }

    // Finish session & persist honest multi-evidence skill updates
    session.finished = true;
    const total = session.results.length;
    const score = session.results.filter((r) => r.correct).length;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    const avgResponseMs = total > 0
      ? Math.round(session.results.reduce((acc, r) => acc + r.responseTimeMs, 0) / total)
      : 0;
    const starsEarned = Math.max(2, Math.min(8, Math.round(score / 2) + 2));

    const skillBreakdown: Partial<Record<SkillId, { correct: number; total: number }>> = {};
    for (const r of session.results) {
      const prev = skillBreakdown[r.skillId] || { correct: 0, total: 0 };
      prev.total += 1;
      if (r.correct) prev.correct += 1;
      skillBreakdown[r.skillId] = prev;
    }

    const strengths: SkillId[] = [];
    const weakSkills: SkillId[] = [];
    for (const [sid, data] of Object.entries(skillBreakdown) as Array<[SkillId, { correct: number; total: number }]>) {
      const pct = Math.round((data.correct / data.total) * 100);
      if (pct >= 80) strengths.push(sid);
      else weakSkills.push(sid);
    }

    const child = db.children[session.childId];
    let updatedSkillProgress = child?.skillProgress;
    if (child) {
      const nowIso = new Date().toISOString();
      for (const [sid, data] of Object.entries(skillBreakdown) as Array<[SkillId, { correct: number; total: number }]>) {
        const acc = Math.round((data.correct / data.total) * 100);
        child.skillProgress[sid] = evaluateSkillUpdate(child.skillProgress[sid], {
          accuracy: acc,
          isAssessment: true,
          nowIso,
        });
      }
      child.stars = (child.stars || 0) + starsEarned;
      child.level = Math.max(1, Math.floor(child.stars / 6) + 1);
      child.completedBaseline = true;
      const summaryRec: AssessmentResult = {
        id: `sa-res-${session.id}`,
        childId: child.id,
        ageGroup: child.ageGroup,
        mode: 'lab',
        date: nowIso,
        questionsCompleted: total,
        correctAnswers: score,
        skillBreakdown,
        recommendedWorldId: weakSkills[0] === 'arabic-literacy' ? 'arabic-letters' : weakSkills[0] === 'numeracy' ? 'numbers-kingdom' : 'intelligence-castle',
        recommendedActivityId: 'act-ar-letter-tap-34',
        starsEarned,
      };
      child.assessmentHistory = [summaryRec, ...(child.assessmentHistory || [])].slice(0, 40);
      updatedSkillProgress = child.skillProgress;

      recordAuditEvent(db, {
        eventType: 'SMART_ASSESSMENT',
        actorId: req.authSession?.user.id,
        actorRole: req.authSession?.user.role,
        actionType: 'COMPLETE_SMART_ASSESSMENT',
        recordType: 'assessment',
        recordId: session.id,
        newValue: { score, total, percentage, weakSkills },
        reason: 'Smart adaptive assessment graded and saved server-side',
        ip: getClientIp(req),
        summary: `Smart assessment ${session.id} finished (${score}/${total} = ${percentage}%) for ${child.id}`,
      });
    }

    saveDb(db);

    const recommendedRevision: Array<{ screen: AppScreen; label: LocalizedText; reason: LocalizedText }> = weakSkills.slice(0, 3).map((sid) => {
      if (sid === 'arabic-literacy' || sid === 'english-literacy') {
        return {
          screen: 'reading-adventure',
          label: { ar: 'مغامرة القراءة المتدرجة', en: 'Reading Adventure Stages' },
          reason: { ar: 'تدريب لطيف على الحروف والأصوات والكلمات', en: 'Gentle step-by-step letters and phonics practice' },
        };
      }
      if (sid === 'numeracy' || sid === 'math-reasoning') {
        return {
          screen: 'academy',
          label: { ar: 'أكاديمية نونو للأرقام', en: 'Nono Numbers Academy' },
          reason: { ar: 'تعزيز العدّ والأنماط بأمثلة واضحة', en: 'Strengthen counting and patterns with worked examples' },
        };
      }
      return {
        screen: 'entertainment-hub',
        label: { ar: 'عالم الاكتشاف والألعاب', en: 'Discovery & Brain Play' },
        reason: { ar: 'ممارسة ممتعة للمهارات البصرية والعلمية', en: 'Fun practice for visual and science thinking' },
      };
    });

    const resp: SmartAssessmentSubmitResponse = {
      correct,
      difficultyTier: session.difficultyTier,
      streak: session.streak,
      consecutiveMistakes: session.consecutiveMistakes,
      emotionalFeedback,
      finished: true,
      summary: {
        score,
        totalQuestions: total,
        percentage,
        starsEarned,
        avgResponseMs,
        strengths,
        weakSkills,
        recommendedRevision,
        updatedSkillProgress: updatedSkillProgress || ({} as Record<SkillId, never>),
      },
    };
    res.json(resp);
  });
}
