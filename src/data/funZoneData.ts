import { CharacterOutfit, CuratedYouTubeVideo, LocalizedText } from '../types/nonoland';

export interface FunCharacter {
  id: 'nono' | 'lolo' | 'leo' | 'bobo' | 'ellie' | 'titi';
  name: LocalizedText;
  emoji: string;
  color: string;
  tagline: LocalizedText;
}

export const FUN_CHARACTERS: FunCharacter[] = [
  { id: 'nono', name: { ar: 'نونو', en: 'Nono' }, emoji: '🦊', color: '#8054D9', tagline: { ar: 'مستكشف النجوم المرح', en: 'Cheerful Star-Fox' } },
  { id: 'lolo', name: { ar: 'لولو', en: 'Lolo' }, emoji: '🐰', color: '#FF78B7', tagline: { ar: 'الأرنبة القافزة السريعة', en: 'Bouncy Bunny' } },
  { id: 'leo', name: { ar: 'ليو', en: 'Leo' }, emoji: '🦁', color: '#FFD84D', tagline: { ar: 'الأسد الشجاع اللطيف', en: 'Gentle Brave Lion' } },
  { id: 'bobo', name: { ar: 'بوبو', en: 'Bobo' }, emoji: '🐻', color: '#FF9360', tagline: { ar: 'الدب محب العسل والموسيقى', en: 'Honey & Music Bear' } },
  { id: 'ellie', name: { ar: 'إيلي', en: 'Ellie' }, emoji: '🐘', color: '#39BDF2', tagline: { ar: 'الفيلة الرسامة المبدعة', en: 'Artistic Elephant' } },
  { id: 'titi', name: { ar: 'تيتي', en: 'Titi' }, emoji: '🐢', color: '#55D98B', tagline: { ar: 'السلحفاة الذكية الهادئة', en: 'Clever Calm Turtle' } },
];

export const DRESS_UP_OPTIONS = {
  hats: [
    { id: 'none', emoji: '', label: { ar: 'بدون قبعة', en: 'No Hat' } },
    { id: 'crown', emoji: '👑', label: { ar: 'تاج ذهبي', en: 'Golden Crown' } },
    { id: 'wizard', emoji: '🎩', label: { ar: 'قبعة ساحر', en: 'Magic Hat' } },
    { id: 'cap', emoji: '🧢', label: { ar: 'كاب رياضي', en: 'Sport Cap' } },
    { id: 'flower', emoji: '🌸', label: { ar: 'زهرة الربيع', en: 'Spring Flower' } },
  ],
  outfits: [
    { id: 'scarf', emoji: '🧣', label: { ar: 'وشاح المستكشف', en: 'Explorer Scarf' } },
    { id: 'cape', emoji: '🦸', label: { ar: 'عباءة البطل', en: 'Hero Cape' } },
    { id: 'bow', emoji: '🎀', label: { ar: 'فيونكة أنيقة', en: 'Fancy Bow' } },
    { id: 'vest', emoji: '🦺', label: { ar: 'سترة المخترع', en: 'Inventor Vest' } },
  ],
  accessories: [
    { id: 'glasses', emoji: '🕶️', label: { ar: 'نظارة شمسية', en: 'Cool Shades' } },
    { id: 'wand', emoji: '🪄', label: { ar: 'عصا سحرية', en: 'Magic Wand' } },
    { id: 'guitar', emoji: '🎸', label: { ar: 'جيتار مرح', en: 'Fun Guitar' } },
    { id: 'balloon', emoji: '🎈', label: { ar: 'بالونة طائرة', en: 'Floating Balloon' } },
  ],
  backdrops: ['#FFF8E9', '#E5F6FF', '#F3E8FF', '#FFE6F2', '#E2F9EC'],
};

export const DEFAULT_CHARACTER_OUTFITS: Record<string, CharacterOutfit> = {
  nono: { characterId: 'nono', hat: 'none', outfit: 'scarf', accessory: 'wand', backdropColor: '#F3E8FF' },
  lolo: { characterId: 'lolo', hat: 'flower', outfit: 'bow', accessory: 'balloon', backdropColor: '#FFE6F2' },
  leo: { characterId: 'leo', hat: 'crown', outfit: 'cape', accessory: 'glasses', backdropColor: '#FFF8E9' },
  bobo: { characterId: 'bobo', hat: 'cap', outfit: 'vest', accessory: 'guitar', backdropColor: '#E2F9EC' },
  ellie: { characterId: 'ellie', hat: 'wizard', outfit: 'scarf', accessory: 'wand', backdropColor: '#E5F6FF' },
  titi: { characterId: 'titi', hat: 'none', outfit: 'bow', accessory: 'glasses', backdropColor: '#E2F9EC' },
};

export interface FunnyMomentSkit {
  id: string;
  title: LocalizedText;
  characters: string[];
  beats: Array<{
    emojiScene: string;
    caption: LocalizedText;
    sound: 'pop' | 'success' | 'drum' | 'bell';
  }>;
}

export const FUNNY_MOMENTS: FunnyMomentSkit[] = [
  {
    id: 'skit-bobo-honey',
    title: { ar: 'بوبو ووعاء العسل الطائر!', en: 'Bobo & the Floating Honey Jar!' },
    characters: ['🐻', '🦊'],
    beats: [
      { emojiScene: '🐻🍯👀', caption: { ar: 'وجد بوبو وعاء عسل يلمع على الغصن!', en: 'Bobo spotted a shiny honey jar on a branch!' }, sound: 'pop' },
      { emojiScene: '🦊🪄✨', caption: { ar: 'لمس نونو الوعاء بعصاه السحرية بالخطأ فطار في السماء!', en: 'Nono tapped it with a magic wand—and the jar floated up!' }, sound: 'bell' },
      { emojiScene: '🐻🎈🤣🍯', caption: { ar: 'طار بوبو ببالونة ليلحق بالعسل وضحك الجميع!', en: 'Bobo floated up on a balloon to catch it and everyone giggled!' }, sound: 'success' },
    ],
  },
  {
    id: 'skit-leo-sneeze',
    title: { ar: 'عطسة ليو المضحكة بالألوان', en: "Leo's Rainbow Confetti Sneeze" },
    characters: ['🦁', '🐘'],
    beats: [
      { emojiScene: '🐘🎨🦁', caption: { ar: 'كانت إيلي ترسم، فدغدغت ريشة الرسم أنف ليو!', en: 'Ellie was painting when a paintbrush tickled Leo’s nose!' }, sound: 'pop' },
      { emojiScene: '🦁💥🌈', caption: { ar: 'هاتشووو! تطايرت قصاصات قوس قزح في كل مكان!', en: 'ACHOO! Colorful rainbow confetti burst everywhere!' }, sound: 'drum' },
      { emojiScene: '🦁🎨😂🐘', caption: { ar: 'أصبح ليو وإيلي لوحة فنية متحركة رائعة!', en: 'Leo and Ellie turned into a hilarious living painting!' }, sound: 'success' },
    ],
  },
  {
    id: 'skit-titi-dance',
    title: { ar: 'رقصة تيتي السريعة المفاجئة', en: "Titi's Surprise Turbo Dance" },
    characters: ['🐢', '🐰'],
    beats: [
      { emojiScene: '🐢🎵💤', caption: { ar: 'ظنت لولو أن السلحفاة تيتي نائمة بهدوء...', en: 'Lolo thought Titi the Turtle was taking a slow nap...' }, sound: 'pop' },
      { emojiScene: '🥁🎶🐢⚡', caption: { ar: 'وعندما بدأت الموسيقى، رقصت تيتي أسرع من الجميع!', en: 'When the beat dropped, Titi spun faster than anyone!' }, sound: 'drum' },
      { emojiScene: '🐰🌟🐢💃', caption: { ar: 'صفّقت لولو بشدة وانضمت لحفلة الرقص!', en: 'Lolo cheered and joined the joyful dance party!' }, sound: 'success' },
    ],
  },
];

export const SPOT_DIFFERENCE_PUZZLES = [
  {
    id: 'std-1',
    title: { ar: 'مخيم الغابة السعيد', en: 'Happy Forest Camp' },
    leftGrid: ['🌲', '⛺', '🦊', '🍄', '☀️', '🦋'],
    rightGrid: ['🌲', '⛺', '🦊', '🌺', '☀️', '🐝'],
    diffIndices: [3, 5],
  },
  {
    id: 'std-2',
    title: { ar: 'مغامرة الشاطئ', en: 'Sunny Beach Day' },
    leftGrid: ['🏖️', '🦀', '⛵', '🌴', '🐚', '🍦'],
    rightGrid: ['🏖️', '🐙', '⛵', '🌴', '⭐', '🍦'],
    diffIndices: [1, 4],
  },
];

export const OFFICIAL_YOUTUBE_CHANNEL = {
  url: 'https://www.youtube.com/@Future-p6l',
  handle: '@Future-p6l',
  channelName: { ar: 'قناة نونو لاند الرسمية على يوتيوب', en: 'NonoLand Official on YouTube' },
  safetyNotice: {
    ar: 'سلامة الطفل أولاً: لا نعرض تعليقات أو اقتراحات يوتيوب العامة داخل واجهة الطفل. الانتقال للقناة الخارجية محمي ببوابة الأهل، ويخضع تشغيل الفيديو أو الإعلانات الخارجية لسياسات منصة يوتيوب.',
    en: 'Child Safety First: Public YouTube comments, live chat, and unrelated recommendations are never exposed to children. External channel visits are parent-gated, and external playback/ads are governed by YouTube platform policies.',
  },
};

export const INITIAL_CURATED_VIDEOS: CuratedYouTubeVideo[] = [];
