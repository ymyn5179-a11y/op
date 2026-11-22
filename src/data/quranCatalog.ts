import type {
  QuranMannerSpec,
  QuranReciterSpec,
  QuranStorySpec,
  QuranSurahSpec,
} from '../types/nonoland';
import {
  LEGACY_GARDEN_STORY,
  QURAN_STORY_LIBRARY,
  mergeStoryWithAdminOverride,
} from './quranStoryLibrary';

export { LEGACY_GARDEN_STORY, QURAN_STORY_LIBRARY, mergeStoryWithAdminOverride };

export const QURAN_OPENING_BASMALAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

export const QURAN_SURAHS: QuranSurahSpec[] = [
  {
    id: 'surah-1',
    number: 1,
    nameAr: 'سُورَةُ ٱلْفَاتِحَةِ',
    nameEn: 'Al-Fatihah',
    englishMeaning: 'The Opening',
    revelationType: 'meccan',
    ayahCount: 7,
    recommendedMinBand: '1-2',
    hasOpeningBasmalah: false, // Basmalah is verse 1:1 itself in Al-Fatihah
    textSource: 'King Fahd Complex Medina Mushaf (api.quran.com v4 text_uthmani, cross-checked with AlQuran Cloud quran-uthmani)',
    textSourceUrl: 'https://api.quran.com/api/v4/verses/by_chapter/1?fields=text_uthmani',
    textVerificationStatus: 'verified',
    textSha256: '2ba2195e4abc07d8551ba06ed4df0b956322f5106c777ff3bee0bdc805a0810a',
    ageSummary: {
      young: {
        ar: 'نبدأ دائماً باسم الله الرحمن الرحيم، ونشكر الله الذي يحبنا ويرعانا.',
        en: 'We always begin with Allah’s gentle name and thank Him for loving and caring for us.',
      },
      mid: {
        ar: 'سورة جميلة نحمد فيها الله رب العالمين، ونسأله أن يهدينا للخير واللطف.',
        en: 'A gentle opening Surah thanking Allah, Lord of all creation, and asking Him to guide our steps.',
      },
      older: {
        ar: 'أم الكتاب: نبدأ ببسم الله، ونحمد الله الرحيم، ونطلب الهداية إلى الطريق الصالح في كل يوم.',
        en: 'The Opening of the Quran: praising Allah the Most Merciful, trusting Him, and asking for guidance toward goodness.',
      },
    },
    gentleValue: {
      ar: 'الشكر والمحبة والبدء باسم الله',
      en: 'Gratitude, love, and beginning with Bismillah',
    },
    ayahs: [
      {
        number: 1,
        verseKey: '1:1',
        textUthmani: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
        ageMeaning: {
          young: { ar: 'نبدأ باسم الله الرحمن الرحيم.', en: 'We begin in the name of Allah, the Most Compassionate.' },
          mid: { ar: 'نقول بسم الله قبل أن نبدأ أي عمل جميل.', en: 'We say Bismillah before starting any good activity.' },
          older: { ar: 'نستعين باسم الله واسع الرحمة في كل أمورنا.', en: 'We begin with the name of Allah, full of gentle mercy.' },
        },
      },
      {
        number: 2,
        verseKey: '1:2',
        textUthmani: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ',
        ageMeaning: {
          young: { ar: 'الحمد والشكر لله خالق كل شيء.', en: 'Thank You, Allah, Creator of everything around us!' },
          mid: { ar: 'نشكر الله على النعم والعائلة والطبيعة الجميلة.', en: 'All praise and thanks belong to Allah for family, skies, and earth.' },
          older: { ar: 'الحمد لله الذي ربّى وخلق السماوات والأرض وكل الكائنات.', en: 'All gratitude belongs to Allah, Sustainer of all worlds.' },
        },
      },
      {
        number: 3,
        verseKey: '1:3',
        textUthmani: 'ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
        ageMeaning: {
          young: { ar: 'الله رحيم ولطيف جداً.', en: 'Allah is endlessly kind and merciful.' },
          mid: { ar: 'رحمة الله قريبة منا تحيطنا في كل وقت.', en: 'Allah’s mercy surrounds us gently every moment.' },
          older: { ar: 'الله واسع الرحمة بجميع خلقه، يفيض عليهم بالعطف.', en: 'The Most Compassionate, the Most Merciful to all creation.' },
        },
      },
      {
        number: 4,
        verseKey: '1:4',
        textUthmani: 'مَـٰلِكِ يَوْمِ ٱلدِّينِ',
        ageMeaning: {
          young: { ar: 'الله يحكم بالخير والعدل دائماً.', en: 'Allah is always fair, wise, and kind.' },
          mid: { ar: 'الله يرى كل عمل لطيف نقوم به ويفرحنا بالخير.', en: 'Allah sees every gentle good deed we do.' },
          older: { ar: 'الله مالك يوم الجزاء الذي يكافئ المحسنين بعدله ورحمته.', en: 'Sovereign of the Day of Recompense, full of justice and mercy.' },
        },
      },
      {
        number: 5,
        verseKey: '1:5',
        textUthmani: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
        ageMeaning: {
          young: { ar: 'نحب الله ونطلب مساعدته دائماً.', en: 'We love Allah and ask Him for help.' },
          mid: { ar: 'نوجه قلوبنا لله وحده ونستعين به ليعيننا.', en: 'We worship Allah alone and ask Him to give us strength.' },
          older: { ar: 'نخلص حبنا وعبادتنا لله وحده، ومنه نطلب العون في كل خطوة.', en: 'You alone we worship, and You alone we ask for help.' },
        },
      },
      {
        number: 6,
        verseKey: '1:6',
        textUthmani: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
        ageMeaning: {
          young: { ar: 'يا رب دلّنا على الطريق الجميل.', en: 'Guide us to the kind and right path.' },
          mid: { ar: 'ندعو الله أن يهدينا للصدق واللطف ومساعدة الآخرين.', en: 'We ask Allah to guide us toward honesty and kindness.' },
          older: { ar: 'اهدنا يا الله إلى الطريق الواضح المستقيم الذي يرضيك.', en: 'Guide us onto the straight, clear path of goodness.' },
        },
      },
      {
        number: 7,
        verseKey: '1:7',
        textUthmani: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
        ageMeaning: {
          young: { ar: 'طريق الطيبين الذين يحبهم الله.', en: 'The path of kind people whom Allah loves.' },
          mid: { ar: 'طريق الأنبياء والصالحين الذين أنعم الله عليهم بالخير.', en: 'The path of good, grateful people blessed by Allah.' },
          older: { ar: 'طريق من أنعم الله عليهم بالهدى والحكمة، بعيداً عن الضلال والأذى.', en: 'The path of those You have blessed with guidance and wisdom.' },
        },
      },
    ],
  },
  {
    id: 'surah-112',
    number: 112,
    nameAr: 'سُورَةُ الإِخۡلَاصِ',
    nameEn: 'Al-Ikhlas',
    englishMeaning: 'Sincerity / Pure Faith',
    revelationType: 'meccan',
    ayahCount: 4,
    recommendedMinBand: '1-2',
    hasOpeningBasmalah: true,
    textSource: 'King Fahd Complex Medina Mushaf (api.quran.com v4 text_uthmani, cross-checked with AlQuran Cloud quran-uthmani)',
    textSourceUrl: 'https://api.quran.com/api/v4/verses/by_chapter/112?fields=text_uthmani',
    textVerificationStatus: 'verified',
    textSha256: 'd7e6b7a6e7e349b372b2d24b5f240a2af4e8eb0e7f67bfb103db0cde5d77c94b',
    ageSummary: {
      young: {
        ar: 'الله واحد أحد، خلق السماء والأرض، وليس مثله شيء.',
        en: 'Allah is One and Unique — He created the sky and earth, and nothing is like Him.',
      },
      mid: {
        ar: 'تعلمنا هذه السورة القصيرة أن الله واحد لا شريك له، ونلجأ إليه في كل وقت.',
        en: 'This short Surah teaches us that Allah is One, Eternal, and everyone turns to Him.',
      },
      older: {
        ar: 'سورة التوحيد الصافي: الله أحد صمد، غني عن كل شيء، ولا يشبهه شيء في الوجود.',
        en: 'Pure devotion: Allah is One, Eternal, Self-Sufficient, and utterly unique.',
      },
    },
    gentleValue: {
      ar: 'معرفة الله الواحد الأحد',
      en: 'Knowing and loving the One God',
    },
    ayahs: [
      {
        number: 1,
        verseKey: '112:1',
        textUthmani: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
        ageMeaning: {
          young: { ar: 'الله واحد أحد.', en: 'Allah is One!' },
          mid: { ar: 'نعرف ونقول بقلبنا: الله واحد لا شريك له.', en: 'Allah is the One and Only.' },
          older: { ar: 'قل بيقين: الله هو الواحد الأحد المنفرد بالكمال.', en: 'Say: He is Allah, the One and Only.' },
        },
      },
      {
        number: 2,
        verseKey: '112:2',
        textUthmani: 'ٱللَّهُ ٱلصَّمَدُ',
        ageMeaning: {
          young: { ar: 'الكل يحتاج إلى الله، والله يحفظنا.', en: 'Everyone relies on Allah to take care of us.' },
          mid: { ar: 'الله هو الذي نقصدُه في الدعاء دائماً.', en: 'Allah is Eternal, and we always turn to Him.' },
          older: { ar: 'الصمد: الكامل الذي تقصده المخلوقات كلها في حاجاتها.', en: 'The Eternal Refuge upon whom all creation depends.' },
        },
      },
      {
        number: 3,
        verseKey: '112:3',
        textUthmani: 'لَمْ يَلِدْ وَلَمْ يُولَدْ',
        ageMeaning: {
          young: { ar: 'الله موجود دائماً قبل كل شيء.', en: 'Allah has always been here forever.' },
          mid: { ar: 'الله لم يلد أحداً ولم يُولد من أحد.', en: 'He neither begets nor was He born.' },
          older: { ar: 'الله أزلي باقٍ لا بداية له ولا نهاية، منزه عن الولد والوالد.', en: 'He has no parents and no children; He is eternal.' },
        },
      },
      {
        number: 4,
        verseKey: '112:4',
        textUthmani: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ',
        ageMeaning: {
          young: { ar: 'لا يوجد أحد مثل الله أبداً.', en: 'There is no one at all like Allah.' },
          mid: { ar: 'لا يشبه اللهَ أحدٌ في عظمته ولطفه.', en: 'Nothing in the whole universe is like Him.' },
          older: { ar: 'لا مثيل ولا نظير لله سبحانه في أسمائه وصفاته.', en: 'Nor is there to Him any equivalent.' },
        },
      },
    ],
  },
  {
    id: 'surah-113',
    number: 113,
    nameAr: 'سُورَةُ الفَلَقِ',
    nameEn: 'Al-Falaq',
    englishMeaning: 'The Daybreak',
    revelationType: 'meccan',
    ayahCount: 5,
    recommendedMinBand: '1-2',
    hasOpeningBasmalah: true,
    textSource: 'King Fahd Complex Medina Mushaf (api.quran.com v4 text_uthmani, cross-checked with AlQuran Cloud quran-uthmani)',
    textSourceUrl: 'https://api.quran.com/api/v4/verses/by_chapter/113?fields=text_uthmani',
    textVerificationStatus: 'verified',
    textSha256: 'a1cef8b5b2493a02a84e02da5451b452b919691a8f1dabbfa3c263308e5cc7ef',
    ageSummary: {
      young: {
        ar: 'نطلب من الله أن يحفظنا في الصباح وعند النوم.',
        en: 'We ask Allah to keep us safe in the bright morning and at bedtime.',
      },
      mid: {
        ar: 'سورة الحفظ والطمأنينة: الله رب الفجر المضيء يحمينا من كل أذى.',
        en: 'A comforting prayer of protection: Allah, Lord of the dawn, keeps us safe.',
      },
      older: {
        ar: 'نتحصن بالله رب الفلق ونستعيذ به من كل سوء في الليل والنهار ليطمئن قلبنا.',
        en: 'Seeking refuge in the Lord of daybreak from all harm so our hearts rest peacefully.',
      },
    },
    gentleValue: {
      ar: 'الشعور بالأمان وحفظ الله',
      en: 'Feeling safe in Allah’s protection',
    },
    ayahs: [
      {
        number: 1,
        verseKey: '113:1',
        textUthmani: 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ',
        ageMeaning: {
          young: { ar: 'أحتمي بالله خالق الصباح الجميل.', en: 'I seek safety with Allah, Lord of the bright morning.' },
          mid: { ar: 'نلجأ إلى الله الذي يشق ظلام الليل بنور الفجر.', en: 'Say: I seek refuge with the Lord of daybreak.' },
          older: { ar: 'ألوذ وأتحصن بالله رب الفلق وباعث النور.', en: 'Say: I seek protection in the Lord of the dawn.' },
        },
      },
      {
        number: 2,
        verseKey: '113:2',
        textUthmani: 'مِن شَرِّ مَا خَلَقَ',
        ageMeaning: {
          young: { ar: 'الله يحفظنا من كل شيء يؤذينا.', en: 'Allah keeps us safe from anything harmful.' },
          mid: { ar: 'نسأل الله أن يبعد عنا كل أذى.', en: 'From the harm of whatever might hurt us.' },
          older: { ar: 'أن يحفظنا الله من أذى أي مخلوق في الكون.', en: 'Protection from any harm among created things.' },
        },
      },
      {
        number: 3,
        verseKey: '113:3',
        textUthmani: 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ',
        ageMeaning: {
          young: { ar: 'الله يحرسنا في الليل الهادئ.', en: 'Allah watches over us when night falls.' },
          mid: { ar: 'حتى في الظلام، الله معنا ويحفظنا.', en: 'Allah protects us throughout the quiet night.' },
          older: { ar: 'ونستعيذ بالله من أذى قد يأتي في ظلمة الليل حين يدخل.', en: 'And from harm in the darkness of night as it settles.' },
        },
      },
      {
        number: 4,
        verseKey: '113:4',
        textUthmani: 'وَمِن شَرِّ ٱلنَّفَّـٰثَـٰتِ فِى ٱلْعُقَدِ',
        ageMeaning: {
          young: { ar: 'الله القوي يحمينا دائماً.', en: 'Allah’s strength always protects us.' },
          mid: { ar: 'الله يحفظنا من أي أذى خفي لا نراه.', en: 'Allah shields us from hidden harms.' },
          older: { ar: 'نتوكل على الله ونحتمي به من كل سوء وأذى خفي.', en: 'Seeking refuge in Allah from hidden harm and ill intentions.' },
        },
      },
      {
        number: 5,
        verseKey: '113:5',
        textUthmani: 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
        ageMeaning: {
          young: { ar: 'نتمنى الخير لكل أصدقائنا والله يحفظنا.', en: 'We wish goodness for everyone, and Allah guards us.' },
          mid: { ar: 'الله يحمينا من الحسد ويزرع المحبة في قلوبنا.', en: 'Allah protects our blessings and fills hearts with kindness.' },
          older: { ar: 'نتحصن بالله من الحسد، ونحب الخير للجميع بقلب سليم.', en: 'From the harm of envy, while keeping a generous heart.' },
        },
      },
    ],
  },
  {
    id: 'surah-114',
    number: 114,
    nameAr: 'سُورَةُ النَّاسِ',
    nameEn: 'An-Nas',
    englishMeaning: 'Mankind',
    revelationType: 'meccan',
    ayahCount: 6,
    recommendedMinBand: '1-2',
    hasOpeningBasmalah: true,
    textSource: 'King Fahd Complex Medina Mushaf (api.quran.com v4 text_uthmani, cross-checked with AlQuran Cloud quran-uthmani)',
    textSourceUrl: 'https://api.quran.com/api/v4/verses/by_chapter/114?fields=text_uthmani',
    textVerificationStatus: 'verified',
    textSha256: 'a48d74dba8472cb1a6d5eae8788c89609fb9a27b685229075fe47fcff560269e',
    ageSummary: {
      young: {
        ar: 'الله ملك الناس وربهم الذي يحفظ قلوبنا سعيدة وآمنة.',
        en: 'Allah cares for all people and keeps our hearts calm and safe.',
      },
      mid: {
        ar: 'آخر سورة في القرآن، نطلب فيها من الله أن يملأ صدورنا بالأفكار الطيبة.',
        en: 'The final Surah of the Quran — asking Allah to keep good, peaceful thoughts in our hearts.',
      },
      older: {
        ar: 'نستعيذ برب الناس ومَلِكهم وإلههم من الوسوسة والأفكار المقلقة لنبقى مطمئنين.',
        en: 'Seeking refuge in the Lord, Sovereign, and God of all people from troubling whispers.',
      },
    },
    gentleValue: {
      ar: 'طمأنينة القلب والأفكار الطيبة',
      en: 'Peaceful hearts and kind thoughts',
    },
    ayahs: [
      {
        number: 1,
        verseKey: '114:1',
        textUthmani: 'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ',
        ageMeaning: {
          young: { ar: 'أحتمي بالله الذي يرعى كل الناس.', en: 'I stay safe with Allah, Who cares for all people.' },
          mid: { ar: 'نلجأ إلى الله الذي يربينا ويرعانا برحمته.', en: 'Say: I seek refuge in the Lord of all people.' },
          older: { ar: 'أعتصم برب جميع البشر ومصلح أحوالهم.', en: 'Say: I seek refuge in the Lord of mankind.' },
        },
      },
      {
        number: 2,
        verseKey: '114:2',
        textUthmani: 'مَلِكِ ٱلنَّاسِ',
        ageMeaning: {
          young: { ar: 'الله ملك عظيم ولطيف.', en: 'Allah is the gentle King of everyone.' },
          mid: { ar: 'الله هو الملك الحق الذي يحكم بالرحمة.', en: 'The true Sovereign of all people.' },
          older: { ar: 'ملك الناس الذي بيده كل الخير والأمان.', en: 'The Sovereign of mankind.' },
        },
      },
      {
        number: 3,
        verseKey: '114:3',
        textUthmani: 'إِلَـٰهِ ٱلنَّاسِ',
        ageMeaning: {
          young: { ar: 'نحب الله ونعبده وحده.', en: 'We love and worship Allah alone.' },
          mid: { ar: 'الله إلهنا الذي يستحق حبنا وشكركنا.', en: 'The God whom all people love and worship.' },
          older: { ar: 'المعبود بحق الذي تتجه إليه القلوب.', en: 'The God of mankind.' },
        },
      },
      {
        number: 4,
        verseKey: '114:4',
        textUthmani: 'مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ',
        ageMeaning: {
          young: { ar: 'عندما نذكر الله تبتعد الأفكار المزعجة.', en: 'When we remember Allah, worried thoughts go away.' },
          mid: { ar: 'نستعيذ بالله من الأفكار التي تدفعنا للخطأ.', en: 'Protection from sneaky whispers that nudge toward mistakes.' },
          older: { ar: 'نحتمي بالله من الوسوسة التي تتراجع وتختفي عند ذكر الله.', en: 'From the retreating whisperer whenever Allah is remembered.' },
        },
      },
      {
        number: 5,
        verseKey: '114:5',
        textUthmani: 'ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ',
        ageMeaning: {
          young: { ar: 'الله يحفظ قلبنا نظيفاً وسعيداً.', en: 'Allah keeps our hearts happy and clean.' },
          mid: { ar: 'الله يحمي قلوبنا لتبقى محبة للخير.', en: 'Who whispers inside hearts — yet Allah guards our hearts.' },
          older: { ar: 'نذكر الله ليبقى صدرنا مطمئناً بعيداً عن الحزن والوسوسة.', en: 'Who whispers in the hearts of people.' },
        },
      },
      {
        number: 6,
        verseKey: '114:6',
        textUthmani: 'مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ',
        ageMeaning: {
          young: { ar: 'الله يحفظنا دائماً في كل مكان.', en: 'Allah keeps us safe everywhere we go.' },
          mid: { ar: 'نختار الصحبة الطيبة ونحتمي بالله من أي سوء.', en: 'Both unseen whispers and unkind words — Allah protects us.' },
          older: { ar: 'سواء جاءت الوسوسة من الجن أو من كلام غير صالح، فالله حافظنا.', en: 'Whether from unseen beings or unkind people.' },
        },
      },
    ],
  },
  {
    id: 'surah-108',
    number: 108,
    nameAr: 'سُورَةُ الكَوۡثَرِ',
    nameEn: 'Al-Kawthar',
    englishMeaning: 'Abundance',
    revelationType: 'meccan',
    ayahCount: 3,
    recommendedMinBand: '1-2',
    hasOpeningBasmalah: true,
    textSource: 'King Fahd Complex Medina Mushaf (api.quran.com v4 text_uthmani, cross-checked with AlQuran Cloud quran-uthmani)',
    textSourceUrl: 'https://api.quran.com/api/v4/verses/by_chapter/108?fields=text_uthmani',
    textVerificationStatus: 'verified',
    textSha256: '5ef35765fda287144b3bac08ac689151ba0330e90bc6931663d5285ca258833c',
    ageSummary: {
      young: {
        ar: 'أقصر سورة في القرآن! تذكرنا بنعم الله الكثيرة ونشكره.',
        en: 'The shortest Surah! It reminds us of Allah’s many gifts and saying Alhamdulillah.',
      },
      mid: {
        ar: 'أعطانا الله خيراً كثيراً، ونشكره بالصلاة ومساعدة المحتاجين.',
        en: 'Allah gave us abundant blessings, so we thank Him with prayer and generosity.',
      },
      older: {
        ar: 'أعطى الله النبي محمد ﷺ الخير الكثير ونهر الكوثر، وأمرنا بالشكر والصلاة والعطاء.',
        en: 'Allah granted abundant good and Al-Kawthar, reminding us to pray and share generously.',
      },
    },
    gentleValue: {
      ar: 'شكر النعم والكرم والعطاء',
      en: 'Gratitude and generous sharing',
    },
    ayahs: [
      {
        number: 1,
        verseKey: '108:1',
        textUthmani: 'إِنَّآ أَعْطَيْنَـٰكَ ٱلْكَوْثَرَ',
        ageMeaning: {
          young: { ar: 'أعطانا الله خيرات كثيرة جميلة.', en: 'Allah gave us so many wonderful gifts!' },
          mid: { ar: 'وهب الله نبيه خيراً كثيراً ونهراً جميلاً في الجنة.', en: 'Indeed, We have granted you abundant goodness.' },
          older: { ar: 'بشارة من الله بالعطاء الواسع ونهر الكوثر المبارك.', en: 'Indeed, We have given you Al-Kawthar (abundance).' },
        },
      },
      {
        number: 2,
        verseKey: '108:2',
        textUthmani: 'فَصَلِّ لِرَبِّكَ وَٱنْحَرْ',
        ageMeaning: {
          young: { ar: 'نشكر الله ونشارك الخير مع الناس.', en: 'We thank Allah and share kindly with others.' },
          mid: { ar: 'نصلي لربنا شكراً له ونُطعم الآخرين بلطف.', en: 'So pray to your Lord and give generously.' },
          older: { ar: 'شكر النعمة يكون بالصلاة الخالصة لله ومساعدة الفقراء.', en: 'So pray to your Lord sincerely and offer charity.' },
        },
      },
      {
        number: 3,
        verseKey: '108:3',
        textUthmani: 'إِنَّ شَانِئَكَ هُوَ ٱلْأَبْتَرُ',
        ageMeaning: {
          young: { ar: 'الخير والحب يدومان دائماً.', en: 'Kindness and goodness always last.' },
          mid: { ar: 'ذكرُ اللهِ والخير يبقيان دائماً، ولا يدوم الأذى.', en: 'Goodness remains forever blessed by Allah.' },
          older: { ar: 'من يكره الخير ينقطع أثره، بينما يبقى ذكر النبي ﷺ مباركاً إلى الأبد.', en: 'Those who oppose goodness fade away, while good legacy endures.' },
        },
      },
    ],
  },
  {
    id: 'surah-103',
    number: 103,
    nameAr: 'سُورَةُ العَصۡرِ',
    nameEn: 'Al-Asr',
    englishMeaning: 'The Declining Day / Time',
    revelationType: 'meccan',
    ayahCount: 3,
    recommendedMinBand: '2-3',
    hasOpeningBasmalah: true,
    textSource: 'King Fahd Complex Medina Mushaf (api.quran.com v4 text_uthmani, cross-checked with AlQuran Cloud quran-uthmani)',
    textSourceUrl: 'https://api.quran.com/api/v4/verses/by_chapter/103?fields=text_uthmani',
    textVerificationStatus: 'verified',
    textSha256: '205a4044c0cbe6637479a21b2e90f4aeb164c8c5daf20ce7efe3e56ece98bcde',
    ageSummary: {
      young: {
        ar: 'وقتنا ثمين! نفرح عندما نعمل الخير ونصبر ونكون لطفاء.',
        en: 'Our time is precious when we do good deeds and are patient.',
      },
      mid: {
        ar: 'تعلمنا قيمة الوقت، وأن الفائزين هم من يؤمنون ويعملون الخير ويتعاونون بالحق والصبر.',
        en: 'Time is precious: happy hearts believe, do good, speak truth, and stay patient.',
      },
      older: {
        ar: 'منهج السعادة في ٣ آيات: الإيمان، العمل الصالح، الصدق، والصبر الجميل مع الآخرين.',
        en: 'A blueprint for goodness: faith, kind deeds, encouraging truth, and gentle patience.',
      },
    },
    gentleValue: {
      ar: 'قيمة الوقت والعمل الصالح والصبر',
      en: 'Precious time, good deeds, truth & patience',
    },
    ayahs: [
      {
        number: 1,
        verseKey: '103:1',
        textUthmani: 'وَٱلْعَصْرِ',
        ageMeaning: {
          young: { ar: 'الوقت نعمة جميلة من الله.', en: 'Time is a wonderful gift from Allah.' },
          mid: { ar: 'يقسم الله بالزمن ليذكرنا بأهمية كل لحظة نعيشها.', en: 'By the passing time — reminding us how precious time is.' },
          older: { ar: 'قَسَمٌ بالدهر والوقت لندرك قيمته في فعل الخير.', en: 'By time and the passing of the day.' },
        },
      },
      {
        number: 2,
        verseKey: '103:2',
        textUthmani: 'إِنَّ ٱلْإِنسَـٰنَ لَفِى خُسْرٍ',
        ageMeaning: {
          young: { ar: 'إذا لم نفعل الخير يضيع وقتنا.', en: 'Without kindness, time slips away.' },
          mid: { ar: 'الإنسان يخسر وقته إن لم يملأه بالخير والعمل المفيد.', en: 'People lose precious time unless they fill it with goodness.' },
          older: { ar: 'يمضي العمر سريعاً ويضيع إن لم يُستثمر في الصلاح.', en: 'Indeed, humanity is in loss without purposeful goodness.' },
        },
      },
      {
        number: 3,
        verseKey: '103:3',
        textUthmani: 'إِلَّا ٱلَّذِينَ ءَامَنُوا۟ وَعَمِلُوا۟ ٱلصَّـٰلِحَـٰتِ وَتَوَاصَوْا۟ بِٱلْحَقِّ وَتَوَاصَوْا۟ بِٱلصَّبْرِ',
        ageMeaning: {
          young: { ar: 'الفائزون يحبون الله ويساعدون الآخرين ويصبرون.', en: 'Happy winners love Allah, help others, and stay patient.' },
          mid: { ar: 'إلا من يؤمن بالله، ويعمل الخير، ويقول الصدق، ويصبر بلطف.', en: 'Except those who believe, do good deeds, encourage truth, and encourage patience.' },
          older: { ar: 'أربع صفات للنجاح: الإيمان بالله، العمل الصالح، التناصح بالحق، والصبر.', en: 'Four keys to success: faith, righteous deeds, mutual truth, and patience.' },
        },
      },
    ],
  },
  {
    id: 'surah-110',
    number: 110,
    nameAr: 'سُورَةُ النَّصۡرِ',
    nameEn: 'An-Nasr',
    englishMeaning: 'The Divine Aid',
    revelationType: 'medinan',
    ayahCount: 3,
    recommendedMinBand: '2-3',
    hasOpeningBasmalah: true,
    textSource: 'King Fahd Complex Medina Mushaf (api.quran.com v4 text_uthmani, cross-checked with AlQuran Cloud quran-uthmani)',
    textSourceUrl: 'https://api.quran.com/api/v4/verses/by_chapter/110?fields=text_uthmani',
    textVerificationStatus: 'verified',
    textSha256: '102d9adcb294099b7120613f530f1057b620e8956ce0d5855edb67161a319d5c',
    ageSummary: {
      young: {
        ar: 'عندما ننجح أو نرى شيئاً جميلاً نقول سبحان الله والحمد لله.',
        en: 'When good things happen, we say SubhanAllah and thank Allah.',
      },
      mid: {
        ar: 'عندما ينعم الله علينا بالنجاح، نحمده ونسبحه بتواضع.',
        en: 'When Allah helps us succeed, we praise Him humbly.',
      },
      older: {
        ar: 'تعلمنا التواضع وقت الفرح والنصر: نسبّح الله ونحمده ونستغفره لأنه التواب الرحيم.',
        en: 'Gratitude and humility in times of success: glorifying Allah and seeking His forgiveness.',
      },
    },
    gentleValue: {
      ar: 'التواضع وتسبيح الله عند النجاح',
      en: 'Humility & praising Allah in moments of joy',
    },
    ayahs: [
      {
        number: 1,
        verseKey: '110:1',
        textUthmani: 'إِذَا جَآءَ نَصْرُ ٱللَّهِ وَٱلْفَتْحُ',
        ageMeaning: {
          young: { ar: 'عندما يساعدنا الله ونفرح.', en: 'When Allah’s help and goodness arrive.' },
          mid: { ar: 'عندما يأتي عون الله بالخير والنصر.', en: 'When the help of Allah and victory come.' },
          older: { ar: 'بشارة بعون الله وتمكينه للخير والسلام.', en: 'When Allah’s support and opening of goodness arrive.' },
        },
      },
      {
        number: 2,
        verseKey: '110:2',
        textUthmani: 'وَرَأَيْتَ ٱلنَّاسَ يَدْخُلُونَ فِى دِينِ ٱللَّهِ أَفْوَاجًا',
        ageMeaning: {
          young: { ar: 'كثير من الناس يحبون الخير معاً.', en: 'Many people come together loving goodness.' },
          mid: { ar: 'واجتمع الناس جماعات يحبون دين الله والسلام.', en: 'And people gather in groups embracing faith and peace.' },
          older: { ar: 'ورأيت الناس يدخلون في الإسلام جماعات متتابعة فرحين بالهدى.', en: 'And you see people entering the path of Allah in multitudes.' },
        },
      },
      {
        number: 3,
        verseKey: '110:3',
        textUthmani: 'فَسَبِّحْ بِحَمْدِ رَبِّكَ وَٱسْتَغْفِرْهُ ۚ إِنَّهُۥ كَانَ تَوَّابًۢا',
        ageMeaning: {
          young: { ar: 'نقول سبحان الله وبحمده، الله يحبنا ويتوب علينا.', en: 'We say SubhanAllah wa bihamdih — Allah is so forgiving!' },
          mid: { ar: 'فقل سبحان الله والحمد لله واطلب مغفرته اللطيفة.', en: 'Glorify and praise your Lord and ask His gentle forgiveness.' },
          older: { ar: 'قابل النعمة بالتسبيح والحمد والاستغفار، فالله كثير القبول للتوبة.', en: 'Exalt Him with praise and seek His forgiveness; He is ever Accepting of repentance.' },
        },
      },
    ],
  },
  {
    id: 'surah-105',
    number: 105,
    nameAr: 'سُورَةُ الفِيلِ',
    nameEn: 'Al-Fil',
    englishMeaning: 'The Elephant',
    revelationType: 'meccan',
    ayahCount: 5,
    recommendedMinBand: '2-3',
    hasOpeningBasmalah: true,
    textSource: 'King Fahd Complex Medina Mushaf (api.quran.com v4 text_uthmani, cross-checked with AlQuran Cloud quran-uthmani)',
    textSourceUrl: 'https://api.quran.com/api/v4/verses/by_chapter/105?fields=text_uthmani',
    textVerificationStatus: 'verified',
    textSha256: '0ba208c22430346cfb5da7f1ab9c39977ebb241e4fc3adfe9b1242b2d4014118',
    ageSummary: {
      young: {
        ar: 'حفظ الله بيته الحرام في مكة، وأرسل طيوراً تحمي البيت.',
        en: 'Allah protected His Sacred House in Makkah with gentle little birds.',
      },
      mid: {
        ar: 'قصة حفظ الكعبة المشرفة: حين حاول جيش كبير إيذاءها، حفظ الله بيته بقدرته.',
        en: 'How Allah protected the Kaaba from a huge army through tiny birds.',
      },
      older: {
        ar: 'يذكرنا الله كيف حمى الكعبة عام الفيل، وأن القوة الحقيقية لله الذي يحفظ بيته.',
        en: 'A reminder of how Allah protected the Sacred House in the Year of the Elephant.',
      },
    },
    gentleValue: {
      ar: 'قدرة الله وحفظه لبيته الحرام',
      en: 'Allah’s care and protection of the Sacred Kaaba',
    },
    ayahs: [
      {
        number: 1,
        verseKey: '105:1',
        textUthmani: 'أَلَمْ تَرَ كَيْفَ فَعَلَ رَبُّكَ بِأَصْحَـٰبِ ٱلْفِيلِ',
        ageMeaning: {
          young: { ar: 'نتذكر كيف حمى الله الكعبة الجميلة.', en: 'Remember how Allah protected the Sacred Kaaba!' },
          mid: { ar: 'هل تعلم كيف حفظ الله بيته من أصحاب الفيل؟', en: 'Have you seen how your Lord dealt with the companions of the elephant?' },
          older: { ar: 'تذكير بقصة أبرهة الذي أراد هدم الكعبة فحماها الله.', en: 'Have you not seen how your Lord protected the Sacred House?' },
        },
      },
      {
        number: 2,
        verseKey: '105:2',
        textUthmani: 'أَلَمْ يَجْعَلْ كَيْدَهُمْ فِى تَضْلِيلٍ',
        ageMeaning: {
          young: { ar: 'لم يستطيعوا إيذاء الكعبة أبداً.', en: 'They could not harm the Kaaba at all.' },
          mid: { ar: 'أبطل الله خطتهم السيئة فلم يصلوا لهدفهم.', en: 'Did He not make their harmful plan go completely astray?' },
          older: { ar: 'أفشل الله تدبيرهم وحمى بيته الحرام.', en: 'He turned their plan to nothing.' },
        },
      },
      {
        number: 3,
        verseKey: '105:3',
        textUthmani: 'وَأَرْسَلَ عَلَيْهِمْ طَيْرًا أَبَابِيلَ',
        ageMeaning: {
          young: { ar: 'أرسل الله أسراباً من الطيور الصغيرة.', en: 'Allah sent flocks of little birds.' },
          mid: { ar: 'جاءت جماعات من الطيور بأمر الله لحماية البيت.', en: 'And He sent against them birds in flocks.' },
          older: { ar: 'أرسل الله جماعات متتابعة من الطير بقدرته سبحانه.', en: 'Sending flocks of birds in waves.' },
        },
      },
      {
        number: 4,
        verseKey: '105:4',
        textUthmani: 'تَرْمِيهِم بِحِجَارَةٍ مِّن سِجِّيلٍ',
        ageMeaning: {
          young: { ar: 'تحمل الطيور حصى صغيرة لحماية الكعبة.', en: 'Carrying tiny pebbles to protect the Kaaba.' },
          mid: { ar: 'أوقفتهم الحجارة الصغيرة بإذن الله.', en: 'Striking the invading army with small baked clay pebbles.' },
          older: { ar: 'كانت حجارة من طين متحجر أوقفت الجيش المهاجم بقدرة الله.', en: 'Throwing small stones of baked clay by Allah’s command.' },
        },
      },
      {
        number: 5,
        verseKey: '105:5',
        textUthmani: 'فَجَعَلَهُمْ كَعَصْفٍ مَّأْكُولٍۭ',
        ageMeaning: {
          young: { ar: 'وبقيت الكعبة آمنة محمية بسلام.', en: 'And the Kaaba remained safe and peaceful.' },
          mid: { ar: 'فتفرّق الجيش وبقي بيت الله آمناً مطمئناً.', en: 'So the Sacred House remained safe and guarded.' },
          older: { ar: 'تحطم غرور المعتدين كأوراق زرع متناثرة وبقيت مكة آمنة.', en: 'Leaving their force scattered while Makkah stayed safe.' },
        },
      },
    ],
  },
  {
    id: 'surah-106',
    number: 106,
    nameAr: 'سُورَةُ قُرَيۡشٍ',
    nameEn: 'Quraysh',
    englishMeaning: 'Quraysh',
    revelationType: 'meccan',
    ayahCount: 4,
    recommendedMinBand: '3-4',
    hasOpeningBasmalah: true,
    textSource: 'King Fahd Complex Medina Mushaf (api.quran.com v4 text_uthmani, cross-checked with AlQuran Cloud quran-uthmani)',
    textSourceUrl: 'https://api.quran.com/api/v4/verses/by_chapter/106?fields=text_uthmani',
    textVerificationStatus: 'verified',
    textSha256: '2f0d2241b64f5e7627b938c7280c59404f27768f0da04b0f684fa831556c6777',
    ageSummary: {
      young: {
        ar: 'نشكر الله على نعمة الطعام اللذيذ والبيت الدافئ الآمن.',
        en: 'Thanking Allah for yummy food and feeling safe at home.',
      },
      mid: {
        ar: 'أنعم الله على أهل مكة بالأمان في السفر والطعام الطيب ليشكروه ويعبدوه.',
        en: 'Allah blessed Makkah with safe journeys and food so people thank and worship Him.',
      },
      older: {
        ar: 'تذكّرنا نعم الله الكبرى: الشبع بعد الجوع والأمان بعد الخوف، فتستحق الشكر والعبادة.',
        en: 'Gratitude for two priceless blessings: nourishment and safety in every season.',
      },
    },
    gentleValue: {
      ar: 'الشكر على نعمة الطعام والأمان',
      en: 'Gratitude for food and peaceful safety',
    },
    ayahs: [
      {
        number: 1,
        verseKey: '106:1',
        textUthmani: 'لِإِيلَـٰفِ قُرَيْشٍ',
        ageMeaning: {
          young: { ar: 'نعم الله على أهل مكة الكرام.', en: 'Allah’s kindness to the people of Makkah.' },
          mid: { ar: 'لما اعتادته قريش من رحلات آمنة ومباركة.', en: 'For the accustomed safe journeys of Quraysh.' },
          older: { ar: 'تذكير بنعمة الأمان والألفة التي منحها الله لأهل مكة.', en: 'For the security and unity granted to Quraysh.' },
        },
      },
      {
        number: 2,
        verseKey: '106:2',
        textUthmani: 'إِۦلَـٰفِهِمْ رِحْلَةَ ٱلشِّتَآءِ وَٱلصَّيْفِ',
        ageMeaning: {
          young: { ar: 'سفر آمن في البرد وفي الصيف.', en: 'Safe travels in winter and summer.' },
          mid: { ar: 'يسّر الله لهم السفر في الشتاء والصيف للخير والتجارة.', en: 'Their safe winter and summer journeys.' },
          older: { ar: 'كانوا يسافرون في الشتاء إلى اليمن وفي الصيف إلى الشام بأمان.', en: 'Allah kept their winter and summer trade journeys safe.' },
        },
      },
      {
        number: 3,
        verseKey: '106:3',
        textUthmani: 'فَلْيَعْبُدُوا۟ رَبَّ هَـٰذَا ٱلْبَيْتِ',
        ageMeaning: {
          young: { ar: 'نشكر الله رب الكعبة المشرفة.', en: 'Let us thank and worship the Lord of the Sacred House.' },
          mid: { ar: 'فليشكروا الله ويعبدوا رب الكعبة الذي أكرمهم.', en: 'So let them worship the Lord of this Sacred House.' },
          older: { ar: 'فليخلصوا العبادة والشكر لرب الكعبة الحافظ.', en: 'Let them worship the Lord of this House in gratitude.' },
        },
      },
      {
        number: 4,
        verseKey: '106:4',
        textUthmani: 'ٱلَّذِىٓ أَطْعَمَهُم مِّن جُوعٍ وَءَامَنَهُم مِّنْ خَوْفٍۭ',
        ageMeaning: {
          young: { ar: 'الله يطعمنا الطعام اللذيذ ويجعلنا آمنين.', en: 'Allah gives us food and keeps us safe.' },
          mid: { ar: 'الذي رزقهم الطعام الطيب والأمان والهدوء.', en: 'Who fed them against hunger and kept them safe from fear.' },
          older: { ar: 'فالله هو من يرزقنا الشبع بعد الجوع ويمنحنا الأمان والطمأنينة.', en: 'Who has provided them food and granted them security.' },
        },
      },
    ],
  },
];

// Honest verification registry: reciter audio stays explicitly pending_verification until
// documented licensing/permission, Tajweed review sign-off, and verified audio URLs are attached.
// Phase 1 configures ONLY ONE default adult reciter:
// Sheikh Mahmoud Khalil Al-Husary – Hafs 'an 'Asim – Murattal.
export const QURAN_RECITERS: QuranReciterSpec[] = [
  {
    id: 'adult-husary-muallim',
    canonicalSlug: 'adult-husary-murattal',
    name: {
      ar: 'الشيخ محمود خليل الحصري – رواية حفص عن عاصم – تلاوة مرتلة',
      en: "Sheikh Mahmoud Khalil Al-Husary – Hafs 'an 'Asim – Murattal",
    },
    reciterType: 'adult',
    riwayah: {
      ar: 'رواية حفص عن عاصم',
      en: "Hafs 'an 'Asim",
    },
    style: {
      ar: 'تلاوة مرتلة متأنية واضحة مخارج الحروف',
      en: 'Calm, clear Murattal recitation with precise articulation',
    },
    sourceName: 'Quran Foundation Content API / Official Audio CDN',
    licenseOrPermission:
      'Quran Foundation Developer Terms (Nov 20, 2026) permit commercial/freemium integrated end-user app use; awaiting Reciter & Recitation Source Verification and admin confirmations',
    attributionText: {
      ar: 'بيانات القرآن مقدمة من Quran.Foundation. — التلاوة للشيخ محمود خليل الحصري (رواية حفص عن عاصم - مرتلة).',
      en: "Quran data provided by Quran.Foundation. — Recitation: Sheikh Mahmoud Khalil Al-Husary – Hafs 'an 'Asim – Murattal.",
    },
    sourceVerificationStatus: 'pending',
    verificationStatus: 'pending_verification',
    unavailableReason: {
      ar: 'التلاوة الصوتية للشيخ محمود خليل الحصري (مرتلة) بانتظار إتمام التحقق من مصدر القارئ والتسجيلات وتأكيدات المشرف واعتماد البسملة.',
      en: 'Recitation audio for Sheikh Mahmoud Khalil Al-Husary (Murattal) is awaiting Reciter & Recitation Source Verification, administrator confirmations, and Basmala asset approval.',
    },
  },
  {
    id: 'child-reciter-approved',
    name: {
      ar: 'قارئ صغير مجاز (تحت المراجعة)',
      en: 'Approved Child Reciter (Pending Review)',
    },
    reciterType: 'child',
    style: {
      ar: 'صوت طفل هادئ بعد التحقق من المصدر والإذن',
      en: 'Gentle child recitation (requires documented consent + source verification)',
    },
    sourceName: 'Child Reciter Slot (Strict Permission + Source Verification Gate)',
    licenseOrPermission: 'Pending signed guardian/publisher permission',
    sourceVerificationStatus: 'pending',
    verificationStatus: 'pending_verification',
    unavailableReason: {
      ar: 'تسجيل القارئ الصغير غير مفعّل بعد لعدم إرفاق الإذن الموثّق والتحقق من المصدر — يتم التحويل تلقائياً إلى القارئ البالغ المعتمد عند توفره.',
      en: 'Child reciter audio is pending documented permission and source verification — falls back only to the verified adult reciter when available.',
    },
  },
];

export const QURAN_STORIES: QuranStorySpec[] = QURAN_STORY_LIBRARY;

export const QURAN_MANNERS: QuranMannerSpec[] = [
  {
    id: 'manner-bismillah',
    title: { ar: 'قول بسم الله قبل الأكل واللعب', en: 'Saying Bismillah Before Eating & Starting' },
    phraseAr: 'بِسْمِ اللهِ',
    transliteration: 'Bismillah',
    icon: '🍽️',
    whenToUse: {
      ar: 'قبل الطعام أو شرب الماء أو فتح كتاب نونو.',
      en: 'Before eating, drinking water, or starting an activity.',
    },
    agePractice: {
      young: {
        ar: 'نلمس البطاقة ونقول معاً: بسم الله!',
        en: 'Tap and say together: Bismillah!',
      },
      mid: {
        ar: 'قبل أن نأكل تفاحة لذيذة، نقول بسم الله ونأكل باليد اليمنى.',
        en: 'Before eating a yummy snack, say Bismillah!',
      },
      older: {
        ar: 'نبدأ الأكل والشرب وكل عمل طيب بقول: بسم الله لتنزل البركة.',
        en: 'Begin meals and good activities with Bismillah for blessing.',
      },
    },
    togetherPrompt: {
      ar: 'اطلب من طفلك قول «بسم الله» مع ابتسامة قبل وجبته القادمة.',
      en: 'Invite your child to smile and say “Bismillah” before their next snack.',
    },
  },
  {
    id: 'manner-alhamdulillah',
    title: { ar: 'قول الحمد لله بعد النعم', en: 'Saying Alhamdulillah After Meals & Joy' },
    phraseAr: 'الْحَمْدُ لِلَّهِ',
    transliteration: 'Alhamdulillah',
    icon: '🌟',
    whenToUse: {
      ar: 'بعد الانتهاء من الطعام أو اللعب أو عند العطاس.',
      en: 'After finishing a meal, playtime, or when sneezing.',
    },
    agePractice: {
      young: {
        ar: 'نرفع يدنا بلطف ونقول: الحمد لله!',
        en: 'Smile warmly and say: Alhamdulillah!',
      },
      mid: {
        ar: 'عندما نشبع أو ننهي لعبتنا، نشكر الله ونقول الحمد لله.',
        en: 'When we finish eating or playing, we thank Allah: Alhamdulillah.',
      },
      older: {
        ar: 'نحمد الله على نعمه اليومية؛ فالشكر يزيد الفرح في القلب.',
        en: 'Thanking Allah daily with Alhamdulillah fills the heart with joy.',
      },
    },
    togetherPrompt: {
      ar: 'شاركوا معاً نعمة واحدة تحبونها اليوم وقولوا «الحمد لله».',
      en: 'Name one blessing together today and say “Alhamdulillah”.',
    },
  },
  {
    id: 'manner-salam',
    title: { ar: 'إفشاء السلام والتحية الطيبة', en: 'Greeting Kindly with As-Salamu Alaykum' },
    phraseAr: 'السَّلَامُ عَلَيْكُمْ',
    transliteration: 'As-Salamu Alaykum',
    icon: '👋',
    whenToUse: {
      ar: 'عند دخول البيت أو لقاء العائلة والأصدقاء.',
      en: 'When entering home or meeting family and friends.',
    },
    agePractice: {
      young: {
        ar: 'نلوّح بيدنا بلطف ونقول: السلام عليكم!',
        en: 'Wave gently and say: As-Salamu Alaykum!',
      },
      mid: {
        ar: 'ندخل الغرفة بابتسامة دافئة ونقول: السلام عليكم.',
        en: 'Enter with a warm smile and greet everyone with Salam.',
      },
      older: {
        ar: 'السلام يعني الأمان والمحبة — نبدأ به عند اللقاء ونرد بأحسن منه.',
        en: 'Greeting with Salam spreads peace and kindness in the room.',
      },
    },
    togetherPrompt: {
      ar: 'تدربوا على تحية الصباح: «السلام عليكم ورحمة الله» عند دخول الغرفة.',
      en: 'Practice greeting each other with “As-Salamu Alaykum” when walking into the room.',
    },
  },
  {
    id: 'manner-kind-parents',
    title: { ar: 'بر الوالدين والكلام اللطيف', en: 'Kind Words & Respect for Parents' },
    phraseAr: 'جَزَاكُمَا اللهُ خَيْرًا',
    transliteration: 'JazakumAllahu Khayran',
    icon: '💝',
    whenToUse: {
      ar: 'عند التحدث مع ماما وبابا أو مساعدتهما في البيت.',
      en: 'When speaking gently with Mom and Dad or helping at home.',
    },
    agePractice: {
      young: {
        ar: 'حضن دافئ وكلمة لطيفة لماما وبابا.',
        en: 'A warm hug and gentle voice for Mom and Dad.',
      },
      mid: {
        ar: 'نتحدث بصوت هادئ ولطيف ونقول شكراً وجزاكم الله خيراً.',
        en: 'Use a gentle voice and say thank you / JazakAllahu Khayran.',
      },
      older: {
        ar: 'أوصانا القرآن بالقول الكريم للوالدين، فنسمع لهما باحترام ونساعدهما.',
        en: 'The Quran teaches us to speak kindly to parents and help them gladly.',
      },
    },
    togetherPrompt: {
      ar: 'شجّع طفلك على عمل لطيف صغير مثل ترتيب لعبة معاً.',
      en: 'Do one small helpful action together, like tidying a favorite toy.',
    },
  },
  {
    id: 'manner-honesty',
    title: { ar: 'الصدق والأمانة', en: 'Truthfulness & Gentle Honesty' },
    phraseAr: 'الصِّدْقُ يُحِبُّهُ اللهُ',
    transliteration: 'Truthfulness is loved by Allah',
    icon: '🕊️',
    whenToUse: {
      ar: 'عندما نحكي ما حدث أو نعيد لعبة لصديقنا.',
      en: 'When telling what happened or returning a friend’s toy.',
    },
    agePractice: {
      young: {
        ar: 'نقول الحقيقة بلطف، وبابا وماما يسمعاننا بحب.',
        en: 'We tell the truth gently, and parents listen with love.',
      },
      mid: {
        ar: 'الطفل الصادق شجاع ومحبوب عند الله والناس.',
        en: 'Telling the truth makes our heart brave and peaceful.',
      },
      older: {
        ar: 'نقول الصدق دائماً ونحفظ ألعاب وكتب أصدقائنا بأمانة.',
        en: 'Always speak truthfully and take good care of others’ belongings.',
      },
    },
    togetherPrompt: {
      ar: 'امدح طفلك عندما يحكي لك الموقف بصدق وطمأنينة.',
      en: 'Praise your child warmly whenever they share the truth openly.',
    },
  },
  {
    id: 'manner-mercy-animals',
    title: { ar: 'الرفق بالحيوان والنبات', en: 'Kindness to Animals & Nature' },
    phraseAr: 'الرِّفْقُ مَغْزَاهُ جَمِيلٌ',
    transliteration: 'Gentle care for Allah’s creatures',
    icon: '🐾',
    whenToUse: {
      ar: 'عند رؤية قطة أو عصفور أو سقي نبات في الحديقة.',
      en: 'When seeing a cat, bird, or watering a little plant.',
    },
    agePractice: {
      young: {
        ar: 'يد ناعمة ولطيفة مع القطط والعصافير والزهور.',
        en: 'Gentle hands with kittens, birds, and flowers.',
      },
      mid: {
        ar: 'نضع ماءً نظيفاً للعصافير ولا نؤذي أي حيوان أو نبات.',
        en: 'Offer gentle care and water to plants, birds, and pets.',
      },
      older: {
        ar: 'الرحمة بالكائنات الصغيرة سبب لمحبة الله والبركة في حياتنا.',
        en: 'Showing mercy to animals and plants brings Allah’s love and care.',
      },
    },
    togetherPrompt: {
      ar: 'اسقوا نبتة معاً أو ضعوا وعاء ماء صغيراً للطيور.',
      en: 'Water a plant together or set out a little dish of water for birds.',
    },
  },
];

export const DEFAULT_ALLOWED_SURAH_IDS = QURAN_SURAHS.map((s) => s.id);

export function getQuranSurahById(surahId: string): QuranSurahSpec | undefined {
  return QURAN_SURAHS.find((s) => s.id === surahId);
}

export function getQuranReciterById(reciterId: string): QuranReciterSpec | undefined {
  const normalized = reciterId === 'adult-husary-murattal' ? 'adult-husary-muallim' : reciterId;
  return QURAN_RECITERS.find((r) => r.id === normalized || r.canonicalSlug === reciterId);
}

export function getQuranStoryById(storyId: string): QuranStorySpec | undefined {
  const found = QURAN_STORIES.find((s) => s.id === storyId);
  if (found) return found;
  if (storyId === LEGACY_GARDEN_STORY.id) return LEGACY_GARDEN_STORY;
  return undefined;
}

export function getQuranMannerById(mannerId: string): QuranMannerSpec | undefined {
  return QURAN_MANNERS.find((m) => m.id === mannerId);
}
