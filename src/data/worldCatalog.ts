import {
  ChildAvatarConfig,
  LearningPlanGoal,
  LocalizedText,
  ParentSchedulePreferences,
  PetSpeciesId,
  PetState,
  ReportSubjectKey,
  RewardShopItem,
  RoomConfig,
} from '../types/nonoland';

export interface LabExperimentSpec {
  id: string;
  title: LocalizedText;
  shortTag: LocalizedText;
  icon: string;
  accentColor: string;
  category: 'chemistry' | 'physics' | 'biology' | 'space' | 'challenge';
  objective: LocalizedText;
  nonoIntro: LocalizedText;
  explanationByAge: {
    young: LocalizedText; // internal band 1-2
    mid: LocalizedText; // internal band 2-3
    older: LocalizedText; // internal band 3-4
  };
  starsReward: number;
}

export const LAB_EXPERIMENTS: LabExperimentSpec[] = [
  {
    id: 'lab-color-mixing',
    title: { ar: 'مختبر خلط الألوان', en: 'Color Mixing Lab' },
    shortTag: { ar: 'كيمياء مرحة', en: 'Fun Chemistry' },
    icon: '🎨',
    accentColor: '#FF78B7',
    category: 'chemistry',
    objective: {
      ar: 'امزج الألوان الأساسية في الأنابيب السحرية لتصنع ألواناً جديدة!',
      en: 'Mix primary liquids in glowing beakers to create brand new colors!',
    },
    nonoIntro: {
      ar: 'أهلاً بك في طاولة الألوان! اختر لونين لنرى ماذا يحدث عندما يندمجان معاً!',
      en: 'Welcome to the color bench! Pick two colors to see what new shade appears!',
    },
    explanationByAge: {
      young: {
        ar: 'رائع! الأحمر والأصفر معاً يصنعان لون البرتقالة اللذيذة 🍊!',
        en: 'Awesome! Red and yellow together make bright orange like a yummy tangerine 🍊!',
      },
      mid: {
        ar: 'الأحمر والأزرق والأصفر هي ألوان أساسية؛ بخلطها نصنع ألواناً ثانوية مثل الأخضر والبنفسجي والبرتقالي.',
        en: 'Red, blue, and yellow are primary colors! Mixing two of them creates secondary colors: green, purple, and orange.',
      },
      older: {
        ar: 'عند مزج لونين أساسيين نحصل على لون جديد جميل: الأحمر مع الأصفر يصنع برتقالياً، والأزرق مع الأصفر يصنع أخضر!',
        en: 'Mixing two primary colors makes a brand-new shade: red + yellow = orange, and blue + yellow = green!',
      },
    },
    starsReward: 4,
  },
  {
    id: 'lab-volcano',
    title: { ar: 'تجربة البركان الفوّار', en: 'Fizzing Volcano Experiment' },
    shortTag: { ar: 'تفاعل فوار', en: 'Safe Reaction' },
    icon: '🌋',
    accentColor: '#FF9360',
    category: 'chemistry',
    objective: {
      ar: 'أضف مسحوق البيكنج صودا ثم الخل اللطيف وشاهد فوران البركان الآمن!',
      en: 'Add baking powder and gentle vinegar inside the volcano crater to watch safe fizzing bubbles!',
    },
    nonoIntro: {
      ar: 'هيا نرتدي نظارة المختبر! سنصنع فوراناً جميلاً مثل عصير الفقاعات!',
      en: 'Safety goggles on! Let us combine safe kitchen ingredients to create fizzy volcano foam!',
    },
    explanationByAge: {
      young: {
        ar: 'فقاعات كثيرة تطير! عندما يلتقي المسحوق بالسائل يخرج هواء مرح يصنع الرغوة!',
        en: 'Look at those dancing bubbles! Mixing the powder and liquid makes tiny gas bubbles rise up!',
      },
      mid: {
        ar: 'عند اختلاط صودا الخبز والخل تتكون فقاعات غاز ثاني أكسيد الكربون فتندفع الرغوة للأعلى.',
        en: 'When baking soda meets vinegar, they react to release carbon dioxide gas bubbles that lift colorful foam upward!',
      },
      older: {
        ar: 'تجمع المسحوق مع الخل اللطيف يصنع فقاعات غاز سريعة ترتفع للأعلى وتدفع الرغوة الملونة مثل البركان الصغير!',
        en: 'Mixing baking soda and vinegar makes bubbly gas that rises up fast and pushes colorful foam out!',
      },
    },
    starsReward: 4,
  },
  {
    id: 'lab-float-sink',
    title: { ar: 'تجربة الطفو والغوص', en: 'Floating & Sinking Tank' },
    shortTag: { ar: 'فيزياء الماء', en: 'Water Physics' },
    icon: '⛵',
    accentColor: '#39BDF2',
    category: 'physics',
    objective: {
      ar: 'اختبر الأشياء في حوض الماء واكتشف أيهما يطفو فوق الماء وأيهما يغوص!',
      en: 'Drop objects into the clear water tank to discover which ones float on top and which sink!',
    },
    nonoIntro: {
      ar: 'توقّع أولاً ثم أسقط الغرض داخل حوض الماء لنختبر الفرضية!',
      en: 'Predict first, then drop each object into our water tank to test your guess!',
    },
    explanationByAge: {
      young: {
        ar: 'البطة والخشب يحبان الطفو فوق الماء، أما الحجر والمفتاح فيغوصان للأسفل!',
        en: 'The rubber duck and wood stay on top of the water, while heavy stones sink down!',
      },
      mid: {
        ar: 'الأجسام الخفيفة أو المملوءة بالهواء تطفو فوق الماء، بينما الأجسام الثقيلة المتراصة تغوص للقاع.',
        en: 'Objects that are light for their size or hold air float on water, while dense heavy objects sink to the bottom.',
      },
      older: {
        ar: 'الأشياء الخفيفة أو التي تحتوي على هواء يرفعها الماء فتطفو على السطح، بينما الأشياء الثقيلة المتماسكة تغوص للقاع.',
        en: 'Light things or items filled with air stay on top of the water, while heavy dense objects sink down.',
      },
    },
    starsReward: 4,
  },
  {
    id: 'lab-magnet',
    title: { ar: 'مختبر اكتشاف المغناطيس', en: 'Magnet Discovery Bench' },
    shortTag: { ar: 'قوى وجذب', en: 'Forces & Magnetism' },
    icon: '🧲',
    accentColor: '#8054D9',
    category: 'physics',
    objective: {
      ar: 'حرّك المغناطيس القوي نحو الأشياء واختبر ما ينجذب إليه وما لا ينجذب!',
      en: 'Move the horseshoe magnet toward objects to discover what sticks and what stays still!',
    },
    nonoIntro: {
      ar: 'المغناطيس يمتلك قوة سحرية غير مرئية! أي الأشياء سيقفز نحوه؟',
      en: 'A magnet has an invisible pull! Tap or slide items near it to see which ones jump!',
    },
    explanationByAge: {
      young: {
        ar: 'قفز المسمار والمفتاح المعدني نحو المغناطيس! بينما الخشب والورق لم يتحركا!',
        en: 'The metal key and clip jumped right onto the magnet! Wood and paper stayed put!',
      },
      mid: {
        ar: 'المغناطيس يجذب المعادن مثل الحديد والفولاذ، ولا يجذب البلاستيك أو الخشب أو الورق.',
        en: 'Magnets attract metals containing iron or steel, while wood, plastic, and paper are non-magnetic.',
      },
      older: {
        ar: 'المغناطيس يمتلك قوة جذب خفية تلتقط المعادن مثل الحديد، بينما لا تجذب الخشب أو الورق أو البلاستيك.',
        en: 'A magnet has an invisible pull that sticks to iron metals, while wood, paper, and plastic stay still.',
      },
    },
    starsReward: 4,
  },
  {
    id: 'lab-plant-grow',
    title: { ar: 'مختبر نمو النبات السعيد', en: 'Plant Growing Greenhouse' },
    shortTag: { ar: 'عالم الأحياء', en: 'Living Biology' },
    icon: '🌱',
    accentColor: '#55D98B',
    category: 'biology',
    objective: {
      ar: 'ازرع البذرة في التربة، ثم اسقها بالماء وافتح لها ضوء الشمس لتنمو زهرة جميلة!',
      en: 'Plant the seed in soil, water it gently, and add warm sunlight to watch every growth stage!',
    },
    nonoIntro: {
      ar: 'البذرة الصغيرة نائمة في التربة! لنمنحها الماء والشمس خطوة بخطوة!',
      en: 'Our tiny seed is cozy in the soil! Give it water and sunlight step by step!',
    },
    explanationByAge: {
      young: {
        ar: 'أولاً جذر صغير، ثم ساق خضراء، ثم زهرة مشرقة! النبات يشرب الماء ويحب الشمس!',
        en: 'First tiny roots, then a green sprout, then a bright flower! Plants love water and sunshine!',
      },
      mid: {
        ar: 'تحتاج البذور إلى التربة والماء والهواء وضوء الشمس لتنبت جذوراً وساقاً وأوراقاً وأزهاراً.',
        en: 'Seeds need soil, water, air, and sunlight to sprout roots, stems, leaves, and blooming flowers.',
      },
      older: {
        ar: 'تشرب البذرة الماء فتستيقظ وتمد جذورها في التربة، ثم تفتح أوراقها الخضراء لتستقبل ضوء الشمس وتكبر!',
        en: 'Water wakes the little seed so its roots grow into the soil, and green leaves open to enjoy warm sunlight!',
      },
    },
    starsReward: 4,
  },
  {
    id: 'lab-space-explorer',
    title: { ar: 'مستكشف الفضاء والكواكب', en: 'Space Explorer Observatory' },
    shortTag: { ar: 'فلك ونجوم', en: 'Cosmic Astronomy' },
    icon: '🪐',
    accentColor: '#6366F1',
    category: 'space',
    objective: {
      ar: 'اضبط التلسكوب على الشمس والقمر والكواكب واكتشف أسرار مجموعتنا الشمسية!',
      en: 'Aim the star telescope across the Sun, Earth, Mars, and ringed Saturn to inspect our solar system!',
    },
    nonoIntro: {
      ar: 'انظر عبر التلسكوب السماوي! أي كوكب له حلقات لامعة حوله؟',
      en: 'Peer through our observatory telescope! Which planet wears sparkling rings?',
    },
    explanationByAge: {
      young: {
        ar: 'الشمس دافئة ومضيئة، والأرض بيتنا الأزرق، وزحل يرتدي حلقات رائعة!',
        en: 'The Sun shines bright, Earth is our blue home, and Saturn wears sparkly rings!',
      },
      mid: {
        ar: 'تدور ٨ كواكب حول الشمس؛ الأرض هي الكوكب المناسب للحياة لوجود الماء والهواء، وزحل يشتهر بحلقاته.',
        en: 'Eight planets orbit the Sun! Earth supports life with liquid water and air, while Saturn has icy rings.',
      },
      older: {
        ar: 'تدور الكواكب حول الشمس الدافئة! كوكب الأرض يضم الماء والهواء لنعيش عليه، وزحل يتزين بحلقات لامعة جميلة.',
        en: 'Planets travel around our bright Sun! Earth gives us water and air to live, and Saturn wears sparkling rings.',
      },
    },
    starsReward: 4,
  },
  {
    id: 'lab-animal-discovery',
    title: { ar: 'مختبر اكتشاف الحيوانات ومواطنها', en: 'Animal Habitat Discovery' },
    shortTag: { ar: 'الطبيعة والحياة', en: 'Animal Biology' },
    icon: '🦁',
    accentColor: '#10B981',
    category: 'biology',
    objective: {
      ar: 'أعد كل حيوان إلى موطنه الطبيعي واستمع إلى صوته وطريقة عيشه!',
      en: 'Match each animal to its natural habitat and explore how it stays cozy and safe!',
    },
    nonoIntro: {
      ar: 'أصدقاؤنا الحيوانات يبحثون عن بيوتهم! هل يعيش الدب القطبي في الصحراء أم الجليد؟',
      en: 'Our animal friends need their cozy homes! Where does each animal live best?',
    },
    explanationByAge: {
      young: {
        ar: 'السمكة تسبح في البحر، والجمل يحب الصحراء، والأسد يعيش في الغابة والسهول!',
        en: 'Fish swim in the ocean, camels love sandy deserts, and lions roam grassy savannas!',
      },
      mid: {
        ar: 'لكل حيوان موطن يناسب جسمه وطعامه: الدب القطبي له فراء سميك للثلج، والسمكة تتنفس بالخياشيم في الماء.',
        en: 'Every animal fits its habitat: polar bears have thick fur for ice, and fish use gills underwater.',
      },
      older: {
        ar: 'لكل حيوان صفات رائعة تساعده في بيته: السمكة تسبح بالزعانف، والجمل يتحمل حرارة الصحراء، والدب القطبي يدفئه فراؤه.',
        en: 'Every animal fits its home: fish swim with fins, camels love warm deserts, and polar bears stay cozy in thick fur.',
      },
    },
    starsReward: 4,
  },
  {
    id: 'lab-scientist-challenges',
    title: { ar: 'تحديات العالم الصغير', en: 'Little Scientist Challenges' },
    shortTag: { ar: 'استنتاج ذكي', en: 'Smart Puzzles' },
    icon: '🔭',
    accentColor: '#F59E0B',
    category: 'challenge',
    objective: {
      ar: 'حل ٣ ألغاز علمية عملية تتدرج حسب عمرك لتنال وسام العالم الصغير!',
      en: 'Solve 3 interactive science reasoning missions tailored to your age band!',
    },
    nonoIntro: {
      ar: 'جاهز لاختبار ذكائك العلمي؟ فكّر ولاحظ النتيجة مثل العلماء الحقيقيين!',
      en: 'Ready to think like a young scientist? Observe clues and test your answer!',
    },
    explanationByAge: {
      young: {
        ar: 'أنت عالم صغير رائع! لاحظت الألوان والحيوانات والحواس بذكاء!',
        en: 'You are an amazing little scientist! You noticed nature clues right away!',
      },
      mid: {
        ar: 'العلماء يسألون: ماذا أرى؟ لماذا حدث هذا؟ وأنت أجبت بالمنطق والملاحظة!',
        en: 'Real scientists observe carefully and ask why—and you just used scientific thinking!',
      },
      older: {
        ar: 'أحسنت! لاحظت الصور والألوان واستنتجت الحل بتركيز مثل المستكشفين الصغار الأذكياء!',
        en: 'Great observing! You looked closely at the clues and figured out the answer like a bright little explorer!',
      },
    },
    starsReward: 5,
  },
];

export const VALID_LAB_EXPERIMENT_IDS = new Set(LAB_EXPERIMENTS.map((e) => e.id));

export const PET_SPECIES: Array<{
  id: PetSpeciesId;
  name: LocalizedText;
  emoji: string;
  color: string;
  soundLabel: LocalizedText;
  favoriteTreat: LocalizedText;
}> = [
  {
    id: 'star-puppy',
    name: { ar: 'جرو النجوم', en: 'Starlight Puppy' },
    emoji: '🐶',
    color: '#FF9360',
    soundLabel: { ar: 'هاو هاو لطيف!', en: 'Happy woof!' },
    favoriteTreat: { ar: 'بسكويت العسل', en: 'Honey biscuit' },
  },
  {
    id: 'cloud-kitten',
    name: { ar: 'قطة الغيمة', en: 'Cloud Kitten' },
    emoji: '🐱',
    color: '#FF78B7',
    soundLabel: { ar: 'مياو ناعم!', en: 'Soft purr!' },
    favoriteTreat: { ar: 'حليب دافئ', en: 'Warm milk' },
  },
  {
    id: 'honey-bunny',
    name: { ar: 'أرنوب العسل', en: 'Honey Bunny' },
    emoji: '🐰',
    color: '#8054D9',
    soundLabel: { ar: 'قفزة مرحة!', en: 'Joyful hop!' },
    favoriteTreat: { ar: 'جزرة مقرمشة', en: 'Crunchy carrot' },
  },
  {
    id: 'cosmic-dragon',
    name: { ar: 'تنين النجوم الودود', en: 'Friendly Star Dragon' },
    emoji: '🐲',
    color: '#39BDF2',
    soundLabel: { ar: 'نفخة شرارات ملونة!', en: 'Sparkle puff!' },
    favoriteTreat: { ar: 'توت القمر', en: 'Moonberry treat' },
  },
  {
    id: 'garden-turtle',
    name: { ar: 'سلحفاة الحديقة', en: 'Garden Turtle' },
    emoji: '🐢',
    color: '#55D98B',
    soundLabel: { ar: 'ابتسامة هادئة!', en: 'Cozy smile!' },
    favoriteTreat: { ar: 'ورقة خس طازجة', en: 'Crisp leaf' },
  },
];

export const PET_PRESET_NAMES: Array<{ id: string; label: LocalizedText }> = [
  { id: 'coco-star', label: { ar: 'كوكو النجمي', en: 'Star Coco' } },
  { id: 'lulu-cloud', label: { ar: 'لولو السحابة', en: 'Cloud Lulu' } },
  { id: 'simsim', label: { ar: 'سمسم', en: 'Simsim' } },
  { id: 'bisco', label: { ar: 'بيسكو', en: 'Bisco' } },
  { id: 'marshmallow', label: { ar: 'مارشميلو', en: 'Marshmallow' } },
  { id: 'falfoul', label: { ar: 'فلفول', en: 'Falfoul' } },
];

export const REWARD_SHOP_ITEMS: RewardShopItem[] = [
  {
    id: 'shop-avatar-astronaut',
    category: 'avatar',
    name: { ar: 'بدلة رائد الفضاء', en: 'Astronaut Explorer Suit' },
    description: { ar: 'زي فضائي لامع لصورتك الرمزية', en: 'Shiny cosmic spacesuit for My Avatar' },
    emoji: '👩‍🚀',
    costStars: 6,
  },
  {
    id: 'shop-avatar-royal',
    category: 'avatar',
    name: { ar: 'تاج وعباءة المبدع', en: 'Creator Crown & Cape' },
    description: { ar: 'تاج ذهبي وعباءة ملكية للأبطال', en: 'Golden crown and cape outfit' },
    emoji: '👑',
    costStars: 8,
  },
  {
    id: 'shop-avatar-glasses',
    category: 'avatar',
    name: { ar: 'نظارة العالم الذكي', en: 'Smart Scientist Glasses' },
    description: { ar: 'نظارة دائرية أنيقة للمختبر والقراءة', en: 'Cool round glasses for Lab & Reading' },
    emoji: '👓',
    costStars: 4,
  },
  {
    id: 'shop-pet-bowtie',
    category: 'pet',
    name: { ar: 'ربطة عنق قوس قزح للأليف', en: 'Rainbow Pet Bowtie' },
    description: { ar: 'إكسسوار مبهج يرتديه صديقك الأليف', en: 'Cheerful rainbow bowtie for My Pet' },
    emoji: '🎀',
    costStars: 5,
  },
  {
    id: 'shop-pet-cushion',
    category: 'pet',
    name: { ar: 'وسادة الغيمة الدافئة', en: 'Cozy Cloud Bed' },
    description: { ar: 'سرير ناعم لمسكن الحيوان الأليف', en: 'Fluffy cloud bed for pet habitat' },
    emoji: '☁️',
    costStars: 6,
  },
  {
    id: 'shop-pet-ball',
    category: 'pet',
    name: { ar: 'كرة النجوم المضيئة', en: 'Glowing Star Ball' },
    description: { ar: 'لعبة قفز مرحة لوقت اللعب مع أليفك', en: 'Bouncy glowing toy for pet playtime' },
    emoji: '⚽',
    costStars: 4,
  },
  {
    id: 'shop-room-telescope',
    category: 'room',
    name: { ar: 'تلسكوب النجوم لغرفتي', en: 'Bedroom Star Telescope' },
    description: { ar: 'أداة استكشاف رائعة تزين غرفتك', en: 'Decorate My Room with a cosmic telescope' },
    emoji: '🔭',
    costStars: 7,
  },
  {
    id: 'shop-room-rainbow-rug',
    category: 'room',
    name: { ar: 'سجادة قوس قزح لغرفتي', en: 'Rainbow Dream Rug' },
    description: { ar: 'تفتح تصميم سجادة قوس قزح في الغرفة', en: 'Unlocks Rainbow Rug inside My Room' },
    emoji: '🌈',
    costStars: 5,
  },
  {
    id: 'shop-room-bookshelf',
    category: 'room',
    name: { ar: 'مكتبة القصص السحرية', en: 'Storybook Shelf' },
    description: { ar: 'خزانة كتب جميلة تعرض قصصك المفضلة', en: 'Cozy bookshelf for your bedroom wall' },
    emoji: '📚',
    costStars: 6,
  },
  {
    id: 'shop-island-lantern',
    category: 'island',
    name: { ar: 'فانوس جزيرة السماء', en: 'Sky Island Lantern' },
    description: { ar: 'زينة مضيئة تزين جزيرة مغامراتك', en: 'Glowing lantern charm for Adventure Map' },
    emoji: '🏮',
    costStars: 7,
  },
  {
    id: 'shop-char-scientist-coat',
    category: 'character',
    name: { ar: 'معطف نونو المخترع', en: "Nono's Inventor Coat" },
    description: { ar: 'مظهر خاص لشخصيات نونو لاند في المسرح والغرفة', en: 'Special inventor outfit for Nono & friends' },
    emoji: '🥼',
    costStars: 8,
  },
];

export const DEFAULT_AVATAR_CONFIG: ChildAvatarConfig = {
  hairStyle: 'classic',
  hairColor: '#27345C',
  skinTone: '#F6C7A3',
  outfit: 'explorer',
  outfitColor: '#8054D9',
  accessory: 'none',
  expression: 'happy',
  unlockedCosmetics: ['explorer', 'classic', 'happy'],
};

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  theme: 'sunny',
  wallColor: '#FFF3D1',
  wallpaper: 'clouds',
  floorStyle: 'wood',
  curtains: 'violet',
  rug: 'cloud',
  lighting: 'daylight',
  gardenPlants: [
    { id: 'gp-1', slotIndex: 0, speciesId: 'sunflower', stage: 1, waterCount: 1 },
    { id: 'gp-2', slotIndex: 1, speciesId: 'lavender', stage: 0, waterCount: 0 },
  ],
  toyTapsCount: 0,
};

export const DEFAULT_PET_STATE: PetState = {
  adopted: false,
  speciesId: 'star-puppy',
  presetNameId: 'coco-star',
  mood: 'happy',
  accessories: [],
  habitatDecor: [],
  careCount: 0,
  playCount: 0,
};

export const DEFAULT_PARENT_SCHEDULE: ParentSchedulePreferences = {
  preferredDays: ['sun', 'mon', 'tue', 'wed', 'thu'],
  dailyGoalMinutes: 25,
  reminderTime: '17:00',
  weeklySummaryEmail: true,
  achievementAlerts: true,
  focusAreas: ['arabic', 'math', 'logic'],
};

export const DEFAULT_NEXT_MONTH_PLAN: LearningPlanGoal[] = [
  {
    id: 'plan-arabic',
    subject: 'arabic',
    title: { ar: 'تعزيز القراءة والحروف العربية', en: 'Strengthen Arabic Letters & Reading' },
    targetCount: 6,
    focusNote: { ar: '٤ دروس تفاعلية + قصتين عربيتين', en: '4 interactive lessons + 2 Arabic stories' },
    enabled: true,
  },
  {
    id: 'plan-english',
    subject: 'english',
    title: { ar: 'تنمية مفردات اللغة الإنجليزية', en: 'Grow English Phonics & Vocabulary' },
    targetCount: 5,
    focusNote: { ar: 'التركيز على الاستماع والنطق البسيط', en: 'Focus on listening and sound matching' },
    enabled: true,
  },
  {
    id: 'plan-math',
    subject: 'math',
    title: { ar: 'ممارسة الأرقام والعمليات الذهنية', en: 'Numbers & Math Reasoning Practice' },
    targetCount: 5,
    focusNote: { ar: 'أنشطة عد ومقارنة وأنماط عددية', en: 'Counting, comparisons, and number patterns' },
    enabled: true,
  },
  {
    id: 'plan-logic',
    subject: 'logic',
    title: { ar: 'تحديات الذكاء والمنطق والتركيز', en: 'Brain Games & Logical Observation' },
    targetCount: 4,
    focusNote: { ar: 'ألعاب الذاكرة والمتاهات والتسلسل المنطقي', en: 'Memory matching, mazes & sequencing' },
    enabled: true,
  },
  {
    id: 'plan-creative',
    subject: 'creative',
    title: { ar: 'إبداعات فنية وتجارب مختبر نونو', en: 'Creative Studio & Science Discovery' },
    targetCount: 4,
    focusNote: { ar: 'تجربتان في المختبر + مشروع رسم أو قصة', en: '2 Lab experiments + drawing or story project' },
    enabled: true,
  },
];

export const REPORT_SUBJECT_LABELS: Record<ReportSubjectKey, LocalizedText> = {
  arabic: { ar: 'اللغة العربية', en: 'Arabic Language' },
  english: { ar: 'اللغة الإنجليزية', en: 'English Language' },
  math: { ar: 'الرياضيات والأرقام', en: 'Math & Numbers' },
  logic: { ar: 'المنطق والمهارات المعرفية', en: 'Logic & Cognitive Skills' },
  creative: { ar: 'الإبداع والفنون والقصص', en: 'Creative Arts & Stories' },
  general: { ar: 'المعرفة العامة والعلوم', en: 'General Knowledge & Science' },
  'quran-values': { ar: 'القرآن والقيم الإسلامية', en: 'Quran & Islamic Values' },
};
