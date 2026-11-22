import { AgeGroupId, LocalizedText } from '../types/nonoland';

export interface ArabicLetterEntry {
  id: string;
  char: string;
  nameAr: string;
  nameEn: string;
  phoneticHint: LocalizedText;
  forms: {
    isolated: string;
    initial: string;
    medial: string;
    final: string;
  };
  word: string;
  wordMeaningEn: string;
  emoji: string;
  similarGroup: string[];
  writingTip: LocalizedText;
}

export const ARABIC_ALPHABET: ArabicLetterEntry[] = [
  { id: 'ar-alif', char: 'أ', nameAr: 'أَلِف', nameEn: 'Alif', phoneticHint: { ar: 'صوت: أَ (مثل أرنب)', en: 'Sound: /a/ as in Arnab' }, forms: { isolated: 'أ', initial: 'أ', medial: 'ـأ', final: 'ـأ' }, word: 'أرنب', wordMeaningEn: 'Rabbit', emoji: '🐰', similarGroup: ['أ', 'إ', 'ا'], writingTip: { ar: 'من الأعلى للأسفل بخط مستقيم وفوقه همزة', en: 'Draw straight down, then add a tiny curved hamza on top' } },
  { id: 'ar-baa', char: 'ب', nameAr: 'بَاء', nameEn: 'Baa', phoneticHint: { ar: 'صوت: بَ (مثل بطة)', en: 'Sound: /b/ as in Batta' }, forms: { isolated: 'ب', initial: 'بـ', medial: 'ـبـ', final: 'ـب' }, word: 'بطة', wordMeaningEn: 'Duck', emoji: '🦆', similarGroup: ['ب', 'ت', 'ث'], writingTip: { ar: 'طبق من اليمين لليسار وتحته نقطة واحدة', en: 'Curve right-to-left like a boat with 1 dot below' } },
  { id: 'ar-taa', char: 'ت', nameAr: 'تَاء', nameEn: 'Taa', phoneticHint: { ar: 'صوت: تَ (مثل تفاحة)', en: 'Sound: /t/ as in Tuffaha' }, forms: { isolated: 'ت', initial: 'تـ', medial: 'ـتـ', final: 'ـت' }, word: 'تفاحة', wordMeaningEn: 'Apple', emoji: '🍎', similarGroup: ['ب', 'ت', 'ث'], writingTip: { ar: 'طبق من اليمين لليسار وفوقه نقطتان', en: 'Boat shape with 2 dots smiling on top' } },
  { id: 'ar-thaa', char: 'ث', nameAr: 'ثَاء', nameEn: 'Thaa', phoneticHint: { ar: 'صوت: ثَ (مثل ثعلب)', en: 'Sound: /th/ as in Thalab' }, forms: { isolated: 'ث', initial: 'ثـ', medial: 'ـثـ', final: 'ـث' }, word: 'ثعلب', wordMeaningEn: 'Fox', emoji: '🦊', similarGroup: ['ب', 'ت', 'ث'], writingTip: { ar: 'طبق وفوقه ٣ نقاط على شكل مثلث', en: 'Boat shape with 3 dots in a triangle on top' } },
  { id: 'ar-jeem', char: 'ج', nameAr: 'جِيم', nameEn: 'Jeem', phoneticHint: { ar: 'صوت: جَ (مثل جمل)', en: 'Sound: /j/ as in Jamal' }, forms: { isolated: 'ج', initial: 'جـ', medial: 'ـجـ', final: 'ـج' }, word: 'جمل', wordMeaningEn: 'Camel', emoji: '🐪', similarGroup: ['ج', 'ح', 'خ'], writingTip: { ar: 'حاجب مائل ثم نصف دائرة وفي بطنها نقطة', en: 'Small slant across, big curve down, 1 dot inside' } },
  { id: 'ar-haa', char: 'ح', nameAr: 'حَاء', nameEn: 'Haa', phoneticHint: { ar: 'صوت: حَ (مثل حصان)', en: 'Sound: /h/ as in Hisan' }, forms: { isolated: 'ح', initial: 'حـ', medial: 'ـحـ', final: 'ـح' }, word: 'حصان', wordMeaningEn: 'Horse', emoji: '🐴', similarGroup: ['ج', 'ح', 'خ'], writingTip: { ar: 'مثل الجيم لكن بدون أي نقاط', en: 'Smooth wave and curve with zero dots' } },
  { id: 'ar-khaa', char: 'خ', nameAr: 'خَاء', nameEn: 'Khaa', phoneticHint: { ar: 'صوت: خَ (مثل خروف)', en: 'Sound: /kh/ as in Kharoof' }, forms: { isolated: 'خ', initial: 'خـ', medial: 'ـخـ', final: 'ـخ' }, word: 'خروف', wordMeaningEn: 'Sheep', emoji: '🐑', similarGroup: ['ج', 'ح', 'خ'], writingTip: { ar: 'نفس شكل الحاء وفوق رأسها نقطة', en: 'Same curve as Haa with 1 dot on top' } },
  { id: 'ar-daal', char: 'د', nameAr: 'دَال', nameEn: 'Daal', phoneticHint: { ar: 'صوت: دَ (مثل دب)', en: 'Sound: /d/ as in Dub' }, forms: { isolated: 'د', initial: 'د', medial: 'ـد', final: 'ـد' }, word: 'دب', wordMeaningEn: 'Bear', emoji: '🐻', similarGroup: ['د', 'ذ'], writingTip: { ar: 'قوس مفتوح نحو اليمين يجلس على السطر', en: 'Angle curve resting gently on the baseline' } },
  { id: 'ar-dhaal', char: 'ذ', nameAr: 'ذَال', nameEn: 'Dhaal', phoneticHint: { ar: 'صوت: ذَ (مثل ذرة)', en: 'Sound: /dh/ as in Dhura' }, forms: { isolated: 'ذ', initial: 'ذ', medial: 'ـذ', final: 'ـذ' }, word: 'ذرة', wordMeaningEn: 'Corn', emoji: '🌽', similarGroup: ['د', 'ذ'], writingTip: { ar: 'مثل الدال وفوقه نقطة', en: 'Just like Daal with 1 dot above' } },
  { id: 'ar-raa', char: 'ر', nameAr: 'رَاء', nameEn: 'Raa', phoneticHint: { ar: 'صوت: رَ (مثل رمان)', en: 'Sound: /r/ as in Rumman' }, forms: { isolated: 'ر', initial: 'ر', medial: 'ـر', final: 'ـر' }, word: 'رمان', wordMeaningEn: 'Pomegranate', emoji: '🍒', similarGroup: ['ر', 'ز'], writingTip: { ar: 'انحناءة ناعمة تنزل تحت السطر مثل الزلاجة', en: 'Smooth slide curving below the line' } },
  { id: 'ar-zaay', char: 'ز', nameAr: 'زَاي', nameEn: 'Zaay', phoneticHint: { ar: 'صوت: زَ (مثل زرافة)', en: 'Sound: /z/ as in Zarafa' }, forms: { isolated: 'ز', initial: 'ز', medial: 'ـز', final: 'ـز' }, word: 'زرافة', wordMeaningEn: 'Giraffe', emoji: '🦒', similarGroup: ['ر', 'ز'], writingTip: { ar: 'مثل الراء وفوقها نقطة', en: 'Slide curve like Raa with 1 dot above' } },
  { id: 'ar-seen', char: 'س', nameAr: 'سِين', nameEn: 'Seen', phoneticHint: { ar: 'صوت: سَ (مثل سمكة)', en: 'Sound: /s/ as in Samaka' }, forms: { isolated: 'س', initial: 'سـ', medial: 'ـسـ', final: 'ـس' }, word: 'سمكة', wordMeaningEn: 'Fish', emoji: '🐟', similarGroup: ['س', 'ش'], writingTip: { ar: 'ثلاث أسنان صغيرة ثم صحن كبير عميق', en: 'Three little waves followed by a deep bowl' } },
  { id: 'ar-sheen', char: 'ش', nameAr: 'شِين', nameEn: 'Sheen', phoneticHint: { ar: 'صوت: شَ (مثل شمس)', en: 'Sound: /sh/ as in Shams' }, forms: { isolated: 'ش', initial: 'شـ', medial: 'ـشـ', final: 'ـش' }, word: 'شمس', wordMeaningEn: 'Sun', emoji: '☀️', similarGroup: ['س', 'ش'], writingTip: { ar: 'مثل السين وفوقها ٣ نقاط', en: 'Like Seen with 3 dots floating above' } },
  { id: 'ar-saad', char: 'ص', nameAr: 'صَاد', nameEn: 'Saad', phoneticHint: { ar: 'صوت: صَ (مثل صاروخ)', en: 'Sound: /sˤ/ as in Sarookh' }, forms: { isolated: 'ص', initial: 'صـ', medial: 'ـصـ', final: 'ـص' }, word: 'صاروخ', wordMeaningEn: 'Rocket', emoji: '🚀', similarGroup: ['ص', 'ض'], writingTip: { ar: 'حلقة بيضاوية على السطر ثم صحن عميق', en: 'Oval loop then a deep bowl' } },
  { id: 'ar-daad', char: 'ض', nameAr: 'ضَاد', nameEn: 'Daad', phoneticHint: { ar: 'صوت: ضَ (مثل ضفدع)', en: 'Sound: /dˤ/ as in Difda' }, forms: { isolated: 'ض', initial: 'ضـ', medial: 'ـضـ', final: 'ـض' }, word: 'ضفدع', wordMeaningEn: 'Frog', emoji: '🐸', similarGroup: ['ص', 'ض'], writingTip: { ar: 'مثل الصاد وفوقها نقطة', en: 'Like Saad with 1 dot above' } },
  { id: 'ar-taa2', char: 'ط', nameAr: 'طَاء', nameEn: 'Taa (Heavy)', phoneticHint: { ar: 'صوت: طَ (مثل طائرة)', en: 'Sound: /tˤ/ as in Taa-ira' }, forms: { isolated: 'ط', initial: 'طـ', medial: 'ـطـ', final: 'ـط' }, word: 'طائرة', wordMeaningEn: 'Airplane', emoji: '✈️', similarGroup: ['ط', 'ظ'], writingTip: { ar: 'حلقة على السطر وفوقها عصا عمودية', en: 'Loop on the line with a tall vertical stick' } },
  { id: 'ar-dhaa2', char: 'ظ', nameAr: 'ظَاء', nameEn: 'Dhaa (Heavy)', phoneticHint: { ar: 'صوت: ظَ (مثل ظرف)', en: 'Sound: /ðˤ/ as in Dharf' }, forms: { isolated: 'ظ', initial: 'ظـ', medial: 'ـظـ', final: 'ـظ' }, word: 'ظرف', wordMeaningEn: 'Envelope', emoji: '✉️', similarGroup: ['ط', 'ظ'], writingTip: { ar: 'مثل الطاء وبجانب عصاها نقطة', en: 'Like Taa with 1 dot beside the stick' } },
  { id: 'ar-ayn', char: 'ع', nameAr: 'عَيْن', nameEn: 'Ayn', phoneticHint: { ar: 'صوت: عَ (مثل عصفور)', en: 'Sound: /ʕ/ as in Usfoor' }, forms: { isolated: 'ع', initial: 'عـ', medial: 'ـعـ', final: 'ـع' }, word: 'عصفور', wordMeaningEn: 'Bird', emoji: '🐦', similarGroup: ['ع', 'غ'], writingTip: { ar: 'قوس صغير فوق السطر ثم قوس كبير تحته', en: 'Small C-curve on top, large C-curve below' } },
  { id: 'ar-ghayn', char: 'غ', nameAr: 'غَيْن', nameEn: 'Ghayn', phoneticHint: { ar: 'صوت: غَ (مثل غيمة)', en: 'Sound: /ɣ/ as in Ghayma' }, forms: { isolated: 'غ', initial: 'غـ', medial: 'ـغـ', final: 'ـغ' }, word: 'غيمة', wordMeaningEn: 'Cloud', emoji: '☁️', similarGroup: ['ع', 'غ'], writingTip: { ar: 'مثل العين وفوقها نقطة', en: 'Like Ayn with 1 dot above' } },
  { id: 'ar-faa', char: 'ف', nameAr: 'فَاء', nameEn: 'Faa', phoneticHint: { ar: 'صوت: فَ (مثل فيل)', en: 'Sound: /f/ as in Feel' }, forms: { isolated: 'ف', initial: 'فـ', medial: 'ـفـ', final: 'ـف' }, word: 'فيل', wordMeaningEn: 'Elephant', emoji: '🐘', similarGroup: ['ف', 'ق'], writingTip: { ar: 'رأس دائري فوق السطر ثم طبق وفوقه نقطة', en: 'Round head on a wide dish with 1 dot on top' } },
  { id: 'ar-qaaf', char: 'ق', nameAr: 'قَاف', nameEn: 'Qaaf', phoneticHint: { ar: 'صوت: قَ (مثل قمر)', en: 'Sound: /q/ as in Qamar' }, forms: { isolated: 'ق', initial: 'قـ', medial: 'ـقـ', final: 'ـق' }, word: 'قمر', wordMeaningEn: 'Moon', emoji: '🌙', similarGroup: ['ف', 'ق'], writingTip: { ar: 'رأس دائري وصحن عميق وفوقه نقطتان', en: 'Round head with deep bowl and 2 dots on top' } },
  { id: 'ar-kaaf', char: 'ك', nameAr: 'كَاف', nameEn: 'Kaaf', phoneticHint: { ar: 'صوت: كَ (مثل كتاب)', en: 'Sound: /k/ as in Kitab' }, forms: { isolated: 'ك', initial: 'كـ', medial: 'ـكـ', final: 'ـك' }, word: 'كتاب', wordMeaningEn: 'Book', emoji: '📖', similarGroup: ['ك', 'ل'], writingTip: { ar: 'عصا طويلة تتصل بطبق وبداخلها كاف صغيرة', en: 'Tall stroke, flat base, tiny zig-zag inside' } },
  { id: 'ar-laam', char: 'ل', nameAr: 'لَام', nameEn: 'Laam', phoneticHint: { ar: 'صوت: لَ (مثل ليمون)', en: 'Sound: /l/ as in Laymoon' }, forms: { isolated: 'ل', initial: 'لـ', medial: 'ـلـ', final: 'ـل' }, word: 'ليمون', wordMeaningEn: 'Lemon', emoji: '🍋', similarGroup: ['ك', 'ل'], writingTip: { ar: 'عصا طويلة تنزل وتنحني كخطاف تحت السطر', en: 'Tall stroke curving into a hook at the bottom' } },
  { id: 'ar-meem', char: 'م', nameAr: 'مِيم', nameEn: 'Meem', phoneticHint: { ar: 'صوت: مَ (مثل موز)', en: 'Sound: /m/ as in Mawz' }, forms: { isolated: 'م', initial: 'مـ', medial: 'ـمـ', final: 'ـم' }, word: 'موز', wordMeaningEn: 'Banana', emoji: '🍌', similarGroup: ['م', 'هـ'], writingTip: { ar: 'دائرة صغيرة وذيل ينزل إلى الأسفل', en: 'Small round head with a tail dropping down' } },
  { id: 'ar-noon', char: 'ن', nameAr: 'نُون', nameEn: 'Noon', phoneticHint: { ar: 'صوت: نَ (مثل نجمة)', en: 'Sound: /n/ as in Najma' }, forms: { isolated: 'ن', initial: 'نـ', medial: 'ـنـ', final: 'ـن' }, word: 'نجمة', wordMeaningEn: 'Star', emoji: '⭐', similarGroup: ['ب', 'ن'], writingTip: { ar: 'صحن عميق وبداخله نقطة واحدة في الوسط', en: 'Deep smiling bowl with 1 dot inside' } },
  { id: 'ar-haa2', char: 'هـ', nameAr: 'هَاء', nameEn: 'Haa (Soft)', phoneticHint: { ar: 'صوت: هَـ (مثل هلال)', en: 'Sound: /h/ as in Hilal' }, forms: { isolated: 'ه', initial: 'هـ', medial: 'ـهـ', final: 'ـه' }, word: 'هلال', wordMeaningEn: 'Crescent', emoji: '🌙', similarGroup: ['هـ', 'م'], writingTip: { ar: 'قوس يحيط بدائرة صغيرة في القلب', en: 'Outer curve hugging a small inner circle' } },
  { id: 'ar-waaw', char: 'و', nameAr: 'وَاو', nameEn: 'Waaw', phoneticHint: { ar: 'صوت: وَ (مثل وردة)', en: 'Sound: /w/ as in Warda' }, forms: { isolated: 'و', initial: 'و', medial: 'ـو', final: 'ـو' }, word: 'وردة', wordMeaningEn: 'Flower', emoji: '🌹', similarGroup: ['و', 'ف'], writingTip: { ar: 'رأس دائري فوق السطر وذيل ينزلق للأسفل', en: 'Round head with a tail sliding below the line' } },
  { id: 'ar-yaa', char: 'ي', nameAr: 'يَاء', nameEn: 'Yaa', phoneticHint: { ar: 'صوت: يَ (مثل يد)', en: 'Sound: /y/ as in Yad' }, forms: { isolated: 'ي', initial: 'يـ', medial: 'ـيـ', final: 'ـي' }, word: 'يد', wordMeaningEn: 'Hand', emoji: '✋', similarGroup: ['ي', 'ى'], writingTip: { ar: 'منحنى يشبه البطة وتحته نقطتان', en: 'Swan-like curve with 2 dots underneath' } },
];

export interface EnglishLetterEntry {
  id: string;
  upper: string;
  lower: string;
  nameSound: string;
  phoneticSound: string;
  word: string;
  wordAr: string;
  emoji: string;
  cvcExample: string;
}

const RAW_EN: Array<[string, string, string, string, string, string]> = [
  ['A', 'ay', '/æ/ ah', 'Apple', 'تفاحة', '🍎'],
  ['B', 'bee', '/b/ buh', 'Ball', 'كرة', '⚽'],
  ['C', 'see', '/k/ kuh', 'Cat', 'قطة', '🐱'],
  ['D', 'dee', '/d/ duh', 'Dog', 'كلب', '🐶'],
  ['E', 'ee', '/ɛ/ eh', 'Elephant', 'فيل', '🐘'],
  ['F', 'ef', '/f/ fff', 'Fish', 'سمكة', '🐟'],
  ['G', 'jee', '/g/ guh', 'Grapes', 'عنب', '🍇'],
  ['H', 'aych', '/h/ huh', 'Hat', 'قبعة', '👒'],
  ['I', 'eye', '/ɪ/ ih', 'Igloo', 'كوخ جليدي', '🧊'],
  ['J', 'jay', '/dʒ/ juh', 'Juice', 'عصير', '🧃'],
  ['K', 'kay', '/k/ kuh', 'Kite', 'طائرة ورقية', '🪁'],
  ['L', 'el', '/l/ lll', 'Lion', 'أسد', '🦁'],
  ['M', 'em', '/m/ mmm', 'Moon', 'قمر', '🌙'],
  ['N', 'en', '/n/ nnn', 'Nest', 'عش', '🪺'],
  ['O', 'oh', '/ɒ/ aw', 'Orange', 'برتقالة', '🍊'],
  ['P', 'pee', '/p/ puh', 'Panda', 'باندا', '🐼'],
  ['Q', 'cue', '/kw/ kwuh', 'Queen', 'ملكة', '👑'],
  ['R', 'ar', '/r/ rrr', 'Rainbow', 'قوس قزح', '🌈'],
  ['S', 'ess', '/s/ sss', 'Sun', 'شمس', '☀️'],
  ['T', 'tee', '/t/ tuh', 'Tree', 'شجرة', '🌳'],
  ['U', 'you', '/ʌ/ uh', 'Umbrella', 'مظلة', '☂️'],
  ['V', 'vee', '/v/ vvv', 'Violin', 'كمان', '🎻'],
  ['W', 'double-u', '/w/ wuh', 'Whale', 'حوت', '🐋'],
  ['X', 'ex', '/ks/ ks', 'Xylophone', 'إكسيلوفون', '🎹'],
  ['Y', 'why', '/j/ yuh', 'Yo-yo', 'يويو', '🪀'],
  ['Z', 'zee', '/z/ zzz', 'Zebra', 'حمار وحشي', '🦓'],
];

const CVC_WORDS = ['CAT', 'BAT', 'SUN', 'DOG', 'MAP', 'PEN', 'RED', 'BOX', 'HAT', 'CUP'];

export const ENGLISH_ALPHABET: EnglishLetterEntry[] = RAW_EN.map(([u, nameSound, phoneticSound, word, wordAr, emoji], idx) => ({
  id: `en-${u.toLowerCase()}`,
  upper: u,
  lower: u.toLowerCase(),
  nameSound,
  phoneticSound,
  word,
  wordAr,
  emoji,
  cvcExample: CVC_WORDS[idx % CVC_WORDS.length],
}));

export interface NumberTier {
  id: '1-5' | '1-10' | '1-20';
  label: LocalizedText;
  recommendedAges: AgeGroupId[];
  numbers: number[];
}

export const NUMBER_TIERS: NumberTier[] = [
  { id: '1-5', label: { ar: '١ إلى ٥ (البداية)', en: '1 to 5 (First Steps)' }, recommendedAges: ['1-4'], numbers: [1, 2, 3, 4, 5] },
  { id: '1-10', label: { ar: '١ إلى ١٠ (أساسي)', en: '1 to 10 (Counting)' }, recommendedAges: ['1-4'], numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: '1-20', label: { ar: '١١ إلى ٢٠ (استكشاف متدرج)', en: '11 to 20 (Step-Up)' }, recommendedAges: ['1-4'], numbers: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
];

export interface ColorEntry {
  id: string;
  hex: string;
  name: LocalizedText;
  type: 'primary' | 'secondary' | 'neutral';
  examples: LocalizedText;
  emojis: string;
}

export const ACADEMY_COLORS: ColorEntry[] = [
  { id: 'red', hex: '#FF4D6D', name: { ar: 'أحمر', en: 'Red' }, type: 'primary', examples: { ar: 'تفاحة · فراولة · طماطم', en: 'Apple · Strawberry · Ladybug' }, emojis: '🍎🍓🐞' },
  { id: 'blue', hex: '#39BDF2', name: { ar: 'أزرق', en: 'Blue' }, type: 'primary', examples: { ar: 'سماء · بحر · حوت', en: 'Sky · Ocean · Whale' }, emojis: '🌊🐋🫐' },
  { id: 'yellow', hex: '#FFD84D', name: { ar: 'أصفر', en: 'Yellow' }, type: 'primary', examples: { ar: 'شمس · موزة · ليمونة', en: 'Sun · Banana · Lemon' }, emojis: '☀️🍌🍋' },
  { id: 'green', hex: '#55D98B', name: { ar: 'أخضر', en: 'Green' }, type: 'secondary', examples: { ar: 'شجرة · ضفدع · خيار', en: 'Tree · Frog · Broccoli' }, emojis: '🌳🐸🥦' },
  { id: 'orange', hex: '#FF9360', name: { ar: 'برتقالي', en: 'Orange' }, type: 'secondary', examples: { ar: 'برتقال · جزرة · ثعلب', en: 'Orange · Carrot · Fox' }, emojis: '🍊🥕🦊' },
  { id: 'purple', hex: '#8054D9', name: { ar: 'بنفسجي', en: 'Purple' }, type: 'secondary', examples: { ar: 'عنب · باذنجان · زهرة', en: 'Grapes · Eggplant · Flower' }, emojis: '🍇🍆🪻' },
  { id: 'pink', hex: '#FF78B7', name: { ar: 'وردي', en: 'Pink' }, type: 'secondary', examples: { ar: 'زهرة · فلامنجو · خوخ', en: 'Blossom · Flamingo · Peach' }, emojis: '🌸🦩🍑' },
  { id: 'white', hex: '#FFFFFF', name: { ar: 'أبيض', en: 'White' }, type: 'neutral', examples: { ar: 'سحابة · ثلج · أرنب', en: 'Cloud · Snow · Bunny' }, emojis: '☁️❄️🐇' },
];

export interface ColorMixRecipe {
  a: string;
  b: string;
  resultHex: string;
  resultName: LocalizedText;
  explanation: LocalizedText;
}

export const COLOR_MIX_RECIPES: ColorMixRecipe[] = [
  { a: 'red', b: 'blue', resultHex: '#8054D9', resultName: { ar: 'بنفسجي (Purple)', en: 'Purple' }, explanation: { ar: 'الأحمر + الأزرق يصنعان اللون البنفسجي الساحر!', en: 'Red + Blue blend into Magical Purple!' } },
  { a: 'red', b: 'yellow', resultHex: '#FF9360', resultName: { ar: 'برتقالي (Orange)', en: 'Orange' }, explanation: { ar: 'الأحمر + الأصفر يصنعان اللون البرتقالي الدافئ!', en: 'Red + Yellow blend into Warm Orange!' } },
  { a: 'blue', b: 'yellow', resultHex: '#55D98B', resultName: { ar: 'أخضر (Green)', en: 'Green' }, explanation: { ar: 'الأزرق + الأصفر يصنعان الأخضر المنعش!', en: 'Blue + Yellow blend into Fresh Green!' } },
  { a: 'red', b: 'white', resultHex: '#FF78B7', resultName: { ar: 'وردي (Pink)', en: 'Pink' }, explanation: { ar: 'الأحمر + الأبيض يفتحان اللون إلى الوردي اللطيف!', en: 'Red + White create a soft Candy Pink tint!' } },
];

export interface ShapeEntry {
  id: string;
  name: LocalizedText;
  sides: number;
  emoji: string;
  realWorld: LocalizedText;
  level: 'basic' | 'advanced';
}

export const ACADEMY_SHAPES: ShapeEntry[] = [
  { id: 'circle', name: { ar: 'دائرة', en: 'Circle' }, sides: 0, emoji: '⭕', realWorld: { ar: 'شمس · ساعة · عجلة', en: 'Sun · Clock · Wheel' }, level: 'basic' },
  { id: 'square', name: { ar: 'مربع', en: 'Square' }, sides: 4, emoji: '🟦', realWorld: { ar: 'نافذة · وسادة · شطرنج', en: 'Window · Cushion · Chessboard' }, level: 'basic' },
  { id: 'triangle', name: { ar: 'مثلث', en: 'Triangle' }, sides: 3, emoji: '🔺', realWorld: { ar: 'شراع · هرم · شريحة بيتزا', en: 'Sail · Pyramid · Pizza Slice' }, level: 'basic' },
  { id: 'star', name: { ar: 'نجمة', en: 'Star' }, sides: 10, emoji: '⭐', realWorld: { ar: 'نجمة السماء · نجم البحر', en: 'Sky Star · Starfish' }, level: 'basic' },
  { id: 'pentagon', name: { ar: 'خماسي', en: 'Pentagon' }, sides: 5, emoji: '⬠', realWorld: { ar: 'منزل صغير · رقعة كرة قدم', en: 'House outline · Soccer patch' }, level: 'advanced' },
  { id: 'hexagon', name: { ar: 'سداسي', en: 'Hexagon' }, sides: 6, emoji: '⬡', realWorld: { ar: 'خلية النحل · ندفة الثلج', en: 'Honeycomb · Snowflake' }, level: 'advanced' },
];

export const PARENT_OFFLINE_ACTIVITIES: Array<{ id: string; title: LocalizedText; desc: LocalizedText }> = [
  {
    id: 'off-1',
    title: { ar: 'رحلة البحث عن الأشكال في المنزل', en: 'Living Room Shape Hunt' },
    desc: { ar: 'اطلب من طفلك إيجاد ٣ أشياء دائرية و٣ أشياء مربعة في الغرفة وعدّها معاً.', en: 'Ask your child to find 3 circles and 3 squares around the room and count them together.' },
  },
  {
    id: 'off-2',
    title: { ar: 'فرز الفواكه والألوان في المطبخ', en: 'Kitchen Color & Quantity Sorting' },
    desc: { ar: 'رتّبا الفواكه حسب اللون ثم احسبا أيهما أكثر وأيهما أقل.', en: 'Sort fruits or cups by color, then compare which group has more or fewer.' },
  },
  {
    id: 'off-3',
    title: { ar: 'تشكيل الحروف بالصلصال أو الرمل', en: 'Clay or Sand Letter Tracing' },
    desc: { ar: 'شكّلا حرف اليوم بالصلصال أو بإصبع اليد في صينية رمل لتثبيت الاتجاه الحركي.', en: 'Shape today’s letter using playdough or finger-trace in a tray of sand for tactile memory.' },
  },
];
