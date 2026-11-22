import type { LocalizedText } from '../types/nonoland';

export type TogetherCategoryId =
  | 'read-together'
  | 'letter-sound'
  | 'count-home'
  | 'color-shape'
  | 'listening-prompt'
  | 'real-world'
  | 'calm-bedtime'
  | 'draw-together'
  | 'emotion-kindness'
  | 'family-challenge';

export interface TogetherActivitySpec {
  id: string;
  category: TogetherCategoryId;
  title: LocalizedText;
  emoji: string;
  durationMinutes: number;
  objective: LocalizedText;
  parentInstruction: LocalizedText;
  childMicroTask: {
    prompt: LocalizedText;
    choices: Array<{ id: string; emoji: string; label: LocalizedText }>;
  };
  conversationPrompt: LocalizedText;
  followUpTip: LocalizedText;
}

export const TOGETHER_ACTIVITIES_CATALOG: TogetherActivitySpec[] = [
  {
    id: 'together-read-together',
    category: 'read-together',
    title: { ar: 'قصة قصيرة معاً', en: 'Read Together Story Time' },
    emoji: '📖',
    durationMinutes: 6,
    objective: {
      ar: 'تنمية حب القراءة والانتباه المشترك واللغة التعبيرية للطفل (١–٤ سنوات)',
      en: 'Nurture early love for stories, shared attention, and gentle vocabulary (ages 1–4)',
    },
    parentInstruction: {
      ar: 'اجلس بجانب طفلك، أشر بإصبعك إلى الصورة الأولى وقل: "من هذا؟ ماذا يفعل الأرنب؟" واترك له ثواني ليجيب أو يشير.',
      en: 'Sit close together, point to the main picture, and ask gently: "Who is this? What is bunny doing?" Give your child unhurried time to point or respond.',
    },
    childMicroTask: {
      prompt: { ar: 'اختر صورة نحكي عنها حكاية جميلة!', en: 'Pick a cozy character for our story!' },
      choices: [
        { id: 'bunny', emoji: '🐰', label: { ar: 'أرنوب اللطيف', en: 'Cozy Bunny' } },
        { id: 'duck', emoji: '🐥', label: { ar: 'بطوط الصغير', en: 'Little Duck' } },
        { id: 'moon', emoji: '🌙', label: { ar: 'قمر المساء', en: 'Smiling Moon' } },
      ],
    },
    conversationPrompt: {
      ar: 'ماذا تعتقد أن يفعل صديقنا بعد أن يأكل الجزر؟',
      en: 'What do you think our little friend wants to do next?',
    },
    followUpTip: {
      ar: 'أعد نفس القصة غداً واسمح لطفلك بقلب الصفحة أو تقليد صوت الحيوان.',
      en: 'Revisit the same story tomorrow and invite your child to turn pages or mimic sounds.',
    },
  },
  {
    id: 'together-letter-sound',
    category: 'letter-sound',
    title: { ar: 'اكتشاف الحرف والصوت', en: 'Letter & Sound Discovery' },
    emoji: '🔤',
    durationMinutes: 5,
    objective: {
      ar: 'ربط الصوت الأول بالكلمات المألوفة حول الطفل بمرح دون ضغط',
      en: 'Connect gentle first letter sounds to familiar objects playfully',
    },
    parentInstruction: {
      ar: 'انطق صوتاً ناعماً مثل "بَ بَ بَ" أو "Buh" وشجع طفلك على تقليد حركة الشفتين ثم البحث عن شيء قريب بنفس الصوت.',
      en: 'Say a playful sound like "Buh-Buh" or "بَ بَ", let your child copy your lips, then spot one nearby toy starting with that sound.',
    },
    childMicroTask: {
      prompt: { ar: 'اضغط على الصوت الذي قلناه مع ماما أو بابا!', en: 'Tap the sound we practiced together!' },
      choices: [
        { id: 'ba', emoji: '⛵', label: { ar: 'ب — بطة', en: 'B — Boat' } },
        { id: 'ma', emoji: '🍌', label: { ar: 'م — موز', en: 'M — Moon' } },
        { id: 'sa', emoji: '🐟', label: { ar: 'س — سمكة', en: 'S — Sun' } },
      ],
    },
    conversationPrompt: {
      ar: 'هل نجد لعبة في الغرفة تبدأ بهذا الصوت الجميل؟',
      en: 'Can we spot one toy nearby that starts with this sound?',
    },
    followUpTip: {
      ar: 'احتفِ بكل محاولة صوتية حتى لو نطق الطفل جزءاً من الكلمة.',
      en: 'Celebrate every vocal attempt — playful imitation builds phonemic awareness.',
    },
  },
  {
    id: 'together-count-home',
    category: 'count-home',
    title: { ar: 'عدّ الأشياء في البيت', en: 'Count Things at Home' },
    emoji: '🔢',
    durationMinutes: 5,
    objective: {
      ar: 'فهم العدّ الحسي ١–٣–٥ بلمس الأشياء الحقيقية معاً',
      en: 'Build concrete counting (1–5) by touching everyday items side by side',
    },
    parentInstruction: {
      ar: 'ضع ٣ مكعبات أو ملاعق على السجادة وأمسك يد طفلك ليلامس كل قطعة أثناء العدّ بصوت دافئ: ١، ٢، ٣!',
      en: 'Place 3 spoons or soft blocks on the rug and gently guide your child’s finger to touch each one while counting aloud: 1, 2, 3!',
    },
    childMicroTask: {
      prompt: { ar: 'كم تفاحة نضع في سلة نونو اليوم؟', en: 'Tap to count yummy apples into the basket!' },
      choices: [
        { id: 'one', emoji: '🍎', label: { ar: '١ واحد', en: '1 One' } },
        { id: 'two', emoji: '🍎🍎', label: { ar: '٢ اثنان', en: '2 Two' } },
        { id: 'three', emoji: '🍎🍎🍎', label: { ar: '٣ ثلاثة', en: '3 Three' } },
      ],
    },
    conversationPrompt: {
      ar: 'كم حذاء صغيراً أمام الباب؟ لنعدّها معاً!',
      en: 'How many little shoes are near the door? Let us count them!',
    },
    followUpTip: {
      ar: 'العدّ وقت ارتداء الجوارب أو صعود الدرج يثبت المفهوم تلقائياً.',
      en: 'Count steps or socks during daily routines to reinforce one-to-one correspondence.',
    },
  },
  {
    id: 'together-color-shape',
    category: 'color-shape',
    title: { ar: 'بحث الألوان والأشكال', en: 'Color & Shape Hunt' },
    emoji: '🎨',
    durationMinutes: 6,
    objective: {
      ar: 'تنمية الملاحظة البصرية والتمييز بين الألوان الأساسية والدوائر والمربعات',
      en: 'Sharpen visual observation for primary colors and simple shapes',
    },
    parentInstruction: {
      ar: 'اختر لوناً واحداً مع طفلك وابحثا معاً في الغرفة عن وسادة أو كوب أو كتاب بنفس اللون.',
      en: 'Choose one joyful color together and walk around the room spotting a cushion, cup, or book that matches it.',
    },
    childMicroTask: {
      prompt: { ar: 'أي لون وجدناه في غرفتنا؟', en: 'Which sunny color did we find?' },
      choices: [
        { id: 'yellow', emoji: '🟡', label: { ar: 'أصفر مثل الشمس', en: 'Sunny Yellow' } },
        { id: 'blue', emoji: '🔵', label: { ar: 'أزرق مثل البحر', en: 'Sky Blue' } },
        { id: 'red', emoji: '🔴', label: { ar: 'أحمر مثل الفراولة', en: 'Berry Red' } },
      ],
    },
    conversationPrompt: {
      ar: 'هل هذا الشيء مدور مثل الكرة أم مربع مثل الصندوق؟',
      en: 'Is it round like a ball or square like a cozy box?',
    },
    followUpTip: {
      ar: 'اربط اللون باسم الفاكهة أو اللعبة المفضلة لطفلك.',
      en: 'Pair color names with familiar foods or favorite plush toys.',
    },
  },
  {
    id: 'together-listening-prompt',
    category: 'listening-prompt',
    title: { ar: 'لعبة الاستماع والانتباه', en: 'Listening & Follow-the-Clue Game' },
    emoji: '👂',
    durationMinutes: 4,
    objective: {
      ar: 'تقوية الاستماع التفاعلي واتباع تعليمات لطيفة من خطوة واحدة',
      en: 'Strengthen joyful listening and gentle one-step directions',
    },
    parentInstruction: {
      ar: 'اهمس بجملة مرحة مثل: "صفق بيديك مرتين ثم المس أنفك!" وشارك الطفل الحركة بابتسامة.',
      en: 'Whisper a playful clue like: "Clap twice, then touch your nose!" and do the motion together with a smile.',
    },
    childMicroTask: {
      prompt: { ar: 'اختر حركة المرح التي نفذناها معاً!', en: 'Pick the silly action we did together!' },
      choices: [
        { id: 'clap', emoji: '👏', label: { ar: 'تصفيق سعيد', en: 'Happy Claps' } },
        { id: 'wave', emoji: '👋', label: { ar: 'تلويح ودود', en: 'Friendly Wave' } },
        { id: 'hop', emoji: '🐇', label: { ar: 'قفزة أرنب', en: 'Bunny Hop' } },
      ],
    },
    conversationPrompt: {
      ar: 'ما الصوت الهادئ الذي نسمعه الآن في الغرفة؟',
      en: 'What gentle sound can we hear right now if we listen closely?',
    },
    followUpTip: {
      ar: 'تبادل الأدوار! دع طفلك يعطيك أنت أمراً لطيفاً لتنفذه.',
      en: 'Switch roles and let your toddler give YOU a gentle silly instruction!',
    },
  },
  {
    id: 'together-real-world',
    category: 'real-world',
    title: { ar: 'نشاط واقعي من الحياة اليومية', en: 'Real-World Practical Exploration' },
    emoji: '🧺',
    durationMinutes: 8,
    objective: {
      ar: 'تعزيز الاستقلالية الحركية الدقيقة والانتماء العائلي بالمشاركة البسيطة',
      en: 'Build fine motor confidence and belonging through small everyday helper roles',
    },
    parentInstruction: {
      ar: 'أشرك طفلك في مهمة آمنة صغيرة: مطابقة جوربين، سكب ماء بكوب صغير على نبتة، أو فرز الفاكهة في السلة.',
      en: 'Invite your child to do one tiny safe helper task: matching two socks, watering one plant, or placing soft fruit in a bowl.',
    },
    childMicroTask: {
      prompt: { ar: 'بماذا ساعدت عائلتي الجميلة اليوم؟', en: 'How did I help my family today?' },
      choices: [
        { id: 'plant', emoji: '🌱', label: { ar: 'سقيتُ نبتة', en: 'Watered a Plant' } },
        { id: 'toys', emoji: '🧸', label: { ar: 'رتبتُ الألعاب', en: 'Tidied Soft Toys' } },
        { id: 'socks', emoji: '🧦', label: { ar: 'طابقتُ الجوارب', en: 'Matched Socks' } },
      ],
    },
    conversationPrompt: {
      ar: 'كيف تشعر عندما تساعد ماما وبابا في هذا العمل؟',
      en: 'How does your heart feel when you help out?',
    },
    followUpTip: {
      ar: 'امدح المجهود لا الكمال — هذا يبني الشغف بالمشاركة.',
      en: 'Praise effort warmly rather than neatness.',
    },
  },
  {
    id: 'together-calm-bedtime',
    category: 'calm-bedtime',
    title: { ar: 'روتين الهدوء قبل النوم', en: 'Calm Bedtime Wind-Down' },
    emoji: '🌙',
    durationMinutes: 7,
    objective: {
      ar: 'تهيئة الجهاز العصبي للنوم الهادئ عبر التنفس الدافئ والأمان الأسري',
      en: 'Support peaceful transition to sleep with gentle breathing and warm reassurance',
    },
    parentInstruction: {
      ar: 'خفف الإضاءة، تنفس مع طفلك كأنكما تشمان زهرة ثم تنفخان على شمعة دافئة، واذكرا ٣ أشياء أحببتماها اليوم.',
      en: 'Dim the lights, practice smelling a pretend flower and blowing gently on a breeze together, and recall 2 happy moments from today.',
    },
    childMicroTask: {
      prompt: { ar: 'نرسل تصبح على خير إلى...', en: 'Say gentle goodnight to...' },
      choices: [
        { id: 'stars', emoji: '✨', label: { ar: 'النجوم اللامعة', en: 'Twinkling Stars' } },
        { id: 'bear', emoji: '🧸', label: { ar: 'الدب الصغير', en: 'Sleepy Bear' } },
        { id: 'garden', emoji: '🌼', label: { ar: 'حديقة نونو', en: 'Nono Garden' } },
      ],
    },
    conversationPrompt: {
      ar: 'ما أجمل لحظة ضحكنا فيها اليوم؟',
      en: 'What was our favorite smiling moment today?',
    },
    followUpTip: {
      ar: 'التكرار الثابت للروتين المسائي يمنح الطفل طمأنينة عميقة.',
      en: 'Keeping the same calm cue nightly gives toddlers deep emotional security.',
    },
  },
  {
    id: 'together-draw-together',
    category: 'draw-together',
    title: { ar: 'الرسم والتخيل معاً', en: 'Draw & Imagine Together' },
    emoji: '🖍️',
    durationMinutes: 8,
    objective: {
      ar: 'تشجيع الخيال وتآزر اليد والعين بالرسم المشترك الحر',
      en: 'Encourage imagination and early hand-eye coordination through shared scribbling',
    },
    parentInstruction: {
      ar: 'على ورقة كبيرة ارسم دائرة بسيطة واسأل طفلك: "ماذا نضيف لها؟ شمساً أم وجهاً ضاحكاً أم قطة؟" وتبادلا الألوان.',
      en: 'Draw one big gentle circle on paper and ask: "What should we add next — sunbeams, whiskers, or a smiling face?" Take turns adding lines.',
    },
    childMicroTask: {
      prompt: { ar: 'ماذا رسمنا على ورقتنا السحرية؟', en: 'What did we draw together?' },
      choices: [
        { id: 'sun', emoji: '☀️', label: { ar: 'شمس ذهبية', en: 'Happy Sun' } },
        { id: 'cat', emoji: '🐱', label: { ar: 'قطة ظريفة', en: 'Playful Cat' } },
        { id: 'rainbow', emoji: '🌈', label: { ar: 'قوس قزح', en: 'Colorful Rainbow' } },
      ],
    },
    conversationPrompt: {
      ar: 'أين تذهب هذه الرسمة لتعلقها؟ في غرفتك أم على الثلاجة؟',
      en: 'Where should we proudly display our artwork today?',
    },
    followUpTip: {
      ar: 'اسأل طفلك عن رسمته بدل أن تحزرها: "أخبرني عن هذا الخط الجميل!"',
      en: 'Invite storytelling with: "Tell me about your picture!"',
    },
  },
  {
    id: 'together-emotion-kindness',
    category: 'emotion-kindness',
    title: { ar: 'حديث المشاعر واللطف', en: 'Emotion & Kindness Talk' },
    emoji: '💛',
    durationMinutes: 5,
    objective: {
      ar: 'تسمية المشاعر الأساسية بلطف وتعلم التعاطف في سن مبكرة',
      en: 'Help toddlers name simple feelings gently and practice warm kindness',
    },
    parentInstruction: {
      ar: 'تحدثا عن الوجوه السعيدة أو المتفاجئة أو التي تحتاج حضناً، وأكّد للطفل أن كل المشاعر مسموحة ومحبوبة.',
      en: 'Practice happy, surprised, and cozy-hug faces in a mirror or together, reminding your child all feelings are safe with you.',
    },
    childMicroTask: {
      prompt: { ar: 'كيف يشعر قلبنا الجميل الآن؟', en: 'How does our heart feel right now?' },
      choices: [
        { id: 'happy', emoji: '😊', label: { ar: 'سعيد ومبتسم', en: 'Happy & Bright' } },
        { id: 'calm', emoji: '🥰', label: { ar: 'دافئ ومحبوب', en: 'Cozy & Loved' } },
        { id: 'hug', emoji: '🤗', label: { ar: 'يحب الحضن', en: 'Ready for a Hug' } },
      ],
    },
    conversationPrompt: {
      ar: 'كيف نسعد صديقاً أو دمية تبدو حزينة قليلاً؟',
      en: 'How can we comfort a teddy bear when it feels shy or sad?',
    },
    followUpTip: {
      ar: 'تسمية شعور الطفل أثناء اليوم ("يبدو أنك متحمس!") تبني الذكاء العاطفي.',
      en: 'Gently naming feelings during play builds lifelong emotional literacy.',
    },
  },
  {
    id: 'together-family-challenge',
    category: 'family-challenge',
    title: { ar: 'تحدي نهاية الأسبوع العائلي', en: 'Weekly Family Challenge' },
    emoji: '🏡',
    durationMinutes: 10,
    objective: {
      ar: 'صناعة ذكرى عائلية مميزة تجمع اللعب والحركة والفضول دون أي تنافس',
      en: 'Create a joyful, pressure-free family memory combining movement and curiosity',
    },
    parentInstruction: {
      ar: 'اختر تحدياً لطيفاً لهذا الأسبوع مثل بناء قلعة وسائد صغيرة أو نزهة قصيرة لعدّ ٤ أوراق شجر مختلفة.',
      en: 'Pick a playful mini adventure this week: build a cozy pillow fort or collect 3 gentle leaves outside to compare shapes.',
    },
    childMicroTask: {
      prompt: { ar: 'ما مغامرتنا العائلية الجميلة هذا الأسبوع؟', en: 'Choose our family adventure badge!' },
      choices: [
        { id: 'fort', emoji: '⛺', label: { ar: 'خيمة الوسائد', en: 'Cozy Pillow Fort' } },
        { id: 'nature', emoji: '🌿', label: { ar: 'نزهة الطبيعة', en: 'Nature Leaf Walk' } },
        { id: 'picnic', emoji: '🧺', label: { ar: 'نزهة على السجادة', en: 'Living Room Picnic' } },
      ],
    },
    conversationPrompt: {
      ar: 'من نأخذ معنا في مغامرتنا: الدبدوب أم نونو أم القطة؟',
      en: 'Which stuffed friend joins our family adventure today?',
    },
    followUpTip: {
      ar: 'الاحتفال بالوقت المشترك يفتح زهرة خاصة في حديقة الطفل!',
      en: 'Finishing this Together Time moment unlocks a special blossom in the Learning Garden!',
    },
  },
];
