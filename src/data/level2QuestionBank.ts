import { Level2LessonDefinition, Level2QuestionItem, Level2Subject } from '../types/nonoland';
import { ALL_LEVEL2_LESSONS } from './level2Curriculum';

// Fresh independent check items mapped per lesson to verify transfer beyond exact in-lesson teaching examples.
const FRESH_INDEPENDENT_CHECKS: Record<
  string,
  Array<{
    promptAr: string;
    promptEn: string;
    visualCue?: string;
    audioText?: string;
    audioLang?: 'ar' | 'en';
    qType: Level2QuestionItem['qType'];
    options: Array<{ id: string; ar: string; en: string; visual: string }>;
    correctId: string;
    explainAr: string;
    explainEn: string;
  }>
> = {
  'L2-AR01': [
    {
      promptAr: 'أي كلمة جديدة تبدأ بصوت (خَـ) المنطوق بوضوح؟',
      promptEn: 'Which fresh word starts with the spoken Khaa (خَـ) sound?',
      qType: 'picture-id',
      options: [
        { id: 'a', ar: 'خُبز 🍞', en: 'Khubz (Bread) 🍞', visual: '🍞' },
        { id: 'b', ar: 'حَقِيبَة 🎒', en: 'Haqeeba (Bag) 🎒', visual: '🎒' },
        { id: 'c', ar: 'جَرَس 🔔', en: 'Jaras (Bell) 🔔', visual: '🔔' },
      ],
      correctId: 'a',
      explainAr: 'كلمة خُبز تبدأ بحرف الخاء بصوته المميز (خُ) الذي فوقه نقطة.',
      explainEn: 'Khubz (bread) starts with Khaa (خ) marked with one dot above.',
    },
    {
      promptAr: 'اسم الحرف (ثاء)، فما صوته المسموع في كلمة (ثَلْج ❄️)؟',
      promptEn: 'The letter name is Thaa; what sound does it make in Thalj (❄️)?',
      qType: 'audio-id',
      audioText: 'ثَلْج، ثَ، ثَ',
      audioLang: 'ar',
      options: [
        { id: 'a', ar: 'ثَـ', en: 'Tha (ثَ)', visual: '❄️' },
        { id: 'b', ar: 'سَـ', en: 'Sa (سَ)', visual: '☁️' },
        { id: 'c', ar: 'تَـ', en: 'Ta (تَ)', visual: '🍎' },
      ],
      correctId: 'a',
      explainAr: 'الحرف ث له ٣ نقاط وصوته (ثَـ) عند إخراج طرف اللسان.',
      explainEn: 'Thaa (ث) has 3 dots and makes a gentle "th" sound.',
    },
  ],
  'L2-AR02': [
    {
      promptAr: 'في كلمة (قَلَم ✏️)، أي شكل يظهر به حرف اللام في الوسط؟',
      promptEn: 'In the word Qalam (قلم), which shape shows Laam in the MIDDLE?',
      qType: 'multiple-choice',
      options: [
        { id: 'a', ar: 'ـلـ (يمسك من اليمين واليسار)', en: 'ـلـ (connects both sides)', visual: '✏️' },
        { id: 'b', ar: 'لـ (أول الكلمة فقط)', en: 'لـ (initial only)', visual: '🍋' },
        { id: 'c', ar: 'ل (منفصل)', en: 'ل (isolated)', visual: '🔔' },
      ],
      correctId: 'a',
      explainAr: 'حرف اللام في وسط كلمة قلم يتصل بالقاف قبله والميم بعده: ـلـ.',
      explainEn: 'Medial Laam connects to Qaaf before it and Meem after it: ـلـ.',
    },
    {
      promptAr: 'كلمة (تُوت 🫐) تنتهي بالتاء الكاملة، أي موضع لهذه التاء الأخيرة؟',
      promptEn: 'In Toot (توت), where is the underlined full Taa?',
      qType: 'true-false',
      options: [
        { id: 'a', ar: 'في آخر الكلمة (نهاية)', en: 'Final position (End)', visual: '🏁' },
        { id: 'b', ar: 'في أول الكلمة (بداية)', en: 'Initial position (Start)', visual: '🚩' },
      ],
      correctId: 'a',
      explainAr: 'التاء الأخيرة تكتب كاملة لأن الواو قبلها لا تتصل بما بعدها.',
      explainEn: 'The final Taa sits at the end in its full shape.',
    },
  ],
  'L2-EN01': [
    {
      promptAr: 'أي كلمة إنجليزية جديدة تبدأ بصوت القصير A (/æ/)؟',
      promptEn: 'Which fresh English word starts with Short A (/æ/)?',
      qType: 'audio-id',
      audioText: 'Ant, ant, /a/',
      audioLang: 'en',
      options: [
        { id: 'a', ar: 'Ant (نملة) 🐜', en: 'Ant 🐜', visual: '🐜' },
        { id: 'b', ar: 'Egg (بيضة) 🥚', en: 'Egg 🥚', visual: '🥚' },
        { id: 'c', ar: 'Igloo (كوخ ثلج) 🧊', en: 'Igloo 🧊', visual: '🧊' },
      ],
      correctId: 'a',
      explainAr: 'كلمة Ant تبدأ بصوت Short A القصير المفتوح.',
      explainEn: 'Ant starts with the open short /æ/ vowel sound.',
    },
    {
      promptAr: 'في كلمة (Run 🏃)، ما صوت حرف العلة في المنتصف؟',
      promptEn: 'In the new word RUN 🏃, which short vowel is in the middle?',
      qType: 'fill-blank',
      options: [
        { id: 'a', ar: 'u (/ʌ/ — R-u-n)', en: 'u (R-u-n)', visual: '🏃' },
        { id: 'b', ar: 'i (/ɪ/)', en: 'i (R-i-n)', visual: '🔔' },
        { id: 'c', ar: 'o (/ɒ/)', en: 'o (R-o-n)', visual: '⭕' },
      ],
      correctId: 'a',
      explainAr: 'Run فيها صوت Short U القصير (/ʌ/) في الوسط.',
      explainEn: 'Run uses the middle short U vowel sound.',
    },
  ],
  'L2-MA01': [
    {
      promptAr: 'لديك ١٠ مكعبات في علبة و٧ مكعبات بجانبها. كم مجموعها؟',
      promptEn: 'You have 1 bundle of 10 cubes plus 7 single cubes. Total?',
      qType: 'multiple-choice',
      options: [
        { id: 'a', ar: '١٧ (17)', en: '17 (Seventeen)', visual: '🔟+7️⃣' },
        { id: 'b', ar: '١٥ (15)', en: '15 (Fifteen)', visual: '🔟+5️⃣' },
        { id: 'c', ar: '٧١ (71)', en: '71 (Seventy-one)', visual: '7️⃣🔟' },
      ],
      correctId: 'a',
      explainAr: 'عشرة واحدة + ٧ آحاد = ١٧ (سبعة عشر).',
      explainEn: '1 ten + 7 ones equals 17.',
    },
    {
      promptAr: 'أي عدد يأتي مباشرة بين ١٣ و ١٥؟',
      promptEn: 'Which number comes right between 13 and 15?',
      qType: 'fill-blank',
      options: [
        { id: 'a', ar: '١٤ (14)', en: '14 (Fourteen)', visual: '1️⃣4️⃣' },
        { id: 'b', ar: '١٢ (12)', en: '12 (Twelve)', visual: '1️⃣2️⃣' },
        { id: 'c', ar: '١٦ (16)', en: '16 (Sixteen)', visual: '1️⃣6️⃣' },
      ],
      correctId: 'a',
      explainAr: 'الترتيب الصحيح: ١٣، ثم ١٤، ثم ١٥.',
      explainEn: 'Counting forward goes 13 -> 14 -> 15.',
    },
  ],
  'L2-CS02': [
    {
      promptAr: 'لو مزجنا قطرتين من الأصفر 💛 مع قطرتين من الأحمر ❤️ لتلوين برتقالة 🍊، أي لون يظهر؟',
      promptEn: 'If we blend Yellow 💛 and Red ❤️ paint to color a tangerine 🍊, what color appears?',
      qType: 'picture-id',
      options: [
        { id: 'a', ar: 'برتقالي (Orange 🟠)', en: 'Orange 🟠', visual: '🟠' },
        { id: 'b', ar: 'أخضر (Green 🟢)', en: 'Green 🟢', visual: '🟢' },
        { id: 'c', ar: 'بنفسجي (Purple 🟣)', en: 'Purple 🟣', visual: '🟣' },
      ],
      correctId: 'a',
      explainAr: 'الأحمر + الأصفر يعطيان دائماً اللون البرتقالي.',
      explainEn: 'Red mixed with Yellow always creates Orange.',
    },
    {
      promptAr: 'الأزرق 🔵 + الأحمر 🔴 يصنعان اللون الأخضر 🟢. صح أم خطأ؟',
      promptEn: 'True or False: Mixing Blue 🔵 + Red 🔴 creates Green 🟢.',
      qType: 'true-false',
      options: [
        { id: 'a', ar: 'خطأ — يصنعان البنفسجي 💜', en: 'False — Blue + Red make Purple 💜', visual: '🟣' },
        { id: 'b', ar: 'صح — يصنعان الأخضر', en: 'True — makes Green', visual: '🟢' },
      ],
      correctId: 'a',
      explainAr: 'الأزرق + الأحمر يصنعان البنفسجي، أما الأزرق + الأصفر فيصنعان الأخضر.',
      explainEn: 'Blue + Red make Purple! Blue + Yellow make Green.',
    },
  ],
  'L2-LG01': [
    {
      promptAr: 'أي صورة تختلف عن البقية: (جزمة 🥾، حذاء رياضي 👟، صندل 🩴، موزة 🍌)؟',
      promptEn: 'Which one is the odd one out: (Boot 🥾, Sneaker 👟, Sandal 🩴, Banana 🍌)?',
      qType: 'picture-id',
      options: [
        { id: 'a', ar: 'الموزة 🍌 (طعام وليس حذاءً)', en: 'Banana 🍌 (fruit, not footwear)', visual: '🍌' },
        { id: 'b', ar: 'الحذاء الرياضي 👟', en: 'Sneaker 👟', visual: '👟' },
        { id: 'c', ar: 'الجزمة 🥾', en: 'Boot 🥾', visual: '🥾' },
      ],
      correctId: 'a',
      explainAr: 'الثلاثة أحذية نلبسها في القدم، والموزة فاكهة نأكلها.',
      explainEn: 'Three are footwear; Banana is food.',
    },
  ],
  'L2-WA01': [
    {
      promptAr: 'السلحفاة البحرية 🐢 والمرجان 🪸 يعيشان في البيئة المالحة، ما موطنهما؟',
      promptEn: 'Sea turtles 🐢 and coral 🪸 live in salty deep water. What is their habitat?',
      qType: 'multiple-choice',
      options: [
        { id: 'a', ar: 'المحيط والبحر 🌊', en: 'Ocean / Sea 🌊', visual: '🌊' },
        { id: 'b', ar: 'المزرعة 🌾', en: 'Farm 🌾', visual: '🌾' },
        { id: 'c', ar: 'الصحراء 🏜️', en: 'Desert 🏜️', visual: '🏜️' },
      ],
      correctId: 'a',
      explainAr: 'المخلوقات البحرية مثل السلحفاة البحرية موطنها المحيط.',
      explainEn: 'Sea creatures naturally belong in the ocean.',
    },
  ],
};

function buildFallbackFreshOptions(
  lesson: Level2LessonDefinition,
  allInSubject: Level2LessonDefinition[],
  seedOffset: number,
) {
  const distractors = allInSubject.filter((l) => l.id !== lesson.id);
  const d1 = distractors[(seedOffset) % distractors.length] ?? lesson;
  const d2 = distractors[(seedOffset + 1) % distractors.length] ?? lesson;
  const v0 = lesson.vocabulary[0];
  const d1v = d1.vocabulary[0];
  const d2v = d2.vocabulary[0];
  return { v0, d1v, d2v, d1, d2 };
}

function buildQuestionsForLesson(
  lesson: Level2LessonDefinition,
  bySubject: Record<Level2Subject, Level2LessonDefinition[]>,
): Level2QuestionItem[] {
  const peers = bySubject[lesson.subject];
  const items: Level2QuestionItem[] = [];
  const lessonIdx = peers.findIndex((p) => p.id === lesson.id);
  const otherPeer1 = peers[(lessonIdx + 1) % peers.length];
  const otherPeer2 = peers[(lessonIdx + 2) % peers.length];

  // Extract practice question from guided-practice & fill-blank activities
  const guidedAct = lesson.activities.find((a) => a.type === 'guided-practice' && a.options && a.correctOptionId);
  const fillAct = lesson.activities.find((a) => a.type === 'fill-blank' && a.options && a.correctOptionId);

  if (guidedAct && guidedAct.options && guidedAct.correctOptionId) {
    items.push({
      id: `${lesson.id}-Q1`,
      lessonId: lesson.id,
      subject: lesson.subject,
      level: 2,
      kind: 'practice',
      qType: 'multiple-choice',
      difficulty: 1,
      prompt: guidedAct.instruction,
      audioText: lesson.audioCue.text,
      audioLang: lesson.audioCue.lang,
      options: guidedAct.options,
      correctOptionId: guidedAct.correctOptionId,
      explanation: { ar: lesson.teachingContent.ar, en: lesson.teachingContent.en },
      feedbackCorrect: guidedAct.feedbackCorrect,
      feedbackIncorrect: guidedAct.feedbackIncorrect,
    });
  }

  // Q2: Practice listening / vocabulary check
  const vMain = lesson.vocabulary[1] ?? lesson.vocabulary[0];
  const vDist1 = otherPeer1?.vocabulary[0] ?? { wordAr: 'مثال آخر', wordEn: 'Other Item', emoji: '✨' };
  const vDist2 = otherPeer2?.vocabulary[1] ?? otherPeer2?.vocabulary[0] ?? { wordAr: 'خيار إضافي', wordEn: 'Extra Item', emoji: '🌟' };
  items.push({
    id: `${lesson.id}-Q2`,
    lessonId: lesson.id,
    subject: lesson.subject,
    level: 2,
    kind: 'practice',
    qType: 'audio-id',
    difficulty: 1,
    prompt: {
      ar: `استمع ثم اختر البطاقة المرتبطة بمفهوم: ${vMain.wordAr}`,
      en: `Listen and select the card matching: ${vMain.wordEn}`,
    },
    audioText: vMain.audioText || vMain.wordEn,
    audioLang: lesson.audioCue.lang,
    options: [
      { id: 'a', label: { ar: `${vMain.wordAr} (${vMain.wordEn})`, en: `${vMain.wordEn} (${vMain.wordAr})` }, visual: vMain.emoji },
      { id: 'b', label: { ar: `${vDist1.wordAr} (${vDist1.wordEn})`, en: `${vDist1.wordEn} (${vDist1.wordAr})` }, visual: vDist1.emoji },
      { id: 'c', label: { ar: `${vDist2.wordAr} (${vDist2.wordEn})`, en: `${vDist2.wordEn} (${vDist2.wordAr})` }, visual: vDist2.emoji },
    ],
    correctOptionId: 'a',
    explanation: {
      ar: `هذا المفهوم جزء أساسي من درس: ${lesson.title.ar}`,
      en: `This concept belongs directly to: ${lesson.title.en}`,
    },
    feedbackCorrect: { ar: 'أحسنت! استماع وتركيز رائع!', en: 'Well done! Sharp listening!' },
    feedbackIncorrect: { ar: 'أعد الاستماع واضغط البطاقة المطابقة.', en: 'Listen again and match carefully.' },
  });

  // Q3: Practice True/False objective check
  const ex0 = lesson.examples[0];
  items.push({
    id: `${lesson.id}-Q3`,
    lessonId: lesson.id,
    subject: lesson.subject,
    level: 2,
    kind: 'practice',
    qType: 'true-false',
    difficulty: 2,
    prompt: {
      ar: `صح أم خطأ: (${ex0.detail.ar}) — يوضح ${ex0.title.ar}؟`,
      en: `True or False: "${ex0.detail.en}" explains "${ex0.title.en}"?`,
    },
    visualCue: ex0.visual,
    options: [
      { id: 'a', label: { ar: 'صح ✅', en: 'True ✅' }, visual: '✅' },
      { id: 'b', label: { ar: 'خطأ ❌', en: 'False ❌' }, visual: '❌' },
    ],
    correctOptionId: 'a',
    explanation: { ar: ex0.detail.ar, en: ex0.detail.en },
    feedbackCorrect: { ar: 'إجابة صحيحة!', en: 'Correct!' },
    feedbackIncorrect: { ar: 'راجع المثال في الدرس.', en: 'Review the lesson example.' },
  });

  // Q4: Practice fill-blank
  if (fillAct && fillAct.options && fillAct.correctOptionId) {
    items.push({
      id: `${lesson.id}-Q4`,
      lessonId: lesson.id,
      subject: lesson.subject,
      level: 2,
      kind: 'practice',
      qType: 'fill-blank',
      difficulty: 2,
      prompt: fillAct.instruction,
      options: fillAct.options,
      correctOptionId: fillAct.correctOptionId,
      explanation: { ar: lesson.learningObjective.ar, en: lesson.learningObjective.en },
      feedbackCorrect: fillAct.feedbackCorrect,
      feedbackIncorrect: fillAct.feedbackIncorrect,
    });
  }

  // INDEPENDENT QUESTIONS (fresh unseen evaluation checks!)
  const customFresh = FRESH_INDEPENDENT_CHECKS[lesson.id] ?? [];
  customFresh.forEach((f, idx) => {
    items.push({
      id: `${lesson.id}-Q${5 + idx}`,
      lessonId: lesson.id,
      subject: lesson.subject,
      level: 2,
      kind: 'independent',
      qType: f.qType,
      difficulty: idx === 0 ? 2 : 3,
      prompt: { ar: f.promptAr, en: f.promptEn },
      visualCue: f.visualCue,
      audioText: f.audioText,
      audioLang: f.audioLang,
      options: f.options.map((o) => ({ id: o.id, label: { ar: o.ar, en: o.en }, visual: o.visual })),
      correctOptionId: f.correctId,
      explanation: { ar: f.explainAr, en: f.explainEn },
      feedbackCorrect: { ar: 'ممتاز! فهم حقيقي للمهارة!', en: 'Excellent! True mastery!' },
      feedbackIncorrect: { ar: `معلومة مهمة: ${f.explainAr}`, en: `Helpful tip: ${f.explainEn}` },
    });
  });

  // Ensure every lesson has at least 4 fresh independent items using unseen vocabulary/pairs/sequence
  let nextIdx = 5 + customFresh.length;
  const fallback = buildFallbackFreshOptions(lesson, peers, lessonIdx + 3);
  const vFresh = lesson.vocabulary[2] ?? lesson.vocabulary[lesson.vocabulary.length - 1];
  const vLast = lesson.vocabulary[3] ?? lesson.vocabulary[0];

  if (nextIdx <= 6) {
    const seqAct = lesson.activities.find((a) => a.type === 'pattern-sequence' && a.sequenceItems?.length);
    const seqArr = seqAct?.sequenceItems ?? [vMain.wordEn, vFresh.wordEn, vLast.wordEn];
    const seqCorrect = seqArr[seqArr.length - 1];
    items.push({
      id: `${lesson.id}-Q${nextIdx}`,
      lessonId: lesson.id,
      subject: lesson.subject,
      level: 2,
      kind: 'independent',
      qType: 'ordering',
      difficulty: 2,
      prompt: {
        ar: `تحدي مستقل: إذا كان التسلسل يبدأ بـ (${seqArr.slice(0, -1).join(' ➔ ')}) فما الخطوة الأخيرة؟`,
        en: `Independent Check: If the sequence goes (${seqArr.slice(0, -1).join(' -> ')}), what comes last?`,
      },
      options: [
        { id: 'a', label: { ar: seqCorrect, en: seqCorrect }, visual: '🎯' },
        { id: 'b', label: { ar: seqArr[0], en: seqArr[0] }, visual: '🔁' },
        { id: 'c', label: { ar: fallback.d1v.wordEn, en: fallback.d1v.wordEn }, visual: fallback.d1v.emoji },
      ],
      correctOptionId: 'a',
      explanation: {
        ar: `التسلسل الصحيح ينتهي بـ: ${seqCorrect}`,
        en: `The proper sequence ends with: ${seqCorrect}`,
      },
      feedbackCorrect: { ar: 'توقع ذكي وصحيح!', en: 'Smart prediction!' },
      feedbackIncorrect: { ar: 'تتبع البداية خطوة بخطوة.', en: 'Follow the order from step 1.' },
    });
    nextIdx++;
  }

  if (nextIdx <= 7) {
    const matchAct = lesson.activities.find((a) => a.type === 'matching-pairs' && a.pairs?.length);
    const p0 = matchAct?.pairs?.[1] ?? matchAct?.pairs?.[0];
    items.push({
      id: `${lesson.id}-Q${nextIdx}`,
      lessonId: lesson.id,
      subject: lesson.subject,
      level: 2,
      kind: 'independent',
      qType: 'matching',
      difficulty: 2,
      prompt: p0
        ? { ar: `أي بطاقة تناسب (${p0.left}) بشكل صحيح؟`, en: `Which card accurately matches (${p0.left})?` }
        : { ar: `ما الوصف المطابق لـ (${vFresh.wordAr})؟`, en: `Which meaning matches (${vFresh.wordEn})?` },
      options: p0
        ? [
            { id: 'a', label: { ar: p0.right, en: p0.right }, visual: '✅' },
            { id: 'b', label: { ar: fallback.d1v.wordAr, en: fallback.d1v.wordEn }, visual: fallback.d1v.emoji },
            { id: 'c', label: { ar: fallback.d2v.wordAr, en: fallback.d2v.wordEn }, visual: fallback.d2v.emoji },
          ]
        : [
            { id: 'a', label: { ar: `${vFresh.wordEn} — ${vFresh.phoneticHint || ''}`, en: `${vFresh.wordAr} — ${vFresh.phoneticHint || ''}` }, visual: vFresh.emoji },
            { id: 'b', label: { ar: fallback.d1v.wordAr, en: fallback.d1v.wordEn }, visual: fallback.d1v.emoji },
            { id: 'c', label: { ar: fallback.d2v.wordAr, en: fallback.d2v.wordEn }, visual: fallback.d2v.emoji },
          ],
      correctOptionId: 'a',
      explanation: { ar: lesson.teachingContent.ar, en: lesson.teachingContent.en },
      feedbackCorrect: { ar: 'ربط منطقي ممتاز!', en: 'Great logical connection!' },
      feedbackIncorrect: { ar: 'تأمل معنى البطاقة وحاول ثانية.', en: 'Check the meaning carefully.' },
    });
    nextIdx++;
  }

  if (nextIdx <= 8) {
    const exLast = lesson.examples[lesson.examples.length - 1] ?? lesson.examples[0];
    items.push({
      id: `${lesson.id}-Q${nextIdx}`,
      lessonId: lesson.id,
      subject: lesson.subject,
      level: 2,
      kind: 'independent',
      qType: 'picture-id',
      difficulty: 3,
      prompt: {
        ar: `تطبيق مستقل: أي خيار يطابق فكرة (${exLast.title.ar}) — ${exLast.detail.ar}؟`,
        en: `Independent Transfer: Which card demonstrates (${exLast.title.en}) — ${exLast.detail.en}?`,
      },
      options: [
        { id: 'a', label: { ar: `${exLast.title.ar} (${exLast.visual})`, en: `${exLast.title.en} (${exLast.visual})` }, visual: vLast.emoji },
        { id: 'b', label: { ar: `${fallback.d1.title.ar}`, en: `${fallback.d1.title.en}` }, visual: fallback.d1v.emoji },
        { id: 'c', label: { ar: `${fallback.d2.title.ar}`, en: `${fallback.d2.title.en}` }, visual: fallback.d2v.emoji },
      ],
      correctOptionId: 'a',
      explanation: { ar: exLast.detail.ar, en: exLast.detail.en },
      feedbackCorrect: { ar: 'إبداع وإتقان للدرس!', en: 'Wonderful lesson mastery!' },
      feedbackIncorrect: { ar: 'اقرأ التلميح بهدوء واختر المطابق.', en: 'Read the clue calmly and pick the match.' },
    });
  }

  return items;
}

const lessonsBySubject: Record<Level2Subject, Level2LessonDefinition[]> = {
  arabic: ALL_LEVEL2_LESSONS.filter((l) => l.subject === 'arabic'),
  english: ALL_LEVEL2_LESSONS.filter((l) => l.subject === 'english'),
  math: ALL_LEVEL2_LESSONS.filter((l) => l.subject === 'math'),
  'colors-shapes': ALL_LEVEL2_LESSONS.filter((l) => l.subject === 'colors-shapes'),
  logic: ALL_LEVEL2_LESSONS.filter((l) => l.subject === 'logic'),
  'world-around-me': ALL_LEVEL2_LESSONS.filter((l) => l.subject === 'world-around-me'),
};

export const LEVEL2_QUESTION_BANK: Level2QuestionItem[] = ALL_LEVEL2_LESSONS.flatMap((lesson) =>
  buildQuestionsForLesson(lesson, lessonsBySubject),
);

export function getQuestionsForLevel2Lesson(
  lessonId: string,
  kind?: 'practice' | 'independent',
): Level2QuestionItem[] {
  return LEVEL2_QUESTION_BANK.filter((q) => q.lessonId === lessonId && (!kind || q.kind === kind));
}
