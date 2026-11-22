import { Level2ActivitySpec, Level2LessonDefinition, Level2VocabItem } from '../../types/nonoland';

interface LogicL2Spec {
  id: string;
  num: number;
  titleAr: string;
  titleEn: string;
  objAr: string;
  objEn: string;
  introAr: string;
  introEn: string;
  teachAr: string;
  teachEn: string;
  visual: string;
  audioText: string;
  examples: Array<{ titleAr: string; titleEn: string; visual: string; detailAr: string; detailEn: string }>;
  vocab: Array<[string, string, string, string]>;
  guidedPromptAr: string;
  guidedPromptEn: string;
  guidedOptions: Array<[string, string, string, string]>;
  guidedCorrect: string;
  pairs: Array<[string, string]>;
  sortBuckets: Array<{ id: string; ar: string; en: string; emoji: string }>;
  sortItems: Array<{ id: string; ar: string; en: string; visual: string; bucketId: string }>;
  sequence: string[];
  fillPromptAr: string;
  fillPromptEn: string;
  fillOptions: Array<[string, string, string, string]>;
  fillCorrect: string;
}

const LOGIC_L2_SPECS: LogicL2Spec[] = [
  {
    id: 'L2-LG01',
    num: 1,
    titleAr: 'اكتشف العنصر المختلف (Odd One Out)',
    titleEn: 'Spot the Odd One Out',
    objAr: 'يكتشف الطفل العنصر غير المنتمي للمجموعة ويعلل السبب بوضوح.',
    objEn: 'Identify which item does not belong in a group and explain the shared rule of the others.',
    introAr: 'أهلاً أيها المحقق الصغير! أنا لبيب، مهمتنا اليوم إيجاد العنصر الدخيل بين ٤ عناصر!',
    introEn: 'Hello detective! Labib here—today we look closely at a group and find the ONE item that does not belong!',
    teachAr: 'كي نكتشف المختلف: نسأل ما الذي يجمع ٣ عناصر معاً؟ قد تكون كلها فواكه، أو كلها حيوانات تسبح، أو كلها أدوات مدرسية، والرابع مختلف عنها!',
    teachEn: 'To spot the odd one out, find the rule linking 3 items (e.g., 3 fruits + 1 shoe, or 3 flying birds + 1 fish). The item breaking the rule is the odd one out!',
    visual: '🍎 🍌 🍇 👟 ❓',
    audioText: 'Apple, banana, grape, shoe. Which one does not belong?',
    examples: [
      { titleAr: 'مختلف بالنوع', titleEn: 'Different Category', visual: '🐶 🐱 🐰 🚌', detailAr: 'ثلاثة حيوانات، أما الحافلة فهي وسيلة نقل', detailEn: '3 animals vs. 1 bus (vehicle)' },
      { titleAr: 'مختلف بالمكان', titleEn: 'Different Habitat', visual: '🐟 🐙 🐳 🦁', detailAr: 'ثلاثة تعيش في البحر، والأسد يعيش على اليابسة', detailEn: '3 ocean creatures vs. 1 land lion' },
      { titleAr: 'مختلف بالحجم/الشكل', titleEn: 'Different Shape', visual: '⭕ ⭕ ⬛ ⭕', detailAr: 'ثلاث دوائر ومربع واحد ذو زوايا', detailEn: '3 curved circles vs. 1 square with corners' },
    ],
    vocab: [
      ['المختلف', 'Odd One Out', '🔍', 'لا يتبع القاعدة'],
      ['القاعدة المشتركة', 'Shared Rule', '🤝', 'ما يجمع البقية'],
      ['مقارنة', 'Compare', '⚖️', 'أوجه الشبه والاختلاف'],
      ['استنتاج', 'Reasoning', '💡', 'تفسير السبب'],
    ],
    guidedPromptAr: 'أي عنصر هو المختلف في المجموعة: (قلم ✏️، مسطرة 📏، ممحاة 🧽، جزرة 🥕)؟',
    guidedPromptEn: 'Which item is the Odd One Out: (Pencil ✏️, Ruler 📏, Eraser 🧽, Carrot 🥕)?',
    guidedOptions: [
      ['a', 'الجزرة (لأنها طعام وليست أداة مدرسية)', 'Carrot 🥕 (food, not school supply)', '🥕'],
      ['b', 'القلم (لأنه يكتب)', 'Pencil ✏️', '✏️'],
      ['c', 'المسطرة (لأنها تقيس)', 'Ruler 📏', '📏'],
    ],
    guidedCorrect: 'a',
    pairs: [
      ['🍎 🍌 🍐 + 🚗', 'السيارة مختلفة (ليست فاكهة)'],
      ['🐦 🦅 🐝 + 🐢', 'السلحفاة مختلفة (لا تطير)'],
      ['2️⃣ 4️⃣ 6️⃣ + 🍎', 'التفاحة مختلفة (ليست رقماً)'],
    ],
    sortBuckets: [
      { id: 'air', ar: 'يطير في الجو (Flies)', en: 'Flies in Sky', emoji: '🕊️' },
      { id: 'water', ar: 'يسبح في الماء (Swims)', en: 'Swims in Water', emoji: '🌊' },
    ],
    sortItems: [
      { id: 'si1', ar: 'عصفور (Bird)', en: 'Bird', visual: '🐦 عصفور', bucketId: 'air' },
      { id: 'si2', ar: 'سمكة (Fish)', en: 'Fish', visual: '🐟 سمكة', bucketId: 'water' },
      { id: 'si3', ar: 'فراشة (Butterfly)', en: 'Butterfly', visual: '🦋 فراشة', bucketId: 'air' },
      { id: 'si4', ar: 'دولفين (Dolphin)', en: 'Dolphin', visual: '🐬 دولفين', bucketId: 'water' },
    ],
    sequence: ['👀 أنظر لجميع العناصر', '🔗 أجد الرابط بين الثلاثة', '🔍 أحدد العنصر المختلف', '💬 أشرح السبب'],
    fillPromptAr: 'المختلف في: (شمس ☀️، قمر 🌙، نجمة ⭐، كرسي 🪑) هو: ___',
    fillPromptEn: 'The odd one out in (Sun ☀️, Moon 🌙, Star ⭐, Chair 🪑) is: ___',
    fillOptions: [
      ['a', 'الكرسي (أثاث منزلي وليس في السماء)', 'Chair 🪑 (furniture, not in sky)', '🪑'],
      ['b', 'الشمس ☀️', 'Sun ☀️', '☀️'],
      ['c', 'القمر 🌙', 'Moon 🌙', '🌙'],
    ],
    fillCorrect: 'a',
  },
  {
    id: 'L2-LG02',
    num: 2,
    titleAr: 'إكمال التسلسل والأنماط المنطقية المتنامية',
    titleEn: 'Complete Sequences & Growing Logic Patterns',
    objAr: 'يتوقع الطفل الخطوة التالية في تسلسل متنامٍ أو منطقي بالصور والأحداث.',
    objEn: 'Predict the next step in logical progression and growing patterns.',
    introAr: 'أهلاً بالمكتشف! بعض الأنماط تكبر خطوة بعد خطوة مثل الشجرة أو برج المكعبات!',
    introEn: 'Hi detective! Some sequences grow step by step like a sprouting plant or stacked blocks!',
    teachAr: 'في التسلسل المتنامي يزيد العنصر بانتظام (+١ نجمة كل مرة) أو تتسلسل مراحل الزمن (بذرة -> برعم -> شجرة -> ثمرة) من البداية إلى النتيجة.',
    teachEn: 'Growing sequences add items steadily (+1 star each step) or follow a real timeline from start to finish (Seed -> Sprout -> Tree -> Fruit).',
    visual: '🌱 ➡️ 🌿 ➡️ 🌳 ➡️ 🍎',
    audioText: 'Seed, sprout, tree, fruit. One star, two stars, three stars, four stars.',
    examples: [
      { titleAr: 'تسلسل زمني', titleEn: 'Time Progression', visual: '🥚 ➡️ 🐣 ➡️ 🐤 ➡️ 🐔', detailAr: 'مراحل نمو الكتكوت بالترتيب الطبيعي', detailEn: 'Natural growth sequence step by step' },
      { titleAr: 'نمط متنامٍ (+1)', titleEn: 'Growing (+1) Pattern', visual: '⭐ · ⭐⭐ · ⭐⭐⭐ · ⭐⭐⭐⭐', detailAr: 'نضيف نجمة واحدة في كل محطة', detailEn: 'Add 1 star at every step' },
      { titleAr: 'تسلسل روتين اليوم', titleEn: 'Daily Routine Sequence', visual: '🌅 استيقاظ ➡️ 🪥 غسل ➡️ 🥣 فطور ➡️ 🎒 مدرسة', detailAr: 'خطوات الصباح بالترتيب المنطقي', detailEn: 'Morning routine in logical order' },
    ],
    vocab: [
      ['تسلسل', 'Sequence', '➡️', 'أحداث متتالية'],
      ['قبل / بعد', 'Before / After', '⏳', 'ترتيب الزمن'],
      ['يزداد', 'Growing', '📈', 'يكبر بانتظام'],
      ['النتيجة النهائية', 'Final Step', '🏁', 'آخر مرحلة'],
    ],
    guidedPromptAr: 'انظر للتسلسل: بذرة 🌱، برعم صغير 🌿، شجرة صغيرة 🪴، ما المرحلة التالية؟',
    guidedPromptEn: 'Look at the growth sequence: Seed 🌱 -> Sprout 🌿 -> Sapling 🪴 -> What comes next?',
    guidedOptions: [
      ['a', 'شجرة كبيرة مثمرة 🌳🍎', 'Big fruit tree 🌳🍎', '🌳'],
      ['b', 'بيضة دجاج 🥚', 'Egg 🥚', '🥚'],
      ['c', 'ثلج متساقط ❄️', 'Snowflake ❄️', '❄️'],
    ],
    guidedCorrect: 'a',
    pairs: [
      ['1️⃣ قطرة + غيمة', '2️⃣ مطر 🌧️'],
      ['1️⃣ دقيق + عجن', '2️⃣ خبز ساخن 🍞'],
      ['1️⃣ بذرة في التربة + ماء', '2️⃣ نبتة خضراء 🌱'],
    ],
    sortBuckets: [
      { id: 'first', ar: 'البداية (Start / First)', en: 'First Step', emoji: '1️⃣' },
      { id: 'end', ar: 'النتيجة (End / Result)', en: 'Final Result', emoji: '🏁' },
    ],
    sortItems: [
      { id: 'si1', ar: 'بيضة سليمة (Whole Egg)', en: 'Whole Egg', visual: '🥚 بيضة', bucketId: 'first' },
      { id: 'si2', ar: 'نبتة مثمرة (Fruited Tree)', en: 'Fruited Tree', visual: '🌳🍎 شجرة', bucketId: 'end' },
      { id: 'si3', ar: 'بذرة صغيرة (Tiny Seed)', en: 'Tiny Seed', visual: '🌱 بذرة', bucketId: 'first' },
      { id: 'si4', ar: 'كتكوت يفقس (Hatched Chick)', en: 'Hatched Chick', visual: '🐣 كتكوت', bucketId: 'end' },
    ],
    sequence: ['⭐ (1)', '⭐⭐ (2)', '⭐⭐⭐ (3)', '⭐⭐⭐⭐ (4)'],
    fillPromptAr: 'أكمل التسلسل المتناقص للرسم: 🌕 قمر كامل ➡️ 🌓 نصف قمر ➡️ 🌙 هلال ➡️ ___',
    fillPromptEn: 'Complete the shrinking sequence: 🌕 Full -> 🌓 Half -> 🌙 Crescent -> ___',
    fillOptions: [
      ['a', '🌑 محاق (مظلم بالكامل)', '🌑 New Moon (completely dark)', '🌑'],
      ['b', '☀️ شمس ساطعة', '☀️ Bright Sun', '☀️'],
      ['c', '🌕 قمر أكبر', '🌕 Giant Moon', '🌕'],
    ],
    fillCorrect: 'a',
  },
  {
    id: 'L2-LG03',
    num: 3,
    titleAr: 'التطابق المنطقي والسبب والنتيجة',
    titleEn: 'Logical Matching & Cause and Effect',
    objAr: 'يربط الطفل بين السبب ونتيجته المنطقية وبين الشيء ووظيفته أو مكمله.',
    objEn: 'Connect logical cause-and-effect pairs and match objects with their natural partner.',
    introAr: 'لماذا نفتح المظلة عندما تمطر السماء؟ لأن المطر سبب، والمظلة تحمينا كنتيجة ذكية!',
    introEn: 'Why do we open an umbrella when it rains? Rain is the cause, and staying dry with an umbrella is the effect!',
    teachAr: 'كل فعل له نتيجة منطقية (cause & effect): إذا نزل المطر نلبس المعطف، وإذا سقينا الزهرة تنمو، وإذا أكلنا طعاماً صحياً نصبح أقوياء.',
    teachEn: 'Every action has a logical effect: Watering plants -> plants grow; Rain falling -> use umbrella; Turning off tap -> save water!',
    visual: '🌧️ مطر ➡️ ☂️ مظلة | 🌱 سقي ➡️ 🌸 زهرة',
    audioText: 'Cause and effect: Rain causes puddles. Watering helps flowers grow.',
    examples: [
      { titleAr: 'المطر والبلل', titleEn: 'Rain & Umbrella', visual: '🌧️ ➡️ ☂️', detailAr: 'السبب: سقوط المطر، النتيجة: نستخدم المظلة', detailEn: 'Cause: Rain falls -> Effect: Open umbrella' },
      { titleAr: 'الشمس والثلج', titleEn: 'Sun & Ice', visual: '☀️ + 🧊 ➡️ 💧', detailAr: 'السبب: حرارة الشمس، النتيجة: يذوب الجليد لماء', detailEn: 'Cause: Warm sun -> Effect: Ice melts into water' },
      { titleAr: 'الأدوات المتلازمة', titleEn: 'Natural Pairs', visual: '🔒 قفل ↔️ 🔑 مفتاح', detailAr: 'المفتاح يفتح القفل، والفرشاة تنظف الأسنان', detailEn: 'Key opens Lock; Toothbrush cleans Teeth' },
    ],
    vocab: [
      ['السبب', 'Cause', '⚡', 'لماذا حدث هذا؟'],
      ['النتيجة', 'Effect / Result', '🎯', 'ماذا حصل بعده؟'],
      ['مكمل منطقي', 'Logical Partner', '🧩', 'يعملان معاً'],
      ['تنبؤ ذكي', 'Smart Prediction', '🔮', 'توقع ما سيحدث'],
    ],
    guidedPromptAr: 'تركنا مكعب ثلج 🧊 تحت شمس الصيف الحارة ☀️. ما النتيجة المتوقعة؟',
    guidedPromptEn: 'We leave an ice cube 🧊 under the hot summer sun ☀️. What happens next?',
    guidedOptions: [
      ['a', 'يذوب ويتحول إلى ماء 💧', 'It melts into liquid water 💧', '💧'],
      ['b', 'يكبر ويصبح جبلاً 🏔️', 'It grows into a mountain 🏔️', '🏔️'],
      ['c', 'يطير في السماء ✈️', 'It flies into the sky ✈️', '✈️'],
    ],
    guidedCorrect: 'a',
    pairs: [
      ['🔒 القفل (Lock)', '🔑 المفتاح (Key)'],
      ['🦷 الأسنان (Teeth)', '🪥 فرشاة الأسنان (Toothbrush)'],
      ['🌧️ المطر (Rain)', '☂️ المظلة (Umbrella)'],
    ],
    sortBuckets: [
      { id: 'cause', ar: 'السبب / الفعل (Cause)', en: 'Cause / Action', emoji: '⚡' },
      { id: 'effect', ar: 'النتيجة (Effect)', en: 'Effect / Result', emoji: '🎯' },
    ],
    sortItems: [
      { id: 'si1', ar: 'سقوط المطر الغزير (Heavy Rain)', en: 'Heavy Rain', visual: '🌧️ مطر', bucketId: 'cause' },
      { id: 'si2', ar: 'تبلل الشارع (Wet Street)', en: 'Wet Street', visual: '💧 شارع مبلل', bucketId: 'effect' },
      { id: 'si3', ar: 'غسل اليدين بالصابون (Wash Hands)', en: 'Wash Hands', visual: '🧼 غسل', bucketId: 'cause' },
      { id: 'si4', ar: 'أيدٍ نظيفة وصحية (Clean Hands)', en: 'Clean Hands', visual: '✨ نظافة', bucketId: 'effect' },
    ],
    sequence: ['☁️ تتجمع الغيوم', '🌧️ يسقط المطر', '🌱 تشرب التربة الماء', '🌷 تتفتح الأزهار'],
    fillPromptAr: 'الظلام حلّ في الغرفة، إذا ضغطنا زر المصباح: ___',
    fillPromptEn: 'The room is dark. When we switch ON the lamp: ___',
    fillOptions: [
      ['a', 'يضيء المصباح الغرفة 💡', 'The lamp lights up the room 💡', '💡'],
      ['b', 'تتساقط أوراق الشجر 🍂', 'Leaves fall down 🍂', '🍂'],
      ['c', 'يغلي البحر 🌊', 'The ocean boils 🌊', '🌊'],
    ],
    fillCorrect: 'a',
  },
  {
    id: 'L2-LG04',
    num: 4,
    titleAr: 'التصنيف وأوجه الشبه والاختلاف',
    titleEn: 'Categorization, Similarities & Differences',
    objAr: 'يقارن الطفل بين شيئين لاستخراج أوجه الشبه والاختلاف وتصنيفهما في فئات دقيقة.',
    objEn: 'Compare two objects for similarities and differences and sort items into clear categories.',
    introAr: 'كيف تتشابه الطائرة والعصفور، وكيف يختلفان؟ هيا نكتشف مهارة المقارنة!',
    introEn: 'How are an airplane and a bird similar, and how are they different? Let us compare!',
    teachAr: 'التشابه يعني ما يشتركان فيه (الطائرة والعصفور كلاهما يطير في الجو!)، والاختلاف هو ما يميز كل واحد (العصفور كائن حي له ريش، والطائرة آلة من معدن).',
    teachEn: 'Similarities are shared traits (both Bird & Plane fly in the sky!). Differences set them apart (Bird is alive with feathers; Plane is a metal machine).',
    visual: '🐦 ↔️ ✈️ (كلاهما يطير، لكن أحدهما حي والآخر آلة)',
    audioText: 'Compare similarities and differences. Categorize living and non-living.',
    examples: [
      { titleAr: 'وجه الشبه', titleEn: 'Similarity', visual: '🚗 سيارة & 🚌 حافلة', detailAr: 'كلاهما مركبة تسير على عجلات لنقل الناس', detailEn: 'Both are wheeled vehicles carrying people' },
      { titleAr: 'وجه الاختلاف', titleEn: 'Difference', visual: '🌳 شجرة vs 🪑 كرسي خشب', detailAr: 'الشجرة تنمو وتشرب، أما الكرسي فجماد لا ينمو', detailEn: 'Tree is living and grows; wooden chair is non-living' },
      { titleAr: 'التصنيف بالفئة', titleEn: 'Category Sorting', visual: '👕 ملابس | 🧸 ألعاب', detailAr: 'نضع كل نوع في صندوقه المخصص', detailEn: 'Group objects by what they are used for' },
    ],
    vocab: [
      ['وجه الشبه', 'Similarity', '🟰', 'صفة مشتركة'],
      ['وجه الاختلاف', 'Difference', '↔️', 'صفة مختلفة'],
      ['كائن حي', 'Living Thing', '🌱', 'ينمو ويتغذى'],
      ['جماد', 'Non-Living', '🪨', 'لا ينمو'],
    ],
    guidedPromptAr: 'ما وجه الشبه بين التفاحة 🍎 والطماطم 🍅؟',
    guidedPromptEn: 'What is a similarity between an Apple 🍎 and a Tomato 🍅?',
    guidedOptions: [
      ['a', 'كلاهما نبات نأكله وشكله مستدير', 'Both are round edible plant foods', '🥗'],
      ['b', 'كلاهما يسير على عجلات', 'Both roll on road wheels', '🚗'],
      ['c', 'كلاهما يصنعان من الخشب', 'Both are made of wood', '🪵'],
    ],
    guidedCorrect: 'a',
    pairs: [
      ['🐈 قطة و 🐕 كلب', 'الشبه: كلاهما حيوان أليف بـ ٤ أرجل'],
      ['🐠 سمكة و ⛵ قارب', 'الشبه: كلاهما يتحرك في الماء'],
      ['☀️ شمس و 💡 مصباح', 'الشبه: كلاهما يعطينا الضوء'],
    ],
    sortBuckets: [
      { id: 'living', ar: 'كائن حي (ينمو)', en: 'Living (Grows)', emoji: '🌿' },
      { id: 'nonliving', ar: 'جماد (لا ينمو)', en: 'Non-Living', emoji: '🧱' },
    ],
    sortItems: [
      { id: 'si1', ar: 'فراشة تطير (Butterfly)', en: 'Butterfly', visual: '🦋 فراشة', bucketId: 'living' },
      { id: 'si2', ar: 'ملعقة معدنية (Spoon)', en: 'Spoon', visual: '🥄 ملعقة', bucketId: 'nonliving' },
      { id: 'si3', ar: 'زهرة تنمو (Flower)', en: 'Flower', visual: '🌻 زهرة', bucketId: 'living' },
      { id: 'si4', ar: 'كرة جلدية (Ball)', en: 'Ball', visual: '⚽ كرة', bucketId: 'nonliving' },
    ],
    sequence: ['👀 ألاحظ العنصرين', '🤝 أكتب المشترك بينهما', '↔️ أكتب المختلف بينهما', '🏷️ أضعهما في فئات'],
    fillPromptAr: 'الاختلاف الأساسي بين الحافلة 🚌 والدراجة 🚲 هو: ___',
    fillPromptEn: 'A key difference between a Bus 🚌 and a Bicycle 🚲 is: ___',
    fillOptions: [
      ['a', 'الحافلة كبيرة وتحمل ركاباً كثيرين، والدراجة لشخص أو اثنين', 'Bus is large for many riders; Bicycle fits 1-2 riders', '🚌'],
      ['b', 'الحافلة تطير في الفضاء', 'Bus flies in space', '🚀'],
      ['c', 'الدراجة تسبح في المحيط', 'Bicycle swims in ocean', '🌊'],
    ],
    fillCorrect: 'a',
  },
  {
    id: 'L2-LG05',
    num: 5,
    titleAr: 'المتاهات والاتجاهات والتفكير المكاني',
    titleEn: 'Mazes, Paths & Spatial Reasoning',
    objAr: 'يستخدم الطفل الاتجاهات المكانية (أعلى، أسفل، يمين، يسار، داخل، خارج، بجانب) لتتبع المسار الصحيح.',
    objEn: 'Follow spatial directions (up, down, right, left, inside, outside, next to) to solve path puzzles.',
    introAr: 'أهلاً في متاهة الكنز! لنصل إلى الجائزة دون الاصطدام بالحواجز نستخدم خريطة الاتجاهات!',
    introEn: 'Welcome to the treasure maze! Let us use direction arrows to trace a clear path!',
    teachAr: 'الاتجاهات الأربعة الأساسية تساعدنا في الخرائط والألعاب: للأعلى ⬆️، للأسفل ⬇️، لليمين ➡️، لليسار ⬅️، كما نعرف موقع الأشياء: داخل 📦، خارج، فوق، وتحت.',
    teachEn: 'Four core directions guide every maze: UP ⬆️, DOWN ⬇️, RIGHT ➡️, LEFT ⬅️. Spatial words also tell us where things sit: Inside, Outside, On Top, Under, Next To.',
    visual: '🐭 ➡️ ⬆️ ➡️ 🧀 (تتبع المسار بدون حواجز!)',
    audioText: 'Up, down, right, left, inside, outside, next to.',
    examples: [
      { titleAr: 'قراءة الخريطة', titleEn: 'Reading a Path', visual: '🏁 بداية ➔ ⬆️ فوق ➔ ➡️ يمين ➔ 🏆 هدف', detailAr: 'نمشي خطوة خطوة حسب الأسهم ولا نعبر الجدران', detailEn: 'Follow arrows step by step without crossing walls' },
      { titleAr: 'فوق وتحت', titleEn: 'Above & Below', visual: '🐦 فوق الشجرة | 🐇 تحت الشجرة', detailAr: 'تحديد موقع الكائن بالنسبة لمحيطه', detailEn: 'Locate objects relative to a landmark' },
      { titleAr: 'داخل وخارج', titleEn: 'Inside & Outside', visual: '🍎 داخل السلة | 🍌 بجانب السلة', detailAr: 'التمييز الدقيق بين داخل الإطار وخارجه', detailEn: 'Tell inside a container vs. beside it' },
    ],
    vocab: [
      ['أعلى / فوق', 'Up / Above', '⬆️', 'اتجاه الصعود'],
      ['أسفل / تحت', 'Down / Below', '⬇️', 'اتجاه النزول'],
      ['يمين / يسار', 'Right / Left', '➡️⬅️', 'الاتجاه الجانبي'],
      ['داخل / خارج', 'Inside / Outside', '📦', 'الموقع المكاني'],
    ],
    guidedPromptAr: 'القطة 🐱 تقف في الأسفل وتريد صعود السلم لتصل إلى سقف البيت 🏠. أي سهم تختار؟',
    guidedPromptEn: 'Cat 🐱 wants to climb a ladder straight to the roof 🏠. Which arrow moves UP?',
    guidedOptions: [
      ['a', 'للأعلى (Up ⬆️)', 'Up ⬆️', '⬆️'],
      ['b', 'للأسفل (Down ⬇️)', 'Down ⬇️', '⬇️'],
      ['c', 'لليسار (Left ⬅️)', 'Left ⬅️', '⬅️'],
    ],
    guidedCorrect: 'a',
    pairs: [
      ['⬆️ سهم للأعلى', 'صعود السلم أو طيران البالون'],
      ['⬇️ سهم للأسفل', 'نزول الدرج أو هبوط المظلة'],
      ['📦 داخل الصندوق', 'الألعاب المرتبة جوه'],
    ],
    sortBuckets: [
      { id: 'vertical', ar: 'حركة عمودية (أعلى / أسفل)', en: 'Vertical (Up / Down)', emoji: '↕️' },
      { id: 'horizontal', ar: 'حركة أفقية (يمين / يسار)', en: 'Horizontal (Right / Left)', emoji: '↔️' },
    ],
    sortItems: [
      { id: 'si1', ar: 'صعود المصعد للأعلى (Up ⬆️)', en: 'Elevator Up', visual: '⬆️ للأعلى', bucketId: 'vertical' },
      { id: 'si2', ar: 'الالتفاف يميناً (Right ➡️)', en: 'Turn Right', visual: '➡️ لليمين', bucketId: 'horizontal' },
      { id: 'si3', ar: 'النزول للأسفل (Down ⬇️)', en: 'Go Down', visual: '⬇️ للأسفل', bucketId: 'vertical' },
      { id: 'si4', ar: 'الالتفاف يساراً (Left ⬅️)', en: 'Turn Left', visual: '⬅️ لليسار', bucketId: 'horizontal' },
    ],
    sequence: ['🚩 نقطة البداية', '➡️ خطوتان يميناً', '⬆️ خطوة للأعلى', '🏆 الوصول للكنز'],
    fillPromptAr: 'إذا كان الحذاء تحت السرير، والوسادة فوق السرير، فالوسادة في مكان: ___',
    fillPromptEn: 'If shoes are UNDER the bed and the pillow is ___ the bed:',
    fillOptions: [
      ['a', 'فوق السرير (On top / Above)', 'On top / Above the bed', '🛏️⬆️'],
      ['b', 'تحت الأرض', 'Underground', '🕳️'],
      ['c', 'في السماء البعيدة', 'In outer space', '🌌'],
    ],
    fillCorrect: 'a',
  },
  {
    id: 'L2-LG06',
    num: 6,
    titleAr: 'الذاكرة وحل المشكلات خطوة بخطوة',
    titleEn: 'Memory & Multi-Step Problem Solving',
    objAr: 'يستخدم الطفل ذاكرته البصرية ويطبق ٣ خطوات مترابطة لحل مشكلة بسيطة.',
    objEn: 'Apply visual memory recall and 3-step reasoning to solve everyday puzzles.',
    introAr: 'التحدي الكبير يا بطل! اليوم ندرّب عقلنا على التذكر والتخطيط بذكاء لحل الألغاز!',
    introEn: 'Grand challenge, hero! Today we train our brain to remember clues and plan smart solutions!',
    teachAr: 'لحل أي مشكلة: ١) نفهم المطلوب بهدوء، ٢) نجمع المعطيات والرموز، ٣) نجرب الحل خطوة بخطوة ونتحقق منه.',
    teachEn: 'Smart problem solving follows 3 steps: (1) Understand the goal, (2) Gather clues from memory/picture, (3) Test your solution and double-check!',
    visual: '🧠 تذكر الرموز: 🌟 🎈 🎁 ➔ أي رمز اختفى؟',
    audioText: 'Understand the goal, check the clues, test and verify.',
    examples: [
      { titleAr: 'تذكر المفقود', titleEn: 'Memory Recall', visual: 'صف كامل: 🍎 🍌 🍇 | بعد الاختفاء: 🍎 ❓ 🍇', detailAr: 'نسترجع من الذاكرة أن الموزة 🍌 كانت في الوسط!', detailEn: 'Recall from memory that Banana 🍌 was in the middle!' },
      { titleAr: 'مشكلة وتخطيط', titleEn: 'Plan & Solve', visual: 'القطة جائعة 🐱 -> أين الطعام؟ -> تحضير الوعاء', detailAr: 'نرتب الخطوات بالمنطق للوصول لحل سليم', detailEn: 'Arrange logical steps to fix a real problem' },
      { titleAr: 'تحدي الميزان', titleEn: 'Balance Logic', visual: 'تفاحتان = وزن كوب واحد -> ٤ تفاحات = كوبان!', detailAr: 'الربط بين المعطيات للوصول للإجابة الصحيحة', detailEn: 'Use clues to calculate the answer logically' },
    ],
    vocab: [
      ['تخطيط', 'Planning', '📝', 'ترتيب الخطوات'],
      ['الذاكرة البصرية', 'Visual Memory', '🧠', 'تذكر ما رأينا'],
      ['مشكلة وحل', 'Problem & Solution', '🧩', 'تحويل الصعب لسهل'],
      ['التحقق', 'Verify', '✅', 'التأكد من صحة الحل'],
    ],
    guidedPromptAr: 'في سلة الألعاب كان هناك: كرة ⚽، دمية 🧸، ومكعب 🧊. أخذت سارة المكعب، وأخذ عمر الكرة. ماذا بقي في السلة؟',
    guidedPromptEn: 'A basket held a Ball ⚽, Teddy 🧸, and Cube 🧊. Sara took the Cube, Omar took the Ball. What is left?',
    guidedOptions: [
      ['a', 'الدمية فقط (Teddy 🧸)', 'Only the Teddy 🧸', '🧸'],
      ['b', 'الكرة (Ball ⚽)', 'The Ball ⚽', '⚽'],
      ['c', 'لم يبق شيء', 'Nothing left', '🕳️'],
    ],
    guidedCorrect: 'a',
    pairs: [
      ['🥤 كوب مسكوب على الطاولة', '🧻 نجففه بمنديل نظيف'],
      ['🎒 نسيان الدفتر في البيت', '📋 نجهز الحقيبة في المساء قبل النوم'],
      ['🌧️ السماء تمطر قبل الخروج', '🧥 نلبس المعطف ونأخذ المظلة'],
    ],
    sortBuckets: [
      { id: 'problem', ar: 'مشكلة تحتاج حلاً (Problem)', en: 'Problem', emoji: '❓' },
      { id: 'solution', ar: 'حل ذكي (Smart Solution)', en: 'Solution', emoji: '💡' },
    ],
    sortItems: [
      { id: 'si1', ar: 'انسكاب العصير على الأرض', en: 'Spilled Juice on Floor', visual: '🧃💦 انسكاب', bucketId: 'problem' },
      { id: 'si2', ar: 'مسح الأرض بمنشفة نظيفة', en: 'Wipe with Clean Towel', visual: '🧽 مسح', bucketId: 'solution' },
      { id: 'si3', ar: 'تبعثر المكعبات في الممر', en: 'Blocks Scattered on Path', visual: '🧱 فوضى', bucketId: 'problem' },
      { id: 'si4', ar: 'إعادتها إلى صندوق الألعاب', en: 'Put Back in Toy Box', visual: '📦 ترتيب', bucketId: 'solution' },
    ],
    sequence: ['1️⃣ أفهم المشكلة', '2️⃣ أجمع الأدلة والذاكرة', '3️⃣ أختار الحل الأفضل', '4️⃣ أتحقق أن المشكلة انتهت'],
    fillPromptAr: 'رأيت ٣ بطاقات: 🔑 🚗 🏠 ثم أغمضت عينيك، الآن تظهر: 🔑 ❓ 🏠. البطاقة المختفية هي: ___',
    fillPromptEn: 'You saw: 🔑 🚗 🏠. After hiding the middle card: 🔑 ❓ 🏠. Which card is hidden?',
    fillOptions: [
      ['a', 'السيارة (Car 🚗)', 'Car 🚗', '🚗'],
      ['b', 'القطار (Train 🚂)', 'Train 🚂', '🚂'],
      ['c', 'البيت (House 🏠)', 'House 🏠', '🏠'],
    ],
    fillCorrect: 'a',
  },
];

function buildLogicActivities(s: LogicL2Spec): Level2ActivitySpec[] {
  return [
    {
      id: `${s.id}-a1`,
      type: 'guided-practice',
      title: { ar: '١. لغز التفكير الأول', en: '1. First Thinking Puzzle' },
      instruction: { ar: s.guidedPromptAr, en: s.guidedPromptEn },
      options: s.guidedOptions.map(([id, ar, en, visual]) => ({ id, label: { ar, en }, visual })),
      correctOptionId: s.guidedCorrect,
      feedbackCorrect: { ar: 'تفكير منطقي رائع!', en: 'Brilliant logical thinking!' },
      feedbackIncorrect: { ar: 'اقرأ المعطيات بهدوء وجرب ثانية.', en: 'Read the clues calmly and try again.' },
    },
    {
      id: `${s.id}-a2`,
      type: 'matching-pairs',
      title: { ar: '٢. اربط المنطق بالنتيجة', en: '2. Connect Clues & Logic' },
      instruction: { ar: 'طابق كل موقف مع تفسيره المنطقي.', en: 'Match each situation with its logical explanation.' },
      pairs: s.pairs.map(([left, right], i) => ({ id: `${s.id}-p${i}`, left, right })),
      feedbackCorrect: { ar: 'استنتاج ممتاز!', en: 'Great deduction!' },
      feedbackIncorrect: { ar: 'تأكد من العلاقة وحاول مجدداً.', en: 'Check the link and try again.' },
    },
    {
      id: `${s.id}-a3`,
      type: 'sorting-classify',
      title: { ar: '٣. التصنيف الذكي', en: '3. Smart Categorization' },
      instruction: { ar: 'صنّف كل بطاقة في مكانها الصحيح.', en: 'Place each card into its matching category.' },
      sortBuckets: s.sortBuckets.map((b) => ({ id: b.id, label: { ar: b.ar, en: b.en }, emoji: b.emoji })),
      sortItems: s.sortItems.map((it) => ({ id: it.id, label: { ar: it.ar, en: it.en }, visual: it.visual, bucketId: it.bucketId })),
      feedbackCorrect: { ar: 'تصنيف سليم ١٠٠٪!', en: '100% accurate sorting!' },
      feedbackIncorrect: { ar: 'راجع القاعدة وجرب ثانية.', en: 'Review the rule and retry.' },
    },
    {
      id: `${s.id}-a4`,
      type: 'pattern-sequence',
      title: { ar: '٤. رتّب خطوات الحل', en: '4. Order the Logical Steps' },
      instruction: { ar: 'اضغط الخطوات بالترتيب الصحيح.', en: 'Tap the steps in logical order.' },
      sequenceItems: s.sequence,
      feedbackCorrect: { ar: 'عقل منظم وذكي!', en: 'Organized and smart!' },
      feedbackIncorrect: { ar: 'راجع البداية والنهاية.', en: 'Check start and end steps.' },
    },
    {
      id: `${s.id}-a5`,
      type: 'fill-blank',
      title: { ar: '٥. التحدي المنطقي المستقل', en: '5. Independent Logic Challenge' },
      instruction: { ar: s.fillPromptAr, en: s.fillPromptEn },
      options: s.fillOptions.map(([id, ar, en, visual]) => ({ id, label: { ar, en }, visual })),
      correctOptionId: s.fillCorrect,
      feedbackCorrect: { ar: 'محقق عبقري!', en: 'Genius detective!' },
      feedbackIncorrect: { ar: 'فكر مرة أخرى بهدوء.', en: 'Think again calmly.' },
    },
  ];
}

export const LEVEL2_LOGIC_LESSONS: Level2LessonDefinition[] = LOGIC_L2_SPECS.map((s, idx) => ({
  id: s.id,
  subject: 'logic',
  level: 2,
  ageRange: '1-4',
  recommendedAgeRange: '3-4',
  lessonNumber: s.num,
  title: { ar: s.titleAr, en: s.titleEn },
  learningObjective: { ar: s.objAr, en: s.objEn },
  prerequisiteIds: idx > 0 ? [LOGIC_L2_SPECS[idx - 1].id] : [],
  characterName: { ar: 'لبيب المحقق', en: 'Labib the Detective' },
  characterEmoji: '🦊',
  characterIntro: { ar: s.introAr, en: s.introEn },
  teachingContent: { ar: s.teachAr, en: s.teachEn },
  examples: s.examples.map((e) => ({
    title: { ar: e.titleAr, en: e.titleEn },
    visual: e.visual,
    detail: { ar: e.detailAr, en: e.detailEn },
  })),
  vocabulary: s.vocab.map(([wordAr, wordEn, emoji, phoneticHint], i): Level2VocabItem => ({
    id: `${s.id}-v${i + 1}`,
    wordAr,
    wordEn,
    emoji,
    phoneticHint,
    audioText: `${wordAr} - ${wordEn}`,
    audioLang: 'en',
  })),
  imageVisual: s.visual,
  audioCue: { text: s.audioText, lang: 'en' },
  activities: buildLogicActivities(s),
  completionCriteria: {
    ar: 'حلّ الألغاز المنطقية وحقق ٧٥٪ فأعلى في التقييم المستقل.',
    en: 'Solve the logic activities and score 75%+ on the independent check.',
  },
  estimatedMinutes: 8,
  difficulty: idx < 2 ? 'easy' : idx < 4 ? 'medium' : 'challenging',
  recommendedReviewDays: [1, 3, 7],
}));
