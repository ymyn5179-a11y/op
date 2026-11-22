import { ARABIC_ALPHABET, ACADEMY_COLORS, ENGLISH_ALPHABET } from './academyData';
import {
  AgeGroupId,
  ConceptDomain,
  ExamQuestionItem,
  InternalAgeBand,
  LocalizedText,
  RecommendedAgeRange,
  StoredAgeGroupId,
} from '../types/nonoland';

export interface ColorDeepJourneyData {
  colorId: string;
  hex: string;
  title: LocalizedText;
  introLine: LocalizedText;
  realWorldExamples: Array<{ emoji: string; label: LocalizedText }>;
  matchingPairs: Array<{ emoji: string; label: LocalizedText; isTarget: boolean }>;
  sortBaskets: Array<{ id: string; hex: string; label: LocalizedText }>;
  sortItems: Array<{ emoji: string; label: LocalizedText; basketId: string }>;
  coloringSubject: { emoji: string; svgShape: 'apple' | 'flower' | 'star' | 'car'; label: LocalizedText };
  discoverySceneItems: Array<{ id: string; emoji: string; label: LocalizedText; isTarget: boolean }>;
  memoryItems: Array<{ id: string; emoji: string; label: LocalizedText; isTarget: boolean }>;
  unseenAssessment: Array<{
    prompt: LocalizedText;
    options: Array<{ id: string; visual: string; label: LocalizedText; isCorrect: boolean }>;
  }>;
}

const COLOR_EXTRA_EXAMPLES: Record<
  string,
  {
    examples: Array<{ emoji: string; label: LocalizedText }>;
    unseen: Array<{ emoji: string; label: LocalizedText }>;
    distractors: Array<{ emoji: string; label: LocalizedText; basketId: string }>;
    shape: 'apple' | 'flower' | 'star' | 'car';
  }
> = {
  red: {
    examples: [
      { emoji: '🍎', label: { ar: 'تفاحة حمراء', en: 'Red Apple' } },
      { emoji: '🍓', label: { ar: 'فراولة حمراء', en: 'Red Strawberry' } },
      { emoji: '🚗', label: { ar: 'سيارة حمراء', en: 'Red Car' } },
      { emoji: '🎈', label: { ar: 'بالونة حمراء', en: 'Red Balloon' } },
      { emoji: '🌹', label: { ar: 'وردة حمراء', en: 'Red Flower' } },
      { emoji: '👕', label: { ar: 'قميص أحمر', en: 'Red Shirt' } },
      { emoji: '🚒', label: { ar: 'لعبة إطفاء حمراء', en: 'Red Toy Truck' } },
    ],
    unseen: [
      { emoji: '🍒', label: { ar: 'كرز أحمر', en: 'Red Cherry' } },
      { emoji: '🐞', label: { ar: 'دعسوقة حمراء', en: 'Red Ladybug' } },
    ],
    distractors: [
      { emoji: '🍌', label: { ar: 'موزة صفراء', en: 'Yellow Banana' }, basketId: 'yellow' },
      { emoji: '🫐', label: { ar: 'توت أزرق', en: 'Blueberry' }, basketId: 'blue' },
      { emoji: '🥦', label: { ar: 'بروكلي أخضر', en: 'Green Broccoli' }, basketId: 'green' },
    ],
    shape: 'apple',
  },
  blue: {
    examples: [
      { emoji: '🌊', label: { ar: 'موجة بحر زرقاء', en: 'Blue Ocean Wave' } },
      { emoji: '🐋', label: { ar: 'حوت أزرق', en: 'Blue Whale' } },
      { emoji: '🫐', label: { ar: 'توت أزرق', en: 'Blueberries' } },
      { emoji: '🧢', label: { ar: 'قبعة زرقاء', en: 'Blue Cap' } },
      { emoji: '🦋', label: { ar: 'فراشة زرقاء', en: 'Blue Butterfly' } },
      { emoji: '🚙', label: { ar: 'سيارة زرقاء', en: 'Blue Car' } },
      { emoji: '💎', label: { ar: 'جوهرة زرقاء', en: 'Blue Gem' } },
    ],
    unseen: [
      { emoji: '🛋️', label: { ar: 'أريكة زرقاء', en: 'Blue Sofa' } },
      { emoji: '🪁', label: { ar: 'طائرة ورقية زرقاء', en: 'Blue Kite' } },
    ],
    distractors: [
      { emoji: '🍎', label: { ar: 'تفاحة حمراء', en: 'Red Apple' }, basketId: 'red' },
      { emoji: '🍋', label: { ar: 'ليمونة صفراء', en: 'Yellow Lemon' }, basketId: 'yellow' },
      { emoji: '🐸', label: { ar: 'ضفدع أخضر', en: 'Green Frog' }, basketId: 'green' },
    ],
    shape: 'car',
  },
  yellow: {
    examples: [
      { emoji: '☀️', label: { ar: 'شمس صفراء', en: 'Yellow Sun' } },
      { emoji: '🍌', label: { ar: 'موزة صفراء', en: 'Yellow Banana' } },
      { emoji: '🍋', label: { ar: 'ليمونة صفراء', en: 'Yellow Lemon' } },
      { emoji: '🐥', label: { ar: 'كتكوت أصفر', en: 'Yellow Chick' } },
      { emoji: '⭐', label: { ar: 'نجمة صفراء', en: 'Yellow Star' } },
      { emoji: '🌻', label: { ar: 'زهرة عباد الشمس', en: 'Yellow Sunflower' } },
      { emoji: '🚕', label: { ar: 'سيارة أجرة صفراء', en: 'Yellow Taxi' } },
    ],
    unseen: [
      { emoji: '🧀', label: { ar: 'جبن أصفر', en: 'Yellow Cheese' } },
      { emoji: '🌽', label: { ar: 'ذرة صفراء', en: 'Yellow Corn' } },
    ],
    distractors: [
      { emoji: '🍓', label: { ar: 'فراولة حمراء', en: 'Red Strawberry' }, basketId: 'red' },
      { emoji: '🐋', label: { ar: 'حوت أزرق', en: 'Blue Whale' }, basketId: 'blue' },
      { emoji: '🌳', label: { ar: 'شجرة خضراء', en: 'Green Tree' }, basketId: 'green' },
    ],
    shape: 'star',
  },
  green: {
    examples: [
      { emoji: '🌳', label: { ar: 'شجرة خضراء', en: 'Green Tree' } },
      { emoji: '🐸', label: { ar: 'ضفدع أخضر', en: 'Green Frog' } },
      { emoji: '🥦', label: { ar: 'بروكلي أخضر', en: 'Green Broccoli' } },
      { emoji: '🥒', label: { ar: 'خيار أخضر', en: 'Green Cucumber' } },
      { emoji: '🐢', label: { ar: 'سلحفاة خضراء', en: 'Green Turtle' } },
      { emoji: '🍏', label: { ar: 'تفاحة خضراء', en: 'Green Apple' } },
      { emoji: '🌿', label: { ar: 'أوراق نبات خضراء', en: 'Green Leaves' } },
    ],
    unseen: [
      { emoji: '🥝', label: { ar: 'كيوي أخضر', en: 'Green Kiwi' } },
      { emoji: '🦖', label: { ar: 'ديناصور أخضر', en: 'Green Dino Toy' } },
    ],
    distractors: [
      { emoji: '🍎', label: { ar: 'تفاحة حمراء', en: 'Red Apple' }, basketId: 'red' },
      { emoji: '☀️', label: { ar: 'شمس صفراء', en: 'Yellow Sun' }, basketId: 'yellow' },
      { emoji: '🫐', label: { ar: 'توت أزرق', en: 'Blueberry' }, basketId: 'blue' },
    ],
    shape: 'flower',
  },
};

export function buildColorDeepJourney(colorId: string): ColorDeepJourneyData {
  const color = ACADEMY_COLORS.find((c) => c.id === colorId) || ACADEMY_COLORS[0];
  const preset = COLOR_EXTRA_EXAMPLES[color.id] || {
    examples: [
      { emoji: color.emojis[0] || '🎨', label: { ar: `${color.name.ar} — مثال ١`, en: `${color.name.en} Item 1` } },
      { emoji: color.emojis[1] || '🎈', label: { ar: `${color.name.ar} — مثال ٢`, en: `${color.name.en} Item 2` } },
      { emoji: '🎁', label: { ar: `هدية ${color.name.ar}`, en: `${color.name.en} Gift` } },
      { emoji: '🖍️', label: { ar: `قلم تلوين ${color.name.ar}`, en: `${color.name.en} Crayon` } },
      { emoji: '👕', label: { ar: `تيشيرت ${color.name.ar}`, en: `${color.name.en} Shirt` } },
    ],
    unseen: [
      { emoji: '🎨', label: { ar: `بقعة لون ${color.name.ar}`, en: `${color.name.en} Paint` } },
      { emoji: '🪁', label: { ar: `طائرة ${color.name.ar}`, en: `${color.name.en} Kite` } },
    ],
    distractors: [
      { emoji: '🍎', label: { ar: 'تفاحة حمراء', en: 'Red Apple' }, basketId: 'red' },
      { emoji: '🍌', label: { ar: 'موزة صفراء', en: 'Yellow Banana' }, basketId: 'yellow' },
      { emoji: '🥦', label: { ar: 'بروكلي أخضر', en: 'Green Broccoli' }, basketId: 'green' },
    ],
    shape: 'flower' as const,
  };

  const targetExamples = preset.examples;
  const distractorBasketIds = ['red', 'blue', 'yellow', 'green'].filter((id) => id !== color.id).slice(0, 2);
  const sortBaskets = [
    { id: color.id, hex: color.hex, label: color.name },
    ...distractorBasketIds.map((bid) => {
      const c = ACADEMY_COLORS.find((x) => x.id === bid)!;
      return { id: c.id, hex: c.hex, label: c.name };
    }),
  ];

  const sortItems = [
    { emoji: targetExamples[0].emoji, label: targetExamples[0].label, basketId: color.id },
    { emoji: targetExamples[1].emoji, label: targetExamples[1].label, basketId: color.id },
    ...preset.distractors.filter((d) => distractorBasketIds.includes(d.basketId)).slice(0, 2),
  ];

  return {
    colorId: color.id,
    hex: color.hex,
    title: {
      ar: `رحلة اكتشاف اللون ال${color.name.ar}`,
      en: `Discover the Color ${color.name.en}`,
    },
    introLine: {
      ar: `${color.name.en} — ${color.name.ar}! تعال لنكتشف معاً سر هذا اللون الرائع في عالمنا!`,
      en: `${color.name.en} — ${color.name.ar}! Let's discover how this wonderful color appears all around us!`,
    },
    realWorldExamples: targetExamples,
    matchingPairs: [
      { emoji: targetExamples[0].emoji, label: targetExamples[0].label, isTarget: true },
      { emoji: targetExamples[2].emoji, label: targetExamples[2].label, isTarget: true },
      { emoji: preset.distractors[0].emoji, label: preset.distractors[0].label, isTarget: false },
      { emoji: preset.distractors[1].emoji, label: preset.distractors[1].label, isTarget: false },
    ],
    sortBaskets,
    sortItems,
    coloringSubject: {
      emoji: targetExamples[0].emoji,
      svgShape: preset.shape,
      label: targetExamples[0].label,
    },
    discoverySceneItems: [
      { id: 'd1', emoji: targetExamples[0].emoji, label: targetExamples[0].label, isTarget: true },
      { id: 'd2', emoji: preset.distractors[0].emoji, label: preset.distractors[0].label, isTarget: false },
      { id: 'd3', emoji: targetExamples[1].emoji, label: targetExamples[1].label, isTarget: true },
      { id: 'd4', emoji: preset.distractors[1].emoji, label: preset.distractors[1].label, isTarget: false },
      { id: 'd5', emoji: targetExamples[3].emoji, label: targetExamples[3].label, isTarget: true },
      { id: 'd6', emoji: preset.distractors[2]?.emoji || '⚪', label: preset.distractors[2]?.label || { ar: 'سحابة', en: 'Cloud' }, isTarget: false },
    ],
    memoryItems: [
      { id: 'm1', emoji: targetExamples[1].emoji, label: targetExamples[1].label, isTarget: true },
      { id: 'm2', emoji: preset.distractors[0].emoji, label: preset.distractors[0].label, isTarget: false },
      { id: 'm3', emoji: preset.distractors[1].emoji, label: preset.distractors[1].label, isTarget: false },
    ],
    unseenAssessment: [
      {
        prompt: {
          ar: `اختبار مستقل: أي من هذه الصور الجديدة لونه ${color.name.ar}؟`,
          en: `Independent Check: Which unseen object is ${color.name.en}?`,
        },
        options: [
          { id: 'u1', visual: preset.unseen[0].emoji, label: preset.unseen[0].label, isCorrect: true },
          { id: 'u2', visual: preset.distractors[0].emoji, label: preset.distractors[0].label, isCorrect: false },
          { id: 'u3', visual: preset.distractors[1].emoji, label: preset.distractors[1].label, isCorrect: false },
        ],
      },
      {
        prompt: {
          ar: `تحدٍ ثانٍ: اختر المثال الصحيح للون ال${color.name.ar}!`,
          en: `Challenge 2: Choose another ${color.name.en} object!`,
        },
        options: [
          { id: 'u4', visual: preset.distractors[1].emoji, label: preset.distractors[1].label, isCorrect: false },
          { id: 'u5', visual: preset.unseen[1]?.emoji || targetExamples[4].emoji, label: preset.unseen[1]?.label || targetExamples[4].label, isCorrect: true },
          { id: 'u6', visual: preset.distractors[0].emoji, label: preset.distractors[0].label, isCorrect: false },
        ],
      },
    ],
  };
}

export interface ArabicDeepJourneyData {
  letterId: string;
  char: string;
  nameAr: string;
  nameEn: string;
  introLine: LocalizedText;
  phoneticHint: LocalizedText;
  writingTip: LocalizedText;
  forms: { isolated: string; initial: string; medial: string; final: string };
  examples: Array<{ word: string; meaningEn: string; emoji: string }>;
  distractorChars: string[];
  missingWordPrompt: { masked: string; answerChar: string; fullWord: string; emoji: string };
  buildWordTiles: { targetWord: string; tiles: string[]; emoji: string };
  readingSentences: Record<InternalAgeBand, LocalizedText>;
  unseenAssessmentWord: { word: string; startsWithTarget: boolean; emoji: string };
}

const ARABIC_RICH_EXAMPLES: Record<string, Array<{ word: string; meaningEn: string; emoji: string }>> = {
  'ar-alif': [
    { word: 'أسد', meaningEn: 'Lion', emoji: '🦁' },
    { word: 'أرنب', meaningEn: 'Rabbit', emoji: '🐰' },
    { word: 'أسرة', meaningEn: 'Family', emoji: '👨‍👩‍👧' },
    { word: 'أم', meaningEn: 'Mother', emoji: '👩' },
    { word: 'أذن', meaningEn: 'Ear', emoji: '👂' },
  ],
  'ar-baa': [
    { word: 'بطة', meaningEn: 'Duck', emoji: '🦆' },
    { word: 'بيت', meaningEn: 'House', emoji: '🏠' },
    { word: 'باب', meaningEn: 'Door', emoji: '🚪' },
    { word: 'برتقال', meaningEn: 'Orange', emoji: '🍊' },
    { word: 'بقرة', meaningEn: 'Cow', emoji: '🐄' },
  ],
  'ar-taa': [
    { word: 'تفاحة', meaningEn: 'Apple', emoji: '🍎' },
    { word: 'تاج', meaningEn: 'Crown', emoji: '👑' },
    { word: 'تمساح', meaningEn: 'Crocodile', emoji: '🐊' },
    { word: 'تين', meaningEn: 'Fig', emoji: '🫐' },
    { word: 'توت', meaningEn: 'Berry', emoji: '🍓' },
  ],
};

export function buildArabicDeepJourney(letterId: string): ArabicDeepJourneyData {
  const idx = Math.max(0, ARABIC_ALPHABET.findIndex((l) => l.id === letterId));
  const entry = ARABIC_ALPHABET[idx];
  const next1 = ARABIC_ALPHABET[(idx + 1) % ARABIC_ALPHABET.length];
  const next2 = ARABIC_ALPHABET[(idx + 4) % ARABIC_ALPHABET.length];

  const baseExamples = ARABIC_RICH_EXAMPLES[entry.id] || [
    { word: entry.word, meaningEn: entry.wordMeaningEn, emoji: entry.emoji },
    { word: `${entry.char === 'أ' ? 'أب' : entry.word}`, meaningEn: entry.wordMeaningEn, emoji: entry.emoji },
    { word: `${next1.word}`, meaningEn: `${next1.wordMeaningEn} (للمقارنة)`, emoji: next1.emoji },
  ];

  // Clean word building target (short 2-4 char Arabic letters from entry.word)
  const cleanWord = entry.word.replace(/[^\u0621-\u064A]/g, '');
  const splitLetters = Array.from(cleanWord);
  const shuffledTiles = [...splitLetters].reverse();
  if (shuffledTiles.join('') === cleanWord && shuffledTiles.length >= 2) {
    const tmp = shuffledTiles[0];
    shuffledTiles[0] = shuffledTiles[1];
    shuffledTiles[1] = tmp;
  }

  const masked =
    splitLetters.length > 1 ? `_${splitLetters.slice(1).join('')}` : '_';

  const distractors = entry.similarGroup.filter((c) => c !== entry.char);
  while (distractors.length < 2) {
    const alt = ARABIC_ALPHABET[(idx + distractors.length + 3) % ARABIC_ALPHABET.length].char;
    if (alt !== entry.char && !distractors.includes(alt)) distractors.push(alt);
  }

  return {
    letterId: entry.id,
    char: entry.char,
    nameAr: entry.nameAr,
    nameEn: entry.nameEn,
    introLine: {
      ar: `أهلاً يا بطل! ده حرف ال${entry.nameAr} — ${entry.char}`,
      en: `Hello friend! Meet the Arabic letter ${entry.nameEn} — ${entry.char}`,
    },
    phoneticHint: entry.phoneticHint,
    writingTip: entry.writingTip,
    forms: entry.forms,
    examples: baseExamples,
    distractorChars: distractors.slice(0, 2),
    missingWordPrompt: {
      masked,
      answerChar: splitLetters[0] || entry.char,
      fullWord: entry.word,
      emoji: entry.emoji,
    },
    buildWordTiles: {
      targetWord: cleanWord,
      tiles: shuffledTiles,
      emoji: entry.emoji,
    },
    readingSentences: {
      '1-2': {
        ar: `${entry.emoji} ${entry.char} — ${entry.word}`,
        en: `${entry.emoji} ${entry.char} — ${entry.word}`,
      },
      '2-3': {
        ar: `أنا أرى ${entry.word} ${entry.emoji}`,
        en: `Look! ${entry.word} (${entry.wordMeaningEn}) ${entry.emoji}`,
      },
      '3-4': {
        ar: `تبدأ كلمة "${entry.word}" بحرف (${entry.char}) — هيا ننطقه معاً!`,
        en: `"${entry.word}" (${entry.wordMeaningEn}) begins with ${entry.char}.`,
      },
    },
    unseenAssessmentWord: {
      word: entry.id === 'ar-alif' ? 'أناناس' : entry.word,
      startsWithTarget: true,
      emoji: entry.id === 'ar-alif' ? '🍍' : entry.emoji,
    },
  };
}

export interface EnglishDeepJourneyData {
  letterId: string;
  upper: string;
  lower: string;
  nameSound: string;
  phoneticSound: string;
  word: string;
  wordAr: string;
  emoji: string;
  cvcWord: string;
  examples: Array<{ word: string; emoji: string; ar: string }>;
  distractorLowers: string[];
  readingSentence: Record<InternalAgeBand, LocalizedText>;
}

export function buildEnglishDeepJourney(letterId: string): EnglishDeepJourneyData {
  const idx = Math.max(0, ENGLISH_ALPHABET.findIndex((l) => l.id === letterId));
  const entry = ENGLISH_ALPHABET[idx];
  const alt1 = ENGLISH_ALPHABET[(idx + 3) % ENGLISH_ALPHABET.length];
  const alt2 = ENGLISH_ALPHABET[(idx + 7) % ENGLISH_ALPHABET.length];

  return {
    letterId: entry.id,
    upper: entry.upper,
    lower: entry.lower,
    nameSound: entry.nameSound,
    phoneticSound: entry.phoneticSound,
    word: entry.word,
    wordAr: entry.wordAr,
    emoji: entry.emoji,
    cvcWord: entry.cvcExample,
    examples: [
      { word: entry.word, emoji: entry.emoji, ar: entry.wordAr },
      { word: `${entry.upper}-Sound: ${entry.phoneticSound}`, emoji: '🔊', ar: `صوت الحرف ${entry.upper}` },
      { word: `Word Practice: ${entry.cvcExample}`, emoji: '🧩', ar: `كلمة ${entry.cvcExample}` },
    ],
    distractorLowers: [alt1.lower, alt2.lower],
    readingSentence: {
      '1-2': { ar: `${entry.upper} مثل ${entry.wordAr}`, en: `${entry.upper} is for ${entry.word}` },
      '2-3': { ar: `هذه ${entry.wordAr} تبدأ بحرف ${entry.upper}`, en: `Look! A ${entry.word.toLowerCase()} starts with ${entry.upper}.` },
      '3-4': { ar: `ننطق معاً الكلمة القصيرة: ${entry.cvcExample}`, en: `Sound out the playful word: ${entry.cvcExample}` },
    },
  };
}

export interface MathUnitJourneyData {
  id: string;
  title: LocalizedText;
  ageGroups: StoredAgeGroupId[];
  recommendedAgeRange?: RecommendedAgeRange;
  explanation: LocalizedText;
  targetNumber: number;
  emoji: string;
  operationPrompt: LocalizedText;
  operationChoices: Array<{ label: string; isCorrect: boolean }>;
  wordProblem: {
    prompt: LocalizedText;
    choices: Array<{ label: string; isCorrect: boolean }>;
  };
}

export const MATH_DEEP_UNITS: MathUnitJourneyData[] = [
  {
    id: 'math-count-1-5',
    title: { ar: 'رحلة الأعداد والكميات (١ – ٥)', en: 'Quantities & Counting Journey (1–5)' },
    ageGroups: ['1-4'],
    recommendedAgeRange: '1-2',
    explanation: {
      ar: 'الرقم ليس مجرد شكل! الرقم ٣ يعني ثلاث تفاحات حقيقية يمكننا عدّها واحدة تلو الأخرى.',
      en: 'A number is not just a symbol! Number 3 means three real objects we can count one by one.',
    },
    targetNumber: 4,
    emoji: '🍎',
    operationPrompt: { ar: 'أضف تفاحة إلى ٣ تفاحات، كم يصبح المجموع؟', en: 'Add 1 apple to 3 apples. How many altogether?' },
    operationChoices: [
      { label: '3', isCorrect: false },
      { label: '4', isCorrect: true },
      { label: '5', isCorrect: false },
    ],
    wordProblem: {
      prompt: { ar: 'مع نونو تفاحتان، أعطته لولو تفاحتين إضافيتين. كم تفاحة مع نونو الآن؟', en: 'Nono had 2 apples and Lolo gave him 2 more. How many apples now?' },
      choices: [
        { label: '4', isCorrect: true },
        { label: '2', isCorrect: false },
        { label: '6', isCorrect: false },
      ],
    },
  },
  {
    id: 'math-count-1-10',
    title: { ar: 'رحلة العد والمقارنة (١ – ١٠)', en: 'Counting & More/Fewer Adventure (1–10)' },
    ageGroups: ['1-4'],
    recommendedAgeRange: '2-3',
    explanation: {
      ar: 'نعدّ الأشياء حتى ١٠ ونلاحظ أي مجموعة فيها أكثر وأيها فيها أقل!',
      en: 'We count objects up to 10 and spot which basket has more or fewer!',
    },
    targetNumber: 6,
    emoji: '🌟',
    operationPrompt: { ar: 'أضف نجمة واحدة إلى ٥ نجوم، كم يصبح المجموع؟', en: 'Add 1 star to 5 stars. How many now?' },
    operationChoices: [
      { label: '5', isCorrect: false },
      { label: '6', isCorrect: true },
      { label: '7', isCorrect: false },
    ],
    wordProblem: {
      prompt: { ar: 'في السلة ٤ نجوم، أضفنا إليها نجمتين. كم نجمة في السلة الآن؟', en: 'A basket holds 4 stars and we add 2 more. How many stars altogether?' },
      choices: [
        { label: '6', isCorrect: true },
        { label: '4', isCorrect: false },
        { label: '8', isCorrect: false },
      ],
    },
  },
  {
    id: 'math-add-sub-20',
    title: { ar: 'الأرقام والأنماط الأولى (حتى ١٠)', en: 'Early Numbers & Gentle Patterns (Up to 10)' },
    ageGroups: ['1-4'],
    recommendedAgeRange: '3-4',
    explanation: {
      ar: 'عندما نجمع مجموعتين صغيرتين معاً يكبر العدد، وعندما نأخذ عنصراً نعرف الباقي بسهولة!',
      en: 'Joining two small groups makes more, and taking one away shows how many remain!',
    },
    targetNumber: 8,
    emoji: '🧁',
    operationPrompt: { ar: 'إذا كان معنا ٣ كعكات وأضفنا ٣ كعكات، كم مجموعها؟', en: '3 cupcakes plus 3 more cupcakes makes how many?' },
    operationChoices: [
      { label: '5', isCorrect: false },
      { label: '6', isCorrect: true },
      { label: '8', isCorrect: false },
    ],
    wordProblem: {
      prompt: { ar: 'مع تيتي ٥ جزرات، أعطت نونو ٢ جزرة. كم جزرة بقيت معها؟', en: 'Titi had 5 carrots and shared 2 with Nono. How many carrots remain?' },
      choices: [
        { label: '3', isCorrect: true },
        { label: '2', isCorrect: false },
        { label: '5', isCorrect: false },
      ],
    },
  },
];

// =========================================================================
// VALIDATED EXAM QUESTION BANK (180+ UNIQUE MULTI-FORMAT QUESTIONS)
// Ensures 40-question official exams NEVER duplicate questions or feel repetitive!
// =========================================================================

function buildComprehensiveExamBank(): ExamQuestionItem[] {
  const bank: ExamQuestionItem[] = [];

  // 1. Arabic Alphabet & Literacy Bank (28+ questions across ages)
  ARABIC_ALPHABET.forEach((letter, idx) => {
    const distractorA = ARABIC_ALPHABET[(idx + 1) % ARABIC_ALPHABET.length];
    const distractorB = ARABIC_ALPHABET[(idx + 5) % ARABIC_ALPHABET.length];

    // Recognition / Listening question (all ages with age-appropriate cue)
    bank.push({
      id: `q-ar-rec-${letter.id}`,
      subject: 'arabic',
      ageGroups: ['1-4'],
      recommendedAgeRange: '1-4',
      type: idx % 2 === 0 ? 'listening' : 'recognition',
      difficulty: 1,
      lessonRefId: `deep-ar-${letter.id}`,
      lessonTitle: { ar: `حرف ${letter.nameAr} (${letter.char})`, en: `Arabic Letter ${letter.nameEn}` },
      prompt: {
        ar: `اسمع الصوت واختر حرف (${letter.nameAr}) الذي تبدأ به كلمة "${letter.word}":`,
        en: `Listen and pick the Arabic letter for "${letter.word}" (${letter.wordMeaningEn}):`,
      },
      audioText: `${letter.nameAr}، ${letter.word}`,
      audioLang: 'ar',
      visualCue: letter.emoji,
      options: [
        { id: 'a', label: { ar: letter.char, en: letter.char }, visual: letter.char },
        { id: 'b', label: { ar: distractorA.char, en: distractorA.char }, visual: distractorA.char },
        { id: 'c', label: { ar: distractorB.char, en: distractorB.char }, visual: distractorB.char },
      ].sort((x, y) => (idx % 3 === 0 ? x.id.localeCompare(y.id) : y.id.localeCompare(x.id))),
      correctOptionId: 'a',
      explanation: {
        ar: `كلمة (${letter.word}) تبدأ بحرف (${letter.char} — ${letter.nameAr}).`,
        en: `${letter.word} begins with ${letter.char} (${letter.nameEn}).`,
      },
      published: true,
    });

    // Word & Picture Matching / Forms question (18 items)
    if (idx < 18) {
      bank.push({
        id: `q-ar-form-${letter.id}`,
        subject: 'arabic',
        ageGroups: ['1-4'],
        recommendedAgeRange: '3-4',
        type: idx % 2 === 0 ? 'missing-letter' : 'matching',
        difficulty: 2,
        lessonRefId: `deep-ar-${letter.id}`,
        lessonTitle: { ar: `أشكال وموقع حرف ${letter.char}`, en: `Forms of ${letter.nameEn}` },
        prompt: {
          ar: `أي كلمة تحتوي على حرف (${letter.char}) وتطابق الصورة ${letter.emoji}؟`,
          en: `Which Arabic word matches ${letter.emoji} (${letter.wordMeaningEn}) with letter ${letter.char}?`,
        },
        audioText: letter.word,
        audioLang: 'ar',
        visualCue: letter.emoji,
        options: [
          { id: 'a', label: { ar: letter.word, en: letter.word }, visual: letter.emoji },
          { id: 'b', label: { ar: distractorA.word, en: distractorA.word }, visual: distractorA.emoji },
          { id: 'c', label: { ar: distractorB.word, en: distractorB.word }, visual: distractorB.emoji },
        ].sort((x, y) => (idx % 2 === 0 ? x.id.localeCompare(y.id) : y.id.localeCompare(x.id))),
        correctOptionId: 'a',
        explanation: {
          ar: `الصورة ${letter.emoji} تمثل كلمة "${letter.word}".`,
          en: `${letter.emoji} is "${letter.word}".`,
        },
        published: true,
      });
    }
  });

  // 2. English Alphabet & Phonics Bank (42 unique questions for Little Explorers 1-4)
  ENGLISH_ALPHABET.forEach((en, idx) => {
    const alt1 = ENGLISH_ALPHABET[(idx + 2) % ENGLISH_ALPHABET.length];
    const alt2 = ENGLISH_ALPHABET[(idx + 8) % ENGLISH_ALPHABET.length];

    bank.push({
      id: `q-en-phon-${en.id}`,
      subject: 'english',
      ageGroups: ['1-4'],
      recommendedAgeRange: '1-4',
      type: idx % 2 === 0 ? 'listening' : 'matching',
      difficulty: 1,
      lessonRefId: `deep-en-${en.id}`,
      lessonTitle: { ar: `حرف ${en.upper} بالإنجليزية`, en: `English Letter ${en.upper}` },
      prompt: {
        ar: `اختر الحرف الصغير (Lowercase) والصورة المطابقة للحرف (${en.upper}):`,
        en: `Match uppercase "${en.upper}" (${en.phoneticSound}) with its lowercase & word:`,
      },
      audioText: `${en.upper}. ${en.word}`,
      audioLang: 'en',
      visualCue: en.emoji,
      options: [
        { id: 'a', label: { ar: `${en.lower} — ${en.word}`, en: `${en.lower} — ${en.word}` }, visual: en.emoji },
        { id: 'b', label: { ar: `${alt1.lower} — ${alt1.word}`, en: `${alt1.lower} — ${alt1.word}` }, visual: alt1.emoji },
        { id: 'c', label: { ar: `${alt2.lower} — ${alt2.word}`, en: `${alt2.lower} — ${alt2.word}` }, visual: alt2.emoji },
      ].sort((x, y) => (idx % 3 === 1 ? y.id.localeCompare(x.id) : x.id.localeCompare(y.id))),
      correctOptionId: 'a',
      explanation: {
        ar: `${en.upper} يطابق الحرف الصغير ${en.lower} كما في كلمة ${en.word}.`,
        en: `${en.upper} pairs with lowercase ${en.lower} as in ${en.word}.`,
      },
      published: true,
    });

    if (idx < 16) {
      bank.push({
        id: `q-en-cvc-${en.id}`,
        subject: 'english',
        ageGroups: ['1-4'],
        recommendedAgeRange: '3-4',
        type: 'reading',
        difficulty: 2,
        lessonRefId: `deep-en-${en.id}`,
        lessonTitle: { ar: `قراءة وصوتيات ${en.upper}`, en: `Phonics & Reading ${en.upper}` },
        prompt: {
          ar: `أي كلمة إنجليزية تبدأ بصوت الحرف (${en.upper}) (${en.phoneticSound})؟`,
          en: `Which word starts with the phonetic sound of ${en.upper} (${en.phoneticSound})?`,
        },
        audioText: en.word,
        audioLang: 'en',
        options: [
          { id: 'a', label: { ar: en.word, en: en.word }, visual: en.emoji },
          { id: 'b', label: { ar: alt1.word, en: alt1.word }, visual: alt1.emoji },
          { id: 'c', label: { ar: alt2.word, en: alt2.word }, visual: alt2.emoji },
        ].sort((x, y) => (idx % 2 === 0 ? y.id.localeCompare(x.id) : x.id.localeCompare(y.id))),
        correctOptionId: 'a',
        explanation: {
          ar: `كلمة ${en.word} تبدأ بالحرف ${en.upper}.`,
          en: `${en.word} begins with the ${en.upper} sound.`,
        },
        published: true,
      });
    }
  });

  // 3. Mathematics Bank (Counting 1-12, gentle comparisons & sequences for 1-4; legacy 7-8 items preserved separately)
  for (let n = 1; n <= 12; n++) {
    bank.push({
      id: `q-math-qty-${n}`,
      subject: 'math',
      ageGroups: ['1-4'],
      recommendedAgeRange: n <= 5 ? '1-4' : '2-3',
      type: 'quantity',
      difficulty: 1,
      lessonRefId: 'math-count-1-5',
      lessonTitle: { ar: `العدد والكمية (${n})`, en: `Number & Quantity (${n})` },
      prompt: {
        ar: `عدّ النجوم ثم اختر العدد الصحيح:`,
        en: `Count the stars and select the matching number:`,
      },
      visualCue: '⭐'.repeat(n),
      options: [
        { id: 'a', label: { ar: String(n), en: String(n) }, visual: String(n) },
        { id: 'b', label: { ar: String(n + 1), en: String(n + 1) }, visual: String(n + 1) },
        { id: 'c', label: { ar: String(Math.max(1, n - 1)), en: String(Math.max(1, n - 1)) }, visual: String(Math.max(1, n - 1)) },
      ].sort((x, y) => (n % 2 === 0 ? y.id.localeCompare(x.id) : x.id.localeCompare(y.id))),
      correctOptionId: 'a',
      explanation: {
        ar: `يوجد بالضبط ${n} نجوم.`,
        en: `There are exactly ${n} stars.`,
      },
      published: true,
    });
  }

  const mathOps: Array<{
    id: string;
    ages: StoredAgeGroupId[];
    rec?: RecommendedAgeRange;
    type: ExamQuestionItem['type'];
    prompt: LocalizedText;
    ans: string;
    w1: string;
    w2: string;
    exp: LocalizedText;
  }> = [
    { id: 'm-add-1', ages: ['1-4'], rec: '3-4', type: 'problem-solving', prompt: { ar: 'تفاحتان + تفاحة واحدة = ؟ 🍎🍎 + 🍎', en: '2 apples + 1 apple = ? 🍎🍎 + 🍎' }, ans: '3', w1: '2', w2: '4', exp: { ar: '2 + 1 = 3', en: '2 + 1 = 3' } },
    { id: 'm-add-2', ages: ['1-4'], rec: '3-4', type: 'problem-solving', prompt: { ar: '٣ نجوم + نجمتان = ؟ ⭐⭐⭐ + ⭐⭐', en: '3 stars + 2 stars = ? ⭐⭐⭐ + ⭐⭐' }, ans: '5', w1: '4', w2: '6', exp: { ar: '3 + 2 = 5', en: '3 + 2 = 5' } },
    { id: 'm-sub-1', ages: ['1-4'], rec: '3-4', type: 'problem-solving', prompt: { ar: 'معك ٤ بالونات، طار واحد. كم بقي؟', en: 'You have 4 balloons and 1 floats away. How many left?' }, ans: '3', w1: '2', w2: '5', exp: { ar: '4 - 1 = 3', en: '4 - 1 = 3' } },
    { id: 'm-seq-1', ages: ['1-4'], rec: '2-3', type: 'sequence', prompt: { ar: 'ما العدد الناقص: 1 ، 2 ، __ ، 4 ؟', en: 'Find the missing number: 1, 2, __, 4' }, ans: '3', w1: '5', w2: '6', exp: { ar: 'بعد 2 يأتي 3.', en: 'Counting 1, 2, 3, 4!' } },
    { id: 'm-cmp-1', ages: ['1-4'], rec: '3-4', type: 'recognition', prompt: { ar: 'أي عدد أكبر من 4 وأصغر من 6؟', en: 'Which number is greater than 4 and less than 6?' }, ans: '5', w1: '3', w2: '7', exp: { ar: 'العدد بين 4 و 6 هو 5.', en: '5 sits right between 4 and 6.' } },
    { id: 'm-mul-1', ages: ['7', '8'], type: 'problem-solving', prompt: { ar: '3 مجموعات في كل مجموعة 5 نجوم = ؟', en: '3 groups of 5 stars equals how many?' }, ans: '15', w1: '8', w2: '12', exp: { ar: '3 × 5 = 15', en: '3 × 5 = 15' } },
    { id: 'm-div-1', ages: ['7', '8'], type: 'problem-solving', prompt: { ar: 'وزعنا 18 قطعة حلوى على 3 أطفال بالتساوي. كم يأخذ كل طفل؟', en: 'Share 18 candies equally among 3 kids. Each gets:' }, ans: '6', w1: '5', w2: '9', exp: { ar: '18 ÷ 3 = 6', en: '18 ÷ 3 = 6' } },
    { id: 'm-frac-1', ages: ['7', '8'], type: 'recognition', prompt: { ar: 'قسّمنا فطيرة إلى 4 أجزاء متساوية وأكلنا جزءاً واحداً. ما الكسر؟', en: 'A pie is cut into 4 equal slices and 1 is eaten. Which fraction?' }, ans: '1/4', w1: '1/2', w2: '3/4', exp: { ar: 'جزء من أربعة يساوي ربع (1/4).', en: '1 out of 4 equal parts is 1/4.' } },
  ];

  mathOps.forEach((m, idx) => {
    bank.push({
      id: `q-math-${m.id}`,
      subject: 'math',
      ageGroups: m.ages,
      recommendedAgeRange: m.rec,
      type: m.type,
      difficulty: m.ages.includes('8') ? 3 : m.rec === '3-4' ? 2 : 1,
      lessonRefId: m.ages.includes('1-4') ? 'math-count-1-5' : 'math-add-sub-20',
      lessonTitle: { ar: 'العد والمنطق المبكر', en: 'Counting & Early Reasoning' },
      prompt: m.prompt,
      options: [
        { id: 'a', label: { ar: m.ans, en: m.ans }, visual: m.ans },
        { id: 'b', label: { ar: m.w1, en: m.w1 }, visual: m.w1 },
        { id: 'c', label: { ar: m.w2, en: m.w2 }, visual: m.w2 },
      ].sort((x, y) => (idx % 2 === 0 ? x.id.localeCompare(y.id) : y.id.localeCompare(x.id))),
      correctOptionId: 'a',
      explanation: m.exp,
      published: true,
    });
  });

  // 4. Colors, Shapes & Science Bank (40+ questions for Little Explorers 1-4)
  ACADEMY_COLORS.forEach((col, idx) => {
    const other1 = ACADEMY_COLORS[(idx + 2) % ACADEMY_COLORS.length];
    const other2 = ACADEMY_COLORS[(idx + 5) % ACADEMY_COLORS.length];
    bank.push({
      id: `q-col-${col.id}`,
      subject: 'colors-science',
      ageGroups: ['1-4'],
      recommendedAgeRange: '1-4',
      type: idx % 2 === 0 ? 'listening' : 'matching',
      difficulty: 1,
      lessonRefId: `deep-color-${col.id}`,
      lessonTitle: { ar: `اللون ال${col.name.ar}`, en: `Color ${col.name.en}` },
      prompt: {
        ar: `أي مجموعة أشياء يغلب عليها اللون ال${col.name.ar}؟`,
        en: `Which real-world items belong to the color ${col.name.en}?`,
      },
      audioText: `${col.name.ar}`,
      audioLang: 'ar',
      options: [
        { id: 'a', label: col.examples, visual: col.emojis },
        { id: 'b', label: other1.examples, visual: other1.emojis },
        { id: 'c', label: other2.examples, visual: other2.emojis },
      ].sort((x, y) => (idx % 2 === 0 ? y.id.localeCompare(x.id) : x.id.localeCompare(y.id))),
      correctOptionId: 'a',
      explanation: {
        ar: `أمثلة اللون ${col.name.ar}: ${col.examples.ar}.`,
        en: `${col.name.en} examples: ${col.examples.en}.`,
      },
      published: true,
    });
  });

  const scienceAndShapes: Array<{
    id: string;
    ages: StoredAgeGroupId[];
    rec?: RecommendedAgeRange;
    prompt: LocalizedText;
    ans: { visual: string; label: LocalizedText };
    w1: { visual: string; label: LocalizedText };
    w2: { visual: string; label: LocalizedText };
    exp: LocalizedText;
  }> = [
    {
      id: 'cs-mix-1',
      ages: ['1-4'],
      rec: '2-3',
      prompt: { ar: 'عند مزج الأحمر + الأصفر ينتج اللون:', en: 'Mixing Red + Yellow makes:' },
      ans: { visual: '🟠', label: { ar: 'برتقالي', en: 'Orange' } },
      w1: { visual: '🟢', label: { ar: 'أخضر', en: 'Green' } },
      w2: { visual: '🟣', label: { ar: 'بنفسجي', en: 'Purple' } },
      exp: { ar: 'الأحمر مع الأصفر يصنعان اللون البرتقالي!', en: 'Red and Yellow mix into Orange!' },
    },
    {
      id: 'cs-mix-2',
      ages: ['1-4'],
      rec: '2-3',
      prompt: { ar: 'عند مزج الأزرق + الأصفر ينتج اللون:', en: 'Mixing Blue + Yellow makes:' },
      ans: { visual: '🟢', label: { ar: 'أخضر', en: 'Green' } },
      w1: { visual: '🟣', label: { ar: 'بنفسجي', en: 'Purple' } },
      w2: { visual: '🟠', label: { ar: 'برتقالي', en: 'Orange' } },
      exp: { ar: 'الأزرق + الأصفر = أخضر!', en: 'Blue + Yellow = Green!' },
    },
    {
      id: 'cs-shape-1',
      ages: ['1-4'],
      rec: '1-4',
      prompt: { ar: 'أي شكل له ٣ أضلاع؟', en: 'Which shape has 3 sides?' },
      ans: { visual: '🔺', label: { ar: 'مثلث', en: 'Triangle' } },
      w1: { visual: '⭕', label: { ar: 'دائرة', en: 'Circle' } },
      w2: { visual: '🟦', label: { ar: 'مربع', en: 'Square' } },
      exp: { ar: 'المثلث له ٣ أضلاع.', en: 'A triangle has 3 sides.' },
    },
    {
      id: 'cs-shape-2',
      ages: ['7', '8'],
      prompt: { ar: 'كم ضلعاً للشكل السداسي (Hexagon) كما في خلية النحل؟', en: 'How many sides does a honeycomb Hexagon have?' },
      ans: { visual: '⬡', label: { ar: '6 أضلاع', en: '6 sides' } },
      w1: { visual: '⬠', label: { ar: '5 أضلاع', en: '5 sides' } },
      w2: { visual: '🟦', label: { ar: '4 أضلاع', en: '4 sides' } },
      exp: { ar: 'السداسي له 6 أضلاع متصلة.', en: 'A hexagon has 6 sides.' },
    },
    {
      id: 'cs-sci-1',
      ages: ['1-4'],
      rec: '3-4',
      prompt: { ar: 'ماذا تحتاج النباتات الخضراء لتكبر بسعادة؟', en: 'What helps green plants grow happily?' },
      ans: { visual: '☀️', label: { ar: 'الماء والشمس', en: 'Water & Sun' } },
      w1: { visual: '🪨', label: { ar: 'الصخور', en: 'Rocks' } },
      w2: { visual: '🍭', label: { ar: 'الحلوى', en: 'Candy' } },
      exp: { ar: 'النباتات تحتاج للماء وضوء الشمس.', en: 'Plants love water and warm sunlight!' },
    },
    {
      id: 'cs-sci-2',
      ages: ['1-4'],
      rec: '2-3',
      prompt: { ar: 'أين ينبض القلب داخل جسمنا؟ ❤️', en: 'Where is our happy beating heart? ❤️' },
      ans: { visual: '❤️', label: { ar: 'في الصدر', en: 'Inside our chest' } },
      w1: { visual: '👟', label: { ar: 'في الحذاء', en: 'In our shoe' } },
      w2: { visual: '👒', label: { ar: 'فوق القبعة', en: 'On our hat' } },
      exp: { ar: 'القلب الجميل ينبض داخل صدرنا!', en: 'Our heart beats gently inside our chest!' },
    },
    {
      id: 'cs-space-1',
      ages: ['1-4'],
      rec: '3-4',
      prompt: { ar: 'ما الكوكب الجميل الذي نعيش عليه؟', en: 'Which planet is our home?' },
      ans: { visual: '🌍', label: { ar: 'كوكب الأرض', en: 'Earth' } },
      w1: { visual: '🪐', label: { ar: 'زحل', en: 'Saturn' } },
      w2: { visual: '☀️', label: { ar: 'الشمس', en: 'The Sun' } },
      exp: { ar: 'كوكب الأرض هو بيتنا الأزرق والأخضر.', en: 'Planet Earth is our home.' },
    },
    {
      id: 'cs-geo-1',
      ages: ['1-4'],
      rec: '1-4',
      prompt: { ar: 'أين تسبح الأسماك اللطيفة؟', en: 'Where do friendly fish swim?' },
      ans: { visual: '🌊', label: { ar: 'في الماء والبحر', en: 'Water & Ocean' } },
      w1: { visual: '🏜️', label: { ar: 'في الصحراء الجافة', en: 'Dry Desert' } },
      w2: { visual: '☁️', label: { ar: 'فوق السحاب', en: 'In Clouds' } },
      exp: { ar: 'الأسماك تعيش وتسبح في الماء.', en: 'Fish swim happily in water.' },
    },
  ];

  scienceAndShapes.forEach((sc, idx) => {
    bank.push({
      id: `q-cs-${sc.id}`,
      subject: 'colors-science',
      ageGroups: sc.ages,
      recommendedAgeRange: sc.rec,
      type: 'problem-solving',
      difficulty: sc.ages.includes('8') ? 3 : sc.rec === '3-4' ? 2 : 1,
      lessonRefId: 'science-colors-shapes',
      lessonTitle: { ar: 'الألوان والأشكال والطبيعة', en: 'Colors, Shapes & Nature' },
      prompt: sc.prompt,
      options: [
        { id: 'a', label: sc.ans.label, visual: sc.ans.visual },
        { id: 'b', label: sc.w1.label, visual: sc.w1.visual },
        { id: 'c', label: sc.w2.label, visual: sc.w2.visual },
      ].sort((x, y) => (idx % 2 === 0 ? x.id.localeCompare(y.id) : y.id.localeCompare(x.id))),
      correctOptionId: 'a',
      explanation: sc.exp,
      published: true,
    });
  });

  // Expand gentle 1-4 Math Bank so Little Explorers has 40+ distinct age-appropriate Math questions
  for (let a = 1; a <= 12; a++) {
    const b = (a % 2) + 1;
    const sum = a + b;
    bank.push({
      id: `q-math-gen-add-${a}-${b}`,
      subject: 'math',
      ageGroups: ['1-4'],
      recommendedAgeRange: a <= 5 ? '2-3' : '3-4',
      type: 'problem-solving',
      difficulty: a <= 5 ? 1 : 2,
      lessonRefId: 'math-count-1-5',
      lessonTitle: { ar: `نعدّ معاً (${a} + ${b})`, en: `Counting Together (${a} + ${b})` },
      prompt: {
        ar: `إذا أضفنا ${b} إلى ${a} فما الناتج الصحيح؟`,
        en: `If we add ${b} to ${a}, how many do we have?`,
      },
      visualCue: a <= 5 ? `${'🍎'.repeat(a)} + ${'🍎'.repeat(b)}` : undefined,
      options: [
        { id: 'a', label: { ar: String(sum), en: String(sum) }, visual: String(sum) },
        { id: 'b', label: { ar: String(sum + 1), en: String(sum + 1) }, visual: String(sum + 1) },
        { id: 'c', label: { ar: String(Math.max(1, sum - 1)), en: String(Math.max(1, sum - 1)) }, visual: String(Math.max(1, sum - 1)) },
      ].sort((x, y) => (a % 2 === 0 ? x.id.localeCompare(y.id) : y.id.localeCompare(x.id))),
      correctOptionId: 'a',
      explanation: { ar: `${a} + ${b} = ${sum}`, en: `${a} + ${b} = ${sum}` },
      published: true,
    });
  }

  for (let start = 3; start <= 11; start++) {
    const take = (start % 2) + 1;
    const rem = start - take;
    bank.push({
      id: `q-math-gen-sub-${start}-${take}`,
      subject: 'math',
      ageGroups: ['1-4'],
      recommendedAgeRange: start <= 6 ? '2-3' : '3-4',
      type: 'problem-solving',
      difficulty: start <= 6 ? 1 : 2,
      lessonRefId: 'math-count-1-5',
      lessonTitle: { ar: `كم تبقى؟ (${start} - ${take})`, en: `How Many Left? (${start} - ${take})` },
      prompt: {
        ar: `كان معنا ${start} وأخذنا ${take}، كم تبقى؟`,
        en: `We had ${start} and took ${take} away. How many are left?`,
      },
      visualCue: start <= 6 ? `${'🍓'.repeat(start)} (−${take})` : undefined,
      options: [
        { id: 'a', label: { ar: String(rem), en: String(rem) }, visual: String(rem) },
        { id: 'b', label: { ar: String(rem + 2), en: String(rem + 2) }, visual: String(rem + 2) },
        { id: 'c', label: { ar: String(Math.max(0, rem - 1)), en: String(Math.max(0, rem - 1)) }, visual: String(Math.max(0, rem - 1)) },
      ].sort((x, y) => (start % 3 === 0 ? y.id.localeCompare(x.id) : x.id.localeCompare(y.id))),
      correctOptionId: 'a',
      explanation: { ar: `${start} - ${take} = ${rem}`, en: `${start} - ${take} = ${rem}` },
      published: true,
    });
  }

  // Compare questions for Little Explorers 1-4
  for (let m = 2; m <= 11; m++) {
    const right = m + 3;
    bank.push({
      id: `q-math-cmp-auto-${m}`,
      subject: 'math',
      ageGroups: ['1-4'],
      recommendedAgeRange: m <= 5 ? '2-3' : '3-4',
      type: 'recognition',
      difficulty: 1,
      lessonRefId: 'math-count-1-5',
      lessonTitle: { ar: 'مقارنة الأعداد', en: 'Comparing Numbers' },
      prompt: {
        ar: `ما العدد الأكبر بين الأعداد التالية؟`,
        en: `Which number is the largest?`,
      },
      options: [
        { id: 'a', label: { ar: String(right), en: String(right) }, visual: String(right) },
        { id: 'b', label: { ar: String(m), en: String(m) }, visual: String(m) },
        { id: 'c', label: { ar: String(Math.max(1, m - 1)), en: String(Math.max(1, m - 1)) }, visual: String(Math.max(1, m - 1)) },
      ].sort((x, y) => (m % 2 === 0 ? y.id.localeCompare(x.id) : x.id.localeCompare(y.id))),
      correctOptionId: 'a',
      explanation: { ar: `${right} أكبر من ${m}.`, en: `${right} is greater than ${m}.` },
      published: true,
    });
  }

  for (let f = 2; f <= 9; f++) {
    const prod = f * 3;
    bank.push({
      id: `q-math-mul-auto-${f}`,
      subject: 'math',
      ageGroups: ['7', '8'],
      type: 'problem-solving',
      difficulty: 3,
      lessonRefId: 'math-mult-div-7',
      lessonTitle: { ar: `جدول الضرب (${f} × 3)`, en: `Multiplication (${f} × 3)` },
      prompt: { ar: `كم يساوي ${f} × 3 ؟`, en: `What is ${f} × 3?` },
      options: [
        { id: 'a', label: { ar: String(prod), en: String(prod) }, visual: String(prod) },
        { id: 'b', label: { ar: String(prod + 3), en: String(prod + 3) }, visual: String(prod + 3) },
        { id: 'c', label: { ar: String(prod - 2), en: String(prod - 2) }, visual: String(prod - 2) },
      ].sort((x, y) => (f % 2 === 0 ? x.id.localeCompare(y.id) : y.id.localeCompare(x.id))),
      correctOptionId: 'a',
      explanation: { ar: `${f} × 3 = ${prod}`, en: `${f} × 3 = ${prod}` },
      published: true,
    });
  }

  // Expand Colors, Shapes, Animals, Nature & Science so single-subject exam has 40+ unique Little Explorers items
  const extraWorldItems: Array<{
    id: string;
    rec: RecommendedAgeRange;
    prompt: LocalizedText;
    ans: { visual: string; label: LocalizedText };
    w1: { visual: string; label: LocalizedText };
    w2: { visual: string; label: LocalizedText };
    exp: LocalizedText;
  }> = [
    { id: 'ew-1', rec: '1-4', prompt: { ar: 'أي حيوان يسبح في الماء؟', en: 'Which animal swims in water?' }, ans: { visual: '🐟', label: { ar: 'السمكة', en: 'Fish' } }, w1: { visual: '🦁', label: { ar: 'الأسد', en: 'Lion' } }, w2: { visual: '🦅', label: { ar: 'النسر', en: 'Eagle' } }, exp: { ar: 'السمكة تعيش وتسبح في الماء.', en: 'Fish live in water.' } },
    { id: 'ew-2', rec: '1-4', prompt: { ar: 'بماذا نسمع الموسيقى الجميلة؟', en: 'What do we use to hear lovely music?' }, ans: { visual: '👂', label: { ar: 'الأذن', en: 'Ears' } }, w1: { visual: '👃', label: { ar: 'الأنف', en: 'Nose' } }, w2: { visual: '👅', label: { ar: 'اللسان', en: 'Tongue' } }, exp: { ar: 'نسمع الأصوات بالأذن.', en: 'We hear sounds with our ears.' } },
    { id: 'ew-3', rec: '1-4', prompt: { ar: 'أي شكل مستدير تماماً مثل العجلة؟', en: 'Which shape is round like a wheel?' }, ans: { visual: '⭕', label: { ar: 'الدائرة', en: 'Circle' } }, w1: { visual: '🔺', label: { ar: 'المثلث', en: 'Triangle' } }, w2: { visual: '🟦', label: { ar: 'المربع', en: 'Square' } }, exp: { ar: 'الدائرة مستديرة بلا زوايا.', en: 'A circle is round with no corners.' } },
    { id: 'ew-4', rec: '2-3', prompt: { ar: 'ما الفصل الذي تتساقط فيه أوراق الأشجار؟', en: 'In which season do many tree leaves fall?' }, ans: { visual: '🍂', label: { ar: 'الخريف', en: 'Autumn' } }, w1: { visual: '☀️', label: { ar: 'الصيف', en: 'Summer' } }, w2: { visual: '🌸', label: { ar: 'الربيع', en: 'Spring' } }, exp: { ar: 'تتساقط الأوراق في فصل الخريف.', en: 'Leaves fall in autumn.' } },
    { id: 'ew-5', rec: '1-4', prompt: { ar: 'متى نرى القمر والنجوم بوضوح؟', en: 'When do we see the Moon and stars?' }, ans: { visual: '🌙', label: { ar: 'في الليل', en: 'At Night' } }, w1: { visual: '☀️', label: { ar: 'في الصباح', en: 'In Morning' } }, w2: { visual: '🌈', label: { ar: 'تحت الماء', en: 'Underwater' } }, exp: { ar: 'نرى القمر والنجوم في سماء الليل.', en: 'We see the Moon and stars in the night sky.' } },
    { id: 'ew-6', rec: '2-3', prompt: { ar: 'ما المشروب المفيد للأسنان والعظام؟', en: 'Which drink keeps bones and teeth strong?' }, ans: { visual: '🥛', label: { ar: 'الحليب', en: 'Milk' } }, w1: { visual: '🍭', label: { ar: 'الحلوى الكثيرة', en: 'Candy' } }, w2: { visual: '🥤', label: { ar: 'المشروبات الغازية', en: 'Soda' } }, exp: { ar: 'الحليب مفيد جداً للعظام القوية.', en: 'Milk helps keep bones strong.' } },
    { id: 'ew-7', rec: '2-3', prompt: { ar: 'ما اللون الناتج عن مزج الأحمر والأبيض؟', en: 'What color comes from mixing Red + White?' }, ans: { visual: '🩷', label: { ar: 'الوردي', en: 'Pink' } }, w1: { visual: '🟢', label: { ar: 'الأخضر', en: 'Green' } }, w2: { visual: '🔵', label: { ar: 'الأزرق', en: 'Blue' } }, exp: { ar: 'الأحمر مع الأبيض يعطي اللون الوردي.', en: 'Red + White creates Pink.' } },
    { id: 'ew-8', rec: '2-3', prompt: { ar: 'ما اللون الناتج عن مزج الأحمر والأزرق؟', en: 'What color comes from mixing Red + Blue?' }, ans: { visual: '🟣', label: { ar: 'البنفسجي', en: 'Purple' } }, w1: { visual: '🟡', label: { ar: 'الأصفر', en: 'Yellow' } }, w2: { visual: '🟠', label: { ar: 'البرتقالي', en: 'Orange' } }, exp: { ar: 'الأحمر + الأزرق = بنفسجي.', en: 'Red + Blue = Purple.' } },
    { id: 'ew-9', rec: '1-4', prompt: { ar: 'ماذا نفعل قبل تناول الطعام؟', en: 'What should we do before eating?' }, ans: { visual: '🧼', label: { ar: 'غسل اليدين بالماء والصابون', en: 'Wash hands with soap & water' } }, w1: { visual: '🎨', label: { ar: 'اللعب بالتراب', en: 'Play in mud' } }, w2: { visual: '😴', label: { ar: 'النوم فوراً', en: 'Go straight to sleep' } }, exp: { ar: 'غسل اليدين يحافظ على نظافتنا.', en: 'Washing hands keeps us clean.' } },
    { id: 'ew-10', rec: '1-4', prompt: { ar: 'أي طائر لطيف له عينان كبيرتان في الليل؟', en: 'Which cute bird has big eyes at night?' }, ans: { visual: '🦉', label: { ar: 'البومة', en: 'Owl' } }, w1: { visual: '🐧', label: { ar: 'البطريق', en: 'Penguin' } }, w2: { visual: '🦆', label: { ar: 'البطة', en: 'Duck' } }, exp: { ar: 'البومة طائر ليلي ذو عينين واسعتين.', en: 'Owls have big night eyes.' } },
    { id: 'ew-11', rec: '2-3', prompt: { ar: 'كم ضلعاً للمربع؟', en: 'How many sides does a square have?' }, ans: { visual: '🟦', label: { ar: '4 أضلاع', en: '4 sides' } }, w1: { visual: '🔺', label: { ar: '3 أضلاع', en: '3 sides' } }, w2: { visual: '⭕', label: { ar: '0 أضلاع', en: '0 sides' } }, exp: { ar: 'المربع له 4 أضلاع متساوية.', en: 'A square has 4 equal sides.' } },
    { id: 'ew-12', rec: '3-4', prompt: { ar: 'ماذا تحتاج البذرة لتنمو وتصبح نبتة؟', en: 'What does a seed need to sprout and grow?' }, ans: { visual: '💧', label: { ar: 'الماء وضوء الشمس', en: 'Water & Sunlight' } }, w1: { visual: '🧊', label: { ar: 'الثلج فقط', en: 'Only Ice' } }, w2: { visual: '🪨', label: { ar: 'حجارة مغلقة', en: 'Closed Rocks' } }, exp: { ar: 'تحتاج البذور للماء وضوء الشمس.', en: 'Seeds need water and sunlight.' } },
  ];

  extraWorldItems.forEach((ew, idx) => {
    bank.push({
      id: `q-cs-extra-${ew.id}`,
      subject: 'colors-science',
      ageGroups: ['1-4'],
      recommendedAgeRange: ew.rec,
      type: 'recognition',
      difficulty: 1,
      lessonRefId: 'science-colors-shapes',
      lessonTitle: { ar: 'العلوم والطبيعة والأشكال', en: 'Science, Nature & Shapes' },
      prompt: ew.prompt,
      options: [
        { id: 'a', label: ew.ans.label, visual: ew.ans.visual },
        { id: 'b', label: ew.w1.label, visual: ew.w1.visual },
        { id: 'c', label: ew.w2.label, visual: ew.w2.visual },
      ].sort((x, y) => (idx % 2 === 0 ? x.id.localeCompare(y.id) : y.id.localeCompare(x.id))),
      correctOptionId: 'a',
      explanation: ew.exp,
      published: true,
    });
  });

  ACADEMY_COLORS.forEach((col, idx) => {
    const otherA = ACADEMY_COLORS[(idx + 1) % ACADEMY_COLORS.length];
    const otherB = ACADEMY_COLORS[(idx + 4) % ACADEMY_COLORS.length];
    bank.push({
      id: `q-cs-swatch-${col.id}`,
      subject: 'colors-science',
      ageGroups: ['1-4'],
      recommendedAgeRange: '1-4',
      type: 'matching',
      difficulty: 1,
      lessonRefId: `deep-color-${col.id}`,
      lessonTitle: { ar: `تطبيق اللون ${col.name.ar}`, en: `Applying ${col.name.en}` },
      prompt: {
        ar: `اختر الرمز اللوني المطابق لكلمة (${col.name.ar}):`,
        en: `Choose the color name matching ${col.emojis[0]}:`,
      },
      options: [
        { id: 'a', label: col.name, visual: col.emojis[0] },
        { id: 'b', label: otherA.name, visual: otherA.emojis[0] },
        { id: 'c', label: otherB.name, visual: otherB.emojis[0] },
      ].sort((x, y) => (idx % 2 === 0 ? x.id.localeCompare(y.id) : y.id.localeCompare(x.id))),
      correctOptionId: 'a',
      explanation: { ar: `${col.name.ar} — ${col.name.en}`, en: `${col.name.en} — ${col.name.ar}` },
      published: true,
    });
  });

  ACADEMY_COLORS.forEach((col, idx) => {
    const otherA = ACADEMY_COLORS[(idx + 3) % ACADEMY_COLORS.length];
    const otherB = ACADEMY_COLORS[(idx + 6) % ACADEMY_COLORS.length];
    bank.push({
      id: `q-cs-identify-${col.id}`,
      subject: 'colors-science',
      ageGroups: ['1-4'],
      recommendedAgeRange: '2-3',
      type: 'recognition',
      difficulty: 1,
      lessonRefId: `deep-color-${col.id}`,
      lessonTitle: { ar: `تمييز اللون ${col.name.ar}`, en: `Recognizing ${col.name.en}` },
      prompt: {
        ar: `أي لون ينتمي إلى: ${col.examples.ar}؟`,
        en: `Which color matches: ${col.examples.en}?`,
      },
      options: [
        { id: 'a', label: col.name, visual: col.emojis },
        { id: 'b', label: otherA.name, visual: otherA.emojis },
        { id: 'c', label: otherB.name, visual: otherB.emojis },
      ].sort((x, y) => (idx % 2 === 0 ? y.id.localeCompare(x.id) : x.id.localeCompare(y.id))),
      correctOptionId: 'a',
      explanation: { ar: `الإجابة: ${col.name.ar}.`, en: `Answer: ${col.name.en}.` },
      published: true,
    });
  });

  for (let num = 2; num <= 11; num++) {
    bank.push({
      id: `q-math-after-${num}`,
      subject: 'math',
      ageGroups: ['1-4'],
      recommendedAgeRange: num <= 5 ? '2-3' : '3-4',
      type: 'sequence',
      difficulty: 1,
      lessonRefId: 'math-count-1-5',
      lessonTitle: { ar: `العدد التالي للعدد ${num}`, en: `Number After ${num}` },
      prompt: {
        ar: `ما العدد الذي يأتي مباشرة بعد العدد ${num}؟`,
        en: `Which number comes right after ${num}?`,
      },
      options: [
        { id: 'a', label: { ar: String(num + 1), en: String(num + 1) }, visual: String(num + 1) },
        { id: 'b', label: { ar: String(num - 1), en: String(num - 1) }, visual: String(num - 1) },
        { id: 'c', label: { ar: String(num + 2), en: String(num + 2) }, visual: String(num + 2) },
      ].sort((x, y) => (num % 2 === 0 ? x.id.localeCompare(y.id) : y.id.localeCompare(x.id))),
      correctOptionId: 'a',
      explanation: { ar: `بعد ${num} يأتي ${num + 1}.`, en: `Right after ${num} comes ${num + 1}.` },
      published: true,
    });
  }

  return bank;
}

export const VALIDATED_EXAM_BANK: ExamQuestionItem[] = buildComprehensiveExamBank();

export const AGE_CURRICULUM_OUTCOMES: Record<
  AgeGroupId,
  {
    title: LocalizedText;
    focusAreas: LocalizedText[];
    expectedOutcome: LocalizedText;
    guidanceStyle: LocalizedText;
  }
> = {
  '1-4': {
    title: { ar: 'منهج المستكشفون الصغار (١–٤ سنوات)', en: 'Little Explorers Curriculum (Ages 1–4)' },
    focusAreas: [
      { ar: 'الاستكشاف الحسي والأصوات والألوان والصور التفاعلية (١–٢ سنة)', en: 'Sensory Play, Sounds, Colors & Pictures (Ages 1–2)' },
      { ar: 'المفردات والمطابقة والفرز والعد والأشكال الأساسية (٢–٣ سنوات)', en: 'Vocabulary, Matching, Sorting, Counting & Shapes (Ages 2–3)' },
      { ar: 'الحروف والصوتيات المبكرة والأنماط والقصص التفاعلية (٣–٤ سنوات)', en: 'Early Letters, Phonics, Patterns & Stories (Ages 3–4)' },
      { ar: 'تكيّف تلقائي ذكي حسب عمر الطفل ومستوى تقدمه', en: 'Seamless Internal Adaptation by Age & Ability' },
    ],
    expectedOutcome: {
      ar: 'ينمو الطفل بخطوات لطيفة ومتدرجة من الاستكشاف الحسي واللغوي المبكر إلى الحروف والأرقام والمنطق البسيط.',
      en: 'Children progress gently from sensory play and first words to counting, patterns, early phonics, and interactive stories.',
    },
    guidanceStyle: {
      ar: 'تجربة موحدة دافئة تتكيف داخلياً مع عمر كل طفل وقدراته',
      en: 'One unified world that silently adapts complexity to each child',
    },
  },
};


