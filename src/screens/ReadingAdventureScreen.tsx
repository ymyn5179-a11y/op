import React, { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Lock, Sparkles, Star, Volume2 } from 'lucide-react';
import { EmotionalFeedbackBanner } from '../components/EmotionalFeedbackBanner';
import { NonoLandLogo } from '../components/NonoLandLogo';
import { useNonoLand } from '../context/NonoLandContext';
import { EmotionalFeedbackPayload, Language, LocalizedText, ReadingStageId } from '../types/nonoland';
import { soundEngine } from '../utils/soundEngine';

interface ReadingStageQuestion {
  id: string;
  type: 'tap-letter' | 'listen-word' | 'missing-letter' | 'build-word' | 'picture-match' | 'comprehension';
  prompt: LocalizedText;
  visual?: string;
  audioText?: string;
  audioLang?: Language;
  options: Array<{ id: string; label: string; emoji?: string }>;
  correctId: string;
  wordSlots?: string;
  hint: LocalizedText;
}

interface ReadingStageDef {
  stage: ReadingStageId;
  title: LocalizedText;
  subtitle: LocalizedText;
  emoji: string;
  color: string;
  miniStory?: LocalizedText;
  questions: ReadingStageQuestion[];
}

const READING_STAGES: ReadingStageDef[] = [
  {
    stage: 1,
    title: { ar: '١. تمييز الحروف', en: '1. Letter Recognition' },
    subtitle: { ar: 'حروف عربية وإنجليزية أساسية', en: 'Core Arabic & English letters' },
    emoji: '🔤',
    color: '#FF78B7',
    questions: [
      {
        id: 'r1-1',
        type: 'tap-letter',
        prompt: { ar: 'أين حرف الباء (ب)؟', en: 'Tap the Arabic letter Baa (ب):' },
        options: [
          { id: 'baa', label: 'ب', emoji: '🦆' },
          { id: 'alef', label: 'أ', emoji: '🦁' },
          { id: 'meem', label: 'م', emoji: '🍌' },
        ],
        correctId: 'baa',
        hint: { ar: 'الباء تحته نقطة واحدة مثل بطة!', en: 'Baa has one dot underneath!' },
      },
      {
        id: 'r1-2',
        type: 'tap-letter',
        prompt: { ar: 'اختر الحرف الإنجليزي الكبير M:', en: 'Tap the capital English letter M:' },
        options: [
          { id: 'M', label: 'M', emoji: '🌙' },
          { id: 'W', label: 'W', emoji: '💧' },
          { id: 'S', label: 'S', emoji: '☀️' },
        ],
        correctId: 'M',
        hint: { ar: 'له قمتان متجهتان للأعلى مثل الجبال!', en: 'Two peaks pointing up like mountains!' },
      },
      {
        id: 'r1-3',
        type: 'tap-letter',
        prompt: { ar: 'أين حرف السين (س)؟', en: 'Tap the Arabic letter Seen (س):' },
        options: [
          { id: 'seen', label: 'س', emoji: '🐟' },
          { id: 'sheen', label: 'ش', emoji: '☀️' },
          { id: 'noon', label: 'ن', emoji: '⭐' },
        ],
        correctId: 'seen',
        hint: { ar: 'حرف السين بلا نقاط فوقه!', en: 'Seen has three teeth and zero dots!' },
      },
      {
        id: 'r1-4',
        type: 'tap-letter',
        prompt: { ar: 'اختر الحرف الإنجليزي A (تفاحة Apple):', en: 'Tap the English letter A (Apple):' },
        options: [
          { id: 'A', label: 'A', emoji: '🍎' },
          { id: 'O', label: 'O', emoji: '🍊' },
          { id: 'B', label: 'B', emoji: '🎈' },
        ],
        correctId: 'A',
        hint: { ar: 'يشبه الخيمة أو الصاروخ!', en: 'Looks like a pointy rocket!' },
      },
    ],
  },
  {
    stage: 2,
    title: { ar: '٢. الصوتيات والأصوات', en: '2. Phonics & Sounds' },
    subtitle: { ar: 'ربط الحرف بصوته الواضح', en: 'Connect letters to clear sounds' },
    emoji: '🔊',
    color: '#39BDF2',
    questions: [
      {
        id: 'r2-1',
        type: 'listen-word',
        prompt: { ar: 'استمع للصوت /s/: أي كلمة تبدأ بـ S؟', en: 'Listen to /s/: Which word begins with S?' },
        audioText: 'Sss, Sun',
        audioLang: 'en',
        options: [
          { id: 'sun', label: 'Sun', emoji: '☀️' },
          { id: 'cat', label: 'Cat', emoji: '🐱' },
          { id: 'dog', label: 'Dog', emoji: '🐶' },
        ],
        correctId: 'sun',
        hint: { ar: 'اسمع همس السين الطويل: سْ.. سَن!', en: 'Hear the snake hiss: Sss.. Sun!' },
      },
      {
        id: 'r2-2',
        type: 'listen-word',
        prompt: { ar: 'أي صورة تبدأ بصوت "تَ" (تاء)؟', en: 'Which picture starts with Arabic /t/ (ت)?' },
        audioText: 'تَ.. تفاحة',
        audioLang: 'ar',
        options: [
          { id: 'apple', label: 'تفاحة', emoji: '🍎' },
          { id: 'lion', label: 'أسد', emoji: '🦁' },
          { id: 'fish', label: 'سمكة', emoji: '🐟' },
        ],
        correctId: 'apple',
        hint: { ar: 'تفاحة تبدأ بصوت التاء.', en: 'Tuffaha starts with T!' },
      },
      {
        id: 'r2-3',
        type: 'listen-word',
        prompt: { ar: 'استمع: /b/.. أي صورة تبدأ بـ B؟', en: 'Listen: /b/.. Which starts with B?' },
        audioText: 'Buh, Book',
        audioLang: 'en',
        options: [
          { id: 'book', label: 'Book', emoji: '📖' },
          { id: 'hat', label: 'Hat', emoji: '👒' },
          { id: 'pen', label: 'Pen', emoji: '✏️' },
        ],
        correctId: 'book',
        hint: { ar: 'Book يبدأ بحرف B.', en: 'Book begins with B!' },
      },
      {
        id: 'r2-4',
        type: 'listen-word',
        prompt: { ar: 'أي كلمة تبدأ بصوت "قَ" (قاف)؟', en: 'Which Arabic word starts with /q/ (ق)?' },
        audioText: 'قَ.. قمر',
        audioLang: 'ar',
        options: [
          { id: 'moon', label: 'قمر', emoji: '🌙' },
          { id: 'bird', label: 'عصفور', emoji: '🐦' },
          { id: 'tree', label: 'شجرة', emoji: '🌳' },
        ],
        correctId: 'moon',
        hint: { ar: 'قمر يبدأ بالقاف: قَ.. قمر.', en: 'Qamar means Moon!' },
      },
    ],
  },
  {
    stage: 3,
    title: { ar: '٣. الحركات القصيرة والدمج', en: '3. Short Vowels & Blends' },
    subtitle: { ar: 'الفتحة والضمة والكسرة + a/e/i/o/u', en: 'Short vowels & smooth letter blends' },
    emoji: '✨',
    color: '#8054D9',
    questions: [
      {
        id: 'r3-1',
        type: 'tap-letter',
        prompt: { ar: 'كيف يُقرأ حرف الباء بالفتحة؟', en: 'Pick Baa with Fatha (open "ba" sound):' },
        options: [
          { id: 'ba', label: 'بَ' },
          { id: 'bi', label: 'بِ' },
          { id: 'bu', label: 'بُ' },
        ],
        correctId: 'ba',
        hint: { ar: 'الفتحة شرطة صغيرة فوق الحرف: بَ!', en: 'Fatha is the tiny line above the letter: بَ!' },
      },
      {
        id: 'r3-2',
        type: 'missing-letter',
        prompt: { ar: 'أكمل الصوت الوسط لكلمة دُب (P_T إناء):', en: 'Pick the short vowel for P_T (🍲 Pot):' },
        wordSlots: 'P _ T',
        options: [
          { id: 'O', label: 'O' },
          { id: 'I', label: 'I' },
          { id: 'A', label: 'A' },
        ],
        correctId: 'O',
        hint: { ar: 'قل ببطء: P - O - T = Pot!', en: 'Sound it out: P - O - T = Pot!' },
      },
      {
        id: 'r3-3',
        type: 'tap-letter',
        prompt: { ar: 'اختر الصوت المضموم "مُ":', en: 'Pick Meem with Damma ("mu" sound):' },
        options: [
          { id: 'mu', label: 'مُ' },
          { id: 'ma', label: 'مَ' },
          { id: 'mi', label: 'مِ' },
        ],
        correctId: 'mu',
        hint: { ar: 'الضمة تشبه الواو الصغيرة فوق الحرف.', en: 'Damma looks like a tiny loop above!' },
      },
      {
        id: 'r3-4',
        type: 'missing-letter',
        prompt: { ar: 'أكمل الكلمة: H _ T (قبعة 👒):', en: 'Complete the short vowel: H _ T (👒 Hat):' },
        wordSlots: 'H _ T',
        options: [
          { id: 'A', label: 'A' },
          { id: 'U', label: 'U' },
          { id: 'O', label: 'O' },
        ],
        correctId: 'A',
        hint: { ar: 'H + A + T = Hat!', en: 'H + A + T = Hat!' },
      },
    ],
  },
  {
    stage: 4,
    title: { ar: '٤. المقاطع وبناء الكلمات', en: '4. Syllables & Word Builder' },
    subtitle: { ar: 'أكمل الحرف الناقص وركّب الكلمة', en: 'Fill missing letters & build simple words' },
    emoji: '🧩',
    color: '#55D98B',
    questions: [
      {
        id: 'r4-1',
        type: 'missing-letter',
        prompt: { ar: 'أكمل الكلمة العربية: كَـ _ـب (كتاب 📖):', en: 'Complete the Arabic root: كِتَـ_ب (📖 Book):' },
        wordSlots: 'كِـ تَـ _ ب',
        options: [
          { id: 'alef', label: 'ا' },
          { id: 'baa', label: 'ب' },
          { id: 'seen', label: 'س' },
        ],
        correctId: 'alef',
        hint: { ar: 'نمدّ التاء بألف مدّ: كِتَاب!', en: 'Stretch the Taa with Alef: Kitaab!' },
      },
      {
        id: 'r4-2',
        type: 'build-word',
        prompt: { ar: 'اختر الحرف الناقص لكلمة S _ N (شمس ☀️):', en: 'Pick the missing letter for S _ N (☀️ Sun):' },
        wordSlots: 'S _ N',
        options: [
          { id: 'U', label: 'U' },
          { id: 'E', label: 'E' },
          { id: 'I', label: 'I' },
        ],
        correctId: 'U',
        hint: { ar: 'S + U + N = SUN!', en: 'S + U + N = SUN!' },
      },
      {
        id: 'r4-3',
        type: 'missing-letter',
        prompt: { ar: 'ما أول حرف في كلمة _َمَل (جمل 🐪)؟', en: 'Pick the starting letter of _َمَل (🐪 Camel):' },
        wordSlots: '_ م ل',
        options: [
          { id: 'jeem', label: 'ج' },
          { id: 'haa', label: 'ح' },
          { id: 'khaa', label: 'خ' },
        ],
        correctId: 'jeem',
        hint: { ar: 'حرف الجيم له نقطة في بطنه!', en: 'Jeem has one dot inside!' },
      },
      {
        id: 'r4-4',
        type: 'build-word',
        prompt: { ar: 'اختر الحرف الأول لكلمة _ O G (كلب 🐶):', en: 'Pick the first letter for _ O G (🐶 Dog):' },
        wordSlots: '_ O G',
        options: [
          { id: 'D', label: 'D' },
          { id: 'F', label: 'F' },
          { id: 'B', label: 'B' },
        ],
        correctId: 'D',
        hint: { ar: 'تبدأ بصوت /د/ = D!', en: 'Begins with /d/ sound = D!' },
      },
    ],
  },
  {
    stage: 5,
    title: { ar: '٥. تمييز الكلمات بالصور', en: '5. Word Recognition' },
    subtitle: { ar: 'طابق الكلمة المقروءة مع الصورة', en: 'Match written words to pictures' },
    emoji: '🖼️',
    color: '#FF9360',
    questions: [
      {
        id: 'r5-1',
        type: 'picture-match',
        prompt: { ar: 'اقرأ الكلمة واختر صورتها: "شَجَرَة"', en: 'Read the word and pick its picture: "TREE"' },
        options: [
          { id: 'tree', label: 'شَجَرَة / Tree', emoji: '🌳' },
          { id: 'car', label: 'سَيَّارَة / Car', emoji: '🚗' },
          { id: 'house', label: 'بَيْت / House', emoji: '🏠' },
        ],
        correctId: 'tree',
        hint: { ar: 'كلمة خضراء تنمو في الحديقة!', en: 'Green and tall in the garden!' },
      },
      {
        id: 'r5-2',
        type: 'picture-match',
        prompt: { ar: 'اختر الصورة المناسبة لكلمة: "STAR"', en: 'Pick the matching picture for: "STAR"' },
        options: [
          { id: 'star', label: 'Star', emoji: '⭐' },
          { id: 'cloud', label: 'Cloud', emoji: '☁️' },
          { id: 'flower', label: 'Flower', emoji: '🌸' },
        ],
        correctId: 'star',
        hint: { ar: 'تلمع في سماء الليل!', en: 'Shines in the night sky!' },
      },
      {
        id: 'r5-3',
        type: 'picture-match',
        prompt: { ar: 'اقرأ وطابق: "بَحْر"', en: 'Read & match: "OCEAN / SEA"' },
        options: [
          { id: 'sea', label: 'بَحْر / Sea', emoji: '🌊' },
          { id: 'mountain', label: 'جَبَل / Mountain', emoji: '⛰️' },
          { id: 'fire', label: 'نَار / Fire', emoji: '🔥' },
        ],
        correctId: 'sea',
        hint: { ar: 'أزرق ومليء بالأمواج!', en: 'Blue with gentle waves!' },
      },
      {
        id: 'r5-4',
        type: 'picture-match',
        prompt: { ar: 'طابق الكلمة: "FISH"', en: 'Match the word: "FISH"' },
        options: [
          { id: 'fish', label: 'Fish', emoji: '🐟' },
          { id: 'bird', label: 'Bird', emoji: '🐦' },
          { id: 'bear', label: 'Bear', emoji: '🐻' },
        ],
        correctId: 'fish',
        hint: { ar: 'تسبح في الماء!', en: 'Swims in water!' },
      },
    ],
  },
  {
    stage: 6,
    title: { ar: '٦. الجمل البسيطة', en: '6. Simple Sentences' },
    subtitle: { ar: 'قراءة وفهم جملة من كلمتين أو ثلاث', en: 'Read & understand 2–4 word sentences' },
    emoji: '💬',
    color: '#EC4899',
    questions: [
      {
        id: 'r6-1',
        type: 'comprehension',
        prompt: { ar: 'اقرأ الجملة: "الْقِطُّ يَشْرَبُ الحَلِيبَ 🥛" — ماذا يفعل القط؟', en: 'Read: "The cat drinks milk 🥛." — What does the cat do?' },
        options: [
          { id: 'drinks', label: 'يشرب الحليب / Drinks milk', emoji: '🥛' },
          { id: 'flies', label: 'يطير في السماء / Flies', emoji: '🚀' },
          { id: 'swims', label: 'يقود سيارة / Drives', emoji: '🚗' },
        ],
        correctId: 'drinks',
        hint: { ar: 'انظر للكلمة الثانية في الجملة: يَشْرَبُ.', en: 'Look at the action word: drinks!' },
      },
      {
        id: 'r6-2',
        type: 'comprehension',
        prompt: { ar: 'اقرأ: "The sun is yellow." — ما لون الشمس؟', en: 'Read: "The sun is yellow." — What color is the sun?' },
        options: [
          { id: 'yellow', label: 'أصفر / Yellow', emoji: '🟡' },
          { id: 'blue', label: 'أزرق / Blue', emoji: '🔵' },
          { id: 'green', label: 'أخضر / Green', emoji: '🟢' },
        ],
        correctId: 'yellow',
        hint: { ar: 'الكلمة الأخيرة هي Yellow.', en: 'The last word is yellow!' },
      },
      {
        id: 'r6-3',
        type: 'comprehension',
        prompt: { ar: 'اقرأ: "أنا أقرأ كتاباً جميلاً." — ماذا أقرأ؟', en: 'Read: "I read a nice book." — What do I read?' },
        options: [
          { id: 'book', label: 'كتاباً / A book', emoji: '📖' },
          { id: 'ball', label: 'كرة / A ball', emoji: '⚽' },
          { id: 'cake', label: 'كعكة / Cake', emoji: '🍰' },
        ],
        correctId: 'book',
        hint: { ar: 'كلمة كتاباً تعني Book.', en: 'Look for book!' },
      },
      {
        id: 'r6-4',
        type: 'comprehension',
        prompt: { ar: 'اقرأ: "Lolo jumps high." — من يقفز عالياً؟', en: 'Read: "Lolo jumps high." — Who jumps?' },
        options: [
          { id: 'lolo', label: 'لولو / Lolo', emoji: '🐰' },
          { id: 'leo', label: 'ليو / Leo', emoji: '🦁' },
          { id: 'bobo', label: 'بوبو / Bobo', emoji: '🐻' },
        ],
        correctId: 'lolo',
        hint: { ar: 'الجملة تبدأ باسم صديقتنا لولو.', en: 'The first word is the friend name!' },
      },
    ],
  },
  {
    stage: 7,
    title: { ar: '٧. قصة قصيرة تفاعلية', en: '7. Short Interactive Story' },
    subtitle: { ar: 'اقرأ فقرة قصيرة وأجب عن أحداثها', en: 'Read a mini-story and answer questions' },
    emoji: '📖',
    color: '#0EA5E9',
    miniStory: {
      ar: 'في صباح مشمس ☀️، حمل نونو سلة فواكه حمراء فيها ٣ تفاحات 🍎، وذهب إلى الحديقة ليتقاسمها مع صديقه ليو الأسد 🦁.',
      en: 'On a sunny morning ☀️, Nono carried a red basket with 3 apples 🍎 to the garden to share them with his friend Leo the Lion 🦁.',
    },
    questions: [
      {
        id: 'r7-1',
        type: 'comprehension',
        prompt: { ar: 'ماذا كان يوجد في سلة نونو؟', en: 'What was inside Nono’s basket?' },
        options: [
          { id: 'apples', label: '٣ تفاحات / 3 Apples', emoji: '🍎' },
          { id: 'toys', label: 'سيارات / Toy cars', emoji: '🚗' },
          { id: 'books', label: 'دفاتر / Notebooks', emoji: '📓' },
        ],
        correctId: 'apples',
        hint: { ar: 'فواكه حمراء لذيذة.', en: 'Delicious red fruits!' },
      },
      {
        id: 'r7-2',
        type: 'comprehension',
        prompt: { ar: 'إلى أين ذهب نونو؟', en: 'Where did Nono go?' },
        options: [
          { id: 'garden', label: 'إلى الحديقة / The Garden', emoji: '🌿' },
          { id: 'moon', label: 'إلى القمر / The Moon', emoji: '🌙' },
          { id: 'school', label: 'إلى المطبخ / Kitchen', emoji: '🍳' },
        ],
        correctId: 'garden',
        hint: { ar: 'مكان فيه أشجار وزهور.', en: 'A green outdoor place!' },
      },
      {
        id: 'r7-3',
        type: 'comprehension',
        prompt: { ar: 'مع من تقاسم نونو التفاح؟', en: 'Who did Nono share the apples with?' },
        options: [
          { id: 'leo', label: 'مع ليو الأسد / Leo the Lion', emoji: '🦁' },
          { id: 'whale', label: 'مع الحوت / A Whale', emoji: '🐳' },
          { id: 'robot', label: 'مع روبوت / A Robot', emoji: '🤖' },
        ],
        correctId: 'leo',
        hint: { ar: 'ابحث عن اسم الصديق في نهاية القصة.', en: 'Look at the end of the story!' },
      },
      {
        id: 'r7-4',
        type: 'comprehension',
        prompt: { ar: 'ما القيمة الجميلة في هذه القصة؟', en: 'What kind lesson does this story show?' },
        options: [
          { id: 'sharing', label: 'المشاركة والكرم / Sharing', emoji: '🤝' },
          { id: 'sleep', label: 'النوم طوال اليوم / Sleeping all day', emoji: '😴' },
          { id: 'rush', label: 'الركض السريع / Running fast', emoji: '🏃' },
        ],
        correctId: 'sharing',
        hint: { ar: 'تقاسم نونو الطعام مع صديقه.', en: 'Nono brought apples for both friends!' },
      },
    ],
  },
  {
    stage: 8,
    title: { ar: '٨. الفهم القرائي المتقن', en: '8. Reading Comprehension Mastery' },
    subtitle: { ar: 'استنتاج المعنى والتسلسل والفكرة الرئيسية', en: 'Inference, sequence & main idea mastery' },
    emoji: '🏆',
    color: '#10B981',
    miniStory: {
      ar: 'زرعت لولو بذرة زهرة صغيرة 🌱 في التربة، ثم سقتها بالماء كل صباح 💧 ووضعتها قرب نافذة مشمسة ☀️. وبعد أسبوع، تفتّحت زهرة صفراء جميلة 🌻!',
      en: 'Lolo planted a tiny flower seed 🌱 in the soil, watered it every morning 💧, and placed it near a sunny window ☀️. A week later, a bright yellow sunflower bloomed 🌻!',
    },
    questions: [
      {
        id: 'r8-1',
        type: 'comprehension',
        prompt: { ar: 'ما الخطوة الأولى التي فعلتها لولو؟', en: 'What did Lolo do FIRST?' },
        options: [
          { id: 'seed', label: 'زرعت بذرة / Planted a seed', emoji: '🌱' },
          { id: 'picked', label: 'قطفت الزهرة / Picked the flower', emoji: '✂️' },
          { id: 'painted', label: 'رسمت لوحة / Painted a wall', emoji: '🎨' },
        ],
        correctId: 'seed',
        hint: { ar: 'انظر لأول جملة في القصة.', en: 'Check the very first sentence.' },
      },
      {
        id: 'r8-2',
        type: 'comprehension',
        prompt: { ar: 'ماذا احتاجت الزهرة لتنمو؟', en: 'What did the plant need to grow?' },
        options: [
          { id: 'water-sun', label: 'الماء والشمس والتربة / Soil, water & sun', emoji: '💧' },
          { id: 'snow', label: 'ثلجاً وعلكة / Snow and candy', emoji: '❄️' },
          { id: 'dark', label: 'صندوقاً مظلماً / A dark box', emoji: '📦' },
        ],
        correctId: 'water-sun',
        hint: { ar: 'الماء كل صباح والنافذة المشمسة.', en: 'Water every morning + sunny window!' },
      },
      {
        id: 'r8-3',
        type: 'comprehension',
        prompt: { ar: 'متى تفتّحت الزهرة الصفراء؟', en: 'When did the yellow sunflower bloom?' },
        options: [
          { id: 'week', label: 'بعد أسبوع / After a week', emoji: '📅' },
          { id: 'instant', label: 'في نفس اللحظة / In one second', emoji: '⚡' },
          { id: 'year', label: 'بعد مئة سنة / After 100 years', emoji: '⏳' },
        ],
        correctId: 'week',
        hint: { ar: 'ابحث عن كلمة "بعد..." في السطر الأخير.', en: 'Look at the last sentence!' },
      },
      {
        id: 'r8-4',
        type: 'comprehension',
        prompt: { ar: 'ما الفكرة الرئيسية للقصة؟', en: 'What is the main idea of this story?' },
        options: [
          { id: 'care', label: 'الرعاية والصبر يصنعان النمو / Care & patience help plants grow', emoji: '🌻' },
          { id: 'games', label: 'كيف نلعب الكرة / How to play soccer', emoji: '⚽' },
          { id: 'moon', label: 'السفر للفضاء / Going to space', emoji: '🚀' },
        ],
        correctId: 'care',
        hint: { ar: 'لولو اهتمت بالبذرة يوماً بعد يوم.', en: 'Lolo cared for the seed every morning!' },
      },
    ],
  },
];

export const ReadingAdventureScreen: React.FC = () => {
  const { activeChild, language, recordReadingStage, navigate } = useNonoLand();
  const [selectedStage, setSelectedStage] = useState<ReadingStageId>(1);
  const [qIdx, setQIdx] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState<EmotionalFeedbackPayload | null>(null);
  const [stageSummary, setStageSummary] = useState<{ mastered: boolean; starsAdded: number; accuracy: number } | null>(null);

  const activeStageDef = useMemo(
    () => READING_STAGES.find((s) => s.stage === selectedStage) || READING_STAGES[0],
    [selectedStage],
  );

  if (!activeChild) return null;

  const stageProgress = activeChild.readingStageProgress || {};
  const isStageUnlocked = (stageNum: ReadingStageId): boolean => {
    if (stageNum === 1) return true;
    return Boolean(stageProgress[stageNum - 1]?.mastered);
  };
  const currentQ = activeStageDef.questions[qIdx];

  const selectStage = (stageNum: ReadingStageId) => {
    if (!isStageUnlocked(stageNum)) {
      soundEngine.playEncourage();
      return;
    }
    soundEngine.playPop();
    setSelectedStage(stageNum);
    setQIdx(0);
    setCorrectCount(0);
    setMistakes(0);
    setFeedback(null);
    setStageSummary(null);
  };

  const handleAnswer = async (optId: string) => {
    if (!currentQ || stageSummary) return;
    const isCorrect = optId === currentQ.correctId;

    if (!isCorrect) {
      soundEngine.playEncourage();
      const nextMistakes = mistakes + 1;
      setMistakes(nextMistakes);
      setFeedback({
        tone: nextMistakes >= 2 ? 'simplify' : 'encourage',
        characterId: 'nono',
        title: { ar: 'لنجرّب معاً بتلميح لطيف! 🌟', en: 'Let us try again with a gentle clue! 🌟' },
        message: { ar: 'كل محاولة تبني مهارة القراءة.', en: 'Every try grows your reading superpower!' },
        hintStep: currentQ.hint,
      });
      return;
    }

    soundEngine.playSuccess();
    const nextCorrect = correctCount + 1;
    setCorrectCount(nextCorrect);
    setMistakes(0);
    setFeedback({
      tone: 'celebrate',
      characterId: 'lolo',
      title: { ar: 'قراءة رائعة! ✨', en: 'Super Reading! ✨' },
      message: { ar: 'أحسنت مطابقة الحرف والصوت.', en: 'You matched the sound and meaning!' },
    });

    if (qIdx + 1 < activeStageDef.questions.length) {
      setTimeout(() => {
        setFeedback(null);
        setQIdx(qIdx + 1);
      }, 650);
    } else {
      const total = activeStageDef.questions.length;
      const accuracy = Math.round((nextCorrect / total) * 100);
      const res = await recordReadingStage({
        stage: selectedStage,
        correctCount: nextCorrect,
        totalCount: total,
      });
      setStageSummary({
        mastered: res.mastered,
        starsAdded: res.starsAdded,
        accuracy,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="nono-card p-5 sm:p-6 bg-gradient-to-r from-[#FCE7F3] via-[#F3ECFF] to-[#E5F6FF] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <NonoLandLogo variant="compact" size="md" showWordmark={false} language={language} />
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-xs font-extrabold text-[#8054D9]">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'مسار ٨ مراحل متدرّج' : '8-Stage Progressive Path'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'مغامرة القراءة التفاعلية' : 'Interactive Reading Adventure'}
            </h1>
            <p className="text-xs sm:text-sm font-bold text-[#27345C]/75">
              {language === 'ar'
                ? 'من تمييز الحروف والأصوات إلى قراءة الجمل والقصص وفهم المقروء!'
                : 'From letters and phonics to syllables, simple sentences, stories, and comprehension!'}
            </p>
          </div>
        </div>
        <div className="px-4 py-2.5 rounded-2xl bg-white border border-[#27345C]/10 text-xs font-extrabold text-[#27345C]">
          {language === 'ar'
            ? `المراحل المتقنة: ${Object.values(stageProgress).filter((s) => s.mastered).length} / 8`
            : `Stages Mastered: ${Object.values(stageProgress).filter((s) => s.mastered).length} / 8`}
        </div>
      </div>

      {/* 8-Stage Journey Path */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {READING_STAGES.map((st) => {
          const unlocked = isStageUnlocked(st.stage);
          const prog = stageProgress[st.stage];
          const selected = selectedStage === st.stage;
          return (
            <button
              key={st.stage}
              type="button"
              onClick={() => selectStage(st.stage)}
              className={`p-3.5 rounded-2xl border-2 text-start space-y-1 transition-all ${
                selected
                  ? 'border-[#8054D9] bg-[#F3ECFF] shadow-sm cursor-pointer'
                  : unlocked
                    ? 'border-[#27345C]/12 bg-white hover:border-[#8054D9]/50 cursor-pointer'
                    : 'border-slate-200 bg-slate-50 opacity-65 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{st.emoji}</span>
                {prog?.mastered ? (
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                ) : !unlocked ? (
                  <Lock className="w-4 h-4 text-slate-400" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#8054D9]" />
                )}
              </div>
              <p className="text-xs font-extrabold text-[#27345C] leading-snug">{st.title[language]}</p>
              <p className="text-[11px] font-bold text-[#27345C]/65">{st.subtitle[language]}</p>
            </button>
          );
        })}
      </div>

      {/* Active Stage Workspace */}
      <div className="nono-card p-6 bg-white space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-extrabold text-[#27345C]">{activeStageDef.title[language]}</h2>
            <p className="text-xs font-bold text-[#27345C]/65">
              {language === 'ar'
                ? `التحدي ${qIdx + 1} من ${activeStageDef.questions.length}`
                : `Step ${qIdx + 1} of ${activeStageDef.questions.length}`}
            </p>
          </div>
          {currentQ && (
            <button
              type="button"
              onClick={() =>
                soundEngine.speak(
                  currentQ.audioText || currentQ.prompt[language],
                  currentQ.audioLang || language,
                )
              }
              className="min-h-[42px] px-4 rounded-xl bg-[#E5F6FF] text-[#0369A1] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
              <span>{language === 'ar' ? 'اقرأ بصوت مسموع' : 'Read Aloud'}</span>
            </button>
          )}
        </div>

        {activeStageDef.miniStory && (
          <div className="p-4 rounded-2xl bg-[#FFF8E9] border-2 border-[#FFD84D] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#B45309]">
                {language === 'ar' ? 'اقرأ القصة القصيرة:' : 'Read the Mini-Story:'}
              </span>
              <button
                type="button"
                onClick={() => soundEngine.speak(activeStageDef.miniStory![language], language, { slow: true })}
                className="px-3 py-1 rounded-lg bg-white text-xs font-extrabold text-[#27345C] flex items-center gap-1 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#8054D9]" />
                <span>{language === 'ar' ? 'استمع للقصة' : 'Hear Story'}</span>
              </button>
            </div>
            <p className="text-base font-extrabold text-[#27345C] leading-relaxed">
              {activeStageDef.miniStory[language]}
            </p>
          </div>
        )}

        {stageSummary ? (
          <div className="p-6 rounded-3xl bg-gradient-to-br from-[#ECFDF5] to-[#E5F6FF] text-center space-y-4">
            <div className="text-4xl">🎉</div>
            <h3 className="text-2xl font-extrabold text-[#27345C]">
              {stageSummary.mastered
                ? language === 'ar'
                  ? 'أحسنت! أتقنت هذه المرحلة القرائية!'
                  : 'Bravo! You mastered this reading stage!'
                : language === 'ar'
                  ? 'محاولة رائعة! لنحاول مجدداً لإتقان المرحلة'
                  : 'Great practice! Try once more to unlock the next stage'}
            </h3>
            <p className="text-sm font-bold text-[#27345C]/80">
              {language === 'ar'
                ? `الدقة: ${stageSummary.accuracy}% · +${stageSummary.starsAdded} نجوم ⭐`
                : `Accuracy: ${stageSummary.accuracy}% · +${stageSummary.starsAdded} Stars ⭐`}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {stageSummary.mastered && selectedStage < 8 && (
                <button
                  type="button"
                  onClick={() => selectStage((selectedStage + 1) as ReadingStageId)}
                  className="min-h-[46px] px-6 rounded-2xl bg-[#8054D9] text-white font-extrabold flex items-center gap-2 cursor-pointer"
                >
                  <Star className="w-4 h-4 fill-current" />
                  <span>{language === 'ar' ? `المرحلة التالية (${selectedStage + 1})` : `Next Stage (${selectedStage + 1})`}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => selectStage(selectedStage)}
                className="min-h-[46px] px-5 rounded-2xl bg-white border border-[#27345C]/15 font-extrabold text-[#27345C] cursor-pointer"
              >
                {language === 'ar' ? 'إعادة المرحلة' : 'Practice Again'}
              </button>
            </div>
          </div>
        ) : (
          currentQ && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#27345C]/10 text-center space-y-2">
                <p className="text-lg sm:text-xl font-extrabold text-[#27345C]">{currentQ.prompt[language]}</p>
                {currentQ.wordSlots && (
                  <p className="text-3xl font-extrabold tracking-widest text-[#8054D9] py-2">
                    {currentQ.wordSlots}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {currentQ.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => void handleAnswer(opt.id)}
                    className="min-h-[82px] p-4 rounded-2xl bg-white hover:bg-[#F3ECFF] border-2 border-[#27345C]/15 hover:border-[#8054D9] flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    {opt.emoji && <span className="text-3xl">{opt.emoji}</span>}
                    <span className="text-lg font-extrabold text-[#27345C]">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        <EmotionalFeedbackBanner feedback={feedback} language={language} onNavigate={navigate} />
      </div>
    </div>
  );
};
