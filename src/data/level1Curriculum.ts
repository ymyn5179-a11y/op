import {
  Level1LessonDefinition,
  Level1Subject,
  Level1VocabItem,
  LocalizedText,
} from '../types/nonoland';
import academyAudioLookup from './academyAudioLookup.json';
import {
  type AcademyAudioLang,
  normalizeAcademyAudioText,
  resolveLevel1VocabSpokenText,
} from '../utils/academyAudioText';

const audioLookupMaps = academyAudioLookup as {
  ar: Record<string, string>;
  en: Record<string, string>;
};

function hasPreGeneratedAudio(text: string, lang: AcademyAudioLang): boolean {
  const clean = normalizeAcademyAudioText(text);
  if (!clean) return false;
  return Boolean((lang === 'en' ? audioLookupMaps.en : audioLookupMaps.ar)?.[clean]);
}

function makeVocab(
  prefix: string,
  items: Array<[string, string, string]>,
  lang: AcademyAudioLang,
  subject: Level1Subject,
): Level1VocabItem[] {
  return items.map(([text, secondaryText, emoji], idx) => ({
    id: `${prefix}-v${idx + 1}`,
    text,
    secondaryText,
    emoji,
    audioStatus: hasPreGeneratedAudio(
      resolveLevel1VocabSpokenText(subject, { text, secondaryText }, lang),
      lang,
    )
      ? 'verified_audio'
      : 'pregenerated_pending',
  }));
}

// =========================================================================
// 1. ARABIC LETTERS — EXACT 28 LESSONS (AR01 – AR28)
// =========================================================================
const ARABIC_SPEC: Array<{
  id: string;
  char: string;
  nameAr: string;
  nameEn: string;
  teach: Array<[string, string, string]>;
  unseen: Array<[string, string, string]>;
}> = [
  { id: 'AR01', char: 'أ', nameAr: 'الألف', nameEn: 'Alif', teach: [['أسد', 'Lion', '🦁'], ['أرنب', 'Rabbit', '🐰']], unseen: [['أناناس', 'Pineapple', '🍍'], ['أذن', 'Ear', '👂'], ['أم', 'Mother', '👩'], ['إبرة', 'Needle', '🪡']] },
  { id: 'AR02', char: 'ب', nameAr: 'الباء', nameEn: 'Baa', teach: [['بطة', 'Duck', '🦆'], ['باب', 'Door', '🚪']], unseen: [['بيت', 'House', '🏠'], ['برتقال', 'Orange', '🍊'], ['بقرة', 'Cow', '🐄']] },
  { id: 'AR03', char: 'ت', nameAr: 'التاء', nameEn: 'Taa', teach: [['تفاحة', 'Apple', '🍎'], ['تاج', 'Crown', '👑']], unseen: [['تمساح', 'Crocodile', '🐊'], ['توت', 'Berry', '🍓'], ['تين', 'Fig', '🫐']] },
  { id: 'AR04', char: 'ث', nameAr: 'الثاء', nameEn: 'Thaa', teach: [['ثعلب', 'Fox', '🦊'], ['ثوب', 'Robe', '👘']], unseen: [['ثلج', 'Snow', '❄️'], ['ثوم', 'Garlic', '🧄'], ['ثعبان', 'Snake', '🐍']] },
  { id: 'AR05', char: 'ج', nameAr: 'الجيم', nameEn: 'Jeem', teach: [['جمل', 'Camel', '🐪'], ['جزر', 'Carrot', '🥕']], unseen: [['جرس', 'Bell', '🔔'], ['جبن', 'Cheese', '🧀'], ['جسر', 'Bridge', '🌉']] },
  { id: 'AR06', char: 'ح', nameAr: 'الحاء', nameEn: 'Haa', teach: [['حصان', 'Horse', '🐴'], ['حوت', 'Whale', '🐋']], unseen: [['حقيبة', 'Bag', '🎒'], ['حذاء', 'Shoe', '👟'], ['حمامة', 'Dove', '🕊️']] },
  { id: 'AR07', char: 'خ', nameAr: 'الخاء', nameEn: 'Khaa', teach: [['خروف', 'Sheep', '🐑'], ['خيار', 'Cucumber', '🥒']], unseen: [['خبز', 'Bread', '🍞'], ['خيمة', 'Tent', '⛺'], ['خاتم', 'Ring', '💍']] },
  { id: 'AR08', char: 'د', nameAr: 'الدال', nameEn: 'Daal', teach: [['دب', 'Bear', '🐻'], ['دجاجة', 'Hen', '🐔']], unseen: [['دراجة', 'Bicycle', '🚲'], ['دولفين', 'Dolphin', '🐬'], ['دلو', 'Bucket', '🪣']] },
  { id: 'AR09', char: 'ذ', nameAr: 'الذال', nameEn: 'Dhaal', teach: [['ذرة', 'Corn', '🌽'], ['ذئب', 'Wolf', '🐺']], unseen: [['ذهب', 'Gold', '🪙'], ['ذباب', 'Fly', '🪰'], ['ذيل', 'Tail', '🐕']] },
  { id: 'AR10', char: 'ر', nameAr: 'الراء', nameEn: 'Raa', teach: [['رمان', 'Pomegranate', '🍎'], ['ريشة', 'Feather', '🪶']], unseen: [['رمل', 'Sand', '🏖️'], ['رجل', 'Man', '👨'], ['رقبة', 'Neck', '🦒']] },
  { id: 'AR11', char: 'ز', nameAr: 'الزاي', nameEn: 'Zaay', teach: [['زهرة', 'Flower', '🌸'], ['زرافة', 'Giraffe', '🦒']], unseen: [['زيتون', 'Olives', '🫒'], ['زبد', 'Butter', '🧈'], ['زورق', 'Boat', '⛵']] },
  { id: 'AR12', char: 'س', nameAr: 'السين', nameEn: 'Seen', teach: [['سمكة', 'Fish', '🐟'], ['سيارة', 'Car', '🚗']], unseen: [['ساعة', 'Clock', '⏰'], ['سحاب', 'Cloud', '☁️'], ['سرير', 'Bed', '🛏️']] },
  { id: 'AR13', char: 'ش', nameAr: 'الشين', nameEn: 'Sheen', teach: [['شمس', 'Sun', '☀️'], ['شجرة', 'Tree', '🌳']], unseen: [['شمعة', 'Candle', '🕯️'], ['شاي', 'Tea', '🍵'], ['شوكة', 'Fork', '🍴']] },
  { id: 'AR14', char: 'ص', nameAr: 'الصاد', nameEn: 'Saad', teach: [['صقر', 'Falcon', '🦅'], ['صندوق', 'Box', '📦']], unseen: [['صاروخ', 'Rocket', '🚀'], ['صابون', 'Soap', '🧼'], ['صحن', 'Plate', '🍽️']] },
  { id: 'AR15', char: 'ض', nameAr: 'الضاد', nameEn: 'Daad', teach: [['ضفدع', 'Frog', '🐸'], ['ضرس', 'Tooth', '🦷']], unseen: [['ضوء', 'Light', '💡'], ['ضباب', 'Fog', '🌫️'], ['ضيف', 'Guest', '🤝']] },
  { id: 'AR16', char: 'ط', nameAr: 'الطاء', nameEn: 'Taa', teach: [['طائرة', 'Plane', '✈️'], ['طماطم', 'Tomato', '🍅']], unseen: [['طبل', 'Drum', '🥁'], ['طاووس', 'Peacock', '🦚'], ['طاولة', 'Table', '🪑']] },
  { id: 'AR17', char: 'ظ', nameAr: 'الظاء', nameEn: 'Dhaa', teach: [['ظرف', 'Envelope', '✉️'], ['ظل', 'Shadow', '👤']], unseen: [['ظبي', 'Gazelle', '🦌'], ['ظفر', 'Nail', '💅'], ['ظهر', 'Noon', '🕛']] },
  { id: 'AR18', char: 'ع', nameAr: 'العين', nameEn: 'Ayn', teach: [['عصفور', 'Bird', '🐦'], ['عنب', 'Grapes', '🍇']], unseen: [['عسل', 'Honey', '🍯'], ['عين', 'Eye', '👁️'], ['علم', 'Flag', '🚩']] },
  { id: 'AR19', char: 'غ', nameAr: 'الغين', nameEn: 'Ghayn', teach: [['غيمة', 'Cloud', '☁️'], ['غزال', 'Deer', '🦌']], unseen: [['غراب', 'Crow', '🐦‍⬛'], ['غابة', 'Forest', '🌲'], ['غواصة', 'Submarine', '🚤']] },
  { id: 'AR20', char: 'ف', nameAr: 'الفاء', nameEn: 'Faa', teach: [['فراشة', 'Butterfly', '🦋'], ['فيل', 'Elephant', '🐘']], unseen: [['فراولة', 'Strawberry', '🍓'], ['فأر', 'Mouse', '🐭'], ['فانوس', 'Lantern', '🏮']] },
  { id: 'AR21', char: 'ق', nameAr: 'القاف', nameEn: 'Qaaf', teach: [['قمر', 'Moon', '🌙'], ['قلم', 'Pen', '✏️']], unseen: [['قطة', 'Cat', '🐱'], ['قطار', 'Train', '🚂'], ['قارب', 'Boat', '⛵']] },
  { id: 'AR22', char: 'ك', nameAr: 'الكاف', nameEn: 'Kaaf', teach: [['كتاب', 'Book', '📖'], ['كرة', 'Ball', '⚽']], unseen: [['كلب', 'Dog', '🐶'], ['كوب', 'Cup', '🥤'], ['كرسي', 'Chair', '🪑']] },
  { id: 'AR23', char: 'ل', nameAr: 'اللام', nameEn: 'Laam', teach: [['ليمون', 'Lemon', '🍋'], ['لعبة', 'Toy', '🧸']], unseen: [['لبن', 'Milk', '🥛'], ['لحم', 'Meat', '🥩'], ['لؤلؤ', 'Pearl', '🦪']] },
  { id: 'AR24', char: 'م', nameAr: 'الميم', nameEn: 'Meem', teach: [['موز', 'Banana', '🍌'], ['مفتاح', 'Key', '🔑']], unseen: [['ماء', 'Water', '💧'], ['مركب', 'Ship', '🚢'], ['مظلة', 'Umbrella', '☂️']] },
  { id: 'AR25', char: 'ن', nameAr: 'النون', nameEn: 'Noon', teach: [['نمر', 'Tiger', '🐯'], ['نجمة', 'Star', '⭐']], unseen: [['نحلة', 'Bee', '🐝'], ['نار', 'Fire', '🔥'], ['نخلة', 'Palm', '🌴']] },
  { id: 'AR26', char: 'هـ', nameAr: 'الهاء', nameEn: 'Haa', teach: [['هلال', 'Crescent', '🌙'], ['هدية', 'Gift', '🎁']], unseen: [['هرم', 'Pyramid', '🔺'], ['هاتف', 'Phone', '📱'], ['هدهد', 'Hoopoe', '🐦']] },
  { id: 'AR27', char: 'و', nameAr: 'الواو', nameEn: 'Waaw', teach: [['وردة', 'Rose', '🌹'], ['ولد', 'Boy', '👦']], unseen: [['ورقة', 'Leaf', '🍃'], ['وسادة', 'Pillow', '🛏️'], ['وحيد القرن', 'Rhino', '🦏']] },
  { id: 'AR28', char: 'ي', nameAr: 'الياء', nameEn: 'Yaa', teach: [['يد', 'Hand', '✋'], ['يمامة', 'Dove', '🕊️']], unseen: [['يقطين', 'Pumpkin', '🎃'], ['يخت', 'Yacht', '🛥️'], ['يوسفي', 'Tangerine', '🍊']] },
];

export const LEVEL1_ARABIC_LESSONS: Level1LessonDefinition[] = ARABIC_SPEC.map((item, idx) => ({
  id: item.id,
  subject: 'arabic',
  level: 1,
  ageRange: '1-4',
  unit:
    idx < 7
      ? 'ar-unit-1'
      : idx < 11
        ? 'ar-unit-2'
        : idx < 15
          ? 'ar-unit-3'
          : idx < 19
            ? 'ar-unit-4'
            : 'ar-unit-5',
  order: idx + 1,
  title: {
    ar: `اكتشف حرف ${item.nameAr} (${item.char})`,
    en: `Discover Arabic Letter ${item.nameEn} (${item.char})`,
  },
  learningObjective: {
    ar: `التعرف البصري والسمعي على حرف (${item.char}) المنفصل وربطه بكلمات مثل ${item.teach[0][0]} و${item.teach[1][0]}.`,
    en: `Visually and aurally recognize isolated Arabic letter ${item.char} (${item.nameEn}) with words like ${item.teach[0][0]} and ${item.teach[1][0]}.`,
  },
  characterIntro: {
    ar: `أهلاً يا بطل! معك نونو، واليوم نكتشف معاً حرف ${item.nameAr} الجميل: ${item.char}`,
    en: `Hello little discoverer! Nono is here to introduce Arabic letter ${item.nameEn}: ${item.char}`,
  },
  explanation: {
    ar: `هذا هو شكل حرف (${item.char}) منفصلاً. اسمع اسمه بوضوح، وشاهد كيف تبدأ به كلمتا (${item.teach[0][0]}) و(${item.teach[1][0]}).`,
    en: `Look closely at the isolated shape ${item.char}. Hear its clear name and see how words like ${item.teach[0][0]} begin with it.`,
  },
  targetSymbol: item.char,
  teachingVocab: makeVocab(item.id, item.teach, 'ar', 'arabic'),
  unseenVocab: makeVocab(`${item.id}-u`, item.unseen, 'ar', 'arabic'),
  activityFormats: [
    'tap-select',
    'listen-select',
    'match-picture',
    'find-hidden',
    'memory-challenge',
    'independent-challenge',
  ],
  prerequisiteIds: idx > 0 ? [ARABIC_SPEC[idx - 1].id] : [],
  suggestedMinutes: 6,
  revisionIntervalHours: 48,
  audioStatus:
    hasPreGeneratedAudio(item.char, 'ar') &&
    hasPreGeneratedAudio(`أهلاً يا بطل! معك نونو، واليوم نكتشف معاً حرف ${item.nameAr} الجميل: ${item.char}`, 'ar')
      ? 'verified_audio'
      : 'pregenerated_pending',
}));

// =========================================================================
// 2. ENGLISH ALPHABET — EXACT 26 LESSONS (EN01 – EN26)
// =========================================================================
const ENGLISH_SPEC: Array<{
  id: string;
  upper: string;
  lower: string;
  teach: Array<[string, string, string]>;
  unseen: Array<[string, string, string]>;
}> = [
  { id: 'EN01', upper: 'A', lower: 'a', teach: [['Apple', 'تفاحة', '🍎'], ['Ant', 'نملة', '🐜']], unseen: [['Alligator', 'تمساح', '🐊'], ['Astronaut', 'رائد فضاء', '👩‍🚀']] },
  { id: 'EN02', upper: 'B', lower: 'b', teach: [['Ball', 'كرة', '⚽'], ['Bear', 'دب', '🐻']], unseen: [['Banana', 'موزة', '🍌'], ['Bee', 'نحلة', '🐝']] },
  { id: 'EN03', upper: 'C', lower: 'c', teach: [['Cat', 'قطة', '🐱'], ['Car', 'سيارة', '🚗']], unseen: [['Cake', 'كعكة', '🎂'], ['Cow', 'بقرة', '🐄']] },
  { id: 'EN04', upper: 'D', lower: 'd', teach: [['Dog', 'كلب', '🐶'], ['Duck', 'بطة', '🦆']], unseen: [['Drum', 'طبل', '🥁'], ['Dolphin', 'دولفين', '🐬']] },
  { id: 'EN05', upper: 'E', lower: 'e', teach: [['Egg', 'بيضة', '🥚'], ['Elephant', 'فيل', '🐘']], unseen: [['Eagle', 'نسر', '🦅'], ['Earth', 'الأرض', '🌍']] },
  { id: 'EN06', upper: 'F', lower: 'f', teach: [['Fish', 'سمكة', '🐟'], ['Frog', 'ضفدع', '🐸']], unseen: [['Flower', 'زهرة', '🌸'], ['Fox', 'ثعلب', '🦊']] },
  { id: 'EN07', upper: 'G', lower: 'g', teach: [['Goat', 'ماعز', '🐐'], ['Grapes', 'عنب', '🍇']], unseen: [['Giraffe', 'زرافة', '🦒'], ['Gift', 'هدية', '🎁']] },
  { id: 'EN08', upper: 'H', lower: 'h', teach: [['Hat', 'قبعة', '👒'], ['House', 'منزل', '🏠']], unseen: [['Horse', 'حصان', '🐴'], ['Heart', 'قلب', '❤️']] },
  { id: 'EN09', upper: 'I', lower: 'i', teach: [['Igloo', 'كوخ جليدي', '🧊'], ['Insect', 'حشرة', '🐞']], unseen: [['Ice Cream', 'آيس كريم', '🍦'], ['Island', 'جزيرة', '🏝️']] },
  { id: 'EN10', upper: 'J', lower: 'j', teach: [['Juice', 'عصير', '🧃'], ['Jam', 'مربى', '🍓']], unseen: [['Jellyfish', 'قنديل البحر', '🪼'], ['Jacket', 'سترة', '🧥']] },
  { id: 'EN11', upper: 'K', lower: 'k', teach: [['Kite', 'طائرة ورقية', '🪁'], ['Key', 'مفتاح', '🔑']], unseen: [['Kangaroo', 'كنغر', '🦘'], ['King', 'ملك', '👑']] },
  { id: 'EN12', upper: 'L', lower: 'l', teach: [['Lion', 'أسد', '🦁'], ['Leaf', 'ورقة شجر', '🍃']], unseen: [['Lemon', 'ليمون', '🍋'], ['Lamp', 'مصباح', '💡']] },
  { id: 'EN13', upper: 'M', lower: 'm', teach: [['Moon', 'قمر', '🌙'], ['Monkey', 'قرد', '🐒']], unseen: [['Mouse', 'فأر', '🐭'], ['Milk', 'حليب', '🥛']] },
  { id: 'EN14', upper: 'N', lower: 'n', teach: [['Nose', 'أنف', '👃'], ['Nest', 'عش', '🪺']], unseen: [['Net', 'شبكة', '🥅'], ['Night', 'ليل', '🌃']] },
  { id: 'EN15', upper: 'O', lower: 'o', teach: [['Orange', 'برتقالة', '🍊'], ['Owl', 'بومة', '🦉']], unseen: [['Octopus', 'أخطبوط', '🐙'], ['Ocean', 'محيط', '🌊']] },
  { id: 'EN16', upper: 'P', lower: 'p', teach: [['Pig', 'خنزير صغير', '🐷'], ['Pizza', 'بيتزا', '🍕']], unseen: [['Panda', 'باندا', '🐼'], ['Penguin', 'بطريق', '🐧']] },
  { id: 'EN17', upper: 'Q', lower: 'q', teach: [['Queen', 'ملكة', '👑'], ['Quilt', 'لحاف', '🛏️']], unseen: [['Question', 'سؤال', '❓'], ['Quiet', 'هدوء', '🤫']] },
  { id: 'EN18', upper: 'R', lower: 'r', teach: [['Rabbit', 'أرنب', '🐰'], ['Rainbow', 'قوس قزح', '🌈']], unseen: [['Rocket', 'صاروخ', '🚀'], ['Rose', 'وردة', '🌹']] },
  { id: 'EN19', upper: 'S', lower: 's', teach: [['Sun', 'شمس', '☀️'], ['Star', 'نجمة', '⭐']], unseen: [['Snake', 'ثعبان', '🐍'], ['Ship', 'سفينة', '🚢']] },
  { id: 'EN20', upper: 'T', lower: 't', teach: [['Tiger', 'نمر', '🐯'], ['Tree', 'شجرة', '🌳']], unseen: [['Train', 'قطار', '🚂'], ['Turtle', 'سلحفاة', '🐢']] },
  { id: 'EN21', upper: 'U', lower: 'u', teach: [['Umbrella', 'مظلة', '☂️'], ['Up', 'أعلى', '⬆️']], unseen: [['Unicorn', 'يونيكورن', '🦄'], ['Uniform', 'زي مدرسي', '👕']] },
  { id: 'EN22', upper: 'V', lower: 'v', teach: [['Van', 'شاحنة صغيرة', '🚐'], ['Violin', 'كمان', '🎻']], unseen: [['Volcano', 'بركان', '🌋'], ['Vegetables', 'خضراوات', '🥦']] },
  { id: 'EN23', upper: 'W', lower: 'w', teach: [['Water', 'ماء', '💧'], ['Whale', 'حوت', '🐋']], unseen: [['Watch', 'ساعة يد', '⌚'], ['Watermelon', 'بطيخ', '🍉']] },
  { id: 'EN24', upper: 'X', lower: 'x', teach: [['X-ray', 'أشعة', '🩻'], ['Xylophone', 'إكسيلوفون', '🎹']], unseen: [['Box', 'صندوق', '📦'], ['Fox', 'ثعلب', '🦊']] },
  { id: 'EN25', upper: 'Y', lower: 'y', teach: [['Yo-yo', 'يويو', '🪀'], ['Yak', 'ثور التبت', '🐃']], unseen: [['Yellow', 'أصفر', '💛'], ['Yacht', 'يخت', '🛥️']] },
  { id: 'EN26', upper: 'Z', lower: 'z', teach: [['Zebra', 'حمار وحشي', '🦓'], ['Zoo', 'حديقة حيوان', '🦁']], unseen: [['Zipper', 'سحّاب', '🤐'], ['Zero', 'صفر', '0️⃣']] },
];

export const LEVEL1_ENGLISH_LESSONS: Level1LessonDefinition[] = ENGLISH_SPEC.map((item, idx) => ({
  id: item.id,
  subject: 'english',
  level: 1,
  ageRange: '1-4',
  unit:
    idx < 6
      ? 'en-unit-1'
      : idx < 12
        ? 'en-unit-2'
        : idx < 18
          ? 'en-unit-3'
          : 'en-unit-4',
  order: idx + 1,
  title: {
    ar: `حرف ${item.upper} ${item.lower} بالإنجليزية`,
    en: `Discover Letter ${item.upper} ${item.lower}`,
  },
  learningObjective: {
    ar: `تمييز الحرف الكبير (${item.upper}) والصغير (${item.lower}) وسماع نطقه مع كلمات ${item.teach[0][0]} و${item.teach[1][0]}.`,
    en: `Recognize uppercase ${item.upper} and lowercase ${item.lower}, hear its letter name and introductory sound with ${item.teach[0][0]} & ${item.teach[1][0]}.`,
  },
  characterIntro: {
    ar: `مرحباً! ليو صديق اللغة الإنجليزية يرحب بك لتعلم حرف (${item.upper} ${item.lower})!`,
    en: `Hi friend! Leo is excited to explore uppercase ${item.upper} and lowercase ${item.lower} with you!`,
  },
  explanation: {
    ar: `لكل حرف إنجليزي شكل كبير (${item.upper}) وشكل صغير (${item.lower}). نسمع اسمه ثم نسمع صوته في كلمة ${item.teach[0][0]}.`,
    en: `Notice both forms: big ${item.upper} and small ${item.lower}. Listen to the letter name and how it sounds at the start of ${item.teach[0][0]}.`,
  },
  targetSymbol: item.upper,
  secondarySymbol: item.lower,
  teachingVocab: makeVocab(item.id, item.teach, 'en', 'english'),
  unseenVocab: makeVocab(`${item.id}-u`, item.unseen, 'en', 'english'),
  activityFormats: [
    'tap-select',
    'match-case',
    'listen-select',
    'match-picture',
    'find-hidden',
    'independent-challenge',
  ],
  prerequisiteIds: idx > 0 ? [ENGLISH_SPEC[idx - 1].id] : [],
  suggestedMinutes: 6,
  revisionIntervalHours: 48,
  audioStatus:
    hasPreGeneratedAudio(item.upper, 'en') &&
    hasPreGeneratedAudio(`Hi friend! Leo is excited to explore uppercase ${item.upper} and lowercase ${item.lower} with you!`, 'en')
      ? 'verified_audio'
      : 'pregenerated_pending',
}));

// =========================================================================
// 3. NUMBERS — EXACT 11 LESSONS (NM01 – NM11: 0 to 10)
// =========================================================================
const NUMBERS_SPEC: Array<{
  id: string;
  num: number;
  arWord: string;
  enWord: string;
  emoji: string;
  objective: LocalizedText;
  explanation: LocalizedText;
}> = [
  { id: 'NM01', num: 0, arWord: 'صفر', enWord: 'Zero', emoji: '🧺', objective: { ar: 'فهم أن الصفر يعني لا يوجد أي شيء (سلة فارغة)', en: 'Understand zero means none or empty (no objects)' }, explanation: { ar: 'الصفر (٠) يعني أن السلة فارغة تماماً — لا توجد أي تفاحة بداخلها!', en: 'Zero (0) means none at all — look at this empty basket with zero apples inside!' } },
  { id: 'NM02', num: 1, arWord: 'واحد', enWord: 'One', emoji: '🍎', objective: { ar: 'تمييز العدد ١ وعدّ عنصر واحد', en: 'Recognize numeral 1 and count one object' }, explanation: { ar: 'العدد ١ يمثل شيئاً واحداً فقط مثل تفاحة واحدة.', en: 'Number 1 stands for a single item, like 1 bright apple.' } },
  { id: 'NM03', num: 2, arWord: 'اثنان', enWord: 'Two', emoji: '⭐', objective: { ar: 'تمييز العدد ٢ وعدّ عنصرين واحداً تلو الآخر', en: 'Recognize numeral 2 and count two objects' }, explanation: { ar: 'نعد: ١، ٢! نجمتان هما كمية العدد ٢.', en: 'Count one, two! Two stars show the quantity 2.' } },
  { id: 'NM04', num: 3, arWord: 'ثلاثة', enWord: 'Three', emoji: '🎈', objective: { ar: 'تمييز العدد ٣ وعدّ ٣ عناصر', en: 'Recognize numeral 3 and count three objects' }, explanation: { ar: 'نعد معاً: ١، ٢، ٣ بالونات!', en: 'Count along: 1, 2, 3 colorful balloons!' } },
  { id: 'NM05', num: 4, arWord: 'أربعة', enWord: 'Four', emoji: '🐥', objective: { ar: 'تمييز العدد ٤ وعدّ ٤ عناصر', en: 'Recognize numeral 4 and count four objects' }, explanation: { ar: 'أربعة كتاكيت لطيفة تمثل العدد ٤.', en: 'Four little chicks help us see what 4 looks like.' } },
  { id: 'NM06', num: 5, arWord: 'خمسة', enWord: 'Five', emoji: '🧸', objective: { ar: 'تمييز العدد ٥ وعدّ ٥ عناصر (مثل أصابع اليد)', en: 'Recognize numeral 5 and count five objects' }, explanation: { ar: '٥ دباديب مثل أصابع يدك الخمسة: ١، ٢، ٣، ٤، ٥!', en: 'Five teddy bears — just like the 5 fingers on one hand!' } },
  { id: 'NM07', num: 6, arWord: 'ستة', enWord: 'Six', emoji: '🍓', objective: { ar: 'تمييز العدد ٦ وعدّ ٦ عناصر بدقة', en: 'Recognize numeral 6 and count six objects' }, explanation: { ar: 'بعد ٥ يأتي ٦! نعد ست فراولات واحدة بعد واحدة.', en: 'Right after 5 comes 6! Let us count 6 strawberries one by one.' } },
  { id: 'NM08', num: 7, arWord: 'سبعة', enWord: 'Seven', emoji: '🚗', objective: { ar: 'تمييز العدد ٧ وعدّ ٧ عناصر', en: 'Recognize numeral 7 and count seven objects' }, explanation: { ar: 'سبع سيارات صغيرة في صف واحد: ١، ٢، ٣، ٤، ٥، ٦، ٧!', en: 'Seven little cars lined up: 1, 2, 3, 4, 5, 6, 7!' } },
  { id: 'NM09', num: 8, arWord: 'ثمانية', enWord: 'Eight', emoji: '🦋', objective: { ar: 'تمييز العدد ٨ وعدّ ٨ عناصر', en: 'Recognize numeral 8 and count eight objects' }, explanation: { ar: 'ثماني فراشات تحلق في الحديقة تمثل العدد ٨.', en: 'Eight fluttering butterflies show the quantity 8.' } },
  { id: 'NM10', num: 9, arWord: 'تسعة', enWord: 'Nine', emoji: '🌸', objective: { ar: 'تمييز العدد ٩ وعدّ ٩ عناصر', en: 'Recognize numeral 9 and count nine objects' }, explanation: { ar: 'تسع زهرات جميلة: نعد من ١ حتى ٩ بهدوء.', en: 'Nine lovely flowers — count calmly from 1 up to 9.' } },
  { id: 'NM11', num: 10, arWord: 'عشرة', enWord: 'Ten', emoji: '🌟', objective: { ar: 'تمييز العدد ١٠ وعدّ ١٠ عناصر كاملة', en: 'Recognize numeral 10 and count ten objects' }, explanation: { ar: 'عشرة نجوم كاملة! إنه أول عدد مكوّن من رقمين (١ و٠).', en: 'Ten shining stars — our first two-digit number!' } },
];

export const LEVEL1_NUMBER_LESSONS: Level1LessonDefinition[] = NUMBERS_SPEC.map((item, idx) => ({
  id: item.id,
  subject: 'numbers',
  level: 1,
  ageRange: '1-4',
  unit: item.num <= 5 ? 'num-unit-1' : 'num-unit-2',
  order: idx + 1,
  title: {
    ar: `اكتشف العدد ${item.num} (${item.arWord})`,
    en: `Discover Number ${item.num} (${item.enWord})`,
  },
  learningObjective: item.objective,
  characterIntro: {
    ar: `أهلاً يا صديقي! بوبو يحب العدّ، واليوم نكتشف معاً العدد ${item.num} (${item.arWord})!`,
    en: `Hello friend! Bobo loves counting, and today we discover number ${item.num} (${item.enWord})!`,
  },
  explanation: item.explanation,
  targetSymbol: String(item.num),
  secondarySymbol: item.arWord,
  numberValue: item.num,
  teachingVocab: [
    {
      id: `${item.id}-qty`,
      text: item.num === 0 ? (item.arWord + ' (فارغ)') : `${item.num} × ${item.emoji}`,
      secondaryText: `${item.enWord} (${item.num})`,
      emoji: item.emoji,
      audioStatus: hasPreGeneratedAudio(item.arWord, 'ar') ? 'verified_audio' : 'pregenerated_pending',
    },
  ],
  unseenVocab: [
    {
      id: `${item.id}-u1`,
      text: `${item.num}`,
      secondaryText: item.enWord,
      emoji: item.num === 0 ? '📭' : '⚽',
      audioStatus: hasPreGeneratedAudio(item.arWord, 'ar') ? 'verified_audio' : 'pregenerated_pending',
    },
  ],
  activityFormats: [
    'tap-select',
    'listen-select',
    'count-collect',
    'match-picture',
    'find-hidden',
    'independent-challenge',
  ],
  prerequisiteIds: idx > 0 ? [NUMBERS_SPEC[idx - 1].id] : [],
  suggestedMinutes: 6,
  revisionIntervalHours: 48,
  audioStatus:
    hasPreGeneratedAudio(item.arWord, 'ar') && hasPreGeneratedAudio(item.enWord, 'en')
      ? 'verified_audio'
      : 'pregenerated_pending',
}));

// =========================================================================
// 4. COLORS — EXACT 10 LESSONS (CL01 – CL10)
// =========================================================================
const COLORS_SPEC: Array<{
  id: string;
  hex: string;
  ar: string;
  en: string;
  teach: Array<[string, string, string]>;
  unseen: Array<[string, string, string]>;
}> = [
  { id: 'CL01', hex: '#FF4D6D', ar: 'أحمر', en: 'Red', teach: [['تفاحة حمراء', 'Red Apple', '🍎'], ['بالونة حمراء', 'Red Balloon', '🎈'], ['سيارة حمراء', 'Red Car', '🚗'], ['فراولة حمراء', 'Red Strawberry', '🍓'], ['وردة حمراء', 'Red Flower', '🌹']], unseen: [['كرز أحمر', 'Red Cherry', '🍒'], ['دعسوقة حمراء', 'Red Ladybug', '🐞']] },
  { id: 'CL02', hex: '#39BDF2', ar: 'أزرق', en: 'Blue', teach: [['موجة زرقاء', 'Blue Wave', '🌊'], ['حوت أزرق', 'Blue Whale', '🐋'], ['قبعة زرقاء', 'Blue Cap', '🧢'], ['فراشة زرقاء', 'Blue Butterfly', '🦋'], ['سيارة زرقاء', 'Blue Car', '🚙']], unseen: [['جوهرة زرقاء', 'Blue Gem', '💎'], ['توت أزرق', 'Blueberry', '🫐']] },
  { id: 'CL03', hex: '#FFD84D', ar: 'أصفر', en: 'Yellow', teach: [['شمس صفراء', 'Yellow Sun', '☀️'], ['موزة صفراء', 'Yellow Banana', '🍌'], ['ليمونة صفراء', 'Yellow Lemon', '🍋'], ['كتكوت أصفر', 'Yellow Chick', '🐥'], ['نجمة صفراء', 'Yellow Star', '⭐']], unseen: [['ذرة صفراء', 'Yellow Corn', '🌽'], ['جبن أصفر', 'Yellow Cheese', '🧀']] },
  { id: 'CL04', hex: '#55D98B', ar: 'أخضر', en: 'Green', teach: [['شجرة خضراء', 'Green Tree', '🌳'], ['ضفدع أخضر', 'Green Frog', '🐸'], ['بروكلي أخضر', 'Green Broccoli', '🥦'], ['سلحفاة خضراء', 'Green Turtle', '🐢'], ['تفاحة خضراء', 'Green Apple', '🍏']], unseen: [['كيوي أخضر', 'Green Kiwi', '🥝'], ['أوراق خضراء', 'Green Leaves', '🌿']] },
  { id: 'CL05', hex: '#FF9360', ar: 'برتقالي', en: 'Orange', teach: [['برتقالة', 'Orange Fruit', '🍊'], ['جزرة برتقالية', 'Orange Carrot', '🥕'], ['ثعلب برتقالي', 'Orange Fox', '🦊'], ['يقطين برتقالي', 'Orange Pumpkin', '🎃'], ['كرة برتقالية', 'Orange Ball', '🏀']], unseen: [['يوسفي برتقالي', 'Tangerine', '🍊'], ['سمكة برتقالية', 'Clownfish', '🐠']] },
  { id: 'CL06', hex: '#8054D9', ar: 'بنفسجي', en: 'Purple', teach: [['عنب بنفسجي', 'Purple Grapes', '🍇'], ['باذنجان بنفسجي', 'Purple Eggplant', '🍆'], ['زهرة بنفسجية', 'Purple Blossom', '🪻'], ['مظلة بنفسجية', 'Purple Umbrella', '☂️'], ['قلب بنفسجي', 'Purple Heart', '💜']], unseen: [['برقوق بنفسجي', 'Plum', '🟣'], ['فراشة بنفسجية', 'Purple Bow', '🎀']] },
  { id: 'CL07', hex: '#FF78B7', ar: 'وردي', en: 'Pink', teach: [['زهرة وردية', 'Pink Blossom', '🌸'], ['فلامنجو وردي', 'Pink Flamingo', '🦩'], ['هدية وردية', 'Pink Ribbon', '🎀'], ['دونات وردية', 'Pink Donut', '🍩'], ['باليه وردي', 'Pink Tulip', '🌷']], unseen: [['قلب وردي', 'Pink Heart', '🩷'], ['آيس كريم وردي', 'Pink Ice Cream', '🍨']] },
  { id: 'CL08', hex: '#1E2433', ar: 'أسود', en: 'Black', teach: [['قطة سوداء', 'Black Cat', '🐈‍⬛'], ['قبعة سوداء', 'Black Hat', '🎩'], ['نملة سوداء', 'Black Ant', '🐜'], ['غراب أسود', 'Black Crow', '🐦‍⬛'], ['كرة سوداء وبيضاء', 'Black & White Ball', '⚽']], unseen: [['ليل مظلم', 'Night Sky', '🌑'], ['حذاء أسود', 'Black Boot', '🥾']] },
  { id: 'CL09', hex: '#F8FAFC', ar: 'أبيض', en: 'White', teach: [['سحابة بيضاء', 'White Cloud', '☁️'], ['أرنب أبيض', 'White Bunny', '🐇'], ['ثلج أبيض', 'White Snow', '❄️'], ['حمامة بيضاء', 'White Dove', '🕊️'], ['كوب حليب أبيض', 'White Milk', '🥛']], unseen: [['خروف أبيض', 'White Sheep', '🐑'], ['بيضة بيضاء', 'White Egg', '🥚']] },
  { id: 'CL10', hex: '#8B5A2B', ar: 'بني', en: 'Brown', teach: [['دب بني', 'Brown Bear', '🐻'], ['شوكولاتة بنية', 'Brown Chocolate', '🍫'], ['حصان بني', 'Brown Horse', '🐴'], ['جوز هند بني', 'Brown Coconut', '🥥'], ['كعكة بنية', 'Brown Cookie', '🍪']], unseen: [['بومة بنية', 'Brown Owl', '🦉'], ['صندوق بني', 'Brown Box', '📦']] },
];

export const LEVEL1_COLOR_LESSONS: Level1LessonDefinition[] = COLORS_SPEC.map((item, idx) => ({
  id: item.id,
  subject: 'colors',
  level: 1,
  ageRange: '1-4',
  unit: idx < 4 ? 'col-unit-1' : 'col-unit-2',
  order: idx + 1,
  title: {
    ar: `اكتشف اللون ${item.ar}`,
    en: `Discover ${item.en}`,
  },
  learningObjective: {
    ar: `التعرف البصري والسمعي على اللون ${item.ar} وتمييزه على أشياء متنوعة من الحياة اليومية.`,
    en: `Visually and aurally recognize ${item.en} (${item.ar}) across multiple everyday objects.`,
  },
  characterIntro: {
    ar: `أهلاً يا بطل! النهارده مع نونو هنتعلم لون جميل اسمه ${item.ar}!`,
    en: `Hello friend! Today Nono and you are learning the color ${item.en}!`,
  },
  explanation: {
    ar: `اللون ${item.ar} (${item.en}) يظهر في أشياء كثيرة حولنا مثل ${item.teach[0][0]} و${item.teach[1][0]}. المس كل صورة لتسمع اسمها!`,
    en: `The color ${item.en} (${item.ar}) appears on many objects like ${item.teach[0][1]} and ${item.teach[1][1]}. Tap each picture to hear it!`,
  },
  targetSymbol: item.ar,
  secondarySymbol: item.en,
  colorHex: item.hex,
  teachingVocab: makeVocab(item.id, item.teach, 'ar', 'colors'),
  unseenVocab: makeVocab(`${item.id}-u`, item.unseen, 'ar', 'colors'),
  activityFormats: [
    'tap-select',
    'listen-select',
    'match-picture',
    'sort-drag',
    'color-picture',
    'find-hidden',
    'memory-challenge',
    'independent-challenge',
  ],
  prerequisiteIds: idx > 0 ? [COLORS_SPEC[idx - 1].id] : [],
  suggestedMinutes: 6,
  revisionIntervalHours: 48,
  audioStatus:
    hasPreGeneratedAudio(item.ar, 'ar') && hasPreGeneratedAudio(item.en, 'en')
      ? 'verified_audio'
      : 'pregenerated_pending',
}));

export const ALL_LEVEL1_LESSONS: Level1LessonDefinition[] = [
  ...LEVEL1_ARABIC_LESSONS,
  ...LEVEL1_ENGLISH_LESSONS,
  ...LEVEL1_NUMBER_LESSONS,
  ...LEVEL1_COLOR_LESSONS,
];

export function getLevel1LessonById(lessonId: string): Level1LessonDefinition | undefined {
  return ALL_LEVEL1_LESSONS.find((l) => l.id === lessonId);
}

export function getLevel1LessonsBySubject(subject: Level1Subject): Level1LessonDefinition[] {
  return ALL_LEVEL1_LESSONS.filter((l) => l.subject === subject);
}

export interface Level1ReviewUnit {
  id: string;
  subject: Level1Subject;
  title: LocalizedText;
  lessonIds: string[];
}

export const LEVEL1_REVIEW_UNITS: Level1ReviewUnit[] = [
  { id: 'REV-AR1', subject: 'arabic', title: { ar: 'مراجعة الحروف العربية ١: أ–خ', en: 'Arabic Letters Review 1: أ–خ' }, lessonIds: ['AR01', 'AR02', 'AR03', 'AR04', 'AR05', 'AR06', 'AR07'] },
  { id: 'REV-AR2', subject: 'arabic', title: { ar: 'مراجعة الحروف العربية ٢: د–ز', en: 'Arabic Letters Review 2: د–ز' }, lessonIds: ['AR08', 'AR09', 'AR10', 'AR11'] },
  { id: 'REV-AR3', subject: 'arabic', title: { ar: 'مراجعة الحروف العربية ٣: س–ض', en: 'Arabic Letters Review 3: س–ض' }, lessonIds: ['AR12', 'AR13', 'AR14', 'AR15'] },
  { id: 'REV-AR4', subject: 'arabic', title: { ar: 'مراجعة الحروف العربية ٤: ط–غ', en: 'Arabic Letters Review 4: ط–غ' }, lessonIds: ['AR16', 'AR17', 'AR18', 'AR19'] },
  { id: 'REV-AR5', subject: 'arabic', title: { ar: 'مراجعة الحروف العربية ٥: ف–ي', en: 'Arabic Letters Review 5: ف–ي' }, lessonIds: ['AR20', 'AR21', 'AR22', 'AR23', 'AR24', 'AR25', 'AR26', 'AR27', 'AR28'] },
  { id: 'REV-EN1', subject: 'english', title: { ar: 'مراجعة الإنجليزية ١: A–F', en: 'English Alphabet Review 1: A–F' }, lessonIds: ['EN01', 'EN02', 'EN03', 'EN04', 'EN05', 'EN06'] },
  { id: 'REV-EN2', subject: 'english', title: { ar: 'مراجعة الإنجليزية ٢: G–L', en: 'English Alphabet Review 2: G–L' }, lessonIds: ['EN07', 'EN08', 'EN09', 'EN10', 'EN11', 'EN12'] },
  { id: 'REV-EN3', subject: 'english', title: { ar: 'مراجعة الإنجليزية ٣: M–R', en: 'English Alphabet Review 3: M–R' }, lessonIds: ['EN13', 'EN14', 'EN15', 'EN16', 'EN17', 'EN18'] },
  { id: 'REV-EN4', subject: 'english', title: { ar: 'مراجعة الإنجليزية ٤: S–Z', en: 'English Alphabet Review 4: S–Z' }, lessonIds: ['EN19', 'EN20', 'EN21', 'EN22', 'EN23', 'EN24', 'EN25', 'EN26'] },
  { id: 'REV-NM1', subject: 'numbers', title: { ar: 'مراجعة الأرقام: ٠–٥', en: 'Numbers Review: 0–5' }, lessonIds: ['NM01', 'NM02', 'NM03', 'NM04', 'NM05', 'NM06'] },
  { id: 'REV-NM2', subject: 'numbers', title: { ar: 'مراجعة الأرقام: ٦–١٠', en: 'Numbers Review: 6–10' }, lessonIds: ['NM07', 'NM08', 'NM09', 'NM10', 'NM11'] },
  { id: 'REV-CL1', subject: 'colors', title: { ar: 'مراجعة الألوان العشرة', en: 'Colors Review: All 10 Colors' }, lessonIds: ['CL01', 'CL02', 'CL03', 'CL04', 'CL05', 'CL06', 'CL07', 'CL08', 'CL09', 'CL10'] },
];
