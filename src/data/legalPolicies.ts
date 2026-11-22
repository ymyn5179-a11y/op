import { POLICY_VERSION } from '../utils/validation';

export interface LegalSection {
  id: string;
  heading: {
    ar: string;
    en: string;
  };
  paragraphs: Array<{
    ar: string;
    en: string;
  }>;
  bullets?: Array<{
    ar: string;
    en: string;
  }>;
}

export interface SubProcessorSpec {
  name: string;
  purpose: {
    ar: string;
    en: string;
  };
  privacyPolicyUrl: string;
  dpaAndIslamicGuidelinesNote: {
    ar: string;
    en: string;
  };
}

export const LEGAL_POLICY_META = {
  appName: {
    ar: 'نونو لاند (NonoLand)',
    en: 'NonoLand',
  },
  effectiveDate: '2026-11-20',
  effectiveDateDisplay: {
    ar: '٢٠ نوفمبر ٢٠٢٦',
    en: 'November 20, 2026',
  },
  policyVersion: POLICY_VERSION,
  contactEmail: 'privacy@nonoland.app',
  postalAddress: 'NonoLand Family Learning Privacy Desk, P.O. Box 40290, Riyadh 11499, Saudi Arabia',
  inquiryResponseDays: 30,
  incidentResponseHours: 24,
  deletionWindowDays: 30,
  backupPurgeDays: 90,
  maxQfAudioCacheDays: 7,
  quranFoundationAttribution: 'Quran data provided by Quran.Foundation.',
  reciterAttribution: "Sheikh Mahmoud Khalil Al-Husary – Hafs 'an 'Asim – Murattal",
} as const;

export const LEGAL_SUB_PROCESSORS: SubProcessorSpec[] = [
  {
    name: 'Quran Foundation (Quran.com & QuranReflect Content APIs / Official Audio CDN)',
    purpose: {
      ar: 'توفير النصوص القرآنية العثمانية والبيانات الوصفية للسور وروابط البث الصوتي المباشر للتلاوات المعتمدة فقط (دون إرسال بيانات شخصية للأطفال).',
      en: 'Retrieving authoritative Quran chapter/verse metadata and direct-stream recitation URLs via server-side APIs (without sending child personal data).',
    },
    privacyPolicyUrl: 'https://quran.com/privacy',
    dpaAndIslamicGuidelinesNote: {
      ar: 'يخضع لشروط مطوري Quran Foundation (التحديث ٢٠ نوفمبر ٢٠٢٦)، مع الالتزام بإبقاء النص القرآني دون تغيير والالتزام بضوابط المحتوى الإسلامي.',
      en: 'Governed by Quran Foundation Developer Terms (updated Nov 20, 2026), preserving unmodified Quran text and Islamic content guidelines.',
    },
  },
  {
    name: 'Neon (Managed Serverless PostgreSQL)',
    purpose: {
      ar: 'تخزين بيانات حسابات أولياء الأمور، ملفات الأطفال العائلية، سجل التقدم، وموافقات الخصوصية بشكل مشفر.',
      en: 'Encrypted relational database storage for parent accounts, family child profiles, learning progress, and consent ledgers.',
    },
    privacyPolicyUrl: 'https://neon.tech/privacy-policy',
    dpaAndIslamicGuidelinesNote: {
      ar: 'اتفاقية معالجة بيانات (DPA) مفعّلة مع التشفير أثناء النقل والتخزين والالتزام الصارم بعدم الوصول أو استغلال البيانات.',
      en: 'Bound by Data Processing Agreement (DPA), TLS/encryption-at-rest, and strict non-repurposing / Islamic content respect.',
    },
  },
  {
    name: 'Google Cloud Run (Hosting & Runtime Infrastructure)',
    purpose: {
      ar: 'استضافة خادم التطبيق وواجهة البرمجة الخلفية وتمرير الطلبات الآمنة عبر HTTPS/TLS.',
      en: 'Application server hosting, TLS termination, and isolated backend runtime infrastructure.',
    },
    privacyPolicyUrl: 'https://policies.google.com/privacy',
    dpaAndIslamicGuidelinesNote: {
      ar: 'خاضع لاتفاقية معالجة البيانات السحابية لـ Google Cloud وضوابط العزل والأمان وإرشادات احترام المحتوى الديني.',
      en: 'Protected under Google Cloud DPA security controls, access isolation, and strict data-handling commitments.',
    },
  },
  {
    name: 'Google Gemini API (Optional Parent-Consented Educational Companion via Server Proxy)',
    purpose: {
      ar: 'تقديم ردود تعليمية لطيفة للطفل في قسم المساعد الذكي فقط بعد موافقة ولي الأمر الصريحة (ولا يُستخدم في تلاوة القرآن أو توليد أي نصوص قرآنية).',
      en: 'Powers optional educational stories/answers in Nono AI ONLY when explicitly opted in by a parent (never used for Quran text/recitation or model training).',
    },
    privacyPolicyUrl: 'https://ai.google.dev/gemini-api/terms',
    dpaAndIslamicGuidelinesNote: {
      ar: 'يعمل عبر وكيل الخادم فقط عند تفعيل موافقة ولي الأمر، ولا تُستخدم بيانات العائلة أو محتوى Quran Foundation لتدريب نماذج الذكاء الاصطناعي.',
      en: 'Called strictly via server proxy only after opt-in parental consent; neither family data nor Quran Foundation content is used to train AI models.',
    },
  },
];

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    id: 'overview',
    heading: {
      ar: '١. نطاق السياسة وهوية التطبيق وتكامل Quran Foundation',
      en: '1. App Identity, Scope & Quran Foundation API Integration',
    },
    paragraphs: [
      {
        ar: `توضح سياسة الخصوصية هذه كيف يعالج تطبيق نونو لاند (NonoLand) البيانات الشخصية والعائلية اعتباراً من تاريخ السريان: ${LEGAL_POLICY_META.effectiveDateDisplay.ar} (الإصدار ${LEGAL_POLICY_META.policyVersion}). يستخدم التطبيق واجهات برمجة تطبيقات Quran Foundation الرسمية المرتبطة بمنظومة Quran.com وQuranReflect لتقديم تجربة تعلم قرآنية هادئة وآمنة للأسرة.`,
        en: `This Privacy Policy explains how NonoLand collects, uses, protects, and deletes information effective ${LEGAL_POLICY_META.effectiveDateDisplay.en} (Version ${LEGAL_POLICY_META.policyVersion}). NonoLand integrates official Quran Foundation APIs associated with Quran.com and QuranReflect to deliver a calm, family-guided Quran learning experience.`,
      },
      {
        ar: 'نؤكد صراحةً أن التطبيق يجلب النصوص القرآنية العثمانية العامة والبيانات الوصفية للسور وروابط التلاوة الصوتية من Quran Foundation API دون جمع أي بيانات شخصية من مصادر Quran Foundation ودون إرسال أي بيانات تعريفية شخصية للأطفال إلى واجهات Quran Foundation.',
        en: 'NonoLand retrieves public Quran Uthmani text, Surah metadata, and recitation stream URLs from Quran Foundation APIs without collecting any personal data from Quran Foundation sources and without transmitting children’s personal information to Quran Foundation APIs.',
      },
    ],
  },
  {
    id: 'data-collected',
    heading: {
      ar: '٢. أنواع البيانات التي نجمعها وأغراضها وأساسها القانوني',
      en: '2. Data Collected, Specific Purposes & Lawful Basis',
    },
    paragraphs: [
      {
        ar: 'نطبق مبدأ تقليل البيانات إلى الحد الأدنى الضروري لتشغيل البيئة التعليمية العائلية الخاصة:',
        en: 'We practice strict data minimization and collect only what is necessary to operate your private family learning space:',
      },
    ],
    bullets: [
      {
        ar: 'بيانات حساب ولي الأمر أو المعلم (١٨+): الاسم المعروض، البريد الإلكتروني، كلمة المرور المجزّأة (hash) أو مفتاح المرور الاختياري، وسجل قبول السياسة — الأساس القانوني: تنفيذ الخدمة والموافقة الصريحة.',
        en: 'Parent/Guardian or Teacher (18+) Account Data: Display name, email address, salted password hash or optional WebAuthn passkey, and policy acceptance timestamp — Lawful basis: contract performance and explicit consent.',
      },
      {
        ar: 'ملف الطفل العائلي الخاص (للفئة ١–٤ سنوات تحت إدارة الأهل): اسم مستعار/لقب اختياري، سنة وشهر الميلاد للتكييف العمري فقط، وتقدم السور والأنشطة — الأساس القانوني: موافقة ولي الأمر القابلة للتحقق وتحت رقابة بوابة الأهل.',
        en: 'Private Child Profile Data (Ages 1–4, parent-managed): Nickname/display name, birth month/year solely for age-band adaptation, and learning/memorization milestones — Lawful basis: verifiable parental consent under Parent Gate control.',
      },
      {
        ar: 'بيانات الميزات الاختيارية ومركز الموافقات: تفضيلات الذكاء الاصطناعي التربوي، التفاعل الصوتي، أو تحليلات التقدم الأسبوعي — تتطلب موافقة صريحة منفصلة (opt-in) ويمكن سحبها في أي وقت من لوحة الأهل.',
        en: 'Optional Feature Consents: Educational AI companion, voice interaction, and weekly learning analytics require separate explicit opt-in consent and may be withdrawn at any time in the Parent Privacy Center.',
      },
      {
        ar: 'سجلات الأمان والتدقيق: عنوان IP عند تسجيل الدخول ورموز الجلسات الآمنة (HttpOnly) لمنع الاختراق وحماية الحسابات — الأساس القانوني: المصلحة المشروعة في أمن المنصة.',
        en: 'Security & Audit Logs: IP metadata at authentication and HttpOnly session identifiers used strictly to prevent abuse and protect family accounts — Lawful basis: legitimate security interest.',
      },
    ],
  },
  {
    id: 'prohibited-uses',
    heading: {
      ar: '٣. الاستخدامات المحظورة وحماية البيانات الدينية الحساسة',
      en: '3. Prohibited Data Uses & Sensitive Religious Data Safeguards',
    },
    paragraphs: [
      {
        ar: 'تُعد بيانات التلاوة والاهتمام الديني للأطفال والعائلات بيانات حساسة تتطلب عناية استثنائية، ولا تُعالج إلا بموافقة ولي الأمر الصريحة.',
        en: 'Information reflecting a family’s Quranic engagement or religious learning preferences is treated as sensitive data and processed strictly with explicit parental opt-in consent.',
      },
    ],
    bullets: [
      {
        ar: 'حظر تام للإعلانات الموجهة: لا ننشئ ملفات تعريف إعلانية ولا نعرض إعلانات تتبعية داخل تجربة الطفل.',
        en: 'Zero Advertising Profiles: NonoLand never builds behavioral advertising profiles or shares family/child data with ad networks.',
      },
      {
        ar: 'منع البيع والتنقيب: لا نبيع بيانات المستخدمين أو بيانات Quran Foundation ولا نؤجرها ولا نستخرجها لأغراض تسويقية أو إعادة بيع مستقلة.',
        en: 'No Selling, Mining, or Repurposing: We never sell, rent, mine, sublicense, or repurpose user data or Quran Foundation data as standalone datasets.',
      },
      {
        ar: 'حظر التدريب بالذكاء الاصطناعي: لا يُسمح باستخدام أي محتوى من Quran Foundation أو محتوى المستخدمين في تدريب أو ضبط نماذج الذكاء الاصطناعي أو التعلم الآلي دون موافقة صريحة مستقلة ومكتوبة.',
        en: 'No AI/ML Model Training: Neither Quran Foundation content nor user-generated family content may be used to train or fine-tune AI/ML models without separate explicit consent.',
      },
    ],
  },
  {
    id: 'sub-processors',
    heading: {
      ar: '٤. الجهات الفرعية المعالجة للبيانات (Sub-Processors)',
      en: '4. Disclosed Third-Party Sub-Processors & DPA Commitments',
    },
    paragraphs: [
      {
        ar: 'نعتمد فقط على مزودي بنية تحتية موثوقين مرتبطين باتفاقيات معالجة بيانات (DPA) والتزام صريح باحترام قدسية النصوص الإسلامية وضوابط المحتوى الشرعي:',
        en: 'NonoLand discloses all third-party sub-processors used to operate the service. Each sub-processor operates under Data Processing Agreements (DPAs) and strict commitments to protect user data and respect Islamic content guidelines:',
      },
    ],
    bullets: LEGAL_SUB_PROCESSORS.map((sp) => ({
      ar: `${sp.name}: ${sp.purpose.ar} (${sp.dpaAndIslamicGuidelinesNote.ar}) — سياسة الخصوصية: ${sp.privacyPolicyUrl}`,
      en: `${sp.name}: ${sp.purpose.en} (${sp.dpaAndIslamicGuidelinesNote.en}) — Privacy Policy: ${sp.privacyPolicyUrl}`,
    })),
  },
  {
    id: 'security',
    heading: {
      ar: '٥. أمن المعلومات والامتثال لقاعدة الأمان (Security Rule 6.9)',
      en: '5. Data Security Controls & Security Rule 6.9 Compliance',
    },
    paragraphs: [
      {
        ar: 'يلتزم تطبيق نونو لاند بضوابط الحماية التقنية المنصوص عليها في شروط مطوري Quran Foundation وبشكل خاص قاعدة الأمان (Security Rule 6.9):',
        en: 'NonoLand enforces technical and organizational safeguards aligned with Quran Foundation Developer Terms, specifically Security Rule 6.9:',
      },
    ],
    bullets: [
      {
        ar: 'التشفير أثناء النقل والتخزين: جميع الاتصالات محمية عبر HTTPS/TLS، والبيانات الحساسة وكلمات المرور ومفاتيح التكامل مخزنة بتشفير معتمد على مستوى الخادم وقاعدة البيانات.',
        en: 'Encryption in Transit & at Rest: All traffic requires HTTPS/TLS encryption, and sensitive fields, credentials, and PostgreSQL records are encrypted at rest.',
      },
      {
        ar: 'ضوابط الوصول وتدوير المفاتيح: تطبيق عزل الصلاحيات (RBAC)، حماية مفاتيح OAuth في الخادم فقط دون تعريضها للمتصفح، وتدوير دوري لمفاتيح التوقيع والجلسات.',
        en: 'Access Controls & Secret Rotation: Role-Based Access Control (RBAC), strict server-only OAuth credential isolation, CSRF protections, and periodic secret/session rotation cadence.',
      },
      {
        ar: 'الاستجابة للحوادث الأمنية خلال أقل من ٢٤ ساعة: يلتزم فريقنا برصد أي خرق أو اشتباه أمني واحتوائه وإبلاغ الجهات المعنية والأسر المتأثرة وQuran Foundation خلال أقل من ٢٤ ساعة.',
        en: 'Less than 24-Hour Incident Response Window: Security incidents or suspected breaches are triaged, contained, and reported within < 24 hours.',
      },
    ],
  },
  {
    id: 'rights-retention',
    heading: {
      ar: '٦. حقوق المستخدمين، الحذف (Delete My Data)، وفترات الاحتفاظ',
      en: '6. User Rights, "Delete My Data", OAuth Revocation & Retention Timelines',
    },
    paragraphs: [
      {
        ar: 'يمكن لولي الأمر الوصول إلى جميع بيانات الأسرة وتصحيحها وتصديرها أو حذفها في أي وقت:',
        en: 'Parents and account holders retain full visibility and control over their family data:',
      },
    ],
    bullets: [
      {
        ar: 'تصدير وحذف البيانات داخل التطبيق: من لوحة ولي الأمر ← مركز الخصوصية والموافقات، يتوفر زر التصدير الفوري (JSON) وآلية «طلب حذف بياناتي» (Delete My Data) المحمية ببوابة الأهل.',
        en: 'Access, Correction & "Delete My Data": Inside Parent Dashboard → Privacy Center & Consent Ledger, parents can update profiles, export their family JSON archive, and trigger "Delete My Data" after Parent Gate verification.',
      },
      {
        ar: 'سحب موافقات OAuth والجلسات: يستخدم التطبيق مصادقة client_credentials على الخادم فقط لجلب البيانات العامة من Quran Foundation ولا يخزن رموز دخول شخصية لحسابات Quran.com للمستخدمين؛ ويمكن لولي الأمر إنهاء جميع الجلسات الفعالة وسحب موافقات الميزات فوراً من مركز الخصوصية أو إعدادات الأمان.',
        en: 'OAuth & Consent Revocation: NonoLand authenticates to Quran Foundation strictly as a server-side client (no end-user QF OAuth personal tokens stored); parents can revoke optional feature consents or terminate all active device sessions immediately in the Privacy Center and Parent Dashboard.',
      },
      {
        ar: 'جداول الاحتفاظ والحذف: نحتفظ ببيانات الحساب طالما الحساب نشط فقط؛ يتم التنفيذ الفعلي للحذف النهائي خلال ٣٠ يوماً من الطلب، وتمحى النسخ الاحتياطية المشفرة خلال ٩٠ يوماً، كما تُحذف روابط التخزين المؤقت للصوت كل ≤ ٧ أيام وتُزال البيانات المرتبطة عند إنهاء تكامل Quran Foundation.',
        en: 'Retention & Deletion Windows: Account data is retained only while active; verified deletion requests are hard-deleted within 30 days and purged from encrypted backups within 90 days; server-cached Quran Foundation stream metadata respects the strict 7-day limit and any linked records are purged upon QF agreement/account termination.',
      },
    ],
  },
  {
    id: 'children-transfers-contact',
    heading: {
      ar: '٧. خصوصية الأطفال (١–٤ سنوات)، النقل الدولي، والتواصل',
      en: '7. Children’s Privacy, International Transfers, Updates & Contact',
    },
    paragraphs: [
      {
        ar: 'صُمم تطبيق نونو لاند للأطفال من عمر ١ إلى ٤ سنوات، ولا يُدار إلا حصرياً عبر حسابات أولياء الأمور والوصاة البالغين (١٨+ عاماً). يُمنع تقنياً إنشاء حسابات مستقلة من قِبل الأطفال أو تسجيل القاصرين ذاتياً، وتخضع جميع تغييرات الخصوصية والذكاء الاصطناعي وبوابة القرآن لمصادقة ولي الأمر.',
        en: 'NonoLand serves young children aged 1–4 strictly under 18+ parent/guardian-managed accounts. Self-registration by minors/children is blocked, and all child profiles, Quran settings, AI toggles, and data actions are gated behind verified Parent Gate authentication.',
      },
      {
        ar: 'عند معالجة أو نقل البيانات عبر مناطق سحابية دولية، نعتمد على البنود التعاقدية القياسية (Standard Contractual Clauses - SCCs) وضمانات معادلة للائحة GDPR مع الالتزام بالقوانين المحلية المعمول بها.',
        en: 'International data transfers rely on Standard Contractual Clauses (SCCs) and GDPR-equivalent contractual safeguards in compliance with applicable regional data-protection laws.',
      },
      {
        ar: `تحديثات السياسة والتواصل: عند إجراء أي تعديل جوهري نحدّث تاريخ السريان ونعرض إشعاراً واضحاً داخل التطبيق/عبر البريد الإلكتروني. للتواصل بشأن الخصوصية أو طلبات البيانات: ${LEGAL_POLICY_META.contactEmail} أو العنوان البريدي (${LEGAL_POLICY_META.postalAddress}) — ونلتزم بالرد خلال مدة أقصاها ${LEGAL_POLICY_META.inquiryResponseDays} يوماً.`,
        en: `Policy Updates & Contact: Material changes update the Effective Date and notify users via in-app notice/email. Privacy inquiries or data requests can be sent to ${LEGAL_POLICY_META.contactEmail} or ${LEGAL_POLICY_META.postalAddress}, with guaranteed response within ${LEGAL_POLICY_META.inquiryResponseDays} days.`,
      },
    ],
  },
];

export const TERMS_OF_USE_SECTIONS: LegalSection[] = [
  {
    id: 'acceptance-eligibility',
    heading: {
      ar: '١. الأهلية والقبول الأسري للشروط',
      en: '1. Eligibility, Parental Stewardship & Acceptance',
    },
    paragraphs: [
      {
        ar: `تحكم شروط الاستخدام هذه (المحدّثة بتاريخ ${LEGAL_POLICY_META.effectiveDateDisplay.ar} — الإصدار ${LEGAL_POLICY_META.policyVersion}) استخدام منصة نونو لاند (NonoLand) بما في ذلك عالم القرآن الكريم. يُشترط لإنشاء حساب عائلي أن يكون المستخدم ولي أمر أو معلماً بالغاً (١٨+ عاماً) يوافق نيابةً عن طفله على هذه الشروط وسياسة الخصوصية.`,
        en: `These Terms of Use (updated ${LEGAL_POLICY_META.effectiveDateDisplay.en}, Version ${LEGAL_POLICY_META.policyVersion}) govern access to NonoLand, including Quran World. Family accounts may only be created and managed by parents, legal guardians, or authorized educators aged 18+, acting on behalf of young learners aged 1–4.`,
      },
    ],
  },
  {
    id: 'quran-foundation-terms',
    heading: {
      ar: '٢. شروط محتوى Quran Foundation والإسناد وعدم التضليل',
      en: '2. Quran Foundation Content Terms, Attribution & Non-Endorsement',
    },
    paragraphs: [
      {
        ar: 'تخضع النصوص والروابط الصوتية المدمجة في عالم القرآن الكريم لشروط مطوري Quran Foundation (التحديث ٢٠ نوفمبر ٢٠٢٦):',
        en: 'Quranic metadata and approved recitation streams integrated into NonoLand follow the official Quran Foundation Developer Terms (updated November 20, 2026):',
      },
    ],
    bullets: [
      {
        ar: `الإسناد الواضح: يعرض التطبيق عبارة "${LEGAL_POLICY_META.quranFoundationAttribution}" مع توثيق القارئ المعتمد (${LEGAL_POLICY_META.reciterAttribution}).`,
        en: `Visible Attribution: NonoLand displays "${LEGAL_POLICY_META.quranFoundationAttribution}" alongside clear reciter attribution (${LEGAL_POLICY_META.reciterAttribution}).`,
      },
      {
        ar: 'عدم المبالغة أو الزعم بالمصادقة: استخدام واجهات Quran Foundation لا يعني رعاية رسمية أو اعتماداً مؤسسياً من Quran Foundation لمنتجات نونو لاند أو منهجها الخاص.',
        en: 'Non-Endorsement: Integration with Quran Foundation APIs does not constitute endorsement or sponsorship of NonoLand by Quran Foundation, Quran.com, or QuranReflect.',
      },
      {
        ar: 'الاستخدام التجاري والتربوي المسموح: يُسمح بدمج محتوى Quran Foundation داخل تجربة المستخدم النهائي في التطبيقات التعليمية والترفيهية العائلية (بما يشمل الاشتراكات أو المزايا المدفوعة)، ويُحظر تماماً بيع المحتوى القرآني أو إعادة ترخيصه أو توزيعه بشكل مستقل أو كحزمة تنزيل أو واجهة API منفصلة.',
        en: 'Permitted Integrated Use & Redistribution Prohibition: Commercial or freemium end-user app integration is permitted under Quran Foundation Developer Terms without an additional API license; however, selling, sublicensing, bulk exporting, or redistributing Quran Foundation audio or content as a standalone package or independent API feed is strictly prohibited.',
      },
      {
        ar: 'البث المباشر وسلامة النص: تُبث الملفات الصوتية مباشرة من روابط المزود المعتمدة دون إعادة استضافة (Rehosting)، وتُحدّث الروابط المخزنة مؤقتاً كل ≤ ٧ أيام، كما يظل النص العثماني ثابتاً ومحفوظاً من الترجمة التلقائية للمتصفح.',
        en: 'Direct Streaming, 7-Day Cache Cap & Text Immutability: Audio streams directly from approved provider CDN URLs (never rehosted), server URL caches remain capped at <= 7 days, and Uthmani Quranic text remains strictly unaltered and protected from browser auto-translation.',
      },
    ],
  },
  {
    id: 'closing-phrase-tajweed-gate',
    heading: {
      ar: '٣. التحقق من مصدر القارئ والتسجيلات وحالة عبارة الختام «صَدَقَ اللَّهُ الْعَظِيمُ»',
      en: '3. Reciter & Recitation Source Verification & Closing Phrase Policy',
    },
    paragraphs: [
      {
        ar: 'لا تُفعّل التلاوة الصوتية لعائلات الأطفال قبل إتمام التحقق من مصدر القارئ والتسجيلات (وفق بيانات مزود Quran Foundation وفحوصات السلامة التقنية للصوت والنص العثماني) وتأكيد المشرفين المصرّح لهم واعتماد البسملة. وتظل عبارة «صَدَقَ اللَّهُ الْعَظِيمُ» خارج النص القرآني وعدّاد الآيات، ومعطّلةً تقنياً وغير معرقلة للإطلاق، ولا يُستبدل أي جزء من القرآن بأصوات آلية (TTS).',
        en: 'Quran audio is never released to child/family accounts until Reciter & Recitation Source Verification (verified against Quran Foundation provider metadata and technical audio and Uthmani text integrity checks), explicit administrator confirmations, and Basmala audio approval are completed. The non-verse closing phrase "Sadaq Allah Al-Azeem" is excluded from Quran text and Ayah counts and remains disabled and non-blocking. Synthetic TTS voices are never used for Quranic recitation.',
      },
    ],
  },
  {
    id: 'account-termination-contact',
    heading: {
      ar: '٤. ضوابط الحساب، الإنهاء، والتواصل القانوني',
      en: '4. Account Controls, Suspension & Legal Contact',
    },
    paragraphs: [
      {
        ar: `يحق لولي الأمر إيقاف قسم عالم القرآن أو تعديل السور المسموحة والحد اليومي في أي لحظة، كما يحق له طلب حذف حساب العائلة وبياناتها بالكامل من مركز الخصوصية أو عبر ${LEGAL_POLICY_META.contactEmail}.`,
        en: `Parents may pause Quran World, adjust allowed Surahs, set daily time limits, or request complete account & data deletion at any time via the Privacy Center or by emailing ${LEGAL_POLICY_META.contactEmail}.`,
      },
    ],
  },
];
