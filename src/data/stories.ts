import { Story } from '../types/nonoland';

export const INTERACTIVE_STORIES: Story[] = [
  {
    id: 'story-lost-starlight-34',
    category: 'interactive',
    title: {
      ar: 'نجمة نونو الصغيرة الضائعة',
      en: "Nono's Little Lost Star",
    },
    summary: {
      ar: 'قصة بصرية لطيفة عن الألوان ومساعدة الأصدقاء.',
      en: 'A gentle picture story about colors and helping forest friends.',
    },
    ageEligibility: ['1-4'],
    recommendedAgeRange: '1-2',
    worldId: 'colors-shapes',
    coverEmoji: '🌟',
    accentColor: '#FF78B7',
    featuredCharacters: ['nono', 'lolo', 'titi'],
    moralValue: { ar: 'اللطف ومساعدة الأصدقاء', en: 'Kindness & Helping Friends' },
    startSceneId: 's1',
    scenes: {
      s1: {
        id: 's1',
        text: {
          ar: 'في صباحٍ مشمس في حديقة الألوان، وجد نونو نجمةً صغيرة حزينة تبحث عن لونها الذهبي اللامع. من سنسأل أولاً؟',
          en: 'One sunny morning in Colors Garden, Nono found a little star looking for its golden glow. Who should we ask first?',
        },
        illustrationEmoji: '🦊🌟🌳',
        bgMood: 'from-[#FFF8E9] via-[#FFE9F4] to-[#E6F7FF]',
        castCharacters: ['nono', 'titi'],
        nonoLine: {
          ar: 'هيا نساعد النجمة! اختر أين نبحث أولاً.',
          en: "Let's help the little star! Tap where we should look first.",
        },
        choices: [
          {
            id: 'c1',
            label: { ar: 'نسأل لولو عند الزهور الصفراء', en: 'Ask Lolo by the yellow flowers' },
            nextSceneId: 's2-butterfly',
            educationalTag: { ar: 'تمييز الألوان', en: 'Color Discovery' },
          },
          {
            id: 'c2',
            label: { ar: 'نسأل بوبو عند الشجرة الخضراء', en: 'Ask Bobo by the green tree' },
            nextSceneId: 's2-monkey',
            educationalTag: { ar: 'اكتشاف الطبيعة', en: 'Nature Discovery' },
          },
        ],
      },
      's2-butterfly': {
        id: 's2-butterfly',
        text: {
          ar: 'قالت لولو بابتسامة: رأيتُ ضوءاً أصفر يلمع فوق الغيمة البيضاء! هل نعدّ ٣ زهرات أولاً أم نلوّح للغيمة؟',
          en: 'Lolo smiled brightly: "I saw a yellow shimmer above the white cloud!" Should we count 3 flowers first or wave to the cloud?',
        },
        illustrationEmoji: '🌼☁️✨',
        bgMood: 'from-[#FFF4D1] via-[#FFE6F2] to-[#FFF8E9]',
        castCharacters: ['nono', 'lolo'],
        nonoLine: {
          ar: 'لولو تعرف الطريق! ما اختيارك؟',
          en: 'Lolo knows a clue! What shall we do?',
        },
        choices: [
          {
            id: 'c3',
            label: { ar: 'نعدّ ٣ زهرات صفراء: ١، ٢، ٣!', en: 'Count 3 yellow flowers: 1, 2, 3!' },
            nextSceneId: 's3-ending',
          },
          {
            id: 'c4',
            label: { ar: 'نلوّح للغيمة كي تهبط إلينا بلطف', en: 'Wave gently to invite the cloud down' },
            nextSceneId: 's3-ending',
          },
        ],
      },
      's2-monkey': {
        id: 's2-monkey',
        text: {
          ar: 'ضحك بوبو وأشار إلى قوس قزح كبير! قال: النجمة تحب اللون الأصفر في قوس قزح. لنذهب إليه معاً!',
          en: 'Bobo pointed up at a bright rainbow! "Stars love the yellow arch!" Shall we cross the rainbow hill together?',
        },
        illustrationEmoji: '🌈🌼💛',
        bgMood: 'from-[#E2F9EC] via-[#FFF6D6] to-[#E5F6FF]',
        castCharacters: ['nono', 'bobo'],
        nonoLine: {
          ar: 'بوبو صديق رائع! هيا بنا!',
          en: 'Bobo is so helpful! Let us go!',
        },
        choices: [
          {
            id: 'c5',
            label: { ar: 'نسير على جسر قوس قزح الملون', en: 'Walk across the colorful rainbow bridge' },
            nextSceneId: 's3-ending',
          },
        ],
      },
      's3-ending': {
        id: 's3-ending',
        text: {
          ar: 'يا للروعة! استعادت النجمة الصغيرة ضوءها الذهبي بفضلك وبفضل لطفك مع الأصدقاء. رقص الجميع تحت السماء الصافية!',
          en: 'Hurray! Because of your kindness and keen eyes, the little star found its golden sparkle again and danced across the sky!',
        },
        illustrationEmoji: '✨🌟🎉',
        bgMood: 'from-[#FFF0B8] via-[#E8DAFF] to-[#E1F7FF]',
        castCharacters: ['nono', 'lolo', 'bobo'],
        nonoLine: {
          ar: 'أحسنت يا صديقي! لقد ساعدت النجمة!',
          en: 'You did it! The star is shining brightly because of you!',
        },
        isEnding: true,
        rewardStars: 4,
      },
    },
  },
  {
    id: 'story-secret-garden-56',
    category: 'prediction',
    title: {
      ar: 'مغارة الحروف المفقودة',
      en: 'The Secret Cove of Missing Letters',
    },
    summary: {
      ar: 'قصة توقّع تفاعلية تجمع بين الحروف الأولى والأصوات واللعب الجماعي.',
      en: 'A gentle "Choose What Happens Next" adventure blending first letters and teamwork.',
    },
    ageEligibility: ['1-4'],
    recommendedAgeRange: '3-4',
    worldId: 'arabic-letters',
    coverEmoji: '🔑',
    accentColor: '#8054D9',
    featuredCharacters: ['nono', 'leo', 'titi'],
    moralValue: { ar: 'الفضول وحب القراءة', en: 'Curiosity & Love of Reading' },
    startSceneId: 'a1',
    scenes: {
      a1: {
        id: 'a1',
        text: {
          ar: 'وصل نونو وليو إلى بوابة خشبية مكتوب عليها: "افتحي يا بوابة بحرف يبدأ به اسم (أسد) و(أرنب)".',
          en: 'Nono and Leo reached a wooden gate with a riddle: "Open me with the letter that starts Apple and Ant!"',
        },
        illustrationEmoji: '🚪🔑🦁',
        bgMood: 'from-[#F1E8FF] via-[#FFF5D6] to-[#FFF8E9]',
        castCharacters: ['nono', 'leo'],
        predictionPrompt: {
          ar: 'توقّع ماذا سيحدث عندما نختار المفتاح الصحيح!',
          en: 'Predict what happens when we turn the right letter key!',
        },
        nonoLine: {
          ar: 'فكر بصوت الكلمة في أولها ثم توقع المفاجأة!',
          en: 'Listen closely to the first sound, then predict the surprise!',
        },
        choices: [
          {
            id: 'ac1',
            label: { ar: 'مفتاح حرف الألف (أ) / A', en: 'The Letter A / أ Key' },
            nextSceneId: 'a2-open',
          },
          {
            id: 'ac2',
            label: { ar: 'نطلب تلميحاً صوتياً من تيتي', en: 'Ask Titi for a sound clue' },
            nextSceneId: 'a2-clue',
          },
        ],
      },
      'a2-clue': {
        id: 'a2-clue',
        text: {
          ar: 'غنى تيتي بصوت عذب: "أَ... أَسَد... أَ... أَرْنَب! وبالإنجليزية A... Apple!" الآن أصبح الحل واضحاً تماماً.',
          en: 'Titi sang sweetly: "Aaa... Apple! Aaa... Ant!" Now the magic gate key is crystal clear.',
        },
        illustrationEmoji: '🎵✨🦜',
        bgMood: 'from-[#E2F6FF] via-[#F2E9FF] to-[#FFF8E9]',
        castCharacters: ['nono', 'titi'],
        nonoLine: {
          ar: 'رائع! جرب المفتاح الصحيح الآن.',
          en: 'Aha! Now turn the matching key!',
        },
        choices: [
          {
            id: 'ac3',
            label: { ar: 'أدر مفتاح (أ / A) وافتح المغارة', en: 'Turn the (أ / A) key to open the cove' },
            nextSceneId: 'a2-open',
          },
        ],
      },
      'a2-open': {
        id: 'a2-open',
        text: {
          ar: 'انفتحت البوابة وكشفت عن مكتبة مضيئة مليئة بالكتب الطائرة والحروف الذهبية! احتفل نونو وأصدقاؤه بهذا الاكتشاف الرائع.',
          en: 'Click! The gate swung open to reveal a glowing cove of floating storybooks and golden letters!',
        },
        illustrationEmoji: '📚✨🏆',
        bgMood: 'from-[#EDE2FF] via-[#DDF7EA] to-[#FFF8E9]',
        castCharacters: ['nono', 'leo', 'titi'],
        nonoLine: {
          ar: 'عمل مذهل! كل حرف يفتح عالماً جديداً.',
          en: 'Amazing work! Every letter unlocks a new world.',
        },
        isEnding: true,
        rewardStars: 5,
      },
    },
  },
  {
    id: 'story-eco-mission-78',
    category: 'prediction',
    title: {
      ar: 'مهمة إنقاذ النهر الكريستالي',
      en: 'Mission: Save the Crystal River',
    },
    summary: {
      ar: 'مغامرة استكشافية لطيفة حول حب الطبيعة والعناية بالماء والنباتات.',
      en: 'A gentle nature discovery story about caring for clean water and garden trees.',
    },
    ageEligibility: ['1-4'],
    recommendedAgeRange: '3-4',
    worldId: 'science-galaxy',
    coverEmoji: '🌊',
    accentColor: '#39BDF2',
    featuredCharacters: ['nono', 'ellie', 'leo'],
    moralValue: { ar: 'حماية البيئة والتفكير العلمي', en: 'Eco Care & Scientific Thinking' },
    startSceneId: 'e1',
    scenes: {
      e1: {
        id: 'e1',
        text: {
          ar: 'لاحظت إيلي أن منسوب المياه في النهر الكريستالي انخفض فجأة، وأن الأسماك تبحث عن ماء نقي. بصفتك محققاً علمياً، ما أول خطوة تتخذها؟',
          en: 'Ellie noticed the Crystal River running low and cloudy. As the team science detective, what happens next if we investigate first?',
        },
        illustrationEmoji: '🔭💧🐟',
        bgMood: 'from-[#DFF4FF] via-[#E3FCEF] to-[#FFF8E9]',
        castCharacters: ['nono', 'ellie'],
        predictionPrompt: {
          ar: 'توقّع أي أسلوب سيساعد النهر على الاستمرار نظيفاً طويلاً؟',
          en: 'Predict which approach will keep the river clean for good!',
        },
        nonoLine: {
          ar: 'العالم الصغير يلاحظ ويفحص الدليل قبل القرار.',
          en: 'A great scientist observes evidence before choosing!',
        },
        choices: [
          {
            id: 'ec1',
            label: { ar: 'فحص مصدر المياه في أعلى الجبل بالعدسة والبوصلة', en: 'Inspect the mountain spring source with lens & compass' },
            nextSceneId: 'e2-spring',
          },
          {
            id: 'ec2',
            label: { ar: 'تصميم مرشح طبيعي من الرمل والحصى لتنقية المياه', en: 'Build a natural sand-and-pebble water filter' },
            nextSceneId: 'e2-filter',
          },
        ],
      },
      'e2-spring': {
        id: 'e2-spring',
        text: {
          ar: 'عند النبع، وجدتَ أغصاناً سقطت بعد العاصفة وسدت المجرى! وإذا أعدنا توجيه المياه وزرعنا أشجاراً على الضفة، سنحمي التربة مستقبلاً.',
          en: 'At the spring, fallen storm branches had blocked the flow! Clearing the path and planting roots along the bank will protect the soil too.',
        },
        illustrationEmoji: '🌲⛰️💦',
        bgMood: 'from-[#DDF9EB] via-[#DFF4FF] to-[#FFF8E9]',
        castCharacters: ['nono', 'ellie', 'leo'],
        nonoLine: {
          ar: 'اكتشاف ذكي! كيف نكمل الحل المستدام؟',
          en: 'Smart discovery! How do we make the fix last?',
        },
        choices: [
          {
            id: 'ec3',
            label: { ar: 'فتح المجرى وغرس شجيرات تثبت ضفة النهر', en: 'Clear the stream and plant shrubs to anchor the bank' },
            nextSceneId: 'e3-victory',
          },
        ],
      },
      'e2-filter': {
        id: 'e2-filter',
        text: {
          ar: 'نجح المرشح الطبقي في تنقية عينة الماء! والآن لاحظت أن الطين القادم من أعلى التل هو السبب الرئيسي للعكارة.',
          en: 'Your layered pebble-and-sand filter cleared the sample! You also deduced that loose soil upstream is causing the cloudiness.',
        },
        illustrationEmoji: '🧪🪨✨',
        bgMood: 'from-[#E5F2FF] via-[#FFF6DD] to-[#FFF8E9]',
        castCharacters: ['nono', 'ellie'],
        nonoLine: {
          ar: 'ممتاز! تجربة ناجحة تقودنا للحل الجذري.',
          en: 'Brilliant experiment! Now let us solve the root cause.',
        },
        choices: [
          {
            id: 'ec4',
            label: { ar: 'التعاون مع القرية لزراعة الأشجار وتنقية النبع', en: 'Partner with the village to plant trees along the spring' },
            nextSceneId: 'e3-victory',
          },
        ],
      },
      'e3-victory': {
        id: 'e3-victory',
        text: {
          ar: 'عاد النهر الكريستالي يتدفق بصفاء ونقاء! قادت قراراتك العلمية الدقيقة وتعاونك مع القرية إلى حماية الطبيعة للجميع.',
          en: 'The Crystal River sparkles once more! Your scientific observation and sustainable plan protected the entire ecosystem.',
        },
        illustrationEmoji: '🌊🌈🌱🏆',
        bgMood: 'from-[#DDF9EB] via-[#E0F3FF] to-[#FFF4D6]',
        castCharacters: ['nono', 'ellie', 'leo'],
        nonoLine: {
          ar: 'تفكير علمي مبهر يا مستكشف!',
          en: 'Outstanding scientific reasoning, Explorer!',
        },
        isEnding: true,
        rewardStars: 6,
      },
    },
  },
  {
    id: 'story-bedtime-moonboat',
    category: 'bedtime',
    isBedtime: true,
    title: {
      ar: 'قارب القمر الهادئ (قصة ما قبل النوم)',
      en: 'The Quiet Moonboat (Bedtime Story)',
    },
    summary: {
      ar: 'قصة نوم دافئة وبطيئة الإيقاع مع النجوم الهادئة تساعد الطفل على الاسترخاء والنوم السعيد.',
      en: 'A soothing starlight bedtime tale designed to calm busy minds for peaceful sleep.',
    },
    ageEligibility: ['1-4'],
    recommendedAgeRange: '1-4',
    worldId: 'science-galaxy',
    coverEmoji: '🌙',
    accentColor: '#6366F1',
    featuredCharacters: ['nono', 'lolo', 'titi'],
    moralValue: { ar: 'السكينة والامتنان ليوم جميل', en: 'Calmness & Bedtime Gratitude' },
    startSceneId: 'b1',
    scenes: {
      b1: {
        id: 'b1',
        text: {
          ar: 'هبط المساء الناعم فوق نونو لاند، وارتدت السماء وشاحها الكحلي المرصّع بالنجوم. فتح نونو قاربه الفضي المصنوع من غيمة بيضاء دافئة.',
          en: 'Soft twilight drifted over NonoLand as the sky put on its deep blue velvet blanket. Nono climbed aboard a silver boat woven from fluffy white clouds.',
        },
        illustrationEmoji: '🌙⛵✨',
        bgMood: 'from-[#182042] via-[#2C2559] to-[#3B2E73]',
        castCharacters: ['nono'],
        nonoLine: {
          ar: 'خذ نفساً عميقاً وهادئاً... السماء تغنّي لنا لحن السكون.',
          en: 'Take one slow, cozy breath... the night sky is humming a gentle lullaby.',
        },
        choices: [
          {
            id: 'bc1',
            label: { ar: 'نبحر ببطء فوق غابة النجوم النائمة', en: 'Sail gently above the sleepy starlit forest' },
            nextSceneId: 'b2',
          },
        ],
      },
      b2: {
        id: 'b2',
        text: {
          ar: 'لوّحت لولو من فوق زهرة اللوتس وأغمض تيتي عينيه على غصن القمر. شكرا لكل ما تعلمناه ولعبناه اليوم يا أصدقاء.',
          en: 'Lolo yawned softly atop a lotus petal and Titi tucked his wing under a moonbeam. "Thank you for a wonderful day of play and discovery."',
        },
        illustrationEmoji: '😴🌸🌌',
        bgMood: 'from-[#1B2246] via-[#2B275C] to-[#23325C]',
        castCharacters: ['nono', 'lolo', 'titi'],
        nonoLine: {
          ar: 'كل النجوم تقول لك: ليلة سعيدة يا بطل.',
          en: 'Every little star whispers: goodnight, dear explorer.',
        },
        choices: [
          {
            id: 'bc2',
            label: { ar: 'نغمض أعيننا ونبتسم لأحلام جميلة', en: 'Close our eyes and drift into sweet dreams' },
            nextSceneId: 'b3',
          },
        ],
      },
      b3: {
        id: 'b3',
        text: {
          ar: 'نامت الجزيرة بسلام وأمان، وبقي مصباح النجمة المضيء يحرس أحلامك السعيدة حتى صباح مغامرة جديدة.',
          en: 'NonoLand fell peacefully asleep under a blanket of warm starlight, saving brand-new adventures for tomorrow morning.',
        },
        illustrationEmoji: '🛌🌟💤',
        bgMood: 'from-[#151B38] via-[#222452] to-[#2C3163]',
        castCharacters: ['nono'],
        nonoLine: {
          ar: 'أحلام سعيدة وهادئة يا صديقي.',
          en: 'Sweet dreams and peaceful sleep, my friend.',
        },
        isEnding: true,
        rewardStars: 3,
      },
    },
  },
  {
    id: 'story-bedtime-raindrop',
    category: 'bedtime',
    isBedtime: true,
    title: {
      ar: 'مقطورة المطر الحالمة',
      en: 'The Dreaming Raindrop Cloud',
    },
    summary: {
      ar: 'رحلة قطرة ندى لطيفة تنزل بهدوء لتغطي الأزهار قبل النوم.',
      en: 'Follow a gentle raindrop drifting softly over sleepy garden flowers at night.',
    },
    ageEligibility: ['1-4'],
    recommendedAgeRange: '1-2',
    worldId: 'healthy-body',
    coverEmoji: '🌧️',
    accentColor: '#3B82F6',
    featuredCharacters: ['lolo', 'ellie'],
    moralValue: { ar: 'الهدوء والراحة', en: 'Peaceful Rest' },
    startSceneId: 'r1',
    scenes: {
      r1: {
        id: 'r1',
        text: {
          ar: 'على وسادة من الغيوم الفضية، همست قطرة المطر الصغيرة لإيلي: حان وقت ترديد صوت المطر الهادئ... تيك... تاك.',
          en: 'Perched on a silver cloud pillow, Little Raindrop whispered to Ellie: "Listen to our soft bedtime rhythm... pitter... patter."',
        },
        illustrationEmoji: '☁️💧🌙',
        bgMood: 'from-[#17213E] via-[#25325C] to-[#2B3D70]',
        castCharacters: ['ellie', 'lolo'],
        nonoLine: {
          ar: 'صوت المطر الخفيف يهدئ القلب قبل النوم.',
          en: 'Soft raindrops make the gentlest lullaby.',
        },
        choices: [
          {
            id: 'rc1',
            label: { ar: 'نسقي أوراق الحديقة بهدوء', en: 'Tuck the garden leaves in gently' },
            nextSceneId: 'r2',
          },
        ],
      },
      r2: {
        id: 'r2',
        text: {
          ar: 'ارتوت الزهور وابتسم القمر في السماء. والآن استراحت إيلي ولولو تحت نجمة المساء الدافئة. تصبحون على خير!',
          en: 'Every thirsty flower smiled under the warm moon, and Ellie curled up for cozy dreams. Goodnight, world!',
        },
        illustrationEmoji: '🌷💤✨',
        bgMood: 'from-[#131B33] via-[#212D52] to-[#2D3264]',
        castCharacters: ['ellie', 'lolo', 'nono'],
        nonoLine: {
          ar: 'نوم هانئ مليء بالراحة!',
          en: 'Rest well and dream brightly!',
        },
        isEnding: true,
        rewardStars: 3,
      },
    },
  },
  {
    id: 'story-originals-grand-picnic',
    category: 'originals',
    title: {
      ar: 'نزهة أبطال نونو لاند الستة',
      en: 'NonoLand Originals: The Grand Six-Friend Picnic',
    },
    summary: {
      ar: 'قصة أصلية من نونو لاند يظهر فيها نونو ولولو وليو وبوبو وإيلي وتيتي معاً في تحدي النزهة السعيدة!',
      en: 'A NonoLand Original starring Nono, Lolo, Leo, Bobo, Ellie & Titi preparing a teamwork picnic!',
    },
    ageEligibility: ['1-4'],
    recommendedAgeRange: '2-3',
    worldId: 'life-skills',
    coverEmoji: '🧺',
    accentColor: '#FF9360',
    featuredCharacters: ['nono', 'lolo', 'leo', 'bobo', 'ellie', 'titi'],
    moralValue: { ar: 'العمل الجماعي وتقدير موهبة كل صديق', en: 'Teamwork & Valuing Everyone’s Gift' },
    startSceneId: 'o1',
    scenes: {
      o1: {
        id: 'o1',
        text: {
          ar: 'اجتمع الأصدقاء الستة في مرج قوس قزح: نونو يحمل الخريطة، لولو تحب النظام، ليو يحرس السلة، بوبو يضحك، إيلي تبتكر، وتيتي يغرد! من تبدأ بمساعدته؟',
          en: 'All six friends met at Rainbow Meadow! Nono holds the map, Lolo organizes, Leo guards the basket, Bobo juggles berries, Ellie invents, and Titi sings! Who joins first?',
        },
        illustrationEmoji: '🧺🍓🎈',
        bgMood: 'from-[#FFF6DB] via-[#FFE9D6] to-[#E6F7FF]',
        castCharacters: ['nono', 'lolo', 'leo'],
        nonoLine: {
          ar: 'كل صديق لديه موهبة مميزة تجعل فريقنا أقوى!',
          en: 'Every friend brings a unique talent that makes our team shine!',
        },
        choices: [
          {
            id: 'oc1',
            label: { ar: 'نساعد بوبو وتيتي في إعداد الألعاب والأغاني', en: 'Help Bobo & Titi prepare music & games' },
            nextSceneId: 'o2-games',
          },
          {
            id: 'oc2',
            label: { ar: 'نساعد إيلي ولو لو في ترتيب مفرش النزهة', en: 'Help Ellie & Lolo arrange the picnic blanket' },
            nextSceneId: 'o2-blanket',
          },
        ],
      },
      'o2-games': {
        id: 'o2-games',
        text: {
          ar: 'عزف تيتي لحناً سعيداً وقفز بوبو بسلة التوت دون أن تسقط حبة واحدة! حتى ليو الشجاع صفق لهما بفرح.',
          en: 'Titi whistled a cheerful melody while Bobo balanced the berry basket playfully! Even brave Leo clapped along!',
        },
        illustrationEmoji: '🎶🍓👏',
        bgMood: 'from-[#E2F9EC] via-[#FFF8E9] to-[#FFEAF3]',
        castCharacters: ['bobo', 'titi', 'leo'],
        nonoLine: {
          ar: 'المرح والموسيقى يجمعان القلوب!',
          en: 'Laughter and music bring everyone closer!',
        },
        choices: [
          {
            id: 'oc3',
            label: { ar: 'الاحتفال مع الأصدقاء الستة جميعاً!', en: 'Celebrate together with all 6 friends!' },
            nextSceneId: 'o3-feast',
          },
        ],
      },
      'o2-blanket': {
        id: 'o2-blanket',
        text: {
          ar: 'صنعت إيلي مروحة ورقية لطيفة تمنع الأوراق من التطاير، وقامت لولو بترتيب الأكواب الملونة لكل صديق بدقة.',
          en: 'Ellie folded a clever paper windmill to keep leaves away while Lolo arranged colorful cups for all six friends.',
        },
        illustrationEmoji: '🪁🥤🌈',
        bgMood: 'from-[#F1E8FF] via-[#FFF6DE] to-[#E3FCEF]',
        castCharacters: ['ellie', 'lolo', 'nono'],
        nonoLine: {
          ar: 'تنظيم رائع وتفكير مبدع!',
          en: 'What clever engineering and warm organization!',
        },
        choices: [
          {
            id: 'oc4',
            label: { ar: 'الاحتفال مع الأصدقاء الستة جميعاً!', en: 'Celebrate together with all 6 friends!' },
            nextSceneId: 'o3-feast',
          },
        ],
      },
      'o3-feast': {
        id: 'o3-feast',
        text: {
          ar: 'جلس نونو ولولو وليو وبوبو وإيلي وتيتي معاً تحت شمس نونو لاند الدافئة، وتعلموا أن التعاون يجعل كل لحظة أجمل بكثير!',
          en: 'Nono, Lolo, Leo, Bobo, Ellie, and Titi shared fruit and stories together, proving teamwork turns simple moments into magic!',
        },
        illustrationEmoji: '🦊🐰🦁🐒🐘🐦',
        bgMood: 'from-[#FFF1C9] via-[#FFE6F2] to-[#DFF6FF]',
        castCharacters: ['nono', 'lolo', 'leo', 'bobo', 'ellie', 'titi'],
        nonoLine: {
          ar: 'معاً نصنع أروع الذكريات في نونو لاند!',
          en: 'Together we create the brightest memories in NonoLand!',
        },
        isEnding: true,
        rewardStars: 5,
      },
    },
  },
  {
    id: 'story-values-honest-kite',
    category: 'values',
    title: {
      ar: 'الطائرة الورقية والأمانة الشجاعة',
      en: 'The Honest Kite Adventure',
    },
    summary: {
      ar: 'قصة قيم أخلاقية حول الصدق والشجاعة والاعتذار اللطيف عند الخطأ غير المقصود.',
      en: 'A heartwarming values story about honesty, courage, and fixing honest mistakes kindly.',
    },
    ageEligibility: ['1-4'],
    recommendedAgeRange: '3-4',
    worldId: 'life-skills',
    coverEmoji: '🪁',
    accentColor: '#10B981',
    featuredCharacters: ['leo', 'ellie', 'nono'],
    moralValue: { ar: 'الصدق والأمانة تبني الثقة', en: 'Honesty & Trustworthiness' },
    startSceneId: 'v1',
    scenes: {
      v1: {
        id: 'v1',
        text: {
          ar: 'بينما كان بوبو يلعب بطائرة ليو الورقية الجديدة، هبت ريح قوية فعلق ذيل الطائرة فوق غصن مرتفع وتمزق قليلاً. شعر بوبو بالقلق: ماذا يفعل الآن؟',
          en: 'While Bobo was flying Leo’s brand-new kite, a gust of wind tangled its tail in a tall branch and tore the ribbon. Bobo felt nervous—what should he do?',
        },
        illustrationEmoji: '🪁💨😟',
        bgMood: 'from-[#E2F9EC] via-[#FFF8E9] to-[#E5F6FF]',
        castCharacters: ['bobo', 'nono'],
        nonoLine: {
          ar: 'الحقيقة قد تبدو صعبة أحياناً، لكنها تجعل الأصدقاء يثقون بنا!',
          en: 'Telling the truth takes courage, and it keeps friendship strong!',
        },
        choices: [
          {
            id: 'vc1',
            label: { ar: 'نخبر ليو بالصدق ونصلح الطائرة معاً', en: 'Tell Leo the truth kindly and fix it together' },
            nextSceneId: 'v2-honest',
            educationalTag: { ar: 'قيمة الصدق', en: 'Honesty' },
          },
          {
            id: 'vc2',
            label: { ar: 'نستشير نونو كيف نعتذر بلطف ونعوض صديقنا', en: 'Ask Nono how to apologize thoughtfully' },
            nextSceneId: 'v2-advice',
          },
        ],
      },
      'v2-advice': {
        id: 'v2-advice',
        text: {
          ar: 'قال نونو بهدوء: الأخطاء تحدث للجميع! عندما نكون صادقين ونعرض المساعدة، يشعر صديقنا بالأمان معنا.',
          en: 'Nono smiled gently: "Everyone makes mistakes! Being honest and helping fix it shows true friendship."',
        },
        illustrationEmoji: '🦊💬💚',
        bgMood: 'from-[#FFF4D6] via-[#E2F9EC] to-[#FFF8E9]',
        castCharacters: ['nono', 'bobo'],
        nonoLine: {
          ar: 'هيا نذهب إلى ليو بشجاعة وابتسامة صادقة.',
          en: 'Let us talk to Leo with courage and care.',
        },
        choices: [
          {
            id: 'vc3',
            label: { ar: 'نتحدث مع ليو ونصمم ذيلاً جديداً ملوناً', en: 'Talk to Leo and craft a bright new tail' },
            nextSceneId: 'v2-honest',
          },
        ],
      },
      'v2-honest': {
        id: 'v2-honest',
        text: {
          ar: 'ابتسم ليو وشكر بوبو على صدقه وشجاعته! جلست إيلي معهما وصنعوا معاً ذيلاً ملوناً أطول وأجمل، وحلّقت الطائرة في السماء أعلى من قبل!',
          en: 'Leo hugged Bobo and thanked him for telling the truth! Together with Ellie, they stitched a rainbow tail and the kite soared higher than ever!',
        },
        illustrationEmoji: '🪁🌈🤝✨',
        bgMood: 'from-[#DDF9EB] via-[#FFF6D6] to-[#E6F7FF]',
        castCharacters: ['leo', 'bobo', 'ellie'],
        nonoLine: {
          ar: 'الصدق والمحبة يصنعان معجزات حقيقية!',
          en: 'Honesty and care make friendships shine!',
        },
        isEnding: true,
        rewardStars: 5,
      },
    },
  },
  {
    id: 'story-values-sharing-seeds',
    category: 'values',
    title: {
      ar: 'بذور المشاركة في بستان إيلي',
      en: "Ellie's Orchard of Sharing",
    },
    summary: {
      ar: 'قصة دافئة تعلم الأطفال كيف يكبر الفرح عندما نشارك خيراتنا ومواهبنا مع الآخرين.',
      en: 'A gentle tale showing how joy multiplies when we share what we grow with neighbors.',
    },
    ageEligibility: ['1-4'],
    recommendedAgeRange: '2-3',
    worldId: 'healthy-body',
    coverEmoji: '🍓',
    accentColor: '#EF4444',
    featuredCharacters: ['ellie', 'lolo', 'titi'],
    moralValue: { ar: 'الكرم والمشاركة بالمحبة', en: 'Generosity & Joyful Sharing' },
    startSceneId: 'sh1',
    scenes: {
      sh1: {
        id: 'sh1',
        text: {
          ar: 'حصدت إيلي سلة مليئة بالفراولة الطازجة من حديقتها! رأت تيتي الصغير يبحث عن إفطار شهي. ماذا تقترح على إيلي؟',
          en: 'Ellie harvested a basket full of sweet red strawberries from her garden! She spotted little Titi looking for breakfast. What should Ellie do?',
        },
        illustrationEmoji: '🍓🧺🌸',
        bgMood: 'from-[#FFE9EF] via-[#FFF8E9] to-[#E2F9EC]',
        castCharacters: ['ellie', 'titi'],
        nonoLine: {
          ar: 'المشاركة تملأ البستان بالابتسامات!',
          en: 'Sharing fills the whole orchard with smiles!',
        },
        choices: [
          {
            id: 'shc1',
            label: { ar: 'نشارك الفراولة ونهدي الأصدقاء بذوراً ليزرعوها', en: 'Share berries and gift seeds for friends to plant' },
            nextSceneId: 'sh2',
          },
        ],
      },
      sh2: {
        id: 'sh2',
        text: {
          ar: 'زرع كل صديق بذرة واحدة، وبعد أسابيع امتلأت الجزيرة كلها ببساتين الفراولة الحلوة بفضل عطاء إيلي ومشاركتها!',
          en: 'Every friend planted one little seed—and soon the whole neighborhood bloomed with sweet berry gardens!',
        },
        illustrationEmoji: '🍓🌿💖✨',
        bgMood: 'from-[#DDF9EB] via-[#FFEBF0] to-[#FFF8E9]',
        castCharacters: ['ellie', 'lolo', 'titi', 'nono'],
        nonoLine: {
          ar: 'بذرة كرم واحدة تصنع بستاناً كاملاً!',
          en: 'One seed of kindness grows an entire orchard!',
        },
        isEnding: true,
        rewardStars: 4,
      },
    },
  },
];
