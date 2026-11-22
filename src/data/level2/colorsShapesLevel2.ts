import { Level2ActivitySpec, Level2LessonDefinition, Level2VocabItem } from '../../types/nonoland';

interface ColorsShapesL2Spec {
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
  guidedOptions: Array<{ id: string; ar: string; en: string; visual: string; colorHex?: string }>;
  guidedCorrect: string;
  pairs: Array<[string, string]>;
  sortBuckets: Array<{ id: string; ar: string; en: string; emoji: string }>;
  sortItems: Array<{ id: string; ar: string; en: string; visual: string; bucketId: string }>;
  sequence: string[];
  fillPromptAr: string;
  fillPromptEn: string;
  fillOptions: Array<{ id: string; ar: string; en: string; visual: string; colorHex?: string }>;
  fillCorrect: string;
}

const CS_L2_SPECS: ColorsShapesL2Spec[] = [
  {
    id: 'L2-CS01',
    num: 1,
    titleAr: 'الألوان الموسّعة ودرجات الفاتح والغامق',
    titleEn: 'Extended Colors & Light vs. Dark Shades',
    objAr: 'يميز الطفل الألوان الموسعة (بنفسجي، رمادي، فيروزي، ذهبي) ويفرق بين الفاتح والغامق بالنص والشكل.',
    objEn: 'Identify extended colors and distinguish light vs. dark shades with clear text labels and visual cues.',
    introAr: 'أهلاً أيها الفنان! أنا قوسو، هيا نكتشف ألواناً جديدة ودرجات فاتحة وغامقة مع الأسماء الواضحة!',
    introEn: 'Hello artist! Qawso here—let us discover extended colors and light vs. dark shades with clear labels!',
    teachAr: 'نضيف إلى الألوان الأساسية ألواناً مثل البنفسجي والفيروزي والرمادي، ولكل لون درجة فاتحة مثل أزرق فاتح (سماوي) ودرجة غامقة مثل أزرق غامق (كحلي).',
    teachEn: 'Beyond primary colors we explore Purple, Turquoise, and Gray. Each color also has a Light tint (Sky Blue) and Dark shade (Navy Blue), always labeled clearly.',
    visual: '🩵 أزرق فاتح · 💙 أزرق غامق · 💜 بنفسجي',
    audioText: 'Light blue, dark blue, purple, gray, turquoise',
    examples: [
      { titleAr: 'درجات الأزرق', titleEn: 'Blue Shades', visual: '🩵 فاتح / 💙 غامق', detailAr: 'سماوي فاتح مثل السماء نهاراً، وكحلي غامق مثل الليل', detailEn: 'Sky blue (light) like daytime sky vs. Navy (dark) like night' },
      { titleAr: 'درجات الأخضر', titleEn: 'Green Shades', visual: '🍏 أخضر فاتح / 🌲 أخضر غامق', detailAr: 'تفاحي فاتح وأخضر الصنوبر الغامق', detailEn: 'Mint/Apple light green vs. Pine dark green' },
      { titleAr: 'ألوان موسعة', titleEn: 'Extended Hues', visual: '💜 بنفسجي · 🩶 رمادي · 🤎 بني', detailAr: 'بنفسجي ورمادي وبني مع اسم كل لون', detailEn: 'Purple, Gray, and Brown clearly labeled' },
    ],
    vocab: [
      ['بنفسجي', 'Purple', '💜', 'لون البنفسج'],
      ['رمادي', 'Gray', '🩶', 'لون الغيمة الممطرة'],
      ['أزرق فاتح', 'Light Blue', '🩵', 'درجة فاتحة'],
      ['أخضر غامق', 'Dark Green', '🌲', 'درجة غامقة'],
    ],
    guidedPromptAr: 'أي بطاقة تمثل الدرجة الفاتحة (أزرق فاتح - سماوي)؟',
    guidedPromptEn: 'Which card shows the Light shade (Sky / Light Blue)?',
    guidedOptions: [
      { id: 'a', ar: 'أزرق فاتح (سماوي)', en: 'Light Blue (Sky)', visual: '🩵 سماوي', colorHex: '#7DD3FC' },
      { id: 'b', ar: 'أزرق غامق (كحلي)', en: 'Dark Blue (Navy)', visual: '💙 كحلي', colorHex: '#1E3A8A' },
      { id: 'c', ar: 'رمادي غامق', en: 'Dark Gray', visual: '🖤 رمادي داكن', colorHex: '#334155' },
    ],
    guidedCorrect: 'a',
    pairs: [
      ['🩵 فاتح (Light)', 'سماوي كالسماء ☀️'],
      ['💙 غامق (Dark)', 'كحلي كالليل 🌙'],
      ['💜 بنفسجي (Purple)', 'عنب وبنفسج 🍇'],
    ],
    sortBuckets: [
      { id: 'light', ar: 'درجات فاتحة (Light)', en: 'Light Shades', emoji: '☀️' },
      { id: 'dark', ar: 'درجات غامقة (Dark)', en: 'Dark Shades', emoji: '🌙' },
    ],
    sortItems: [
      { id: 'si1', ar: 'سماوي فاتح', en: 'Light Sky Blue', visual: '🩵 فاتح', bucketId: 'light' },
      { id: 'si2', ar: 'كحلي غامق', en: 'Dark Navy', visual: '💙 غامق', bucketId: 'dark' },
      { id: 'si3', ar: 'وردي فاتح', en: 'Light Pink', visual: '🩷 فاتح', bucketId: 'light' },
      { id: 'si4', ar: 'أخضر غامق', en: 'Dark Pine Green', visual: '🌲 غامق', bucketId: 'dark' },
    ],
    sequence: ['🤍 أبيض (White)', '🩵 أزرق فاتح (Light)', '💙 أزرق متوسط (Medium)', '🌌 كحلي غامق (Dark)'],
    fillPromptAr: 'اختر اللون الموسع الصحيح لثمار العنب والتوت: ___',
    fillPromptEn: 'Choose the extended color name matching grapes & eggplant: ___',
    fillOptions: [
      { id: 'a', ar: 'بنفسجي (Purple)', en: 'Purple', visual: '💜 بنفسجي', colorHex: '#9333EA' },
      { id: 'b', ar: 'برتقالي (Orange)', en: 'Orange', visual: '🧡 برتقالي', colorHex: '#F97316' },
      { id: 'c', ar: 'رمادي (Gray)', en: 'Gray', visual: '🩶 رمادي', colorHex: '#94A3B8' },
    ],
    fillCorrect: 'a',
  },
  {
    id: 'L2-CS02',
    num: 2,
    titleAr: 'مزج الألوان وتركيباتها السحرية',
    titleEn: 'Color Combinations & Mixing Magic',
    objAr: 'يتعلم الطفل نتائج مزج الألوان الأساسية لإنتاج الألوان الثانوية.',
    objEn: 'Predict and identify secondary colors created by mixing two primary colors.',
    introAr: 'أهلاً في مرسم الألوان! عندما نمزج لونين أساسيين يظهر لون جديد مدهش!',
    introEn: 'Welcome to the paint studio! When we mix two primary colors, a brand-new color appears!',
    teachAr: 'الألوان الأساسية الثلاثة هي: الأحمر والأصفر والأزرق. عند مزجها: أحمر + أصفر = برتقالي، أحمر + أزرق = بنفسجي، أصفر + أزرق = أخضر.',
    teachEn: 'Red, Yellow, and Blue are Primary Colors. Mixing them creates Secondary Colors: Red + Yellow = Orange, Red + Blue = Purple, Yellow + Blue = Green!',
    visual: '❤️ + 💛 = 🧡 · ❤️ + 💙 = 💜 · 💛 + 💙 = 💚',
    audioText: 'Red and yellow make orange. Yellow and blue make green. Red and blue make purple.',
    examples: [
      { titleAr: 'أحمر + أصفر', titleEn: 'Red + Yellow', visual: '🔴 + 🟡 = 🟠 برتقالي', detailAr: 'ينتج اللون البرتقالي (Orange)', detailEn: 'Creates Orange!' },
      { titleAr: 'أصفر + أزرق', titleEn: 'Yellow + Blue', visual: '🟡 + 🔵 = 🟢 أخضر', detailAr: 'ينتج اللون الأخضر (Green)', detailEn: 'Creates Green!' },
      { titleAr: 'أحمر + أزرق', titleEn: 'Red + Blue', visual: '🔴 + 🔵 = 🟣 بنفسجي', detailAr: 'ينتج اللون البنفسجي (Purple)', detailEn: 'Creates Purple!' },
    ],
    vocab: [
      ['أحمر + أصفر = برتقالي', 'Red + Yellow = Orange', '🟠', 'مزيج ١'],
      ['أصفر + أزرق = أخضر', 'Yellow + Blue = Green', '🟢', 'مزيج ٢'],
      ['أحمر + أزرق = بنفسجي', 'Red + Blue = Purple', '🟣', 'مزيج ٣'],
      ['لون أساسي', 'Primary Color', '🎨', 'أصل الألوان'],
    ],
    guidedPromptAr: 'ماذا ينتج إذا مزجنا اللون الأصفر (🟡) مع اللون الأزرق (🔵)؟',
    guidedPromptEn: 'What color do you get when you mix Yellow (🟡) + Blue (🔵)?',
    guidedOptions: [
      { id: 'a', ar: 'أخضر (Green)', en: 'Green', visual: '🟢 أخضر', colorHex: '#22C55E' },
      { id: 'b', ar: 'برتقالي (Orange)', en: 'Orange', visual: '🟠 برتقالي', colorHex: '#F97316' },
      { id: 'c', ar: 'بني (Brown)', en: 'Brown', visual: '🟤 بني', colorHex: '#92400E' },
    ],
    guidedCorrect: 'a',
    pairs: [
      ['🔴 أحمر + 🟡 أصفر', '🟠 برتقالي (Orange)'],
      ['🟡 أصفر + 🔵 أزرق', '🟢 أخضر (Green)'],
      ['🔴 أحمر + 🔵 أزرق', '🟣 بنفسجي (Purple)'],
    ],
    sortBuckets: [
      { id: 'primary', ar: 'ألوان أساسية (Primary)', en: 'Primary Colors', emoji: '🔴' },
      { id: 'secondary', ar: 'ألوان ثانوية/مختلطة (Secondary)', en: 'Mixed Secondary', emoji: '🟢' },
    ],
    sortItems: [
      { id: 'si1', ar: 'أحمر (Red)', en: 'Red', visual: '🔴 أحمر', bucketId: 'primary' },
      { id: 'si2', ar: 'برتقالي (Orange)', en: 'Orange', visual: '🟠 برتقالي', bucketId: 'secondary' },
      { id: 'si3', ar: 'أزرق (Blue)', en: 'Blue', visual: '🔵 أزرق', bucketId: 'primary' },
      { id: 'si4', ar: 'بنفسجي (Purple)', en: 'Purple', visual: '🟣 بنفسجي', bucketId: 'secondary' },
    ],
    sequence: ['🎨 لونان أساسيان (2 Primary)', '🖌️ خلط بالفرشاة (Mix)', '✨ تفاعل الألوان', '🟢 لون ثانوي جديد (Secondary)'],
    fillPromptAr: 'أحمر (🔴) + أزرق (🔵) = ___',
    fillPromptEn: 'Red (🔴) + Blue (🔵) = ___',
    fillOptions: [
      { id: 'a', ar: 'بنفسجي (Purple)', en: 'Purple', visual: '🟣 بنفسجي', colorHex: '#9333EA' },
      { id: 'b', ar: 'أخضر (Green)', en: 'Green', visual: '🟢 أخضر', colorHex: '#22C55E' },
      { id: 'c', ar: 'أصفر (Yellow)', en: 'Yellow', visual: '🟡 أصفر', colorHex: '#EAB308' },
    ],
    fillCorrect: 'a',
  },
  {
    id: 'L2-CS03',
    num: 3,
    titleAr: 'الأشكال الهندسية ثنائية الأبعاد بالتفصيل',
    titleEn: '2D Shapes in Detail: Sides & Corners',
    objAr: 'يميز الطفل الأشكال الهندسية المتقدمة (بيضاوي، معين، خماسي، سداسي، هلال، نجمة) بعدّ الأضلاع والزوايا.',
    objEn: 'Identify Circle, Square, Rectangle, Triangle, Oval, Star, Diamond, Crescent, Pentagon (5), and Hexagon (6) by sides and corners.',
    introAr: 'أهلاً بالمستكشف! كل شكل هندسي له أسرار: عدد الأضلاع المستقيمة وعدد الزوايا المدببة!',
    introEn: 'Hi explorer! Every 2D shape has clues: how many straight sides and corners it has!',
    teachAr: 'المثلث له ٣ أضلاع، المربع ٤ أضلاع متساوية، المستطيل ٤ أضلاع (ضلعان طويلان وضلعان قصيران)، الخماسي ٥ أضلاع، والسداسي ٦ أضلاع، بينما الدائرة والبيضاوي بلا أضلاع مستقيمة.',
    teachEn: 'Triangle has 3 sides; Square has 4 equal sides; Rectangle has 4 sides (2 long, 2 short); Pentagon has 5 sides; Hexagon has 6 sides; Circle and Oval have curved edges with 0 corners.',
    visual: '⭕ ▲ ⬛ ▭ 🥚 💠 ⬟ ⬡ ⭐ 🌙',
    audioText: 'Triangle 3 sides, Square 4 equal sides, Pentagon 5 sides, Hexagon 6 sides',
    examples: [
      { titleAr: 'الخماسي والسداسي', titleEn: 'Pentagon & Hexagon', visual: '⬟ (5) · ⬡ (6)', detailAr: 'الخماسي له ٥ أضلاع والسداسي ٦ أضلاع مثل خلية النحل', detailEn: 'Pentagon has 5 sides; Hexagon has 6 sides like a honeycomb' },
      { titleAr: 'المربع والمستطيل', titleEn: 'Square & Rectangle', visual: '⬛ (4 متساوية) · ▭ (2 طويل + 2 قصير)', detailAr: 'كلاهما بـ ٤ زوايا لكن أضلاع المربع كلها متساوية', detailEn: 'Both have 4 corners; a Square has 4 equal sides' },
      { titleAr: 'البيضاوي والهلال', titleEn: 'Oval & Crescent', visual: '🥚 بيضاوي · 🌙 هلال', detailAr: 'البيضاوي يشبه البيضة والهلال يشبه القمر في أول الشهر', detailEn: 'Oval looks like an egg; Crescent looks like the moon arc' },
    ],
    vocab: [
      ['مثلث (Triangle)', '3 Sides & 3 Corners', '🔺', '٣ أضلاع'],
      ['خماسي (Pentagon)', '5 Sides & 5 Corners', '⬟', '٥ أضلاع'],
      ['سداسي (Hexagon)', '6 Sides & 6 Corners', '⬡', '٦ أضلاع'],
      ['معين / ماسة (Diamond)', '4 Slanted Equal Sides', '💠', '٤ أضلاع مائلة'],
    ],
    guidedPromptAr: 'أي شكل له ٦ أضلاع و٦ زوايا مثل خلية النحل 🐝؟',
    guidedPromptEn: 'Which shape has 6 sides and 6 corners like a honeycomb 🐝?',
    guidedOptions: [
      { id: 'a', ar: 'السداسي (Hexagon ⬡)', en: 'Hexagon (6 sides)', visual: '⬡ سداسي (6)' },
      { id: 'b', ar: 'المثلث (Triangle 🔺)', en: 'Triangle (3 sides)', visual: '🔺 مثلث (3)' },
      { id: 'c', ar: 'الدائرة (Circle ⭕)', en: 'Circle (0 corners)', visual: '⭕ دائرة (0)' },
    ],
    guidedCorrect: 'a',
    pairs: [
      ['🔺 مثلث (Triangle)', '٣ أضلاع (3 sides)'],
      ['⬛ مربع (Square)', '٤ أضلاع متساوية (4 equal)'],
      ['⬡ سداسي (Hexagon)', '٦ أضلاع (6 sides)'],
    ],
    sortBuckets: [
      { id: 'straight', ar: 'بأضلاع مستقيمة وزوايا', en: 'Straight Sides & Corners', emoji: '📐' },
      { id: 'curved', ar: 'منحنية بدون زوايا', en: 'Curved / No Corners', emoji: '⭕' },
    ],
    sortItems: [
      { id: 'si1', ar: 'دائرة (Circle)', en: 'Circle', visual: '⭕ دائرة', bucketId: 'curved' },
      { id: 'si2', ar: 'مستطيل (Rectangle)', en: 'Rectangle', visual: '▭ مستطيل', bucketId: 'straight' },
      { id: 'si3', ar: 'بيضاوي (Oval)', en: 'Oval', visual: '🥚 بيضاوي', bucketId: 'curved' },
      { id: 'si4', ar: 'خماسي (Pentagon)', en: 'Pentagon', visual: '⬟ خماسي', bucketId: 'straight' },
    ],
    sequence: ['🔺 مثلث (3)', '⬛ مربع (4)', '⬟ خماسي (5)', '⬡ سداسي (6)'],
    fillPromptAr: 'شكل يشبه الباب والسبورة وله ضلعان طويلان وضلعان قصيران: ___',
    fillPromptEn: 'A shape like a door with 2 long sides and 2 short sides: ___',
    fillOptions: [
      { id: 'a', ar: 'مستطيل (Rectangle ▭)', en: 'Rectangle', visual: '▭ مستطيل' },
      { id: 'b', ar: 'مثلث (Triangle 🔺)', en: 'Triangle', visual: '🔺 مثلث' },
      { id: 'c', ar: 'دائرة (Circle ⭕)', en: 'Circle', visual: '⭕ دائرة' },
    ],
    fillCorrect: 'a',
  },
  {
    id: 'L2-CS04',
    num: 4,
    titleAr: 'التصنيف حسب اللون والشكل (بأكثر من صفة)',
    titleEn: 'Classification by Shape & Color Attributes',
    objAr: 'يصنف الطفل العناصر حسب الشكل الهندسي مع تجاهل اللون، أو حسب صفتين معاً (لون + شكل + نص).',
    objEn: 'Classify items by geometric shape regardless of color, or match both color and shape cues together.',
    introAr: 'تحدي ذكي! هل المثلث الأزرق والمثلث الأصفر ينتميان لنفس عائلة الشكل؟ نعم، كلاهما مثلث!',
    introEn: 'Smart challenge! Are a blue triangle and yellow triangle in the same shape family? Yes, both are triangles!',
    teachAr: 'يمكننا تصنيف الأشياء حسب صفة واحدة (الشكل فقط: كل المثلثات معاً، أو الحجم فقط)، أو حسب صفتين معاً (نجمة صفراء 💛⭐). نعتمد دائماً على الشكل والنص معاً وليس اللون وحده.',
    teachEn: 'We can sort objects by ONE attribute (all triangles together, ignoring color) or TWO attributes (Star + Yellow). Our cards always pair shape icons with text labels.',
    visual: '🔺 أحمر + 🔺 أزرق = عائلة المثلث (Triangles)',
    audioText: 'Sort by shape, sort by two attributes',
    examples: [
      { titleAr: 'تصنيف بالشكل فقط', titleEn: 'Sort by Shape', visual: '🔴 + 🔵 + 🟢 = دوائر', detailAr: 'رغم اختلاف الألوان كلها دوائر مستديرة', detailEn: 'Different colors, same Circle shape' },
      { titleAr: 'تصنيف بصفتين', titleEn: 'Sort by 2 Attributes', visual: '🟨 مربع أصفر', detailAr: 'نبحث عن الشكل (مربع) والاسم اللوني (أصفر) معاً', detailEn: 'Match BOTH shape (Square) AND label (Yellow)' },
      { titleAr: 'أشكال يومية', titleEn: 'Real-Life Shapes', visual: '🍕 مثلث · 🕰️ دائرة · 🚪 مستطيل', detailAr: 'كل شيء حولنا يحمل شكلاً هندسياً واضحاً', detailEn: 'Everyday objects carry clear 2D shapes' },
    ],
    vocab: [
      ['نفس الشكل', 'Same Shape', '🔺🔺', '٣ أضلاع في كليهما'],
      ['نفس اللون', 'Same Color', '🟦🔵', 'أزرق'],
      ['صفة واحدة', 'One Attribute', '☝️', 'الشكل أو الحجم'],
      ['صفتان معاً', 'Two Attributes', '✌️', 'الشكل واللون'],
    ],
    guidedPromptAr: 'نريد عنصراً يحقق الصفتين معاً: (شكله مربع ⬛) و(مكتوب عليه أخضر 🟩):',
    guidedPromptEn: 'Find the item matching BOTH attributes: (Shape = Square) AND (Label = Green):',
    guidedOptions: [
      { id: 'a', ar: 'مربع أخضر (Green Square)', en: 'Green Square', visual: '🟩 مربع أخضر', colorHex: '#22C55E' },
      { id: 'b', ar: 'مربع أصفر (Yellow Square)', en: 'Yellow Square', visual: '🟨 مربع أصفر', colorHex: '#EAB308' },
      { id: 'c', ar: 'دائرة خضراء (Green Circle)', en: 'Green Circle', visual: '🟢 دائرة خضراء', colorHex: '#22C55E' },
    ],
    guidedCorrect: 'a',
    pairs: [
      ['🍕 قطعة بيتزا', '🔺 شكل المثلث (3 sides)'],
      ['🕰️ ساعة الحائط', '⭕ شكل الدائرة (Round)'],
      ['🚪 باب الغرفة', '▭ شكل المستطيل (4 sides)'],
    ],
    sortBuckets: [
      { id: 'tri', ar: 'عائلة المثلثات (Triangles 🔺)', en: 'All Triangles', emoji: '🔺' },
      { id: 'sq', ar: 'عائلة المربعات (Squares ⬛)', en: 'All Squares', emoji: '⬛' },
    ],
    sortItems: [
      { id: 'si1', ar: 'مثلث تحذير (3 أضلاع)', en: 'Warning Triangle', visual: '⚠️ مثلث', bucketId: 'tri' },
      { id: 'si2', ar: 'مربع أزرق (4 أضلاع متساوية)', en: 'Blue Square', visual: '🟦 مربع', bucketId: 'sq' },
      { id: 'si3', ar: 'مربع أحمر (4 أضلاع متساوية)', en: 'Red Square', visual: '🟥 مربع', bucketId: 'sq' },
      { id: 'si4', ar: 'قطعة مثلثة (3 أضلاع)', en: 'Triangle Slice', visual: '🍕 مثلث', bucketId: 'tri' },
    ],
    sequence: ['🔍 انظر للشكل (Shape)', '🏷️ اقرأ الصفة (Attribute)', '🧺 ضعه في المجموعة', '✅ تحقق من الشرطين'],
    fillPromptAr: 'قطعة الجبن المثلثة وشراع القارب المثلث يتشاركان في صفة: ___',
    fillPromptEn: 'A triangle cheese wedge and triangle sailboat sail share the same: ___',
    fillOptions: [
      { id: 'a', ar: 'الشكل (مثلث ذو ٣ أضلاع)', en: 'Shape (3-sided Triangle)', visual: '🔺 الشكل: مثلث' },
      { id: 'b', ar: 'المذاق الحلو', en: 'Sweet Taste', visual: '🍬 طعم' },
      { id: 'c', ar: 'الإبحار في الماء', en: 'Floating on Water', visual: '🌊 ماء' },
    ],
    fillCorrect: 'a',
  },
  {
    id: 'L2-CS05',
    num: 5,
    titleAr: 'الأنماط المركبة بالألوان والأشكال',
    titleEn: 'Complex Patterns with Colors & Shapes',
    objAr: 'يكتشف الطفل قاعدة النمط الثنائي والثلاثي (ABAB / AABB / ABC) ويكمل الشكل الناقص.',
    objEn: 'Identify ABAB, AABB, and ABC color-and-shape rules and predict the next item accurately.',
    introAr: 'أنا قوسو المتحمس! الأنماط مثل إيقاع موسيقي بصري يتكرر بانتظام. ما القاعدة هنا؟',
    introEn: 'Patterns work like visual music—they repeat with a clear rule! Can you spot the rule?',
    teachAr: 'النمط قد يتكرر كل عنصرين (AB: دائرة، مثلث، دائرة، مثلث) أو يتكرر كل ثلاثة عناصر (ABC: مربع، نجمة، هلال، مربع، نجمة، هلال) أو ثنائيات (AABB).',
    teachEn: 'Patterns repeat by a rule: ABAB (Circle, Triangle, Circle, Triangle), AABB (Square, Square, Star, Star), or ABC (Circle, Square, Star...).',
    visual: '⭕ 🔺 ⭕ 🔺 ⭕ ❓',
    audioText: 'Circle, Triangle, Circle, Triangle, what comes next?',
    examples: [
      { titleAr: 'نمط ABAB', titleEn: 'ABAB Pattern', visual: '🟦 🟡 🟦 🟡 🟦 ➡️ 🟡', detailAr: 'يتناوب عنصران بالتساوي (A ثم B)', detailEn: 'Two items alternate one after another' },
      { titleAr: 'نمط AABB', titleEn: 'AABB Pattern', visual: '⭐ ⭐ 🌙 🌙 ⭐ ⭐ ➡️ 🌙', detailAr: 'يتكرر كل عنصر مرتين متتاليتين', detailEn: 'Each shape repeats twice in a row' },
      { titleAr: 'نمط ABC', titleEn: 'ABC Pattern', visual: '⭕ ⬛ 🔺 · ⭕ ⬛ ❓ (🔺)', detailAr: 'دورة من ثلاثة أشكال مختلفة', detailEn: 'A 3-shape repeating cycle' },
    ],
    vocab: [
      ['نمط متناوب (ABAB)', 'Alternating Pattern', '⭕🔺⭕🔺', 'عنصر ثم الآخر'],
      ['نمط مزدوج (AABB)', 'Double Pattern', '⭐⭐🌙🌙', 'مرتان لكل شكل'],
      ['نمط ثلاثي (ABC)', 'Triple Cycle', '⭕⬛🔺', 'ثلاثة أشكال تدور'],
      ['وحدة النمط', 'Pattern Core', '🔁', 'الجزء الذي يتكرر'],
    ],
    guidedPromptAr: 'أكمل النمط الثلاثي (ABC): مربع ⬛، نجمة ⭐، هلال 🌙، مربع ⬛، نجمة ⭐، ___؟',
    guidedPromptEn: 'Complete the ABC pattern: Square ⬛, Star ⭐, Crescent 🌙, Square ⬛, Star ⭐, ___?',
    guidedOptions: [
      { id: 'a', ar: 'هلال (Crescent 🌙)', en: 'Crescent 🌙', visual: '🌙 هلال' },
      { id: 'b', ar: 'مربع (Square ⬛)', en: 'Square ⬛', visual: '⬛ مربع' },
      { id: 'c', ar: 'دائرة (Circle ⭕)', en: 'Circle ⭕', visual: '⭕ دائرة' },
    ],
    guidedCorrect: 'a',
    pairs: [
      ['⭕ 🔺 ⭕ 🔺', 'نمط ABAB (متناوب)'],
      ['⭐ ⭐ 🌙 🌙', 'نمط AABB (مزدوج)'],
      ['⭕ ⬛ 🔺 ⭕ ⬛ 🔺', 'نمط ABC (ثلاثي)'],
    ],
    sortBuckets: [
      { id: 'abab', ar: 'نمط ثنائي (2-item Rule)', en: '2-Item Pattern', emoji: '2️⃣' },
      { id: 'abc', ar: 'نمط ثلاثي (3-item Rule)', en: '3-Item Pattern', emoji: '3️⃣' },
    ],
    sortItems: [
      { id: 'si1', ar: '⭕ 🔺 ⭕ 🔺', en: 'Circle-Triangle-Circle-Triangle', visual: '⭕🔺⭕🔺', bucketId: 'abab' },
      { id: 'si2', ar: '⬛ ⭐ 🌙 ⬛ ⭐ 🌙', en: 'Square-Star-Moon cycle', visual: '⬛⭐🌙', bucketId: 'abc' },
      { id: 'si3', ar: '🟦 🟨 🟦 🟨', en: 'Blue-Yellow-Blue-Yellow', visual: '🟦🟨🟦🟨', bucketId: 'abab' },
      { id: 'si4', ar: '🍎 🍌 🍇 🍎 🍌 🍇', en: 'Apple-Banana-Grape cycle', visual: '🍎🍌🍇', bucketId: 'abc' },
    ],
    sequence: ['1️⃣ ⭕ دائرة', '2️⃣ ⭕ دائرة', '3️⃣ 🔺 مثلث', '4️⃣ 🔺 مثلث'],
    fillPromptAr: 'في النمط (AABB): ⭐ ⭐ 🌙 🌙 ⭐ ___ ، ما الذي يكمل الثنائي؟',
    fillPromptEn: 'In AABB pattern: ⭐ ⭐ 🌙 🌙 ⭐ ___ — what finishes the pair?',
    fillOptions: [
      { id: 'a', ar: 'نجمة ثانية (Star ⭐)', en: 'Second Star ⭐', visual: '⭐ نجمة' },
      { id: 'b', ar: 'هلال (Crescent 🌙)', en: 'Crescent 🌙', visual: '🌙 هلال' },
      { id: 'c', ar: 'مربع (Square ⬛)', en: 'Square ⬛', visual: '⬛ مربع' },
    ],
    fillCorrect: 'a',
  },
  {
    id: 'L2-CS06',
    num: 6,
    titleAr: 'تحدي البناء الإبداعي بالأشكال والألوان',
    titleEn: 'Creative Shape & Color Building Challenge',
    objAr: 'يركّب الطفل أشكالاً مركبة (بيت، صاروخ، قطار) من الأشكال الهندسية البسيطة ويتوقع الجزء الناقص.',
    objEn: 'Decompose and build complex pictures (house, rocket, train) out of 2D geometric shapes.',
    introAr: 'حان وقت الهندسة الإبداعية! كيف نصنع صاروخاً أو بيتاً من المثلث والمستطيل والدائرة؟',
    introEn: 'Creative builder time! How do we construct a house or rocket using triangles, rectangles, and circles?',
    teachAr: 'يمكننا تركيب الأشكال البسيطة لبناء عالم كامل: البيت = مربع للجدران + مثلث للسقف + مستطيل للباب! الصاروخ = مثلث في القمة + مستطيل للجسم + دوائر للنوافذ!',
    teachEn: 'Simple 2D shapes combine into awesome builds: House = Square wall + Triangle roof + Rectangle door! Rocket = Triangle nose + Rectangle body + Circle windows!',
    visual: '🏠 = 🔺 + ⬛ + ▭ | 🚀 = 🔺 + ▭ + ⭕',
    audioText: 'House from triangle roof and square body. Rocket from triangle nose and rectangle body.',
    examples: [
      { titleAr: 'تصميم البيت', titleEn: 'Build a House', visual: '🔺 سقف + ⬛ جدار + ▭ باب', detailAr: 'نجمع ٣ أشكال مختلفة لنحصل على بيت متكامل', detailEn: '3 simple shapes combine into a cozy house' },
      { titleAr: 'تصميم الصاروخ', titleEn: 'Build a Rocket', visual: '🔺 رأس + ▭ جسم + 🔥 محرك', detailAr: 'المثلث المدبب في الأعلى يشق الهواء', detailEn: 'Pointed Triangle on top, Rectangle body below' },
      { titleAr: 'شاحنة صغيرة', titleEn: 'Build a Truck', visual: '▭ صندوق + ⬛ مقصورة + ⭕⭕ عجلات', detailAr: 'الدائرتان هما العجلتان لأنهما تتدحرجان!', detailEn: 'Two Circles act as wheels because circles roll!' },
    ],
    vocab: [
      ['سقف مثلث', 'Triangle Roof', '🔺🏠', 'في أعلى البيت'],
      ['جدار مربع', 'Square Wall', '⬛🏠', 'قاعدة البيت'],
      ['عجلة دائرية', 'Circle Wheel', '⭕🚌', 'تتدحرج بسهولة'],
      ['جسم مستطيل', 'Rectangle Body', '▭🚀', 'هيكل طويل'],
    ],
    guidedPromptAr: 'نحتاج شكلاً يتدحرج بسهولة ليكون عجلات القطار. أي شكل نختار؟',
    guidedPromptEn: 'We need a shape that rolls smoothly for train wheels. Which shape works best?',
    guidedOptions: [
      { id: 'a', ar: 'الدائرة (Circle ⭕)', en: 'Circle ⭕ (no corners)', visual: '⭕ دائرة مستديرة' },
      { id: 'b', ar: 'المربع (Square ⬛)', en: 'Square ⬛ (has corners)', visual: '⬛ مربع بزوايا' },
      { id: 'c', ar: 'المثلث (Triangle 🔺)', en: 'Triangle 🔺 (pointy)', visual: '🔺 مثلث مدبب' },
    ],
    guidedCorrect: 'a',
    pairs: [
      ['🔺 مثلث في القمة', 'سقف البيت أو رأس الصاروخ'],
      ['⭕ دائرة متدحرجة', 'عجلة السيارة أو الدراجة'],
      ['▭ مستطيل طويل', 'عربة القطار أو الباب'],
    ],
    sortBuckets: [
      { id: 'parts', ar: 'قطع البيت (House Parts 🏠)', en: 'House Build Shapes', emoji: '🏠' },
      { id: 'rocket', ar: 'قطع القطار/السيارة (Train Parts 🚂)', en: 'Vehicle Build Shapes', emoji: '🚂' },
    ],
    sortItems: [
      { id: 'si1', ar: 'مثلث للسقف (Triangle Roof)', en: 'Triangle Roof', visual: '🔺 سقف', bucketId: 'parts' },
      { id: 'si2', ar: 'عجلات دائرية (Circle Wheels)', en: 'Circle Wheels', visual: '⭕ عجلة', bucketId: 'rocket' },
      { id: 'si3', ar: 'باب مستطيل (Rectangle Door)', en: 'Rectangle Door', visual: '▭ باب', bucketId: 'parts' },
      { id: 'si4', ar: 'مقطورات مستطيلة (Train Cars)', en: 'Train Cars', visual: '🚃 مقطورة', bucketId: 'rocket' },
    ],
    sequence: ['1️⃣ ⬛ قاعدة مربعة', '2️⃣ ▭ باب ونافذة', '3️⃣ 🔺 سقف مثلث فوقها', '4️⃣ 🏠 بيت مكتمل!'],
    fillPromptAr: 'لصنع علم الدولة أو الكتاب نستخدم غالباً شكل: ___',
    fillPromptEn: 'To draw a flat flag or book cover, we most commonly use a: ___',
    fillOptions: [
      { id: 'a', ar: 'المستطيل (Rectangle ▭)', en: 'Rectangle ▭', visual: '▭ مستطيل' },
      { id: 'b', ar: 'الهلال فقط (Crescent 🌙)', en: 'Crescent 🌙', visual: '🌙 هلال' },
      { id: 'c', ar: 'البيضاوي (Oval 🥚)', en: 'Oval 🥚', visual: '🥚 بيضاوي' },
    ],
    fillCorrect: 'a',
  },
];

function buildCsActivities(s: ColorsShapesL2Spec): Level2ActivitySpec[] {
  return [
    {
      id: `${s.id}-a1`,
      type: 'guided-practice',
      title: { ar: '١. اختر اللون والشكل الصحيح', en: '1. Choose the Matching Color & Shape' },
      instruction: { ar: s.guidedPromptAr, en: s.guidedPromptEn },
      options: s.guidedOptions.map((o) => ({ id: o.id, label: { ar: o.ar, en: o.en }, visual: o.visual, colorHex: o.colorHex })),
      correctOptionId: s.guidedCorrect,
      feedbackCorrect: { ar: 'رائع! اختيار دقيق جداً!', en: 'Awesome! Spot-on selection!' },
      feedbackIncorrect: { ar: 'اقرأ الاسم وانظر للشكل بتركيز وحاول ثانية.', en: 'Check both the text label and shape, then try again.' },
    },
    {
      id: `${s.id}-a2`,
      type: 'matching-pairs',
      title: { ar: '٢. طابق الوصف مع نتيجته', en: '2. Match Clues & Results' },
      instruction: { ar: 'طابق كل بطاقة من اليمين بما يناسبها من اليسار.', en: 'Match each item on the left with its partner on the right.' },
      pairs: s.pairs.map(([left, right], i) => ({ id: `${s.id}-p${i}`, left, right })),
      feedbackCorrect: { ar: 'تطابق ممتاز!', en: 'Brilliant matching!' },
      feedbackIncorrect: { ar: 'أعد التطابق بهدوء.', en: 'Try matching carefully.' },
    },
    {
      id: `${s.id}-a3`,
      type: 'sorting-classify',
      title: { ar: '٣. صنّف العناصر في مجموعتين', en: '3. Sort into Two Groups' },
      instruction: { ar: 'اقرأ اسم كل عنصر وضعه في المجموعة المناسبة.', en: 'Read each item and place it in the right bucket.' },
      sortBuckets: s.sortBuckets.map((b) => ({ id: b.id, label: { ar: b.ar, en: b.en }, emoji: b.emoji })),
      sortItems: s.sortItems.map((it) => ({ id: it.id, label: { ar: it.ar, en: it.en }, visual: it.visual, bucketId: it.bucketId })),
      feedbackCorrect: { ar: 'تصنيف عبقري!', en: 'Brilliant sorting!' },
      feedbackIncorrect: { ar: 'تحقق من القاعدة وحاول ثانية.', en: 'Check the rule and try again.' },
    },
    {
      id: `${s.id}-a4`,
      type: 'pattern-sequence',
      title: { ar: '٤. رتّب التسلسل البصري', en: '4. Order the Visual Sequence' },
      instruction: { ar: 'اضغط البطاقات بالترتيب الصحيح من البداية للنهاية.', en: 'Tap cards in order from start to finish.' },
      sequenceItems: s.sequence,
      feedbackCorrect: { ar: 'ترتيب فني متقن!', en: 'Artistic perfection!' },
      feedbackIncorrect: { ar: 'راجع الترتيب خطوة بخطوة.', en: 'Check the order step by step.' },
    },
    {
      id: `${s.id}-a5`,
      type: 'fill-blank',
      title: { ar: '٥. التحدي المستقل', en: '5. Independent Challenge' },
      instruction: { ar: s.fillPromptAr, en: s.fillPromptEn },
      options: s.fillOptions.map((o) => ({ id: o.id, label: { ar: o.ar, en: o.en }, visual: o.visual, colorHex: o.colorHex })),
      correctOptionId: s.fillCorrect,
      feedbackCorrect: { ar: 'مبدع حقيقي!', en: 'True creator!' },
      feedbackIncorrect: { ar: 'فكر بالقاعدة وجرّب مرة أخرى.', en: 'Think of the rule and try again.' },
    },
  ];
}

export const LEVEL2_COLORS_SHAPES_LESSONS: Level2LessonDefinition[] = CS_L2_SPECS.map((s, idx) => ({
  id: s.id,
  subject: 'colors-shapes',
  level: 2,
  ageRange: '1-4',
  recommendedAgeRange: '2-3',
  lessonNumber: s.num,
  title: { ar: s.titleAr, en: s.titleEn },
  learningObjective: { ar: s.objAr, en: s.objEn },
  prerequisiteIds: idx > 0 ? [CS_L2_SPECS[idx - 1].id] : [],
  characterName: { ar: 'قوسو الملوّن', en: 'Qawso the Artist' },
  characterEmoji: '🎨',
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
  activities: buildCsActivities(s),
  completionCriteria: {
    ar: 'أكمل جميع الأنشطة وحقق ٧٥٪ فأعلى في التقييم المستقل.',
    en: 'Complete all activities and score 75%+ on the independent check.',
  },
  estimatedMinutes: 8,
  difficulty: idx < 2 ? 'easy' : idx < 4 ? 'medium' : 'challenging',
  recommendedReviewDays: [1, 3, 7],
}));
