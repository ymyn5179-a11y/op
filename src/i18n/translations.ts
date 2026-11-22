import { AgeGroupId, Language, SkillId, StoredAgeGroupId } from '../types/nonoland';

export interface AgeStageMetaEntry {
  label: { ar: string; en: string };
  badgeTitle: { ar: string; en: string };
  description: { ar: string; en: string };
  styleFocus: { ar: string; en: string };
  color: string;
}

export const UNIFIED_STAGE_META: AgeStageMetaEntry = {
  label: { ar: '١ – ٤ سنوات', en: '1–4 Years' },
  badgeTitle: { ar: 'المستكشفون الصغار', en: 'Little Explorers' },
  description: {
    ar: 'رحلة تعليمية واحدة متكيفة مع عمر الطفل (١–٤ سنوات) عبر اللعب، الصوت، الألوان، الحروف، الأرقام والقصص التفاعلية',
    en: 'One unified learning world adapting silently to ages 1–4 through sensory play, vocabulary, counting, letters, phonics & stories',
  },
  styleFocus: {
    ar: 'أنشطة متكيفة مع عمر وقدرات طفلك دون تعقيد',
    en: 'Adaptive activities scaled gently to your child’s age & pace',
  },
  color: '#FF78B7',
};

export const AGE_GROUP_META: Record<AgeGroupId, AgeStageMetaEntry> = {
  '1-4': UNIFIED_STAGE_META,
};

export function getAgeGroupMeta(ageGroup: StoredAgeGroupId | string | undefined | null): AgeStageMetaEntry {
  if (!ageGroup || ageGroup === '1-4' || ageGroup === '3-4') {
    return UNIFIED_STAGE_META;
  }
  return {
    label: { ar: 'سجل تعليمي محفوظ', en: 'Archived Learning Record' },
    badgeTitle: { ar: 'سجل تعليمي محفوظ', en: 'Archived Learning Record' },
    description: UNIFIED_STAGE_META.description,
    styleFocus: UNIFIED_STAGE_META.styleFocus,
    color: '#8054D9',
  };
}

export const SKILL_LABELS: Record<SkillId, { ar: string; en: string; color: string }> = {
  'early-recognition': { ar: 'التمييز البصري والسمعي', en: 'Early Visual & Sound Recognition', color: '#FF78B7' },
  'arabic-literacy': { ar: 'اللغة العربية والقراءة', en: 'Arabic Literacy & Reading', color: '#8054D9' },
  'english-literacy': { ar: 'اللغة الإنجليزية', en: 'English Literacy', color: '#39BDF2' },
  numeracy: { ar: 'الأرقام والعد', en: 'Numbers & Counting', color: '#FFD84D' },
  'math-reasoning': { ar: 'التفكير الرياضي', en: 'Mathematical Reasoning', color: '#FF9360' },
  'logic-patterns': { ar: 'المنطق والأنماط', en: 'Logic & Patterns', color: '#8054D9' },
  'science-discovery': { ar: 'العلوم والاكتشاف', en: 'Science & Discovery', color: '#39BDF2' },
  'memory-focus': { ar: 'الذاكرة والتركيز', en: 'Memory & Focus', color: '#FF78B7' },
  'life-health': { ar: 'الصحة ومهارات الحياة', en: 'Health & Life Skills', color: '#55D98B' },
  'creativity-expression': { ar: 'الإبداع والفنون', en: 'Creativity & Expression', color: '#FF9360' },
};

export const UI_COPY = {
  appName: { ar: 'نونو لاند', en: 'NonoLand' },
  tagline: {
    ar: 'لكل طفل عالمه الخاص ومغامرته الفريدة',
    en: 'Every Child. A Different World. A Unique Adventure.',
  },
  startAdventure: { ar: 'ابدأ المغامرة', en: 'Start Adventure' },
  quickExplore: { ar: 'جولة سريعة بملف جاهز', en: 'Quick Try with Sample Profiles' },
  createChildProfile: { ar: 'إنشاء ملف طفل جديد', en: 'Create New Child Profile' },
  parentArea: { ar: 'منطقة الأهل', en: 'Parents' },
  nav: {
    home: { ar: 'الرئيسية', en: 'Home' },
    academy: { ar: 'أكاديمية نونو', en: 'Academy' },
    exams: { ar: 'الامتحانات', en: 'Exams' },
    funZone: { ar: 'منطقة المرح', en: 'Fun Zone' },
    map: { ar: 'العوالم', en: 'Worlds' },
    games: { ar: 'الألعاب', en: 'Games' },
    lab: { ar: 'مختبر نونو', en: 'Lab' },
    stories: { ar: 'القصص', en: 'Stories' },
    room: { ar: 'غرفتي', en: 'My Room' },
    achievements: { ar: 'إنجازاتي', en: 'Rewards' },
  },
  home: {
    continueAdventure: { ar: 'أكمل مغامرتك', en: 'Continue Your Adventure' },
    recommendedForYou: { ar: 'مغامرة مختارة لك', en: 'Picked Just for You' },
    dailyDiscovery: { ar: 'اكتشافات اليوم اللطيفة', en: 'Gentle Daily Discoveries' },
    noPressureNote: {
      ar: 'تحديات اختيارية ممتعة بدون توقيت ضاغط',
      en: 'Optional playful missions with zero countdown pressure',
    },
    exploreWorlds: { ar: 'اكتشف العوالم العشرة', en: 'Explore 10 Worlds' },
    visitDiscoveryLab: { ar: 'مختبر نونو للاكتشاف', en: "Nono's Discovery Lab" },
    openMyRoom: { ar: 'رتّب غرفتي', en: 'Decorate My Room' },
    listenToNono: { ar: 'اسمع نونو', en: 'Hear Nono' },
    starsLabel: { ar: 'نجمة', en: 'Stars' },
    levelLabel: { ar: 'المستوى', en: 'Level' },
  },
  games: {
    playNow: { ar: 'العب الآن', en: 'Play Now' },
    tryAgain: { ar: 'جرّب مرة أخرى مع نونو!', en: 'Almost! Try one more time with Nono!' },
    greatJob: { ar: 'أحسنت يا بطل!', en: 'Wonderful job!' },
    hintBtn: { ar: 'مساعدة من نونو', en: 'Nono Hint' },
    hearPrompt: { ar: 'اسمع السؤال', en: 'Hear Instruction' },
    backToWorld: { ar: 'العودة للعالم', en: 'Back to World' },
    nextRecommended: { ar: 'المغامرة المقترحة التالية', en: 'Next Recommended Adventure' },
    playAgain: { ar: 'العب مجدداً', en: 'Play Again' },
    completedBadge: { ar: 'مكتمل', en: 'Completed' },
    ageTailored: { ar: 'مناسب لعمرك', en: 'Tailored for your age' },
  },
  lab: {
    title: { ar: 'مختبر نونو للاكتشاف', en: "Nono's Discovery Lab" },
    subtitle: {
      ar: 'تحديات لطيفة تكتشف مهاراتك وتصمم رحلتك الخاصة — بدون أي ضغط أو درجات مدرسية',
      en: 'Playful challenges that discover your strengths and tailor your adventure — zero exam pressure',
    },
    diagnosticMode: { ar: 'جلسة اكتشاف المهارات (تقييم ذكي)', en: 'Skill Discovery Session (Diagnostic)' },
    practiceMode: { ar: 'جلسة تدريب مع تلميحات نونو', en: 'Guided Practice with Hints' },
    startSession: { ar: 'ابدأ رحلة المختبر', en: 'Start Lab Session' },
  },
  parent: {
    gateTitle: { ar: 'بوابة الأمان للأهل', en: 'Parent Safety Gate' },
    gateSubtitle: {
      ar: 'لضمان أمان الأطفال، يرجى حل هذه المسألة البسيطة للدخول إلى لوحة الأهل',
      en: 'To keep child spaces safe, please solve this quick math check to enter the Parent Area',
    },
    dashboardTitle: { ar: 'لوحة تحكم الأهل الذكية', en: 'Parent Insights & Controls' },
    overviewTab: { ar: 'نظرة عامة والتقارير', en: 'Learning Reports' },
    profilesTab: { ar: 'ملفات الأطفال', en: 'Child Profiles' },
    controlsTab: { ar: 'الصوت والوقت والخصوصية', en: 'Controls & Privacy' },
    offlineTab: { ar: 'المحتوى المحلي والاشتراك', en: 'Offline & Plans' },
    noMedicalDisclaimer: {
      ar: 'ملاحظة: تعكس هذه التقارير أداء الطفل داخل أنشطة نونو لاند فقط ولا تمثل تقييماً طبياً أو تشخيصياً.',
      en: 'Note: Insights summarize observed activity inside NonoLand only and are not medical or clinical diagnoses.',
    },
  },
};

export function t(text: { ar: string; en: string }, lang: Language): string {
  return text[lang];
}

export function formatNumber(num: number, lang: Language): string {
  if (lang === 'ar') {
    return new Intl.NumberFormat('ar-EG').format(num);
  }
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatDate(iso: string, lang: Language): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return iso;
  }
}
