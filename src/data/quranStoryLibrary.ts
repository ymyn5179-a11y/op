import type {
  QuranStoryAdminOverride,
  QuranStorySpec,
} from '../types/nonoland';

/**
 * Curated Quran Stories Library for Children Aged 1-4 (حكايات من القرآن)
 *
 * STRICT RELIGIOUS SAFETY & AUTHENTICITY RULES:
 * 1. Zero depiction of Prophets, Messengers, or human figures (scenes use only nature,
 *    animals, architecture, skies, rivers, and symbolic motifs).
 * 2. Narrative storytelling is strictly separated from Quranic verses.
 * 3. No invented Quran verses, hadith, or unconfirmed quotes/conversations.
 * 4. Every story explicitly separates `establishedQuranicFacts` from `simplifiedExplanation`.
 */
export const QURAN_STORY_LIBRARY: QuranStorySpec[] = [
  {
    id: 'qstory-elephant',
    order: 1,
    title: {
      ar: 'أصحاب الفيل',
      en: 'The People of the Elephant',
    },
    description: {
      ar: 'كيف حفظ الله بيته الحرام الكعبة بالطيور الصغيرة، لأن الله القوي يحفظ الخير دائماً.',
      en: 'How Allah protected the Sacred Kaaba with little birds, teaching toddlers that Allah protects goodness.',
    },
    durationSeconds: 195,
    recommendedMinBand: '1-2',
    coverImage: '/src/assets/images/story_elephant_birds_1795276482462.jpg',
    symbolicTheme: 'birds-protection',
    symbolicElements: ['kaaba-sanctuary', 'desert-hills', 'flock-of-birds', 'golden-sunbeam'],
    prohibitsProphetDepiction: true,
    surahReferences: [
      {
        surahNumber: 105,
        surahNameAr: 'سورة الفيل',
        surahNameEn: 'Surah Al-Fil',
        ayahRange: '105:1–5',
      },
    ],
    establishedQuranicFacts: [
      {
        ar: 'ذكر الله تعالى في سورة الفيل أنه حمى بيته الحرام في مكة، وأرسل طيراً أبابيل.',
        en: 'Surah Al-Fil confirms that Allah protected His Sacred House in Mecca and sent flocks of birds (Tayran Ababil).',
      },
    ],
    simplifiedExplanation: {
      ar: 'سرد تعليمي هادئ يبرز قدرة الله ورعايته لبيت الله الحرام مع مشاهد رمزية للكعبة والسماء والطيور.',
      en: 'Calm age-adapted storytelling highlighting Allah’s care for the Sacred House with symbolic Kaaba, sky, and bird scenery.',
    },
    ageSummary: {
      young: {
        ar: 'الكعبة بيت الله الجميل، وحماه الله بطيور صغيرة تطير في السماء.',
        en: 'The Kaaba is Allah’s beautiful house, and Allah kept it safe with little birds in the sky.',
      },
      mid: {
        ar: 'أراد جيش مع فيل كبير الاقتراب من الكعبة بسوء، فحفظ الله بيته الحرام وأرسل طيوراً تحميه بقدرته.',
        en: 'When an army with a big elephant approached the Kaaba, Allah kept His Sacred House safe and sent little birds.',
      },
      older: {
        ar: 'تروي سورة الفيل قصة أصحاب الفيل الذين أرادوا هدم الكعبة، فحمى الله بيته وأرسل عليهم طيراً أبابيل لتبقى مكة آمنة.',
        en: 'Surah Al-Fil teaches us how Allah protected the Sacred Kaaba when an army approached, reminding us real protection comes from Allah.',
      },
    },
    narrationNote: {
      ar: 'سرد قصصي مبسّط — منفصل تماماً عن تلاوة آيات القرآن الكريم.',
      en: 'Educational storytelling narration — strictly separate from Quranic recitation.',
    },
    quotedVerse: {
      surahId: 'surah-105',
      verseKey: '105:3',
      textUthmani: 'وَأَرْسَلَ عَلَيْهِمْ طَيْرًا أَبَابِيلَ',
    },
    moralLesson: {
      ar: 'الله القوي يحفظ بيته ويحفظ من يتوكل عليه.',
      en: 'Allah is strong and protects those who trust in Him.',
    },
    publishedStatus: 'published',
    enabled: true,
    scenes: [
      {
        id: 'elephant-s1',
        order: 1,
        phase: 'intro',
        title: { ar: 'بيت الله الآمن في مكة', en: 'The Peaceful Kaaba in Mecca' },
        durationSeconds: 36,
        illustrationKey: 'elephant-kaaba-dawn',
        sfxCue: 'dawn',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'انظروا! هذه الكعبة الجميلة في مكة، مكان هادئ ومبارك يحبه المسلمون.',
            en: 'Look! Here is the peaceful Kaaba in Mecca, a blessed place loved by Muslims.',
          },
          mid: {
            ar: 'في قلب وادي مكة الهادئ تقف الكعبة المشرفة، بيت الله الحرام الذي يجتمع حوله الناس بسلام.',
            en: 'In the calm valley of Mecca stands the Sacred Kaaba, Allah’s blessed house surrounded by peace.',
          },
          older: {
            ar: 'منذ زمن طويل، كانت الكعبة المشرفة في مكة بيتاً مباركاً يحترمه الناس ويدعون الله عنده بأمان.',
            en: 'Long ago, the Sacred Kaaba in Mecca stood as a blessed house of peace where people prayed safely to Allah.',
          },
        },
      },
      {
        id: 'elephant-s2',
        order: 2,
        phase: 'middle',
        title: { ar: 'قصة الفيل الكبير', en: 'The Approaching Elephant' },
        durationSeconds: 40,
        illustrationKey: 'elephant-hills-stop',
        sfxCue: 'cave',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'جاء فيل كبير في الطريق، لكن الفيل وقف هادئاً ولم يؤذِ الكعبة.',
            en: 'A big elephant came down the path, yet the elephant stopped calmly and did not harm the Kaaba.',
          },
          mid: {
            ar: 'اقترب أبرهة ومعه فيل ضخم قاصداً الكعبة، لكن الله حفظ بيته، فتوقف الفيل في الطريق.',
            en: 'An army with a large elephant approached the Kaaba, yet Allah protected His house and the elephant halted along the way.',
          },
          older: {
            ar: 'أراد أبرهة وجيشه وفيله الكبير هدم الكعبة، فاعتمد أهل مكة على الله الذي يحفظ بيته الحرام.',
            en: 'An army with a huge elephant wanted to harm the Kaaba, while the people of Mecca trusted Allah to protect His house.',
          },
        },
      },
      {
        id: 'elephant-s3',
        order: 3,
        phase: 'middle',
        title: { ar: 'الطيور في السماء', en: 'Little Birds in the Sky' },
        durationSeconds: 42,
        illustrationKey: 'elephant-birds-sky',
        sfxCue: 'birds',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'أرسل الله طيوراً كثيرة في السماء لتحمي الكعبة! اضغطوا على الطيور اللطيفة.',
            en: 'Allah sent many little birds in the sky to protect the Kaaba! Tap the gentle birds.',
          },
          mid: {
            ar: 'أرسل الله من السماء أسراباً من الطيور لتحفظ الكعبة المشرفة. هيا نلمس الطيور في السماء!',
            en: 'Allah sent flocks of birds across the sky to keep the Kaaba safe. Let us tap the birds in the sky!',
          },
          older: {
            ar: 'أرسل الله طيراً أبابيل بأمره الكريم لتحمي البيت الحرام، فظهرت قدرة الله في حفظ مكة.',
            en: 'By Allah’s command, flocks of birds flew overhead to protect the Sacred House, showing Allah’s care for Mecca.',
          },
        },
        activity: {
          id: 'act-elephant-birds',
          type: 'tap-targets',
          title: { ar: 'ساعد الطيور على التحليق فوق الكعبة', en: 'Tap the Little Birds in the Sky' },
          instruction: {
            ar: 'اضغط على ٣ طيور في السماء لتشاهد كيف أرسلها الله لحفظ بيته',
            en: 'Tap 3 little birds in the sky to see Allah’s protection',
          },
          successMessage: {
            ar: 'أحسنت! الله يحفظ بيته الحرام بقدرته.',
            en: 'Well done! Allah protects His Sacred House.',
          },
          retryMessage: {
            ar: 'هذه سحابة لطيفة! حاول مرة أخرى واضغط على الطيور.',
            en: 'That is a soft cloud! Try tapping the little birds.',
          },
          requiredCount: 3,
          items: [
            { id: 'b1', label: { ar: 'طائر صغير', en: 'Little Bird' }, emoji: '🕊️', xPct: 22, yPct: 26, isTarget: true },
            { id: 'b2', label: { ar: 'طائر مغرد', en: 'Sky Bird' }, emoji: '🐦', xPct: 50, yPct: 18, isTarget: true },
            { id: 'b3', label: { ar: 'طائر محلق', en: 'Flying Bird' }, emoji: '🕊️', xPct: 76, yPct: 28, isTarget: true },
            { id: 'c1', label: { ar: 'غيمة بيضاء', en: 'Soft Cloud' }, emoji: '☁️', xPct: 35, yPct: 45, isTarget: false },
          ],
        },
      },
      {
        id: 'elephant-s4',
        order: 4,
        phase: 'middle',
        title: { ar: 'أمان وسلام في مكة', en: 'Peace & Safety Return' },
        durationSeconds: 40,
        illustrationKey: 'elephant-peace-sun',
        sfxCue: 'chime',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'بقيت الكعبة آمنة ونظيفة ومشرقة بنور الشمس.',
            en: 'The Kaaba stayed safe, bright, and peaceful under the warm sun.',
          },
          mid: {
            ar: 'عادت السكينة والأمان إلى مكة كلها، وبقيت الكعبة بيتاً محفوظاً ببركة الله.',
            en: 'Peace and calm filled all of Mecca, and the Sacred Kaaba remained safe under Allah’s blessing.',
          },
          older: {
            ar: 'فشل المعتدون وعاد الأمان إلى البيت الحرام، لنتعلم أن القوة الحقيقية هي التوكل على الله.',
            en: 'Harm was turned away and peace returned to the Sacred House, teaching us to rely upon Allah.',
          },
        },
        activity: {
          id: 'act-elephant-kindness',
          type: 'match-kindness',
          title: { ar: 'ما الذي يحبه الله؟', en: 'What Brings Peace & Blessing?' },
          instruction: {
            ar: 'اختر الفعل الطيب الذي يدل على محبة بيت الله واللطف بالآخرين',
            en: 'Choose the kind action that respects Allah’s House and spreads peace',
          },
          successMessage: {
            ar: 'ممتاز! نحترم الأماكن المقدسة وننشر السلام.',
            en: 'Wonderful! We respect sacred places and spread peace.',
          },
          retryMessage: {
            ar: 'حاول مرة أخرى! ابحث عن العمل الهادئ واللطيف.',
            en: 'Try again gently! Look for the calm and kind action.',
          },
          choices: [
            { id: 'k1', label: { ar: 'الدعاء بهدوء وحب الخير للناس', en: 'Praying calmly and wishing goodness' }, emoji: '🤲', isKindMatch: true },
            { id: 'k2', label: { ar: 'الإزعاج وإتلاف الأشياء', en: 'Making loud noise and breaking things' }, emoji: '💥', isKindMatch: false },
          ],
        },
      },
      {
        id: 'elephant-s5',
        order: 5,
        phase: 'ending',
        title: { ar: 'حمداً لله الحافظ', en: 'Thanking Allah the Protector' },
        durationSeconds: 37,
        illustrationKey: 'elephant-kaaba-dawn',
        sfxCue: 'chime',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'نقول دائماً: الحمد لله، فالله يحفظنا كل يوم.',
            en: 'We always say Alhamdulillah, because Allah watches over us every day.',
          },
          mid: {
            ar: 'نتعلم من قصة أصحاب الفيل أن ندعو الله الحافظ في الصباح والمساء ونشكره على نعمة الأمان.',
            en: 'From this story we learn to ask Allah for protection morning and night and thank Him for safety.',
          },
          older: {
            ar: 'ختم الله القصة في سورة الفيل بعبرة عظيمة: من يحفظ بيته يحفظ المؤمنين الصادقين.',
            en: 'Surah Al-Fil ends with a timeless lesson: the One who protected the Kaaba protects sincere believers.',
          },
        },
      },
    ],
    closingQuiz: {
      question: {
        ar: 'بماذا حمى الله بيته الكعبة في قصة أصحاب الفيل؟',
        en: 'What did Allah send in the sky in the story of Al-Fil?',
      },
      options: [
        { id: 'opt-birds', label: { ar: 'بطيور صغيرة في السماء', en: 'Little birds in the sky' }, emoji: '🕊️', isCorrect: true },
        { id: 'opt-fish', label: { ar: 'بأسماك في البحر', en: 'Fish in the sea' }, emoji: '🐟', isCorrect: false },
      ],
      successFeedback: { ar: 'أحسنت! أرسل الله طيوراً أبابيل لحفظ الكعبة.', en: 'Great job! Allah sent flocks of birds to protect the Kaaba.' },
      retryFeedback: { ar: 'تذكر السماء فوق الكعبة! حاول مرة أخرى.', en: 'Remember the sky above the Kaaba! Try again.' },
    },
    closingActivity: {
      prompt: { ar: 'اضغط على القلب الشاكر لنقول: الحمد لله الذي يحفظنا', en: 'Tap the grateful heart to say: Alhamdulillah' },
      actionLabel: { ar: 'الحمد لله الحافظ 🤍', en: 'Alhamdulillah 🤍' },
      rewardEmoji: '🕋',
      completionPhrase: { ar: 'بارك الله فيك! الله يحفظ بيته ويحفظ الأطفال الطيبين.', en: 'MashaAllah! Allah protects His House and kind children.' },
    },
    completionBadge: {
      id: 'badge-elephant',
      title: { ar: 'وسام الكعبة الآمنة', en: 'Kaaba Safety Badge' },
      icon: '🕋',
    },
  },

  {
    id: 'qstory-nuh-ark',
    order: 2,
    title: {
      ar: 'سفينة سيدنا نوح عليه السلام',
      en: 'The Ark of Prophet Nuh',
    },
    description: {
      ar: 'سفينة خشبية دافئة بناها سيدنا نوح بأمر الله لتحمل المؤمنين وأزواج الحيوانات بأمان.',
      en: 'A grand wooden ark built by Allah’s command to carry believers and gentle animal pairs safely across the water.',
    },
    durationSeconds: 235,
    recommendedMinBand: '1-2',
    coverImage: '/src/assets/images/story_nuh_ark_clean_1795276498796.jpg',
    symbolicTheme: 'olive-ark',
    symbolicElements: ['wooden-ark', 'animal-pairs', 'calm-waves', 'rainbow-arc', 'olive-leaf'],
    prohibitsProphetDepiction: true,
    surahReferences: [
      {
        surahNumber: 11,
        surahNameAr: 'سورة هود',
        surahNameEn: 'Surah Hud',
        ayahRange: '11:36–48',
      },
      {
        surahNumber: 71,
        surahNameAr: 'سورة نوح',
        surahNameEn: 'Surah Nuh',
        ayahRange: '71:1–4',
      },
    ],
    establishedQuranicFacts: [
      {
        ar: 'دعا نبي الله نوح عليه السلام قومه إلى عبادة الله وحده بصبر طويل، ثم أوحى الله إليه أن يصنع الفلك (السفينة) ويحمل فيها من كل زوجين اثنين.',
        en: 'The Quran states Prophet Nuh (AS) called his people patiently and built the ark by Allah’s revelation, carrying pairs of creatures and believers safely.',
      },
    ],
    simplifiedExplanation: {
      ar: 'مشاهد رمزية للسفينة الخشبية والأمواج والحيوانات اللطيفة وغصن الزيتون بدون أي تصوير بشري للأنبياء.',
      en: 'Symbolic wooden ark, calm waves, friendly animals, and olive leaf — zero depiction of Prophets.',
    },
    ageSummary: {
      young: {
        ar: 'سفينة خشبية كبيرة حملت الحيوانات اللطيفة والمؤمنين بأمان في الماء.',
        en: 'A big cozy wooden ark carried friendly animals and good people safely over the water.',
      },
      mid: {
        ar: 'صنع نبي الله نوح عليه السلام سفينة واسعة بأمر الله، ودخلتها أزواج من الحيوانات والطيور حتى هدأت الأمواج.',
        en: 'Prophet Nuh (AS) built a wide ark by Allah’s command, sheltering pairs of animals and birds until calm waters returned.',
      },
      older: {
        ar: 'دعا سيدنا نوح عليه السلام قومه بصبر عظيم، ثم ركب المؤمنون وزوجان من كل كائن في السفينة فنجاهم الله برحمته.',
        en: 'After patient calling to Allah, believers and pairs from every creature boarded the ark and Allah saved them with His mercy.',
      },
    },
    narrationNote: {
      ar: 'سرد قصصي هادئ بالرسوم الرمزية — لا يظهر فيه الأنبياء.',
      en: 'Calm symbolic storytelling — no Prophets are ever visually depicted.',
    },
    moralLesson: {
      ar: 'الصبر، وطاعة الله، والرفق بالحيوانات تجلب السلامة.',
      en: 'Patience, trusting Allah, and kindness to animals bring safety.',
    },
    publishedStatus: 'published',
    enabled: true,
    scenes: [
      {
        id: 'nuh-s1',
        order: 1,
        phase: 'intro',
        title: { ar: 'صناعة السفينة بأمر الله', en: 'Building the Ark by Allah’s Command' },
        durationSeconds: 44,
        illustrationKey: 'nuh-wood-ark',
        sfxCue: 'forest',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'بنى سيدنا نوح سفينة خشبية كبيرة وقوية بأمر الله لتكون بيتاً آمناً.',
            en: 'Prophet Nuh built a big, strong wooden boat by Allah’s command to be a safe home.',
          },
          mid: {
            ar: 'أمر الله نبيه نوحاً عليه السلام أن يصنع سفينة كبيرة من الخشب القوي ليركب فيها المؤمنون بأمان.',
            en: 'Allah guided Prophet Nuh (AS) to craft a strong wooden ark where believers would stay safe.',
          },
          older: {
            ar: 'بعد دعوة طويلة وصبر جميل، أوحى الله إلى نوح عليه السلام أن يصنع الفلك برعاية الله وعنايته.',
            en: 'After patient invitation to goodness, Allah revealed to Nuh (AS) to build the ark under Allah’s watchful care.',
          },
        },
      },
      {
        id: 'nuh-s2',
        order: 2,
        phase: 'middle',
        title: { ar: 'دخول الحيوانات أزواجاً', en: 'Animals Boarding in Pairs' },
        durationSeconds: 50,
        illustrationKey: 'nuh-animal-pairs',
        sfxCue: 'birds',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'دخلت الخراف والزرافات والطيور في أزواج لطيفة داخل السفينة! ساعدهم في الصعود.',
            en: 'Gentle sheep, giraffes, and birds walked into the ark in pairs! Help them board.',
          },
          mid: {
            ar: 'ركب في السفينة من كل نوع زوجان اثنان برفق ونظام، كما أمر الله سبحانه وتعالى.',
            en: 'Pairs of every creature boarded the ark gently and calmly just as Allah commanded.',
          },
          older: {
            ar: 'أمر الله أن يُحمل في السفينة من كل كائن زوجان لحفظ الحياة على الأرض برحمة الله.',
            en: 'Allah commanded pairs of creatures to be carried in the ark to preserve life upon the earth with His mercy.',
          },
        },
        activity: {
          id: 'act-nuh-pairs',
          type: 'place-pairs',
          title: { ar: 'اركبوا السفينة بأمان', en: 'Help the Animal Pairs Board the Ark' },
          instruction: {
            ar: 'اضغط على كل زوج من الحيوانات اللطيفة ليدخل إلى السفينة الآمنة',
            en: 'Tap each gentle animal pair to welcome them safely onto the wooden ark',
          },
          successMessage: {
            ar: 'رائع! كل الأزواج داخل السفينة بأمان وسلام.',
            en: 'Wonderful! Every animal pair is safely aboard the ark.',
          },
          retryMessage: {
            ar: 'هيا نكمل مساعدة كل الحيوانات اللطيفة!',
            en: 'Let us help the rest of the friendly animals board!',
          },
          destinationLabel: { ar: 'سفينة السلامة', en: 'Safe Wooden Ark' },
          items: [
            { id: 'pair-sheep', label: { ar: 'خروفان لطيفان', en: 'Two Little Sheep' }, emoji: '🐑🐑', pairCountLabel: { ar: 'زوج ١', en: 'Pair 1' } },
            { id: 'pair-giraffe', label: { ar: 'زرافتان طويلتان', en: 'Two Tall Giraffes' }, emoji: '🦒🦒', pairCountLabel: { ar: 'زوج ٢', en: 'Pair 2' } },
            { id: 'pair-dove', label: { ar: 'حمامتان بيضاوان', en: 'Two White Doves' }, emoji: '🕊️🕊️', pairCountLabel: { ar: 'زوج ٣', en: 'Pair 3' } },
          ],
        },
      },
      {
        id: 'nuh-s3',
        order: 3,
        phase: 'middle',
        title: { ar: 'الإبحار بسم الله', en: 'Sailing with Bismillah' },
        durationSeconds: 46,
        illustrationKey: 'nuh-calm-waves',
        sfxCue: 'waves',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'تسير السفينة فوق الماء بهدوء، والجميع يقولون: بسم الله.',
            en: 'The ark glides softly over the blue waves while everyone says Bismillah.',
          },
          mid: {
            ar: 'نزل المطر وارتفعت المياه، لكن السفينة ظلت آمنة فوق الأمواج برعاية الله وباسم الله مجراها.',
            en: 'Rain fell and water rose, yet the ark sailed safely over the waves in Allah’s care, moving in the name of Allah.',
          },
          older: {
            ar: 'انطلقت السفينة بين الأمواج باسم الله مجراها ومرساها، محاطة بحفظ الله ولطفه.',
            en: 'The ark sailed through the waters in the name of Allah as its course and anchor, surrounded by Allah’s mercy.',
          },
        },
      },
      {
        id: 'nuh-s4',
        order: 4,
        phase: 'middle',
        title: { ar: 'الأرض الخضراء وأشعة الشمس', en: 'Calm Skies & Green Earth' },
        durationSeconds: 48,
        illustrationKey: 'nuh-olive-rainbow',
        sfxCue: 'dawn',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'توقفت الأمطار وظهر قوس ألوان جميل وغصن أخضر! المس السماء المشرقة.',
            en: 'Rain stopped and a gentle rainbow and green olive leaf appeared! Tap the bright signs.',
          },
          mid: {
            ar: 'أشرقت الشمس وهدأ الماء وعاد النور يملأ السماء مع غصن الزيتون الأخضر.',
            en: 'The sun shone warmly, waters grew calm, and bright light returned along with a green olive branch.',
          },
          older: {
            ar: 'بأمر الله، هدأت السماء وابتلعت الأرض الماء، ورست السفينة بسلام لتبدأ حياة مليئة بالشكر.',
            en: 'By Allah’s command the sky cleared and waters subsided, resting the ark safely to begin anew with gratitude.',
          },
        },
        activity: {
          id: 'act-nuh-peace-signs',
          type: 'tap-targets',
          title: { ar: 'اكتشف علامات الأمان والربيع', en: 'Find Signs of Calm & Green Life' },
          instruction: {
            ar: 'اضغط على الغصن الأخضر والشمس الدافئة وقوس الألوان في المشهد',
            en: 'Tap the green olive branch, warm sun, and rainbow of safety',
          },
          successMessage: {
            ar: 'ممتاز! عاد الأمان والأرض الخضراء برحمة الله.',
            en: 'Awesome! Peace and green land returned by Allah’s mercy.',
          },
          retryMessage: {
            ar: 'هذه موجة لطيفة! ابحث عن الغصن الأخضر والشمس.',
            en: 'That is a gentle wave! Look for the olive leaf and warm sun.',
          },
          requiredCount: 3,
          items: [
            { id: 'n1', label: { ar: 'غصن زيتون أخضر', en: 'Green Olive Leaf' }, emoji: '🌿', xPct: 72, yPct: 35, isTarget: true },
            { id: 'n2', label: { ar: 'شمس مشرقة', en: 'Warm Sun' }, emoji: '☀️', xPct: 22, yPct: 22, isTarget: true },
            { id: 'n3', label: { ar: 'قوس ألوان هادئ', en: 'Gentle Rainbow' }, emoji: '🌈', xPct: 54, yPct: 20, isTarget: true },
            { id: 'n4', label: { ar: 'موجة ماء', en: 'Ocean Wave' }, emoji: '🌊', xPct: 38, yPct: 78, isTarget: false },
          ],
        },
      },
      {
        id: 'nuh-s5',
        order: 5,
        phase: 'ending',
        title: { ar: 'الهبوط بسلام وشكر الله', en: 'Landing in Peace & Gratitude' },
        durationSeconds: 47,
        illustrationKey: 'nuh-wood-ark',
        sfxCue: 'chime',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'نزلت الحيوانات والمؤمنون على الأرض بسلام وقالوا: الحمد لله.',
            en: 'Animals and good people stepped onto safe dry land saying Alhamdulillah.',
          },
          mid: {
            ar: 'رست السفينة بسلام، ونزل المؤمنون والحيوانات شاكرين الله على نجاتهم وعنايته.',
            en: 'The ark came safely to rest, and believers and creatures stepped out thanking Allah for His care.',
          },
          older: {
            ar: 'نزلت سفينة نوح بسلام وبركة من الله، لتعلمنا أن الصبر واللطف بالكائنات طريقهما الأمان.',
            en: 'Prophet Nuh’s ark landed with peace and blessings from Allah, teaching us patience and care for all creatures.',
          },
        },
      },
    ],
    closingQuiz: {
      question: {
        ar: 'كيف دخلت الحيوانات إلى سفينة سيدنا نوح عليه السلام؟',
        en: 'How did the animals enter Prophet Nuh’s safe ark?',
      },
      options: [
        { id: 'nuh-q1', label: { ar: 'أزواجاً لطيفة بأمان', en: 'In gentle pairs safely' }, emoji: '🦒🦒', isCorrect: true },
        { id: 'nuh-q2', label: { ar: 'تسبح وحدها في العاصفة', en: 'Swimming alone in storms' }, emoji: '🌪️', isCorrect: false },
      ],
      successFeedback: { ar: 'أحسنت! دخلت الحيوانات أزواجاً بأمان في السفينة.', en: 'Well done! The animals entered in safe pairs.' },
      retryFeedback: { ar: 'فكّر كيف ركبت الخراف والطيور معاً! حاول مجدداً.', en: 'Think about how the sheep and doves boarded together! Try again.' },
    },
    closingActivity: {
      prompt: { ar: 'قل معنا عند ركوب أي شيء أو بدء يومنا: بسم الله', en: 'Tap to say Bismillah as we begin safely' },
      actionLabel: { ar: 'بسم الله مجراها ⛵', en: 'Bismillah ⛵' },
      rewardEmoji: '🌿',
      completionPhrase: { ar: 'رائع! الله يحفظ الصابرين والرحماء بالحيوانات.', en: 'Wonderful! Allah cares for the patient and those kind to animals.' },
    },
    completionBadge: {
      id: 'badge-nuh-ark',
      title: { ar: 'وسام سفينة السلامة', en: 'Safe Ark Badge' },
      icon: '⛵',
    },
  },

  {
    id: 'qstory-yunus',
    order: 3,
    title: {
      ar: 'سيدنا يونس والحوت',
      en: 'Prophet Yunus & The Gentle Whale',
    },
    description: {
      ar: 'قصة الدعاء الجميل في البحر الهادئ، وكيف يستجيب الله لمن يذكره ويثق برحمته.',
      en: 'A gentle ocean story about calling upon Allah with sincerity and how Allah’s mercy brings light and calm.',
    },
    durationSeconds: 210,
    recommendedMinBand: '1-2',
    coverImage: '/src/assets/images/story_yunus_whale_1795276482020.jpg',
    symbolicTheme: 'whale-sea',
    symbolicElements: ['blue-whale', 'starry-sea', 'coral-bubbles', 'gourd-vine'],
    prohibitsProphetDepiction: true,
    surahReferences: [
      {
        surahNumber: 37,
        surahNameAr: 'سورة الصافات',
        surahNameEn: 'Surah As-Saffat',
        ayahRange: '37:139–148',
      },
      {
        surahNumber: 21,
        surahNameAr: 'سورة الأنبياء',
        surahNameEn: 'Surah Al-Anbiya',
        ayahRange: '21:87–88',
      },
    ],
    establishedQuranicFacts: [
      {
        ar: 'ابتلع الحوت نبي الله يونس عليه السلام في البحر بأمر الله، فسبّح الله ودعاه بصدق، فاستجاب الله له ونجاه وأنبت عليه شجرة من يقطين.',
        en: 'The Quran confirms Prophet Yunus (AS) glorified and called upon Allah from within the whale, and Allah answered him, brought him safely to shore, and grew a gourd vine over him.',
      },
    ],
    simplifiedExplanation: {
      ar: 'رسوم هادئة للبحر الأزرق والحوت اللطيف والشاطئ ونبات اليقطين دون أي تصوير بشري.',
      en: 'Peaceful illustrations of the ocean, gentle whale, sandy shore, and gourd vine — zero human figures.',
    },
    ageSummary: {
      young: {
        ar: 'حوت كبير لطيف في البحر، ودعاء جميل سمعه الله فأخرجه إلى الشاطئ الدافئ.',
        en: 'A gentle big whale in the sea, a sweet prayer heard by Allah, and a warm safe shore.',
      },
      mid: {
        ar: 'في قلب البحر العميق، دعا سيدنا يونس عليه السلام ربه وسبّحه، فسمعه الله اللطيف ونجاه وأظله بنبتة اليقطين الخضراء.',
        en: 'Deep in the sea, Prophet Yunus (AS) praised and prayed to Allah; Allah heard him, saved him onto the shore, and shaded him with a green gourd vine.',
      },
      older: {
        ar: 'تعلمنا قصة نبي الله يونس عليه السلام ألا نيأس أبداً، وأن نذكر الله ونستغفره دائماً لأنه سميع رحيم.',
        en: 'Prophet Yunus’s story teaches us never to lose hope and always turn to Allah, Who hears and cares with mercy.',
      },
    },
    narrationNote: {
      ar: 'حكاية تربوية لطيفة — رسوم بحرية ونباتية رمزية فقط.',
      en: 'Gentle educational story — symbolic sea and plant illustrations only.',
    },
    moralLesson: {
      ar: 'الله يسمع دعاءنا في كل مكان ويحيطنا برحمته.',
      en: 'Allah hears our prayers everywhere and surrounds us with mercy.',
    },
    publishedStatus: 'published',
    enabled: true,
    scenes: [
      {
        id: 'yunus-s1',
        order: 1,
        phase: 'intro',
        title: { ar: 'سفينة فوق البحر الواسع', en: 'A Boat on the Wide Blue Sea' },
        durationSeconds: 38,
        illustrationKey: 'yunus-ocean-twilight',
        sfxCue: 'waves',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'انظروا إلى البحر الأزرق الجميل تحت النجوم اللامعة.',
            en: 'Look at the wide blue sea under twinkling evening stars.',
          },
          mid: {
            ar: 'في البحر الواسع كان هناك قارب يسير في المساء، والله يرى كل شيء في البر والبحر.',
            en: 'Out on the wide sea sailed a boat at twilight, while Allah watches over everything on land and sea.',
          },
          older: {
            ar: 'غادر يونس عليه السلام بلدته مستعجلاً قبل أن يأذن الله، وركب سفينة في البحر الواسع.',
            en: 'Prophet Yunus (AS) left hastily and boarded a ship crossing the deep blue sea.',
          },
        },
      },
      {
        id: 'yunus-s2',
        order: 2,
        phase: 'middle',
        title: { ar: 'الحوت الكبير اللطيف', en: 'The Gentle Giant Whale' },
        durationSeconds: 44,
        illustrationKey: 'yunus-whale-calm',
        sfxCue: 'whale',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'حوت كبير لطيف في الماء الهادئ حفظه الله ولم يؤذه! المسوا الفقاعات المضيئة.',
            en: 'A gentle giant whale in calm water kept him safe without harm! Tap the glowing sea bubbles.',
          },
          mid: {
            ar: 'أمر الله حوتاً عظيماً ألا يؤذي نبي الله يونس عليه السلام أبداً، لأن كل الكائنات تطيع الله.',
            en: 'Allah commanded a great whale not to cause any harm, for all creatures of the sea obey Allah gently.',
          },
          older: {
            ar: 'التقم الحوت يونس عليه السلام بأمر الله دون أذى، فكان في حفظ الله حتى في أعماق البحر.',
            en: 'By Allah’s command, the great whale sheltered Prophet Yunus without harm, keeping him in Allah’s protection even in deep waters.',
          },
        },
        activity: {
          id: 'act-yunus-ocean',
          type: 'tap-targets',
          title: { ar: 'أصدقاء البحر الهادئ', en: 'Tap the Peaceful Ocean Friends' },
          instruction: {
            ar: 'اضغط على الحوت اللطيف والشعب المرجانية والفقاعات المضيئة في البحر',
            en: 'Tap the gentle whale, coral, and sea bubbles glowing in the calm ocean',
          },
          successMessage: {
            ar: 'أحسنت! كل مخلوقات البحر تسبّح لله وتطيعه.',
            en: 'Well done! All creatures of the sea obey and praise Allah.',
          },
          retryMessage: {
            ar: 'هذه حبة رمل على الشاطئ! المس البحر والفقاعات.',
            en: 'That is warm beach sand! Tap the gentle ocean creatures and bubbles.',
          },
          requiredCount: 3,
          items: [
            { id: 'y1', label: { ar: 'الحوت اللطيف', en: 'Gentle Whale' }, emoji: '🐋', xPct: 35, yPct: 48, isTarget: true },
            { id: 'y2', label: { ar: 'فقاعات البحر', en: 'Sea Bubbles' }, emoji: '🫧', xPct: 52, yPct: 30, isTarget: true },
            { id: 'y3', label: { ar: 'شعب مرجانية', en: 'Ocean Coral' }, emoji: '🪸', xPct: 24, yPct: 75, isTarget: true },
            { id: 'y4', label: { ar: 'صخرة رملية', en: 'Shore Stone' }, emoji: '🪨', xPct: 78, yPct: 78, isTarget: false },
          ],
        },
      },
      {
        id: 'yunus-s3',
        order: 3,
        phase: 'middle',
        title: { ar: 'الدعاء الجميل في الظلام', en: 'Sincere Prayer in the Deep' },
        durationSeconds: 44,
        illustrationKey: 'yunus-prayer-light',
        sfxCue: 'stars',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'في الماء الهادئ، دعا يونس الله بقلب صادق، والله يسمعنا دائماً.',
            en: 'In the quiet water, Yunus prayed gently to Allah, and Allah always hears us.',
          },
          mid: {
            ar: 'سبّح سيدنا يونس عليه السلام الله وقال دعاءً جميلاً صادقاً، فاستجاب الله له سريعاً.',
            en: 'Prophet Yunus (AS) glorified Allah with a sincere prayer, and Allah answered him swiftly.',
          },
          older: {
            ar: 'نادى في الظلمات: «لَا إِلَٰهَ إِلَّا أَنتَ سُبْحَانَكَ إِنِّي كُنتُ مِنَ الظَّالِمِينَ»، فنجاه الله برحمته.',
            en: 'He called upon Allah in sincere glorification and repentance, and Allah delivered him from distress.',
          },
        },
      },
      {
        id: 'yunus-s4',
        order: 4,
        phase: 'middle',
        title: { ar: 'الشاطئ ونبتة اليقطين الخضراء', en: 'Warm Shore & Green Gourd Vine' },
        durationSeconds: 44,
        illustrationKey: 'yunus-gourd-shore',
        sfxCue: 'forest',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'أخرج الله الحوت إلى الشاطئ ونبتت أوراق خضراء كبيرة تظلله بحب.',
            en: 'The whale brought him gently to the sunny shore where broad green leaves gave cozy shade.',
          },
          mid: {
            ar: 'أمر الله الحوت فأوصله إلى شاطئ آمن، وأنبت الله شجرة يقطين ناعمة تظلله وتغذيه.',
            en: 'Allah guided him to a calm shore and made a lush gourd vine grow with broad leaves to shade and comfort him.',
          },
          older: {
            ar: 'خرج سيدنا يونس عليه السلام بسلام إلى اليابسة، وأنبت الله عليه شجرة اليقطين رأفةً به حتى استعاد عافيته.',
            en: 'Safely ashore, Allah caused a gourd vine to shade and nourish Prophet Yunus until his strength returned.',
          },
        },
        activity: {
          id: 'act-yunus-gratitude',
          type: 'match-kindness',
          title: { ar: 'ماذا نفعل عندما نشعر بالحزن أو القلق؟', en: 'What Helps When We Feel Worried?' },
          instruction: {
            ar: 'اختر العادة الجميلة التي تعلمناها من قصة سيدنا يونس عليه السلام',
            en: 'Choose the comforting habit we learn from Prophet Yunus’s story',
          },
          successMessage: {
            ar: 'برافو! ندعو الله بلطف ونذكره لأن الله يسمعنا.',
            en: 'Bravo! We pray gently and remember Allah because He always hears us.',
          },
          retryMessage: {
            ar: 'حاول مرة أخرى! تذكّر أن الدعاء الهادئ يطمئن القلب.',
            en: 'Try again! Calm prayer brings peace to our hearts.',
          },
          choices: [
            { id: 'yc1', label: { ar: 'ندعو الله بهدوء ونقول سبحان الله', en: 'Pray calmly to Allah and say SubhanAllah' }, emoji: '🌟', isKindMatch: true },
            { id: 'yc2', label: { ar: 'نبكي ونغلق باب الأمل', en: 'Give up and lose hope' }, emoji: '🌧️', isKindMatch: false },
          ],
        },
      },
      {
        id: 'yunus-s5',
        order: 5,
        phase: 'ending',
        title: { ar: 'عودة سعيدة بالإيمان', en: 'Happy Return & Mercy' },
        durationSeconds: 40,
        illustrationKey: 'yunus-ocean-twilight',
        sfxCue: 'chime',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'نحن نحب الله السميع الذي يرعانا في الليل والنهار.',
            en: 'We love Allah Who hears us and cares for us day and night.',
          },
          mid: {
            ar: 'نتعلم أن الله معنا في كل مكان، وإذا أخطأنا نعتذر وندعو الله فيسامحنا برحمته.',
            en: 'We learn Allah is near everywhere; when we make a mistake, we say sorry and pray gently.',
          },
          older: {
            ar: 'عاش يونس عليه السلام وقومه في خير وسلام، وتبقى قصته درساً في الأمل والتوبة والثقة بالله.',
            en: 'Peace and faith flourished upon his return, leaving a lasting lesson of hope, prayer, and trust in Allah.',
          },
        },
      },
    ],
    closingQuiz: {
      question: {
        ar: 'ماذا أنبت الله ليظلل سيدنا يونس على الشاطئ؟',
        en: 'What did Allah grow to give gentle shade on the shore?',
      },
      options: [
        { id: 'yq1', label: { ar: 'نبتة يقطين خضراء بأوراق واسعة', en: 'A lush green gourd vine' }, emoji: '🌿', isCorrect: true },
        { id: 'yq2', label: { ar: 'جبل من ثلج', en: 'A mountain of ice' }, emoji: '🧊', isCorrect: false },
      ],
      successFeedback: { ar: 'رائع! أنبت الله شجرة اليقطين الجميلة لتظلله.', en: 'Wonderful! Allah grew a green gourd vine to shade him.' },
      retryFeedback: { ar: 'انظر إلى أوراق الشاطئ الخضراء! حاول مرة أخرى.', en: 'Remember the green leaves on the shore! Try again.' },
    },
    closingActivity: {
      prompt: { ar: 'اضغط لنسبّح الله معاً: سبحان الله وبحمده', en: 'Tap to say SubhanAllah with joy' },
      actionLabel: { ar: 'سبحان الله 🐋', en: 'SubhanAllah 🐋' },
      rewardEmoji: '🫧',
      completionPhrase: { ar: 'أحسنت! الله قريب سميع يحب الدعاء الجميل.', en: 'Great job! Allah is always near and loves gentle prayer.' },
    },
    completionBadge: {
      id: 'badge-yunus',
      title: { ar: 'وسام الدعاء والأمل', en: 'Hope & Prayer Badge' },
      icon: '🐋',
    },
  },

  {
    id: 'qstory-kind-brothers',
    order: 4,
    title: {
      ar: 'سيدنا يوسف عليه السلام',
      en: 'Prophet Yusuf — Patience & Forgiveness',
    },
    description: {
      ar: 'ثلاث حلقات قصيرة عن النجوم الأحد عشر، والصبر الجميل، ومسامحة الإخوة بقلب محب.',
      en: 'Three short toddler episodes about the eleven shining stars, patience, and forgiving brothers warmly.',
    },
    durationSeconds: 275,
    recommendedMinBand: '2-3',
    coverImage: '/src/assets/images/story_yusuf_stars_1795276481370.jpg',
    symbolicTheme: 'kind-brothers',
    symbolicElements: ['eleven-stars', 'crescent-moon', 'golden-wheat', 'warm-lantern'],
    prohibitsProphetDepiction: true,
    surahReferences: [
      {
        surahNumber: 12,
        surahNameAr: 'سورة يوسف',
        surahNameEn: 'Surah Yusuf',
        ayahRange: '12:4–101',
      },
    ],
    establishedQuranicFacts: [
      {
        ar: 'رأى نبي الله يوسف عليه السلام في منامه أحد عشر كوكباً والشمس والقمر، وصبر على البعد عن أهله، ثم أكرمه الله ولمّا اجتمع بإخوته عفا عنهم بفضل الله.',
        en: 'Surah Yusuf describes the dream of eleven stars, the sun and moon, Prophet Yusuf’s patience and righteousness through hardship, and his gracious forgiveness when reunited with his family.',
      },
    ],
    simplifiedExplanation: {
      ar: 'رسوم رمزية للنجوم والقمر وحقول القمح الذهبية والفانوس الدافئ — بدون أي رسم للأنبياء.',
      en: 'Symbolic stars, crescent moon, golden wheat fields, and warm home lantern — zero Prophet depiction.',
    },
    ageSummary: {
      young: {
        ar: 'نجوم لامعة وقمر مضيء، وقلب يحب إخوته ويسامحهم.',
        en: 'Bright stars and moon, and a kind heart that loves and forgives brothers.',
      },
      mid: {
        ar: 'تروي قصة نبي الله يوسف عليه السلام أن الصدق والصبر الجميل ومسامحة الإخوة تجمع العائلة بالحب والسلام.',
        en: 'Prophet Yusuf’s story teaches that honesty, calm patience, and forgiving brothers reunite families with warmth.',
      },
      older: {
        ar: 'ثبت نبي الله يوسف عليه السلام على الصدق والأمانة والصبر في كل محنة، وحين عاد إخوته إليه قابلهم بالصفح الجميل.',
        en: 'Prophet Yusuf held fast to honesty, trustworthiness, and patience, and warmly forgave his brothers when they reunited.',
      },
    },
    narrationNote: {
      ar: 'حكاية من ٣ حلقات قصيرة مناسبة لطفل ١–٤ سنوات.',
      en: 'Organized into 3 gentle mini-episodes for children aged 1–4.',
    },
    moralLesson: {
      ar: 'الصدق والصبر والعفو تجمع القلوب بالمحبة.',
      en: 'Honesty, patience, and forgiveness bring hearts together.',
    },
    publishedStatus: 'published',
    enabled: true,
    scenes: [
      {
        id: 'yusuf-s1',
        order: 1,
        phase: 'intro',
        title: { ar: 'الحلقة ١: السماء المضيئة بالنجوم', en: 'Episode 1: The Starry Dream Sky' },
        durationSeconds: 45,
        illustrationKey: 'yusuf-eleven-stars',
        sfxCue: 'stars',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'انظروا إلى السماء المليئة بالنجوم اللامعة والقمر الجميل!',
            en: 'Look up at the peaceful sky filled with bright golden stars and a glowing moon!',
          },
          mid: {
            ar: 'في ليلة هادئة، رأى يوسف عليه السلام في منامه نجوماً مضيئة والشمس والقمر، وكانت علامة خير عظيم من الله.',
            en: 'On a peaceful night, Prophet Yusuf dreamed of eleven shining stars, the sun and moon — a gentle sign of future blessing from Allah.',
          },
          older: {
            ar: 'بدأ نور القصة برؤيا جميلة لأحد عشر كوكباً والشمس والقمر، فأحب أبوه يعقوب عليه السلام رعاية قلبه الصادق.',
            en: 'The story opens with a dream of eleven stars, the sun and the moon, reminding us Allah plans goodness for sincere hearts.',
          },
        },
        activity: {
          id: 'act-yusuf-stars',
          type: 'tap-targets',
          title: { ar: 'أضئ النجوم في السماء', en: 'Tap the Bright Stars & Moon' },
          instruction: {
            ar: 'اضغط على ٣ نجوم مضيئة والقمر الجميل في الليل الهادئ',
            en: 'Tap 3 bright golden stars in the quiet night sky',
          },
          successMessage: {
            ar: 'ممتاز! نجوم السماء تسبّح الله بنورها الجميل.',
            en: 'Awesome! Bright stars shine gently in Allah’s sky.',
          },
          retryMessage: {
            ar: 'هذا حقل القمح الذهبي! المس النجوم في السماء.',
            en: 'That is golden wheat below! Tap the stars high in the sky.',
          },
          requiredCount: 3,
          items: [
            { id: 'yu1', label: { ar: 'نجمة ذهبية', en: 'Golden Star' }, emoji: '⭐', xPct: 24, yPct: 24, isTarget: true },
            { id: 'yu2', label: { ar: 'هلال القمر', en: 'Crescent Moon' }, emoji: '🌙', xPct: 48, yPct: 20, isTarget: true },
            { id: 'yu3', label: { ar: 'نجمة مضيئة', en: 'Bright Star' }, emoji: '🌟', xPct: 76, yPct: 26, isTarget: true },
            { id: 'yu4', label: { ar: 'سنبلة قمح', en: 'Wheat Stalk' }, emoji: '🌾', xPct: 60, yPct: 76, isTarget: false },
          ],
        },
      },
      {
        id: 'yusuf-s2',
        order: 2,
        phase: 'middle',
        title: { ar: 'الحلقة ٢: الصبر في البعد', en: 'Episode 2: Calm Patience Away from Home' },
        durationSeconds: 45,
        illustrationKey: 'yusuf-lantern-patience',
        sfxCue: 'cave',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'عندما ابتعد يوسف عن بيته، بقي هادئاً والله حافظه معه.',
            en: 'When Yusuf was far from home, he stayed calm and Allah kept him safe.',
          },
          mid: {
            ar: 'ابتعد سيدنا يوسف عن بيته وأهله، لكنه لم يغضب ولم ييأس، بل صبر وتوكل على الله الرحيم.',
            en: 'Separated from his home, Prophet Yusuf did not despair; he stayed patient and trusted Allah’s gentle care.',
          },
          older: {
            ar: 'واجه سيدنا يوسف عليه السلام مواقف صعبة بعيداً عن أسرته، لكنه حافظ على الأمانة والصبر الجميل وحسن الظن بالله.',
            en: 'Even through lonely and hard days away from his family, Prophet Yusuf remained trustworthy, kind, and hopeful in Allah.',
          },
        },
      },
      {
        id: 'yusuf-s3',
        order: 3,
        phase: 'middle',
        title: { ar: 'الحلقة ٢: سنابل القمح والخير للجميع', en: 'Episode 2: Golden Wheat & Sharing Food' },
        durationSeconds: 48,
        illustrationKey: 'yusuf-golden-wheat',
        sfxCue: 'forest',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'بارك الله في حقول القمح الذهبي ليأكل الجميع ويشبعوا بسعادة.',
            en: 'Allah blessed the golden wheat fields so everyone could share food happily.',
          },
          mid: {
            ar: 'لما كبر يوسف عليه السلام وولاه الله حفظ الطعام، خطط بحكمة وأمانة ليوزع القمح والخيرات على الناس.',
            en: 'With wisdom and honesty, Prophet Yusuf cared for the golden grain harvests so families everywhere had food to share.',
          },
          older: {
            ar: 'أكرم الله يوسف عليه السلام بالحكمة والأمانة، فحفظ سنابل القمح وقت الرخاء ليطعم الناس جميعاً وقت الشدة.',
            en: 'Allah blessed Yusuf with wisdom to store wheat during plenty so everyone could be cared for during lean years.',
          },
        },
      },
      {
        id: 'yusuf-s4',
        order: 4,
        phase: 'middle',
        title: { ar: 'رتّب خطوات القصة الجميلة', en: 'Order the Story Pictures' },
        durationSeconds: 48,
        illustrationKey: 'yusuf-eleven-stars',
        sfxCue: 'stars',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'هيا نرتب صور القصة الجميلة خطوة بعد خطوة!',
            en: 'Let us put the cozy story pictures in order, step by step!',
          },
          mid: {
            ar: 'لنتذكر أحداث القصة: النجوم أولاً، ثم سنابل القمح، ثم لمّ شمل العائلة بالسلام.',
            en: 'Let us recall the story: first the stars, next the golden wheat, then a happy forgiving family.',
          },
          older: {
            ar: 'رتّب مراحل الصبر والبركة في قصة يوسف عليه السلام بالضغط على ١ ثم ٢ ثم ٣.',
            en: 'Tap steps 1, 2, then 3 in order to recall how patience led to family peace.',
          },
        },
        activity: {
          id: 'act-yusuf-sequence',
          type: 'sequence-cards',
          title: { ar: 'رتّب أحداث القصة من ١ إلى ٣', en: 'Put the Story Steps in Order (1 to 3)' },
          instruction: {
            ar: 'اضغط على المشهد الأول، ثم الثاني، ثم الثالث بالترتيب',
            en: 'Tap the First scene, then Second, then Third in story order',
          },
          successMessage: {
            ar: 'برافو! رتبت قصة سيدنا يوسف بذكاء وهدوء.',
            en: 'Bravo! You ordered the story steps beautifully.',
          },
          retryMessage: {
            ar: 'قريب جداً! ابدأ بالنجوم في السماء أولاً.',
            en: 'Almost! Start with the shining stars in the sky first.',
          },
          steps: [
            { id: 'seq-1', order: 1, label: { ar: 'نجوم السماء والمنام الجميل', en: 'Shining stars in the sky' }, emoji: '🌟' },
            { id: 'seq-2', order: 2, label: { ar: 'القمح ومساعدة الناس بالخير', en: 'Golden wheat & sharing food' }, emoji: '🌾' },
            { id: 'seq-3', order: 3, label: { ar: 'اجتماع العائلة بالصفح والحب', en: 'Family reunited with forgiveness' }, emoji: '🏡' },
          ],
        },
      },
      {
        id: 'yusuf-s5',
        order: 5,
        phase: 'middle',
        title: { ar: 'الحلقة ٣: الصفح الجميل بين الإخوة', en: 'Episode 3: Forgiving Brothers Warmly' },
        durationSeconds: 45,
        illustrationKey: 'yusuf-lantern-patience',
        sfxCue: 'chime',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'عندما عاد الإخوة معاً، سامحهم يوسف وفرحت العائلة كلها.',
            en: 'When the brothers came back together, they forgave each other and everyone smiled.',
          },
          mid: {
            ar: 'عندما جاء إخوته إليه، لم يعاقبهم ولم يغضب، بل قال لهم كلاماً طيباً وسامحهم لوجه الله.',
            en: 'When his brothers came, Prophet Yusuf did not hold anger; he spoke kindly and forgave them for Allah’s sake.',
          },
          older: {
            ar: 'علّمنا سيدنا يوسف عليه السلام أجمل معاني العفو حين قال لإخوته لا تثريب عليكم اليوم يغفر الله لكم.',
            en: 'Prophet Yusuf showed noble forgiveness, comforting his brothers so the entire family reunited in gratitude.',
          },
        },
      },
      {
        id: 'yusuf-s6',
        order: 6,
        phase: 'ending',
        title: { ar: 'درس المحبة والعفو', en: 'A Lesson in Love & Forgiveness' },
        durationSeconds: 44,
        illustrationKey: 'yusuf-golden-wheat',
        sfxCue: 'chime',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'أحب إخوتي وأصدقائي وأسامحهم بابتسامة.',
            en: 'I love my brothers, sisters, and friends and forgive with a smile.',
          },
          mid: {
            ar: 'المؤمن الصغير يحفظ الأمانة ويحب إخوته ويعفو عنهم عندما يخطئون.',
            en: 'A kind child speaks honestly, loves siblings, and forgives kindly.',
          },
          older: {
            ar: 'إن الله لا يضيع أجر الصابرين المحسنين، وبالعفو والمحبة تبقى البيوت مليئة بالبركة.',
            en: 'Allah never wastes the reward of the patient and kind; forgiveness keeps homes warm and blessed.',
          },
        },
      },
    ],
    closingQuiz: {
      question: {
        ar: 'ماذا فعل سيدنا يوسف عليه السلام عندما اجتمع بإخوته مرة أخرى؟',
        en: 'What did Prophet Yusuf do when he reunited with his brothers?',
      },
      options: [
        { id: 'yuq1', label: { ar: 'سامحهم وأحسن إليهم بالحب', en: 'Forgave them warmly' }, emoji: '💛', isCorrect: true },
        { id: 'yuq2', label: { ar: 'غضب وترك البيت', en: 'Stayed angry forever' }, emoji: '☁️', isCorrect: false },
      ],
      successFeedback: { ar: 'أحسنت! الصفح والمحبة هما درس قصة سيدنا يوسف.', en: 'Well done! Warm forgiveness is the heart of this story.' },
      retryFeedback: { ar: 'تذكر كيف اجتمعت العائلة بسعادة! حاول مجدداً.', en: 'Remember how the family reunited happily! Try again.' },
    },
    closingActivity: {
      prompt: { ar: 'اضغط لنرسل كلمة لطيفة لإخوتنا وأصدقائنا: أسامحك وأحبك', en: 'Tap to share a kind forgiving smile' },
      actionLabel: { ar: 'قلب صافٍ متسامح 💛', en: 'Kind & Forgiving Heart 💛' },
      rewardEmoji: '🌟',
      completionPhrase: { ar: 'بارك الله فيك! الصبر والصفح يصنعان بيوتاً سعيدة.', en: 'MashaAllah! Patience and forgiveness make happy homes.' },
    },
    completionBadge: {
      id: 'badge-yusuf',
      title: { ar: 'وسام الصفح الجميل', en: 'Forgiving Heart Badge' },
      icon: '🌟',
    },
  },

  {
    id: 'qstory-musa',
    order: 5,
    title: {
      ar: 'سيدنا موسى عليه السلام',
      en: 'Prophet Musa — Trust in Allah by the River',
    },
    description: {
      ar: 'السلة اللطيفة على ماء النهر الهادئ، وكيف حفظ الله الصغير وأعاده إلى حضن أمه الحنون.',
      en: 'A gentle woven basket gliding safely on calm river ripples until Allah lovingly reunited mother and child.',
    },
    durationSeconds: 245,
    recommendedMinBand: '1-2',
    coverImage: '/src/assets/images/story_musa_river_1795276481993.jpg',
    symbolicTheme: 'river-basket',
    symbolicElements: ['woven-basket', 'calm-river', 'lotus-flowers', 'garden-archway'],
    prohibitsProphetDepiction: true,
    surahReferences: [
      {
        surahNumber: 28,
        surahNameAr: 'سورة القصص',
        surahNameEn: 'Surah Al-Qasas',
        ayahRange: '28:7–13',
      },
      {
        surahNumber: 20,
        surahNameAr: 'سورة طه',
        surahNameEn: 'Surah Ta-Ha',
        ayahRange: '20:38–40',
      },
    ],
    establishedQuranicFacts: [
      {
        ar: 'أوحى الله إلى أم موسى عليه السلام أن تضعه في التابوت وتلقيه في اليم (النهر) وألا تخاف ولا تحزن، فحفظه الله وأعاده إلى أمه برحمته.',
        en: 'The Quran confirms Allah inspired the mother of Musa (AS) to place him in the chest upon the river without fear, and Allah protected him and returned him safely to his mother.',
      },
    ],
    simplifiedExplanation: {
      ar: 'مشاهد رمزية للنهر الهادئ وزهور اللوتس والسلة الفارغة والحديقة المشمسة — دون أي تصوير للأنبياء أو الأشخاص.',
      en: 'Symbolic river, lotus blossoms, empty woven basket, and sunlit garden archway — zero depiction of Prophets or humans.',
    },
    ageSummary: {
      young: {
        ar: 'نهر أزرق هادئ وسلة دافئة يحفظها الله بين أزهار جميلة.',
        en: 'A calm blue river and cozy woven basket watched over gently by Allah among pink flowers.',
      },
      mid: {
        ar: 'وضعت الأم الصابرة السلة الصغيرة في النهر متوكلة على الله، فحفظه الله ورعاه وأرجعه إلى أمه فرحةً مطمئنة.',
        en: 'Trusting Allah completely, his mother set the little basket gently on the calm river; Allah protected him and returned him happily to her.',
      },
      older: {
        ar: 'علّمتنا قصة نبي الله موسى عليه السلام أن من يتوكل على الله وقت الخوف يبدل الله خوفه أمناً وطمأنينة.',
        en: 'Prophet Musa’s early story shows that trusting Allah even when worried turns fear into safety and reassurance.',
      },
    },
    narrationNote: {
      ar: 'رسوم نهر وأزهار وسلة رمزية فارغة فقط — بدون رسم أطفال أو أنبياء.',
      en: 'Symbolic river, flowers, and empty basket scenery only — never depicts children or Prophets.',
    },
    moralLesson: {
      ar: 'حنان الأم، والتوكل على الله، والأمان في كل خطوة.',
      en: 'Mother’s care and trusting Allah bring comfort and safety.',
    },
    publishedStatus: 'published',
    enabled: true,
    scenes: [
      {
        id: 'musa-s1',
        order: 1,
        phase: 'intro',
        title: { ar: 'النهر الهادئ عند الفجر', en: 'Calm River at Morning Light' },
        durationSeconds: 45,
        illustrationKey: 'musa-river-dawn',
        sfxCue: 'river',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'انظروا إلى النهر الصافي والأزهار الوردية الجميلة عند الفجر.',
            en: 'Look at the clear blue river and gentle pink flowers shining at sunrise.',
          },
          mid: {
            ar: 'بجوار نهر النيل الهادئ، صنعت أمٌ حنون سلة دافئة مبطنة، ودعت الله أن يحفظ وليدها بلطفه.',
            en: 'Beside the quiet river, a loving mother prepared a soft cozy basket and trusted Allah with all her heart.',
          },
          older: {
            ar: 'أوحى الله إلى أم موسى عليه السلام أن تطمئن ولا تخاف وتضع الصغير في التابوت في اليم، فوعدها الله بالردّ والحفظ.',
            en: 'Allah inspired the mother of Musa (AS) not to fear or grieve, promising to keep him safe and return him to her.',
          },
        },
      },
      {
        id: 'musa-s2',
        order: 2,
        phase: 'middle',
        title: { ar: 'رحلة السلة فوق الماء', en: 'Gliding Safely on the Ripples' },
        durationSeconds: 50,
        illustrationKey: 'musa-basket-lotus',
        sfxCue: 'river',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'تسير السلة فوق الماء الهادئ بين زهور اللوتس! المسوا الزهور الجميلة.',
            en: 'The cozy basket glides softly past pretty pink flowers! Tap the river flowers.',
          },
          mid: {
            ar: 'حملت الأمواج اللطيفة السلة في طريق آمن بين أعشاب النهر وزهوره برعاية الله القريبة.',
            en: 'Calm ripples carried the basket along a peaceful path past reeds and flowers under Allah’s watchful mercy.',
          },
          older: {
            ar: 'تتحرك المياه بأمر الله وحده، فتجري السلة بسكينة بعيداً عن الخطر لتصل إلى بر الأمان.',
            en: 'Even river waters move by Allah’s command alone, guiding the basket peacefully away from danger toward safety.',
          },
        },
        activity: {
          id: 'act-musa-river',
          type: 'tap-targets',
          title: { ar: 'افتح طريق الزهور الهادئ', en: 'Tap the Peaceful River Blossoms' },
          instruction: {
            ar: 'اضغط على ٣ أزهار لوتس جميلة تسبح بجانب السلة في النهر الهادئ',
            en: 'Tap 3 gentle river lotus flowers glowing beside the calm basket path',
          },
          successMessage: {
            ar: 'رائع! وصلت السلة إلى الضفة الخضراء بسلام.',
            en: 'Wonderful! The basket drifted peacefully to the green bank.',
          },
          retryMessage: {
            ar: 'هيا نلمس أزهار النهر الوردية!',
            en: 'Let us tap the pink blossoms on the water!',
          },
          requiredCount: 3,
          items: [
            { id: 'm1', label: { ar: 'زهرة لوتس وردية', en: 'Pink Lotus' }, emoji: '🪷', xPct: 22, yPct: 72, isTarget: true },
            { id: 'm2', label: { ar: 'زهرة نهر هادئة', en: 'Water Flower' }, emoji: '🌸', xPct: 48, yPct: 68, isTarget: true },
            { id: 'm3', label: { ar: 'ورقة خضراء طافية', en: 'Lotus Pad' }, emoji: '🪷', xPct: 76, yPct: 74, isTarget: true },
            { id: 'm4', label: { ar: 'غيمة الصباح', en: 'Morning Cloud' }, emoji: '☁️', xPct: 35, yPct: 20, isTarget: false },
          ],
        },
      },
      {
        id: 'musa-s3',
        order: 3,
        phase: 'middle',
        title: { ar: 'الوصول إلى الحديقة المشمسة', en: 'Arriving at the Sunlit Garden' },
        durationSeconds: 50,
        illustrationKey: 'musa-garden-arch',
        sfxCue: 'dawn',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'وصلت السلة بسلام إلى الحديقة الخضراء الجميلة عند القوس الحجري.',
            en: 'The cozy basket reached the green sunny garden by the stone archway.',
          },
          mid: {
            ar: 'توقفت السلة عند حديقة مزهرة، فألقى الله محبة وعطفاً في القلوب ليُعتنى بالصغير ويُحفظ.',
            en: 'The basket rested by a blooming garden, where Allah filled hearts with warmth and care to look after him safely.',
          },
          older: {
            ar: 'ألقى الله عليه محبةً منه سبحانه، فصار محفوظاً مرعيّاً في مكان لم يكن يتوقعه أحد.',
            en: 'Allah placed love and care around him, keeping him safe in the most unexpected place by Allah’s gentle plan.',
          },
        },
      },
      {
        id: 'musa-s4',
        order: 4,
        phase: 'middle',
        title: { ar: 'رتّب خطوات رحلة الأمان', en: 'Order the River Safety Journey' },
        durationSeconds: 50,
        illustrationKey: 'musa-basket-lotus',
        sfxCue: 'chime',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'هيا نرتب رحلة السلة الجميلة خطوة خطوة!',
            en: 'Let us order the calm basket journey step by step!',
          },
          mid: {
            ar: 'من النهر إلى الحديقة ثم العودة لحضن الأم الحنون! رتّب البطاقات الثلاث.',
            en: 'From the river to the sunny garden and back to mother’s loving care! Tap 1, 2, then 3.',
          },
          older: {
            ar: 'اختر الترتيب الصحيح لوعد الله الصادق لأم موسى عليه السلام.',
            en: 'Order the 3 peaceful stages showing how Allah fulfilled His promise.',
          },
        },
        activity: {
          id: 'act-musa-sequence',
          type: 'sequence-cards',
          title: { ar: 'رحلة الأمان من ١ إلى ٣', en: 'Safety Journey Order (1 to 3)' },
          instruction: {
            ar: 'اضغط بالترتيب: ١ النهر والسلة، ٢ الحديقة المزهرة، ٣ العودة للأم',
            en: 'Tap in order: 1 River Basket, 2 Blooming Garden, 3 Back to Mother',
          },
          successMessage: {
            ar: 'ممتاز! وعد الله حق دائماً.',
            en: 'Wonderful! Allah’s promise is always true.',
          },
          retryMessage: {
            ar: 'ابدأ بالسلة على النهر أولاً يا بطل!',
            en: 'Start with the little basket on the river first!',
          },
          steps: [
            { id: 'ms-1', order: 1, label: { ar: 'السلة تسبح فوق ماء النهر الهادئ', en: 'Cozy basket on the calm river' }, emoji: '🧺' },
            { id: 'ms-2', order: 2, label: { ar: 'الوصول إلى الحديقة المشمسة بأمان', en: 'Safe arrival by the sunny garden' }, emoji: '🌸' },
            { id: 'ms-3', order: 3, label: { ar: 'العودة السعيدة إلى حضن الأم', en: 'Happy return to mother’s care' }, emoji: '💗' },
          ],
        },
      },
      {
        id: 'musa-s5',
        order: 5,
        phase: 'ending',
        title: { ar: 'طمأنينة القلب عند الأم', en: 'Comfort & Joy Back Home' },
        durationSeconds: 50,
        illustrationKey: 'musa-garden-arch',
        sfxCue: 'chime',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'فرحت الأم كثيراً عندما عاد إليها، وقالت: الحمد لله.',
            en: 'Mother smiled with joy when he came back safely, saying Alhamdulillah.',
          },
          mid: {
            ar: 'أعاد الله الصغير إلى أمه كي تقرّ عينها ولا تحزن، فتعلّمت أن وعد الله لا يضيع أبداً.',
            en: 'Allah returned him safely to his mother so her heart would rest with joy, proving Allah keeps every promise.',
          },
          older: {
            ar: 'تحقق وعد الله الكريم وعاد موسى عليه السلام إلى أمه بأمان، لنتعلم الثقة التامة بالله وبرّ الأمهات.',
            en: 'Allah’s promise came true completely, teaching us deep trust in Allah and gratitude for our mothers’ love.',
          },
        },
      },
    ],
    closingQuiz: {
      question: {
        ar: 'إلى أين أعاد الله الصغير في نهاية القصة ليطمئن قلبه؟',
        en: 'To whom did Allah safely return the child at the end?',
      },
      options: [
        { id: 'mq1', label: { ar: 'إلى أمه الحنون بسعادة وأمان', en: 'Happily back to his loving mother' }, emoji: '💗', isCorrect: true },
        { id: 'mq2', label: { ar: 'إلى صحراء بعيدة باردة', en: 'Far into an icy desert' }, emoji: '🏜️', isCorrect: false },
      ],
      successFeedback: { ar: 'أحسنت! أعاده الله إلى أمه الحنون ليفرح قلبها.', en: 'Great job! Allah safely returned him to his loving mother.' },
      retryFeedback: { ar: 'تذكر قلب الأم الحنون! حاول مرة أخرى.', en: 'Remember his loving mother’s care! Try again.' },
    },
    closingActivity: {
      prompt: { ar: 'اضغط لنرسل دعاءً جميلاً لأمنا الحنون: اللهم احفظ أمي', en: 'Tap to send a gentle prayer for Mom' },
      actionLabel: { ar: 'أحب أمي وأشكر الله 🌷', en: 'Thank Allah for Mom 🌷' },
      rewardEmoji: '🧺',
      completionPhrase: { ar: 'بارك الله فيك! من يتوكل على الله يحفظه الله برحمته.', en: 'MashaAllah! Whoever trusts Allah is always in His gentle care.' },
    },
    completionBadge: {
      id: 'badge-musa',
      title: { ar: 'وسام الطمأنينة والثقة', en: 'Calm Trust Badge' },
      icon: '🧺',
    },
  },

  {
    id: 'qstory-ant',
    order: 6,
    title: {
      ar: 'سيدنا سليمان عليه السلام',
      en: 'Prophet Sulayman & The Valley of Ants',
    },
    description: {
      ar: 'النملة اللطيفة والهدهد الجميل، والابتسامة الشاكرة التي علمتنا احترام الكائنات الصغيرة.',
      en: 'A careful little ant, a colorful hoopoe bird, and a grateful smile reminding us to care for tiny creatures.',
    },
    durationSeconds: 220,
    recommendedMinBand: '1-2',
    coverImage: '/src/assets/images/story_sulayman_ant_1795276482193.jpg',
    symbolicTheme: 'little-ant',
    symbolicElements: ['green-valley', 'little-ants', 'hoopoe-bird', 'olive-branch'],
    prohibitsProphetDepiction: true,
    surahReferences: [
      {
        surahNumber: 27,
        surahNameAr: 'سورة النمل',
        surahNameEn: 'Surah An-Naml',
        ayahRange: '27:16–22',
      },
    ],
    establishedQuranicFacts: [
      {
        ar: 'علم الله نبي الله سليمان عليه السلام منطق الطير، وسمع نملة تحذر النمل أن يدخلن مساكنهن، فتبسم ضاحكاً من قولها ودعا الله أن يوزعه شكر نعمته.',
        en: 'Surah An-Naml confirms Allah taught Prophet Sulayman (AS) the speech of birds and let him hear a little ant warning her colony, so he smiled and prayed to always thank Allah.',
      },
    ],
    simplifiedExplanation: {
      ar: 'مشاهد خضراء رمزية للنمل على الحصى والهدهد على غصن الزيتون دون تصوير أي إنسان.',
      en: 'Symbolic green valley with little ants on a pebble trail and a hoopoe bird on an olive branch — zero human figures.',
    },
    ageSummary: {
      young: {
        ar: 'نملة صغيرة تحب صديقاتها، وهدهد ملون جميل على الغصن الأخضر.',
        en: 'A little ant caring for her friends and a colorful hoopoe bird on a green branch.',
      },
      mid: {
        ar: 'نادت نملة ذكية صديقاتها لتدخلن بيوتكن بأمان، فسمعها نبي الله سليمان عليه السلام وتبسّم وشكر الله على نعمه.',
        en: 'A caring little ant warned her friends safely home; Prophet Sulayman (AS) heard her, smiled gently, and thanked Allah.',
      },
      older: {
        ar: 'تعلمنا قصة وادي النمل مع سيدنا سليمان عليه السلام والهدهد أن أصغر الكائنات لها مكانة عند الله، وأن النعم تستحق الشكر.',
        en: 'The Valley of the Ants and the hoopoe teach us that even the smallest creatures matter to Allah and gratitude makes blessings grow.',
      },
    },
    narrationNote: {
      ar: 'عرض رمزي للوادي الأخضر والنمل والهدهد — بدون أي تصوير للأنبياء.',
      en: 'Symbolic valley, little ants, and hoopoe bird only — zero Prophet depiction.',
    },
    moralLesson: {
      ar: 'الرفق بالحيوانات والحشرات الصغيرة وشكر الله كل يوم.',
      en: 'Gentle kindness to tiny creatures and thanking Allah every day.',
    },
    publishedStatus: 'published',
    enabled: true,
    scenes: [
      {
        id: 'ant-s1',
        order: 1,
        phase: 'intro',
        title: { ar: 'الوادي الأخضر المشرق', en: 'The Sunlit Green Valley' },
        durationSeconds: 42,
        illustrationKey: 'ant-sunny-meadow',
        sfxCue: 'forest',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'انظروا إلى العشب الأخضر والأزهار الملونة والشمس الدافئة.',
            en: 'Look at the bright green meadow, wildflowers, and warm morning sunshine.',
          },
          mid: {
            ar: 'أنعم الله على نبيه سليمان عليه السلام بفهم أصوات الطيور والكائنات، وجعله يشكر الله في كل وقت.',
            en: 'Allah blessed Prophet Sulayman (AS) to understand the language of birds and creatures, inspiring gratitude every day.',
          },
          older: {
            ar: 'في وادٍ أخضر جميل، كانت المخلوقات الصغيرة تعيش بنظام بديع، وكان سليمان عليه السلام يشكر الله على علمه وحكمته.',
            en: 'Across a blooming green valley, tiny creatures worked harmoniously while Prophet Sulayman thanked Allah for His blessings.',
          },
        },
      },
      {
        id: 'ant-s2',
        order: 2,
        phase: 'middle',
        title: { ar: 'تحذير النملة الذكية', en: 'The Careful Little Ant Speaks' },
        durationSeconds: 48,
        illustrationKey: 'ant-pebble-trail',
        sfxCue: 'birds',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'نملة صغيرة ساعدت صديقاتها ليدخلن بيتهن بأمان! المسوا النمل اللطيف.',
            en: 'A tiny ant helped her friends hurry safely home! Tap the little ants on the path.',
          },
          mid: {
            ar: 'قالت نملة صغيرة لرفيقاتها: ادخلن مساكنكن حتى لا يطأكن أحد عن غير قصد! هيا نساعد النمل في الطريق.',
            en: 'A wise little ant warned her sisters to step safely inside their homes so none would be stepped on! Tap to guide them.',
          },
          older: {
            ar: 'اهتمت النملة الصغيرة بسلامة زميلاتها ونبهتهن بلطف، وذكرت أن من يمرّون قد لا يشعرون بصغر حجمهن.',
            en: 'Looking out for her colony’s safety, the little ant called everyone gently inside their homes.',
          },
        },
        activity: {
          id: 'act-ant-path',
          type: 'tap-targets',
          title: { ar: 'ساعد النملات على عبور الطريق بأمان', en: 'Guide the Little Ants Safely' },
          instruction: {
            ar: 'اضغط على ٣ نملات لطيفات على طريق الحصى لتصلن إلى بيتهن بأمان',
            en: 'Tap 3 little ants along the sunny pebble path to help them reach home safely',
          },
          successMessage: {
            ar: 'برافو! كل النملات وصلن إلى مساكنهن بسلام.',
            en: 'Bravo! All the little ants reached their cozy home safely.',
          },
          retryMessage: {
            ar: 'هذه زهرة جميلة! ابحث عن النملات الصغيرات على الطريق.',
            en: 'That is a pretty wildflower! Look for the tiny ants on the pebble path.',
          },
          requiredCount: 3,
          items: [
            { id: 'an1', label: { ar: 'نملة نشيطة ١', en: 'Busy Ant 1' }, emoji: '🐜', xPct: 38, yPct: 72, isTarget: true },
            { id: 'an2', label: { ar: 'نملة نشيطة ٢', en: 'Busy Ant 2' }, emoji: '🐜', xPct: 50, yPct: 60, isTarget: true },
            { id: 'an3', label: { ar: 'نملة نشيطة ٣', en: 'Busy Ant 3' }, emoji: '🐜', xPct: 62, yPct: 50, isTarget: true },
            { id: 'an4', label: { ar: 'زهرة حمراء', en: 'Meadow Flower' }, emoji: '🌺', xPct: 18, yPct: 78, isTarget: false },
          ],
        },
      },
      {
        id: 'ant-s3',
        order: 3,
        phase: 'middle',
        title: { ar: 'الابتسامة الشاكرة ودعاء الشكر', en: 'A Gentle Smile & Thankful Prayer' },
        durationSeconds: 42,
        illustrationKey: 'ant-olive-hoopoe',
        sfxCue: 'chime',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'سمع سليمان النملة وتبسّم وشكر الله، ولم يؤذِ نملة واحدة!',
            en: 'Sulayman heard the tiny ant, smiled gently, thanked Allah, and kept every ant safe!',
          },
          mid: {
            ar: 'تبسّم نبي الله سليمان عليه السلام فرحاً بحكمة النملة الصغيرة، ودعا الله أن يلهمه شكر نعمه دائماً.',
            en: 'Prophet Sulayman (AS) smiled joyfully at the little ant’s care and prayed to Allah to remain grateful for His favors.',
          },
          older: {
            ar: 'دعا سليمان عليه السلام ربه أن يعينه على شكر النعم وعمل الصالحات؛ فالشكر يجعل القلوب رقيقة رحيمة.',
            en: 'He prayed to Allah for a thankful heart and good deeds, showing that gratitude makes hearts tender and kind.',
          },
        },
      },
      {
        id: 'ant-s4',
        order: 4,
        phase: 'middle',
        title: { ar: 'الهدهد على غصن الزيتون', en: 'The Colorful Hoopoe Bird' },
        durationSeconds: 46,
        illustrationKey: 'ant-olive-hoopoe',
        sfxCue: 'birds',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'انظروا إلى الطائر الجميل بتاجه الملون فوق غصن الزيتون! ما أجمل خلق الله!',
            en: 'Look at the colorful hoopoe bird with its little crown on the olive branch!',
          },
          mid: {
            ar: 'كذلك كان الهدهد من طيور سليمان عليه السلام التي تطير في السماء وتسبّح لله الخالق.',
            en: 'The colorful hoopoe bird was also among the birds under Sulayman’s care, soaring across the sky.',
          },
          older: {
            ar: 'تذكر السورة أيضاً قصة الهدهد الذكي الذي ذكّر بأن السجود والعبادة لا تكون إلا لله خالق السماوات والأرض.',
            en: 'Surah An-Naml also mentions the attentive hoopoe, reminding us that worship belongs solely to Allah, Creator of all.',
          },
        },
        activity: {
          id: 'act-ant-kindness',
          type: 'match-kindness',
          title: { ar: 'كيف نعامل الكائنات الصغيرة؟', en: 'How Should We Treat Tiny Creatures?' },
          instruction: {
            ar: 'اختر التصرف اللطيف الذي يعجب الله عند رؤية نملة أو طائر صغير',
            en: 'Choose the kind choice when we see a tiny ant or garden bird',
          },
          successMessage: {
            ar: 'أحسنت! الرفق بالحيوان والحشرات الصغيرة عبادة يحبها الله.',
            en: 'Well done! Being gentle to little ants and birds pleases Allah.',
          },
          retryMessage: {
            ar: 'حاول مرة أخرى! الكائنات الصغيرة تحب الرفق والسلام.',
            en: 'Try again! Tiny creatures deserve gentle care and space.',
          },
          choices: [
            { id: 'ac1', label: { ar: 'نتركها تمر بأمان ونقول سبحان الله', en: 'Let it pass safely and say SubhanAllah' }, emoji: '🌿', isKindMatch: true },
            { id: 'ac2', label: { ar: 'نخيفها أو ندوس طريقها', en: 'Scare it or block its path' }, emoji: '🚫', isKindMatch: false },
          ],
        },
      },
      {
        id: 'ant-s5',
        order: 5,
        phase: 'ending',
        title: { ar: 'شكر الله على كل نعمة', en: 'Thanking Allah Every Day' },
        durationSeconds: 42,
        illustrationKey: 'ant-sunny-meadow',
        sfxCue: 'chime',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'كل النملات والطيور سعيدة، ونحن نقول: الحمد لله.',
            en: 'All the ants and birds are safe, and we say Alhamdulillah.',
          },
          mid: {
            ar: 'لنتذكر أن ننتبه للأشياء الصغيرة من حولنا، ونبتسم ونشكر الله في كل يوم.',
            en: 'Let us remember to notice small creatures kindly, smile, and thank Allah every day.',
          },
          older: {
            ar: 'القوة الحقيقية ليست في الحجم، بل في الرحمة والانتباه للضعفاء وشكر الله على جميع نعمه.',
            en: 'True strength shines through gentleness, noticing the small, and thanking Allah for every blessing.',
          },
        },
      },
    ],
    closingQuiz: {
      question: {
        ar: 'ماذا فعل سيدنا سليمان عليه السلام عندما سمع النملة تحذّر صديقاتها؟',
        en: 'How did Prophet Sulayman respond when he heard the little ant?',
      },
      options: [
        { id: 'aq1', label: { ar: 'تبسّم بلطف وشكر الله', en: 'Smiled gently and thanked Allah' }, emoji: '🌼', isCorrect: true },
        { id: 'aq2', label: { ar: 'صرخ بصوت عالٍ', en: 'Shouted loudly' }, emoji: '📢', isCorrect: false },
      ],
      successFeedback: { ar: 'أحسنت! تبسّم بلطف ودعا الله أن يعينه على الشكر.', en: 'Well done! He smiled kindly and thanked Allah.' },
      retryFeedback: { ar: 'تذكر الابتسامة الجميلة في الوادي الأخضر! حاول مرة أخرى.', en: 'Remember the gentle smile in the green valley! Try again.' },
    },
    closingActivity: {
      prompt: { ar: 'اضغط لنشكر الله على النعم الصغيرة والكبيرة: الحمد لله', en: 'Tap to say a joyful Alhamdulillah' },
      actionLabel: { ar: 'الحمد لله رب العالمين 🐜', en: 'Alhamdulillah 🐜' },
      rewardEmoji: '🌼',
      completionPhrase: { ar: 'رائع! قلبك رقيق ويحب الخير لكل الكائنات.', en: 'Wonderful! You have a gentle heart that cares for every creature.' },
    },
    completionBadge: {
      id: 'badge-ant',
      title: { ar: 'وسام الرفق والشكر', en: 'Gentle Kindness Badge' },
      icon: '🌼',
    },
  },

  {
    id: 'qstory-ibrahim',
    order: 7,
    title: {
      ar: 'سيدنا إبراهيم عليه السلام',
      en: 'Prophet Ibrahim — Looking at the Sky & Knowing Allah',
    },
    description: {
      ar: 'التأمل في النجوم والقمر والشمس المشرقة لاكتشاف أن الله الخالق لا يغيب أبداً.',
      en: 'Gazing peacefully at twinkling stars, the moon, and rising sun to discover Allah, the Creator who never disappears.',
    },
    durationSeconds: 230,
    recommendedMinBand: '2-3',
    coverImage: '/src/assets/images/story_ibrahim_sky_1795276482028.jpg',
    symbolicTheme: 'starry-sky',
    symbolicElements: ['twinkling-stars', 'crescent-moon', 'golden-sunrise', 'stone-walls'],
    prohibitsProphetDepiction: true,
    surahReferences: [
      {
        surahNumber: 6,
        surahNameAr: 'سورة الأنعام',
        surahNameEn: 'Surah Al-An’am',
        ayahRange: '6:75–79',
      },
      {
        surahNumber: 2,
        surahNameAr: 'سورة البقرة',
        surahNameEn: 'Surah Al-Baqarah',
        ayahRange: '2:127',
      },
    ],
    establishedQuranicFacts: [
      {
        ar: 'تأمّل نبي الله إبراهيم عليه السلام في الكوكب والقمر والشمس، فلمّا أفلت وغابت قال إن الله وحده فاطر السماوات والأرض لا يغيب، كما بنى مع إسماعيل قواعد البيت الحرام.',
        en: 'The Quran relates how Prophet Ibrahim (AS) reflected on the star, moon, and sun setting, affirming devotion solely to Allah who created the heavens and earth, and raised the foundations of the Sacred House.',
      },
    ],
    simplifiedExplanation: {
      ar: 'مشاهد طبيعية للسماء في الليل والفجر والصحراء الهادئة والجدران الحجرية — خالية تماماً من أي تصوير بشري.',
      en: 'Natural desert twilight-to-dawn scenery with stars, moon, sun, and clean stone walls — zero human depictions.',
    },
    ageSummary: {
      young: {
        ar: 'النجوم تغيب والقمر يغيب والشمس تغيب، أما الله الخالق فمعنا دائماً.',
        en: 'Stars set, the moon sets, and the sun sets — only Allah our Creator stays with us always.',
      },
      mid: {
        ar: 'نظر سيدنا إبراهيم عليه السلام إلى النجوم والقمر والشمس في السماء وتفكّر بذكاء: كلها مخلوقات جميلة تغيب، والله وحده هو الخالق الدائم.',
        en: 'Prophet Ibrahim (AS) looked thoughtfully at the stars, moon, and sun; each sets in turn, showing Allah alone is the everlasting Creator.',
      },
      older: {
        ar: 'علّمتنا تأملات نبي الله إبراهيم عليه السلام في الكون أن العقل السليم يرى في جمال السماء والأرض دليلاً على عظمة الله الواحد.',
        en: 'Prophet Ibrahim’s contemplation of the night and dawn sky teaches how the wonders of creation point directly to Allah the One.',
      },
    },
    narrationNote: {
      ar: 'مشاهد كونية وطبيعية للتفكر في خلق الله — بدون تصوير للأنبياء.',
      en: 'Cosmic and nature contemplation scenes — zero Prophet depiction.',
    },
    moralLesson: {
      ar: 'الله خالق السماء والنجوم والشمس وهو القريب الحاضر دائماً.',
      en: 'Allah created the stars, moon, and sun, and He is always near.',
    },
    publishedStatus: 'published',
    enabled: true,
    scenes: [
      {
        id: 'ibrahim-s1',
        order: 1,
        phase: 'intro',
        title: { ar: 'نجوم الليل الهادئ', en: 'Stars in the Quiet Night' },
        durationSeconds: 44,
        illustrationKey: 'ibrahim-night-stars',
        sfxCue: 'stars',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'انظروا إلى السماء المظلمة وفيها نجمة صغيرة تلمع ثم تختفي عند الصباح.',
            en: 'Look at the night sky where a bright star twinkles and then fades away.',
          },
          mid: {
            ar: 'في قصةٍ مبسّطةٍ للأطفال: في ليلة هادئة تأمّل سيدنا إبراهيم عليه السلام السماء الواسعة، فرأى كوكباً مضيئاً، فلما أفل وغاب تيقّن أن ما يغيب لا يُعبد، وأن الله الخالق لا يغيب أبداً.',
            en: 'Child-friendly storytelling: Under a quiet night sky, Prophet Ibrahim reflected on the vast heavens, watched a bright star appear and set, and affirmed that whatever fades cannot be worshipped—only Allah the Creator never disappears.',
          },
          older: {
            ar: 'دعا إبراهيم عليه السلام قومه إلى التفكر؛ فالكوكب رغم لمعانه يتغيّر ويأفل، أما الخالق سبحانه فهو الباقي الدائم الذي لا يغيب.',
            en: 'Inviting thoughtful reflection, he pointed out that even bright stars set and pass, while the Creator remains forever.',
          },
        },
      },
      {
        id: 'ibrahim-s2',
        order: 2,
        phase: 'middle',
        title: { ar: 'القمر والشمس تتبعان أمر الله', en: 'Moon & Sun Follow Allah’s Order' },
        durationSeconds: 48,
        illustrationKey: 'ibrahim-dawn-transition',
        sfxCue: 'dawn',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'القمر جميل في الليل والشمس دافئة في النهار! هيا نكتشف خلق الله في السماء.',
            en: 'The moon glows at night and the warm sun rises at dawn! Tap Allah’s signs in the sky.',
          },
          mid: {
            ar: 'ثم طلع القمر منيراً وغاب، ثم أشرقت الشمس الدافئة وبعد النهار تغرب، فكلها تسير بأمر الله خالقها.',
            en: 'Next the glowing moon set, and the bright sun rose and later set — all moving faithfully by the command of Allah.',
          },
          older: {
            ar: 'هكذا أعلن إبراهيم عليه السلام توجّهه الصادق لله الذي فطر السماوات والأرض وحده لا شريك له.',
            en: 'With clear reason, Prophet Ibrahim turned his heart wholly to Allah, Creator of the heavens and earth.',
          },
        },
        activity: {
          id: 'act-ibrahim-sky',
          type: 'tap-targets',
          title: { ar: 'اكتشف آيات الله في السماء', en: 'Find Allah’s Signs in the Sky' },
          instruction: {
            ar: 'اضغط على النجمة اللامعة وهلال القمر والشمس المشرقة لترى كيف خلقها الله بنظام',
            en: 'Tap the twinkling star, crescent moon, and rising sun to celebrate Allah’s creation',
          },
          successMessage: {
            ar: 'سبحان الله! كل نجوم السماء وقمرها وشمسها خلق الله الجميل.',
            en: 'SubhanAllah! The stars, moon, and sun are Allah’s wonderful creation.',
          },
          retryMessage: {
            ar: 'هذه صخرة في الوادي! انظر عالياً نحو السماء.',
            en: 'That is a desert rock below! Look up into the sky.',
          },
          requiredCount: 3,
          items: [
            { id: 'ib1', label: { ar: 'نجمة لامعة', en: 'Shining Star' }, emoji: '✨', xPct: 24, yPct: 18, isTarget: true },
            { id: 'ib2', label: { ar: 'القمر المنير', en: 'Crescent Moon' }, emoji: '🌙', xPct: 16, yPct: 26, isTarget: true },
            { id: 'ib3', label: { ar: 'شمس الفجر', en: 'Rising Sun' }, emoji: '🌅', xPct: 72, yPct: 36, isTarget: true },
            { id: 'ib4', label: { ar: 'صخرة الوادي', en: 'Desert Rock' }, emoji: '🪨', xPct: 48, yPct: 80, isTarget: false },
          ],
        },
      },
      {
        id: 'ibrahim-s3',
        order: 3,
        phase: 'middle',
        title: { ar: 'الكرم والمحبة للضيف', en: 'Warm Hospitality & Sharing' },
        durationSeconds: 46,
        illustrationKey: 'ibrahim-sandstone-valley',
        sfxCue: 'forest',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'أحب سيدنا إبراهيم استقبال الضيوف بابتسامة وطعام طيب.',
            en: 'Prophet Ibrahim loved welcoming guests kindly with a warm smile and good food.',
          },
          mid: {
            ar: 'كان نبي الله إبراهيم عليه السلام كريماً لطيفاً، يستقبل ضيوفه بالسلام ويقدم لهم أطيب الطعام.',
            en: 'Prophet Ibrahim (AS) was wonderfully generous, greeting guests with Salam and sharing warm hospitality.',
          },
          older: {
            ar: 'اشتُهر إبراهيم عليه السلام بإكرام الضيف وطيب الكلام والدعاء بالخير لأهله والناس أجمعين.',
            en: 'He became a timeless example of generosity, gentle speech, and praying for goodness and peace.',
          },
        },
      },
      {
        id: 'ibrahim-s4',
        order: 4,
        phase: 'middle',
        title: { ar: 'بناء قواعد البيت المبارك', en: 'Raising the Sacred Foundations' },
        durationSeconds: 48,
        illustrationKey: 'ibrahim-stone-foundations',
        sfxCue: 'chime',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'بنى بيتاً مباركاً من حجارة طيبة ودعا للناس بالسلام!',
            en: 'Clean stone walls were built with prayers for peace and blessing!',
          },
          mid: {
            ar: 'بأمر الله، رفع إبراهيم عليه السلام مع ابنه إسماعيل عليه السلام قواعد الكعبة في مكة ودعوا الله بالقبول والسلام.',
            en: 'By Allah’s command, Prophet Ibrahim and his son Ismail (AS) raised the foundations of the Kaaba, praying for peace and acceptance.',
          },
          older: {
            ar: 'شارك في بناء البيت الحرام ودعا ربه أن يجعل مكة بلداً آمناً مليئاً بالخير والبركة.',
            en: 'Raising the foundations of the Sacred House, he prayed to Allah to make Mecca a peaceful sanctuary of blessings.',
          },
        },
        activity: {
          id: 'act-ibrahim-values',
          type: 'place-pairs',
          title: { ar: 'اجمع صفات إبراهيم عليه السلام الجميلة', en: 'Gather the Kind Blessings of the Story' },
          instruction: {
            ar: 'اضغط على كل بطاقة لتضيفها إلى بيت الخير والسلام',
            en: 'Tap each card to place it into the peaceful house of blessings',
          },
          successMessage: {
            ar: 'ما شاء الله! التأمل والكرم والسلام خصال رائعة.',
            en: 'MashaAllah! Reflection, generosity, and peace are wonderful gifts.',
          },
          retryMessage: {
            ar: 'أكمل وضع كل البطاقات الطيبة!',
            en: 'Keep placing all the gentle blessing cards!',
          },
          destinationLabel: { ar: 'بيت السلام والبركة', en: 'House of Peace' },
          items: [
            { id: 'ibv1', label: { ar: 'تأمل السماء وشكر الخالق', en: 'Wonder at Allah’s sky' }, emoji: '🌌', pairCountLabel: { ar: 'قيمة ١', en: 'Gift 1' } },
            { id: 'ibv2', label: { ar: 'إكرام الضيف والمشاركة', en: 'Sharing with guests' }, emoji: '🍲', pairCountLabel: { ar: 'قيمة ٢', en: 'Gift 2' } },
            { id: 'ibv3', label: { ar: 'الدعاء بالسلام والأمان', en: 'Praying for peace' }, emoji: '🕊️', pairCountLabel: { ar: 'قيمة ٣', en: 'Gift 3' } },
          ],
        },
      },
      {
        id: 'ibrahim-s5',
        order: 5,
        phase: 'ending',
        title: { ar: 'الله معنا في كل وقت', en: 'Allah Is Always Near' },
        durationSeconds: 44,
        illustrationKey: 'ibrahim-dawn-transition',
        sfxCue: 'chime',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'ننظر إلى القمر والشمس ونقول: ما شاء الله، سبحان الله.',
            en: 'Looking at the moon and sun, we say MashaAllah, SubhanAllah!',
          },
          mid: {
            ar: 'كلما رأينا السماء الجميلة تذكرنا أن الله خلقها بنظام بديع وأنه خليل القلوب الصادقة.',
            en: 'Whenever we gaze at the beautiful sky, we remember Allah made it with harmony and loves sincere hearts.',
          },
          older: {
            ar: 'عاش إبراهيم عليه السلام محباً لله، فدعانا لنحب خالقنا ونكرم الناس وندعو بالسلام للجميع.',
            en: 'Called the close friend of Allah, Prophet Ibrahim teaches us to know our Creator, share warmly, and pray for peace.',
          },
        },
      },
    ],
    closingQuiz: {
      question: {
        ar: 'ما الذي تعلمه سيدنا إبراهيم عندما غابت النجوم والقمر والشمس؟',
        en: 'What did Prophet Ibrahim notice when the stars, moon, and sun set?',
      },
      options: [
        { id: 'ibq1', label: { ar: 'أن الله الخالق وحده لا يغيب أبداً', en: 'Only Allah the Creator never fades' }, emoji: '🌅', isCorrect: true },
        { id: 'ibq2', label: { ar: 'أن السماء بلا خالق', en: 'That the sky has no Creator' }, emoji: '🪨', isCorrect: false },
      ],
      successFeedback: { ar: 'ممتاز! الله خالق السماء والأرض لا يغيب أبداً.', en: 'Wonderful! Allah the Creator of sky and earth never fades.' },
      retryFeedback: { ar: 'تذكر السماء عند الفجر! حاول مرة أخرى.', en: 'Remember the sky transitioning to sunrise! Try again.' },
    },
    closingActivity: {
      prompt: { ar: 'اضغط لنسبح خالق النجوم والشمس والقمر: سبحان الله الخالق', en: 'Tap to say SubhanAllah al-Khaliq' },
      actionLabel: { ar: 'سبحان الله الخالق 🌙', en: 'SubhanAllah the Creator 🌙' },
      rewardEmoji: '🌅',
      completionPhrase: { ar: 'بارك الله فيك! خلق الله كله يسبّح بحمده.', en: 'MashaAllah! All of Allah’s creation praises Him.' },
    },
    completionBadge: {
      id: 'badge-ibrahim',
      title: { ar: 'وسام التأمل في السماء', en: 'Sky Wonder Badge' },
      icon: '🌅',
    },
  },

  {
    id: 'qstory-cave',
    order: 8,
    title: {
      ar: 'أصحاب الكهف',
      en: 'The Companions of the Cave',
    },
    description: {
      ar: 'قصة الكهف الدافئ المشرق بنور الشمس، والأشجار المباركة، والكلب الوفي الحارس عند الباب.',
      en: 'A sunlit mountain cave, peaceful olive trees, and a loyal hound resting calmly by the entrance under Allah’s mercy.',
    },
    durationSeconds: 260,
    recommendedMinBand: '2-3',
    coverImage: '/src/assets/images/story_ashab_kahf_1795276482006.jpg',
    symbolicTheme: 'light-cave',
    symbolicElements: ['mountain-cave', 'olive-trees', 'golden-sunbeam', 'faithful-hound'],
    prohibitsProphetDepiction: true,
    surahReferences: [
      {
        surahNumber: 18,
        surahNameAr: 'سورة الكهف',
        surahNameEn: 'Surah Al-Kahf',
        ayahRange: '18:9–26',
      },
    ],
    establishedQuranicFacts: [
      {
        ar: 'لجأ فتية مؤمنون إلى الكهف ودعوا الله رحمةً ورشداً، فحفظهم الله وأنامهم سنين طويلة مع كلبهم عند المدخل، وكانت الشمس تميل عنهم بلطف عند طلوعها وغروبها.',
        en: 'Surah Al-Kahf describes young believers who sought shelter in the cave praying for Allah’s mercy and guidance; Allah caused them to sleep peacefully for years with their dog at the threshold while sunlight gently shifted around them.',
      },
    ],
    simplifiedExplanation: {
      ar: 'مشاهد طبيعية لمدخل الكهف الجبلي وشجر الزيتون وأشعة الشمس والكلب اللطيف المستلقي بسلام — بدون أي رسم وجوه أو أشخاص.',
      en: 'Natural sunlit cave entrance, olive trees, wildflowers, and resting hound dog — zero depiction of faces or humans.',
    },
    ageSummary: {
      young: {
        ar: 'كهف دافئ بين الجبال وأشجار الزيتون، والشمس تدفئه بنور لطيف والكلب يحرس الباب.',
        en: 'A cozy mountain cave with olive trees, soft warm sunshine, and a friendly dog resting at the door.',
      },
      mid: {
        ar: 'دعا شباب مؤمنون الله أن يحفظ إيمانهم، فآواهم إلى كهف هادئ مع كلبهم الوفي، وحفظهم الله في نوم هادئ مع أشعة الشمس الدافئة.',
        en: 'Sincere young believers prayed for Allah’s mercy, so Allah sheltered them in a peaceful cave with their faithful hound under gentle sunlit warmth.',
      },
      older: {
        ar: 'تروي سورة الكهف كيف حفظ الله الفتية المؤمنين في الكهف حين آمنوا به ودعوه أن يرزقهم رحمةً ورشداً في أمرهم.',
        en: 'Surah Al-Kahf tells how Allah protected sincere believers inside the cave when they trusted Him and prayed for mercy and guidance.',
      },
    },
    narrationNote: {
      ar: 'مشاهد كهف جبلي وشجر زيتون ونور شمس — بدون أي صور بشرية.',
      en: 'Mountain cave, olive trees, and golden sunlight scenery — no human figures.',
    },
    moralLesson: {
      ar: 'الثقة بالله والرفق بالحيوان تجلبان السكينة والبركة.',
      en: 'Trusting Allah and kindness to animals bring calm and blessing.',
    },
    publishedStatus: 'published',
    enabled: true,
    scenes: [
      {
        id: 'cave-s1',
        order: 1,
        phase: 'intro',
        title: { ar: 'الدعاء إلى الله والذهاب إلى الجبل', en: 'A Prayer & A Peaceful Mountain' },
        durationSeconds: 48,
        illustrationKey: 'cave-olive-arch',
        sfxCue: 'cave',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'انظروا إلى الكهف الجبلي الجميل وحوله أشجار الزيتون والأزهار.',
            en: 'Look at the peaceful mountain cave surrounded by green olive trees and wildflowers.',
          },
          mid: {
            ar: 'أراد فتية صادقون عبادة الله وحده بسلام، فدعوا الله برحمته ولجؤوا إلى كهف واسع في الجبل.',
            en: 'Sincere young believers wanted to worship Allah in peace, so they prayed for Allah’s mercy and entered a quiet mountain cave.',
          },
          older: {
            ar: 'ترك الفتية المؤمنون الضوضاء وذهبوا إلى كهف الجبل وهم يدعون الله مخلصين أن يمنحهم من لدنه رحمةً ويهيئ لهم من أمرهم رشداً.',
            en: 'Leaving turmoil behind, the young believers sheltered in a mountain cave, sincerely praying that Allah grant them mercy and right guidance.',
          },
        },
      },
      {
        id: 'cave-s2',
        order: 2,
        phase: 'middle',
        title: { ar: 'الكلب الوفي عند باب الكهف', en: 'The Loyal Dog by the Cave Threshold' },
        durationSeconds: 52,
        illustrationKey: 'cave-hound-sunbeams',
        sfxCue: 'forest',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'استلقى كلب لطيف وهادئ عند مدخل الكهف! المسوا الكلب الوفي والأشجار الخضراء.',
            en: 'A gentle dog rested peacefully right outside the sunlit cave! Tap the faithful dog and olive trees.',
          },
          mid: {
            ar: 'ومعهم كلبهم الوفي مستلقٍ بهدوء على مدخل الكهف يحرس المكان، فصار الكلب الوفي مذكوراً بالخير في القرآن!',
            en: 'Their faithful hound stretched out calmly at the cave entrance — a gentle reminder that kindness to animals is remembered in the Quran!',
          },
          older: {
            ar: 'جلس كلبهم باسطاً ذراعيه عند الباب بأمان، في مشهد جميل يجمع بين رفقة الحيوان الوفي ورعاية الله.',
            en: 'Their loyal dog lay peacefully at the threshold, uniting gentle companionship with Allah’s constant protection.',
          },
        },
        activity: {
          id: 'act-cave-shelter',
          type: 'tap-targets',
          title: { ar: 'تعرّف على حديقة الكهف الدافئة', en: 'Explore the Sunlit Cave Entrance' },
          instruction: {
            ar: 'اضغط على الكلب الوفي وشجرة الزيتون ونور الشمس عند باب الكهف',
            en: 'Tap the resting hound, green olive tree, and golden sunbeams at the cave',
          },
          successMessage: {
            ar: 'ممتاز! هذا الكهف محاط بالسكينة ونور الله.',
            en: 'Wonderful! This quiet cave is surrounded by peace and warm light.',
          },
          retryMessage: {
            ar: 'انظر إلى الأشجار الخضراء والكلب المستلقي بسلام!',
            en: 'Look for the olive trees, sunbeam, and resting dog!',
          },
          requiredCount: 3,
          items: [
            { id: 'cv1', label: { ar: 'الكلب الوفي الهادئ', en: 'Peaceful Hound' }, emoji: '🐕', xPct: 30, yPct: 76, isTarget: true },
            { id: 'cv2', label: { ar: 'شجرة زيتون خضراء', en: 'Olive Tree' }, emoji: '🌳', xPct: 20, yPct: 35, isTarget: true },
            { id: 'cv3', label: { ar: 'نور الشمس اللطيف', en: 'Golden Sunbeam' }, emoji: '☀️', xPct: 60, yPct: 50, isTarget: true },
            { id: 'cv4', label: { ar: 'حجر صغير', en: 'Cave Pebble' }, emoji: '🪨', xPct: 80, yPct: 82, isTarget: false },
          ],
        },
      },
      {
        id: 'cave-s3',
        order: 3,
        phase: 'middle',
        title: { ar: 'النوم المريح وأشعة الشمس', en: 'Peaceful Rest & Gentle Sunlight' },
        durationSeconds: 52,
        illustrationKey: 'cave-hound-sunbeams',
        sfxCue: 'dawn',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'أرسل الله نوماً هادئاً جداً، وتمر الشمس بنور دافئ كل يوم.',
            en: 'Allah sent deep calm sleep while warm sunlight curved gently past the entrance.',
          },
          mid: {
            ar: 'ألقى الله عليهم نوماً مريحاً، وكانت الشمس تطلع وتميل عن يمين الكهف وشماله بلطف حتى لا يزعجهم الحر.',
            en: 'Allah blessed them with restful sleep, guiding morning and evening sunlight gently around the cave so they stayed comfortable.',
          },
          older: {
            ar: 'بقوا في الكهف سنين عديدة في رعاية الله التامة، مما يدل على أن الله قادر على حفظ عباده فوق كل حساب.',
            en: 'For many years Allah kept them safe inside the cave, proving His power and care reach beyond all human reckoning.',
          },
        },
      },
      {
        id: 'cave-s4',
        order: 4,
        phase: 'middle',
        title: { ar: 'الاستيقاظ بنور جديد', en: 'Waking Up to A Bright Morning' },
        durationSeconds: 54,
        illustrationKey: 'cave-olive-arch',
        sfxCue: 'chime',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'استيقظوا بخير وأمان فرأوا الناس قد أصبحوا طيبين يحبون الله!',
            en: 'They woke up safe and sound to see their town filled with peace and faith!',
          },
          mid: {
            ar: 'ثم بعثهم الله من نومهم نشيطين في صباح مشرق، واكتشفوا أن مدينتهم صارت آمنة ومؤمنة بفضل الله.',
            en: 'When Allah awakened them on a bright morning, they discovered their town had become peaceful and filled with believers.',
          },
          older: {
            ar: 'صارت قصتهم آية عظيمة على صدق وعد الله، وأن من يثق بالله يفتح له أبواب الفرج والأمان.',
            en: 'Their story became an inspiring sign that Allah’s promise is true and trusting Him opens doors of peace.',
          },
        },
        activity: {
          id: 'act-cave-kindness',
          type: 'match-kindness',
          title: { ar: 'ما الذي يحفظ قلبنا مطمئناً؟', en: 'What Keeps Our Hearts Calm & Safe?' },
          instruction: {
            ar: 'اختر العادة الجميلة التي تعلمناها من قصة أصحاب الكهف',
            en: 'Choose the calm, kind habit from the story of the Cave Companions',
          },
          successMessage: {
            ar: 'أحسنت! الدعاء والرفق بالحيوان يجلبان السكينة.',
            en: 'Well done! Prayer and kindness to animals bring lasting calm.',
          },
          retryMessage: {
            ar: 'حاول مجدداً! اختر الدعاء الهادئ واللطف.',
            en: 'Try again! Choose gentle prayer and care.',
          },
          choices: [
            { id: 'ck1', label: { ar: 'ندعو الله بالرحمة ونعتني بالحيوانات اللطيفة', en: 'Pray to Allah for mercy and care gently for animals' }, emoji: '🌿', isKindMatch: true },
            { id: 'ck2', label: { ar: 'ننسى الدعاء ونؤذي الكائنات', en: 'Forget prayer and mistreat creatures' }, emoji: '💢', isKindMatch: false },
          ],
        },
      },
      {
        id: 'cave-s5',
        order: 5,
        phase: 'ending',
        title: { ar: 'سورة الكهف ونور الجمعة', en: 'Light of Surah Al-Kahf' },
        durationSeconds: 54,
        illustrationKey: 'cave-olive-arch',
        sfxCue: 'chime',
        narrationAudioUrl: null,
        narration: {
          young: {
            ar: 'نحب قراءة سورة الكهف مع العائلة كل يوم جمعة!',
            en: 'Families love listening to Surah Al-Kahf together every Friday!',
          },
          mid: {
            ar: 'في ختام هذه الحكاية المبسّطة، نتعلّم من أصحاب الكهف أن نتوجّه إلى الله بالدعاء طلباً للرحمة والهداية، وأن نحافظ على الرفق والهدوء.',
            en: 'At the end of this gentle story, the Cave Companions teach us to turn to Allah in prayer for mercy and guidance, and to live with kindness and calm.',
          },
          older: {
            ar: 'في كل جمعة تنير سورة الكهف بيوتنا بالسكينة وتذكرنا بأن الإيمان والدعاء هما حصن المؤمن.',
            en: 'Every Friday, Surah Al-Kahf fills homes with calm light, reminding us faith and prayer are our surest shelter.',
          },
        },
      },
    ],
    closingQuiz: {
      question: {
        ar: 'من كان يستلقي بهدوء عند مدخل الكهف مع أصحاب الكهف؟',
        en: 'Which faithful creature rested calmly at the cave entrance?',
      },
      options: [
        { id: 'cq1', label: { ar: 'كلبهم الوفي الهادئ', en: 'Their calm faithful dog' }, emoji: '🐕', isCorrect: true },
        { id: 'cq2', label: { ar: 'جمل كبير في الصحراء', en: 'A camel in the distant sand' }, emoji: '🐪', isCorrect: false },
      ],
      successFeedback: { ar: 'رائع! كان كلبهم الوفي مستلقياً بسلام عند باب الكهف.', en: 'Awesome! Their faithful dog rested peacefully by the cave door.' },
      retryFeedback: { ar: 'تذكر صديقهم عند مدخل الكهف المشرق! حاول مرة أخرى.', en: 'Remember who rested beside the sunlit cave entrance! Try again.' },
    },
    closingActivity: {
      prompt: { ar: 'اضغط لنرفع دعاءً لطيفاً طلباً لرحمة الله وهدايته', en: 'Tap to say a gentle prayer for Allah’s mercy and guidance' },
      actionLabel: { ar: 'اللهم ارحمنا واهدنا 🌳', en: 'Ya Allah, grant us mercy 🌳' },
      rewardEmoji: '☀️',
      completionPhrase: { ar: 'أحسنت يا بطل! أكملت حكايات من القرآن اليوم بسكينة وجمال.', en: 'MashaAllah! May Allah fill your heart with peace and light.' },
    },
    completionBadge: {
      id: 'badge-cave',
      title: { ar: 'وسام السكينة والنور', en: 'Cave Light Badge' },
      icon: '☀️',
    },
  },
];

/**
 * Legacy compatibility entry preserved solely so historical Neon progress rows
 * referencing 'qstory-gratitude-garden' continue resolving cleanly on backend endpoints.
 */
export const LEGACY_GARDEN_STORY: QuranStorySpec = {
  id: 'qstory-gratitude-garden',
  order: 99,
  title: { ar: 'حديقة الشكر والبركة', en: 'The Garden of Gratitude' },
  description: {
    ar: 'قصة قصيرة عن شكر الله ومشاركة الخيرات مع الجيران.',
    en: 'A short story about gratitude and sharing blessings.',
  },
  durationSeconds: 180,
  recommendedMinBand: '2-3',
  coverImage: '/src/assets/images/story_ashab_kahf_1795276482006.jpg',
  symbolicTheme: 'light-cave',
  symbolicElements: ['blooming-trees', 'olive-grove', 'sharing-basket'],
  prohibitsProphetDepiction: true,
  surahReferences: [{ surahNumber: 68, surahNameAr: 'سورة القلم', surahNameEn: 'Surah Al-Qalam', ayahRange: '68:17–33' }],
  establishedQuranicFacts: [{ ar: 'التذكير بقول ما شاء الله وشكر نعم الله.', en: 'Remembering to thank Allah for blessings and share kindly.' }],
  simplifiedExplanation: { ar: 'مشهد رمزي لبستان مثمر وسلال خير.', en: 'Symbolic blooming garden and sharing baskets.' },
  ageSummary: {
    young: { ar: 'عندما نقول الحمد لله ونشارك طعامنا، يبارك الله لنا.', en: 'When we say Alhamdulillah and share kindly, Allah blesses us.' },
    mid: { ar: 'مشاركة الخيرات مع الجيران تحفظ البركة وتنشر السعادة.', en: 'Sharing fruit and kindness with neighbors keeps blessings blooming.' },
    older: { ar: 'نتذكر أن النعم من عند الله ونشارك المحتاجين بابتسامة.', en: 'Remember all blessings come from Allah and share gladly.' },
  },
  narrationNote: { ar: 'مشهد رمزي لبستان مثمر.', en: 'Symbolic blooming garden.' },
  moralLesson: { ar: 'مشاركة الخير وشكر الله تحفظ النعم.', en: 'Gratitude and sharing keep blessings growing.' },
  publishedStatus: 'draft',
  enabled: false,
  scenes: [],
  closingQuiz: {
    question: { ar: 'ماذا نقول عند رؤية نعم الله؟', en: 'What do we say when we see Allah’s blessings?' },
    options: [{ id: 'g1', label: { ar: 'الحمد لله وما شاء الله', en: 'Alhamdulillah & MashaAllah' }, emoji: '🌿', isCorrect: true }],
    successFeedback: { ar: 'أحسنت!', en: 'Well done!' },
    retryFeedback: { ar: 'حاول مرة أخرى!', en: 'Try again!' },
  },
  closingActivity: {
    prompt: { ar: 'قل الحمد لله', en: 'Say Alhamdulillah' },
    actionLabel: { ar: 'الحمد لله', en: 'Alhamdulillah' },
    rewardEmoji: '🧺',
    completionPhrase: { ar: 'بارك الله فيك!', en: 'MashaAllah!' },
  },
  completionBadge: { id: 'badge-garden', title: { ar: 'وسام الشكر', en: 'Gratitude Badge' }, icon: '🧺' },
};

export function mergeStoryWithAdminOverride(
  baseStory: QuranStorySpec,
  override?: QuranStoryAdminOverride,
): QuranStorySpec {
  if (!override) return baseStory;
  let mergedScenes = baseStory.scenes.map((sc) => {
    const scOver = override.sceneOverrides?.[sc.id];
    if (!scOver) return sc;
    return {
      ...sc,
      ...(scOver.order !== undefined ? { order: scOver.order } : {}),
      ...(scOver.title ? { title: scOver.title } : {}),
      ...(scOver.durationSeconds !== undefined ? { durationSeconds: scOver.durationSeconds } : {}),
      ...(scOver.illustrationKey ? { illustrationKey: scOver.illustrationKey } : {}),
      ...(scOver.sfxCue ? { sfxCue: scOver.sfxCue } : {}),
      ...(scOver.narrationAudioUrl !== undefined ? { narrationAudioUrl: scOver.narrationAudioUrl } : {}),
      ...(scOver.narration ? { narration: scOver.narration } : {}),
    };
  });

  if (Array.isArray(override.sceneOrder) && override.sceneOrder.length > 0) {
    const idxMap = new Map(override.sceneOrder.map((id, idx) => [id, idx]));
    mergedScenes = [...mergedScenes].sort((a, b) => {
      const ia = idxMap.has(a.id) ? idxMap.get(a.id)! : 999 + a.order;
      const ib = idxMap.has(b.id) ? idxMap.get(b.id)! : 999 + b.order;
      return ia - ib;
    });
  }

  return {
    ...baseStory,
    ...(override.enabled !== undefined ? { enabled: override.enabled } : {}),
    ...(override.publishedStatus !== undefined ? { publishedStatus: override.publishedStatus } : {}),
    ...(override.title ? { title: override.title } : {}),
    ...(override.description ? { description: override.description } : {}),
    ...(override.moralLesson ? { moralLesson: override.moralLesson } : {}),
    ...(override.simplifiedExplanation ? { simplifiedExplanation: override.simplifiedExplanation } : {}),
    ...(override.coverImage ? { coverImage: override.coverImage } : {}),
    ...(override.surahReferences ? { surahReferences: override.surahReferences } : {}),
    scenes: mergedScenes.map((s, idx) => ({ ...s, order: idx + 1 })),
    durationSeconds: mergedScenes.reduce((acc, s) => acc + Math.max(10, s.durationSeconds || 30), 0) || baseStory.durationSeconds,
  };
}
