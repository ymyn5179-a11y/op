import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Headphones,
  Heart,
  Lock,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { NonoCharacter } from '../components/NonoCharacter';
import type {
  ChildQuranSummaryPayload,
  QuranCatalogPayload,
} from '../components/quran/QuranSharedTypes';
import { QuranStoriesWorld } from '../components/quran/QuranStoriesWorld';
import { useNonoLand } from '../context/NonoLandContext';
import {
  DEFAULT_ALLOWED_SURAH_IDS,
  QURAN_MANNERS,
  QURAN_OPENING_BASMALAH,
  QURAN_RECITERS,
  QURAN_STORIES,
  QURAN_SURAHS,
} from '../data/quranCatalog';
import { formatNumber } from '../i18n/translations';
import type {
  InternalAgeBand,
  QuranMemorizationStatus,
  QuranSurahSpec,
} from '../types/nonoland';
import { getInternalAgeBand } from '../utils/ageAdaptation';
import {
  QuranAudioController,
  type QuranPlayerState,
  type QuranStopPosition,
  buildSurahRecitationSequence,
  clearQuranStopPosition,
  loadQuranStopPosition,
  resolveVerifiedAudioUrl,
  saveQuranStopPosition,
} from '../utils/quranAudioPlayer';
import { soundEngine } from '../utils/soundEngine';

type QuranTabId = 'listen' | 'surahs' | 'repeat' | 'memorization' | 'stories' | 'manners';

function bandToContentKey(band: InternalAgeBand): 'young' | 'mid' | 'older' {
  if (band === '1-2') return 'young';
  if (band === '2-3') return 'mid';
  return 'older';
}

function getArabicDigits(n: number): string {
  return new Intl.NumberFormat('ar-EG', { useGrouping: false }).format(n);
}

const STATUS_META: Record<
  QuranMemorizationStatus,
  { ar: string; en: string; cls: string }
> = {
  not_started: {
    ar: 'بداية رحلتك',
    en: 'Ready to Begin',
    cls: 'bg-slate-100 text-[#27345C]/75',
  },
  heard: {
    ar: 'سمعتها بهدوء',
    en: 'Listened',
    cls: 'bg-[#E0F2FE] text-[#0369A1]',
  },
  practiced: {
    ar: 'تدربت على ترديدها',
    en: 'Practiced Repeating',
    cls: 'bg-[#FEF3C7] text-[#92400E]',
  },
  familiar: {
    ar: 'أصبحت مألوفة',
    en: 'Familiar',
    cls: 'bg-[#EDE9FE] text-[#5B21B6]',
  },
  parent_confirmed: {
    ar: 'حفظ مؤكد من ولي الأمر ★',
    en: 'Confirmed by Parent ★',
    cls: 'bg-[#DCFCE7] text-[#166534]',
  },
};

export const QuranWorldScreen: React.FC = () => {
  const { activeChild, authSession, language, navigate } = useNonoLand();
  const [activeTab, setActiveTab] = useState<QuranTabId>('listen');
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<QuranCatalogPayload | null>(null);
  const [summary, setSummary] = useState<ChildQuranSummaryPayload | null>(null);
  const [selectedSurahId, setSelectedSurahId] = useState<string>('surah-1');
  const [repeatAyahIndex, setRepeatAyahIndex] = useState<number>(0);
  const [checkedAyahs, setCheckedAyahs] = useState<number[]>([]);
  const [feedbackNotice, setFeedbackNotice] = useState<string>('');
  const [errorNotice, setErrorNotice] = useState<string>('');
  const [savingAction, setSavingAction] = useState(false);

  const [repeatPauseSecs, setRepeatPauseSecs] = useState<number>(3);
  const [stopPosition, setStopPosition] = useState<QuranStopPosition | null>(null);
  const [sampleTestMsg, setSampleTestMsg] = useState<string>('');

  const [playerState, setPlayerState] = useState<QuranPlayerState>({
    status: 'idle',
    playbackMode: null,
    surahId: null,
    ayahNumber: null,
    currentRepeatIndex: 1,
    totalRepeats: 1,
    repeatWindowSecondsLeft: 0,
  });

  const audioCtrlRef = useRef<QuranAudioController | null>(null);

  useEffect(() => {
    const ctrl = new QuranAudioController((next) => setPlayerState(next));
    audioCtrlRef.current = ctrl;
    return () => {
      ctrl.dispose();
    };
  }, []);

  useEffect(() => {
    if (activeChild?.id) {
      setStopPosition(loadQuranStopPosition(activeChild.id));
    }
  }, [activeChild?.id]);

  const isPersistedChild = Boolean(
    authSession.authenticated &&
      activeChild &&
      !activeChild.id.startsWith('demo-') &&
      !activeChild.id.startsWith('sample-'),
  );

  const loadQuranData = useCallback(async () => {
    setLoading(true);
    setErrorNotice('');
    try {
      if (!isPersistedChild || !activeChild) {
        setCatalog({
          quranSchemaReady: false,
          featureEnabled: true,
          surahs: QURAN_SURAHS,
          reciters: QURAN_RECITERS,
          stories: QURAN_STORIES,
          manners: QURAN_MANNERS,
          playbackDefaultResolution: {
            requestedReciter: QURAN_RECITERS[0],
            activeReciter: null,
            usedAdultFallback: false,
            audioAvailable: false,
          },
        });
        setSummary(null);
        return;
      }

      const [catRes, sumRes] = await Promise.all([
        fetch('/api/quran/catalog', { credentials: 'include' }),
        fetch(`/api/children/${encodeURIComponent(activeChild.id)}/quran`, {
          credentials: 'include',
        }),
      ]);

      if (catRes.ok) {
        setCatalog((await catRes.json()) as QuranCatalogPayload);
      }
      if (sumRes.ok) {
        const sData = (await sumRes.json()) as ChildQuranSummaryPayload;
        setSummary(sData);
        if (sData.settings.allowedSurahIds.length > 0) {
          setSelectedSurahId((prev) =>
            sData.settings.allowedSurahIds.includes(prev)
              ? prev
              : sData.settings.allowedSurahIds[0],
          );
        }
      }
    } catch {
      setErrorNotice(
        language === 'ar'
          ? 'تعذر تحميل بيانات عالم القرآن الكريم حالياً.'
          : 'Unable to load Quran World right now.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeChild, isPersistedChild, language]);

  useEffect(() => {
    void loadQuranData();
  }, [loadQuranData]);

  const band = activeChild ? summary?.internalAgeBand || getInternalAgeBand(activeChild) : '1-2';
  const bandKey = bandToContentKey(band);
  const allSurahs = catalog?.surahs || QURAN_SURAHS;
  const allStories = catalog?.stories || QURAN_STORIES;
  const allManners = catalog?.manners || QURAN_MANNERS;
  const settings = summary?.settings;
  const quranSchemaReady = summary?.quranSchemaReady ?? catalog?.quranSchemaReady ?? false;
  const featureEnabled = summary?.featureEnabled ?? catalog?.featureEnabled ?? true;
  const childEnabled = settings ? settings.enabled : true;
  const listenOnlyMode = settings ? settings.listenOnlyMode : false;
  const repeatCount = settings?.repeatCount ?? 2;
  const dailyLimitReached = summary?.dailyLimitReached ?? false;
  const minutesUsedToday = summary?.minutesUsedToday ?? 0;
  const dailyMaxMinutes = settings?.dailyMaxMinutes ?? 15;

  const orderedAllowedSurahs: QuranSurahSpec[] = useMemo(() => {
    const allowedSet = new Set(settings?.allowedSurahIds || DEFAULT_ALLOWED_SURAH_IDS);
    const order = settings?.surahOrder || DEFAULT_ALLOWED_SURAH_IDS;
    const byId = new Map(allSurahs.map((s) => [s.id, s]));
    const sorted: QuranSurahSpec[] = [];
    for (const id of order) {
      if (allowedSet.has(id) && byId.has(id)) {
        sorted.push(byId.get(id)!);
      }
    }
    for (const s of allSurahs) {
      if (allowedSet.has(s.id) && !sorted.some((item) => item.id === s.id)) {
        sorted.push(s);
      }
    }
    return sorted.length > 0 ? sorted : allSurahs;
  }, [allSurahs, settings]);

  const selectedSurah =
    orderedAllowedSurahs.find((s) => s.id === selectedSurahId) || orderedAllowedSurahs[0];

  const surahProgressMap = useMemo(() => {
    const map = new Map<string, ChildQuranSummaryPayload['surahProgress'][number]>();
    for (const item of summary?.surahProgress || []) {
      map.set(item.surahId, item);
    }
    return map;
  }, [summary]);

  const storyProgressMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of summary?.storyProgress || []) {
      map.set(item.storyId, item.completedCount);
    }
    return map;
  }, [summary]);

  const mannerProgressMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of summary?.mannerProgress || []) {
      map.set(item.mannerId, item.practicedCount);
    }
    return map;
  }, [summary]);

  useEffect(() => {
    if (!featureEnabled || !childEnabled || dailyLimitReached) {
      audioCtrlRef.current?.stop();
    }
  }, [featureEnabled, childEnabled, dailyLimitReached]);

  if (!activeChild) return null;

  const playbackResolution = summary?.playbackResolution || catalog?.playbackDefaultResolution;
  const activeReciter = playbackResolution?.activeReciter ?? null;
  const displayedReciter = activeReciter || playbackResolution?.requestedReciter || QURAN_RECITERS[0];
  const audioUrlForCurrent = selectedSurah
    ? resolveVerifiedAudioUrl(
        activeReciter,
        selectedSurah.id,
        activeTab === 'repeat' ? selectedSurah.ayahs[repeatAyahIndex]?.number : undefined,
      )
    : null;
  const hasPerAyahVerifiedAudio = Boolean(
    selectedSurah &&
      activeReciter?.verificationStatus === 'verified' &&
      resolveVerifiedAudioUrl(activeReciter, selectedSurah.id, 1),
  );

  const postQuranAction = async (
    endpoint: string,
    payload: Record<string, unknown>,
    successMsgAr: string,
    successMsgEn: string,
  ) => {
    setFeedbackNotice('');
    setErrorNotice('');
    if (!isPersistedChild) {
      soundEngine.playPop();
      setFeedbackNotice(
        language === 'ar'
          ? 'تم العرض في وضع المعاينة. سجّل بحساب العائلة لحفظ التقدم.'
          : 'Preview mode active. Sign in with your family account to save progress.',
      );
      return;
    }
    if (!quranSchemaReady) {
      setErrorNotice(
        language === 'ar'
          ? 'حفظ التقدم ينتظر تفعيل جداول القرآن الكريم في قاعدة البيانات (Migration 0002).'
          : 'Saving Quran progress awaits database migration 0002_quran_world.sql.',
      );
      return;
    }

    setSavingAction(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authSession.csrfToken) headers['x-csrf-token'] = authSession.csrfToken;
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorNotice(data.error || (language === 'ar' ? 'تعذر حفظ النشاط.' : 'Could not record activity.'));
        return;
      }
      if (data.summary) {
        setSummary((prev) => ({
          ...(prev || ({} as ChildQuranSummaryPayload)),
          ...data.summary,
          quranSchemaReady,
        }));
      }
      soundEngine.playSuccess();
      setFeedbackNotice(language === 'ar' ? successMsgAr : successMsgEn);
    } catch {
      setErrorNotice(language === 'ar' ? 'تعذر الاتصال بالخادم.' : 'Network error.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleRecordStoryProgress = async (payload: {
    storyId: string;
    action: 'start' | 'scene_progress' | 'interaction' | 'complete';
    sceneIndex: number;
    sceneId?: string;
    interactionId?: string;
    quizCompleted?: boolean;
    closingActivityCompleted?: boolean;
    listenedSecondsDelta?: number;
    audioCompleted?: boolean;
    completionToken?: string;
  }) => {
    if (!activeChild || !isPersistedChild || !quranSchemaReady) return;
    if (payload.action === 'complete') {
      setSavingAction(true);
      setErrorNotice('');
    }
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authSession.csrfToken) headers['x-csrf-token'] = authSession.csrfToken;
      const res = await fetch(
        `/api/children/${encodeURIComponent(activeChild.id)}/quran/story/progress`,
        {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (payload.action === 'complete' || res.status === 429) {
          setErrorNotice(
            data.error ||
              (language === 'ar' ? 'تعذر حفظ تقدم القصة.' : 'Could not save story progress.'),
          );
        }
        return;
      }
      if (data.summary) {
        setSummary((prev) => ({
          ...(prev || ({} as ChildQuranSummaryPayload)),
          ...data.summary,
          quranSchemaReady,
        }));
      }
      if (payload.action === 'complete') {
        const storyObj = allStories.find((s) => s.id === payload.storyId);
        setFeedbackNotice(
          language === 'ar'
            ? `بارك الله فيك! أتممت قصة «${storyObj?.title.ar || payload.storyId}» وحصلت على وسام القصة.`
            : `MashaAllah! Completed “${storyObj?.title.en || payload.storyId}” and earned your story badge.`,
        );
      }
    } catch {
      if (payload.action === 'complete') {
        setErrorNotice(language === 'ar' ? 'تعذر الاتصال بالخادم.' : 'Network error.');
      }
    } finally {
      if (payload.action === 'complete') {
        setSavingAction(false);
      }
    }
  };

  const handleSaveStopBookmark = (surahId: string, ayahNum: number) => {
    if (!activeChild) return;
    saveQuranStopPosition(activeChild.id, surahId, ayahNum);
    setStopPosition(loadQuranStopPosition(activeChild.id));
    soundEngine.playPop();
    setFeedbackNotice(
      language === 'ar'
        ? `تم حفظ موضع التوقف عند الآية ${formatNumber(ayahNum, language)}.`
        : `Saved stop position at Ayah ${ayahNum}.`,
    );
  };

  const handleResumeFromBookmark = () => {
    if (!stopPosition) return;
    audioCtrlRef.current?.stop();
    const targetSurah = orderedAllowedSurahs.find((s) => s.id === stopPosition.surahId) || orderedAllowedSurahs[0];
    if (!targetSurah) return;
    setSelectedSurahId(targetSurah.id);
    const ayahIdx = Math.max(0, Math.min(targetSurah.ayahs.length - 1, stopPosition.ayahNumber - 1));
    setRepeatAyahIndex(ayahIdx);
    setActiveTab(listenOnlyMode ? 'listen' : 'repeat');
    soundEngine.playPop();
  };

  const handlePlaySurahOrAyah = async (mode: 'listen' | 'repeat', ayahNum?: number) => {
    if (!selectedSurah) return;
    setFeedbackNotice('');
    setErrorNotice('');
    const ctrl = audioCtrlRef.current;
    if (!ctrl) return;

    const url = resolveVerifiedAudioUrl(activeReciter, selectedSurah.id, ayahNum);
    if (!url) {
      setErrorNotice(
        language === 'ar'
          ? 'التلاوة الصوتية الموثّقة لهذا القارئ غير متاحة بعد؛ يمكن قراءة النص العثماني الموثق مع الطفل مباشرة.'
          : 'Verified recitation audio is not yet available for this reciter; you may read the verified Uthmani text together directly.',
      );
      return;
    }

    if (ayahNum !== undefined && activeChild) {
      saveQuranStopPosition(activeChild.id, selectedSurah.id, ayahNum);
      setStopPosition(loadQuranStopPosition(activeChild.id));
    }

    if (mode === 'listen' && ayahNum === undefined) {
      const approvedBasmalaUrl =
        activeReciter?.basmalaAudioUrl ||
        (catalog?.phraseAssets?.basmala.status === 'approved'
          ? catalog.phraseAssets.basmala.audioUrl
          : null);
      const approvedClosingUrl =
        activeReciter?.closingPhraseAudioUrl ||
        (catalog?.phraseAssets?.closing.status === 'approved'
          ? catalog.phraseAssets.closing.audioUrl
          : null);
      const plan = buildSurahRecitationSequence({
        surah: selectedSurah,
        surahAudioUrl: url,
        basmalaAudioUrl: approvedBasmalaUrl,
        closingPhraseAudioUrl: approvedClosingUrl,
        requireApprovedBasmala: true,
      });

      if (plan.basmalaMissingRequired || plan.steps.length === 0) {
        setErrorNotice(
          language === 'ar'
            ? 'تشغيل هذه السورة يتطلب اعتماد تسجيل البسملة الموثّق من مراجع مخوّل أولاً.'
            : 'Playing this Surah requires an approved authentic Basmala recording first.',
        );
        return;
      }

      await ctrl.playSurahSequence({
        surahId: selectedSurah.id,
        steps: plan.steps,
        repeatCount: 1,
        onSequenceCompleted: () => {
          setFeedbackNotice(
            language === 'ar'
              ? plan.willPlayClosing
                ? `تمت تلاوة ${selectedSurah.nameAr} و«صَدَقَ اللَّهُ الْعَظِيمُ» بهدوء.`
                : `تمت تلاوة ${selectedSurah.nameAr} بهدوء.`
              : plan.willPlayClosing
                ? `Finished listening to ${selectedSurah.nameEn} and closing phrase.`
                : `Finished listening to ${selectedSurah.nameEn}.`,
          );
        },
      });
      return;
    }

    await ctrl.playWithRepeat({
      reciter: activeReciter,
      surahId: selectedSurah.id,
      ayahNumber: ayahNum,
      repeatCount: mode === 'repeat' ? repeatCount : 1,
      repeatPauseSeconds: mode === 'repeat' ? repeatPauseSecs : 0,
    });
  };

  const handlePlayTechnicalSample = async () => {
    setSampleTestMsg('');
    const ctrl = audioCtrlRef.current;
    if (!ctrl) return;
    const ok = await ctrl.playTechnicalSample('/assets/audio/technical-test-chime.wav');
    if (ok) {
      setSampleTestMsg(
        language === 'ar'
          ? 'نجح اختبار مشغّل الصوت على هذا الجهاز ✓'
          : 'Device audio playback check succeeded ✓',
      );
    }
  };

  const handleSelectSurah = (surahId: string) => {
    audioCtrlRef.current?.stop();
    setSelectedSurahId(surahId);
    setRepeatAyahIndex(0);
    setCheckedAyahs([]);
    setFeedbackNotice('');
    soundEngine.playPop();
  };

  const currentRepeatAyah =
    selectedSurah?.ayahs[Math.min(repeatAyahIndex, (selectedSurah?.ayahs.length || 1) - 1)];

  const tabs: Array<{ id: QuranTabId; ar: string; en: string; icon: React.ReactNode }> = [
    { id: 'listen', ar: 'الاستماع للقرآن', en: 'Listen', icon: <Headphones className="w-4 h-4" /> },
    { id: 'surahs', ar: 'السور القصيرة', en: 'Short Surahs', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'repeat', ar: 'استمع وردد', en: 'Listen & Repeat', icon: <Repeat className="w-4 h-4" /> },
    { id: 'memorization', ar: 'رحلة الحفظ', en: 'Memorization', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'stories', ar: 'حكايات من القرآن', en: 'Quran Stories', icon: <Heart className="w-4 h-4" /> },
    { id: 'manners', ar: 'الآداب الإسلامية', en: 'Islamic Manners', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="nono-card rounded-3xl p-10 text-center text-sm font-bold text-[#27345C]/75">
        {language === 'ar' ? 'جارٍ تهيئة عالم القرآن الكريم...' : 'Opening Quran World...'}
      </div>
    );
  }

  if (!featureEnabled || !childEnabled) {
    return (
      <div className="nono-card rounded-3xl p-8 text-center space-y-4 max-w-xl mx-auto">
        <Lock className="w-10 h-10 text-[#047857] mx-auto" />
        <h1 className="text-2xl font-extrabold text-[#27345C]">
          {!featureEnabled
            ? language === 'ar'
              ? 'عالم القرآن الكريم متوقف مؤقتاً'
              : 'Quran World is Currently Paused'
            : language === 'ar'
              ? 'عالم القرآن الكريم مغلق حالياً من قِبل ولي الأمر'
              : 'Quran World is Currently Paused by a Parent'}
        </h1>
        <p className="text-sm text-[#27345C]/75">
          {!featureEnabled
            ? language === 'ar'
              ? 'يمكن لولي الأمر أو الإدارة إعادة تفعيله في أي وقت.'
              : 'Administrators or parents can re-enable this section anytime.'
            : language === 'ar'
              ? 'أوقف ولي الأمر قسم عالم القرآن الكريم مؤقتاً لهذا الطفل من لوحة الأهل.'
              : 'A parent paused Quran World for this profile in Parent Controls.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('home')}
          className="nono-btn-tactile min-h-[44px] px-6 rounded-2xl bg-[#047857] text-white font-extrabold text-sm cursor-pointer"
        >
          {language === 'ar' ? 'العودة للرئيسية' : 'Back Home'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CALM PARCHMENT & EMERALD HEADER */}
      <section className="rounded-[2rem] border-2 border-[#B4862C]/25 bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#0D9488] text-white p-6 sm:p-8 shadow-lg">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-9 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-[#FDE68A]">
              <span>🌙 {language === 'ar' ? 'عالم القرآن الكريم' : 'Quran World'}</span>
              <span aria-hidden="true">·</span>
              <span>
                {language === 'ar' ? 'اسمع، ردد، واتعلم مع نونو' : 'Listen, Repeat & Learn with Nono'}
              </span>
              {isPersistedChild && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {formatNumber(minutesUsedToday, language)} / {formatNumber(dailyMaxMinutes, language)}{' '}
                    {language === 'ar' ? 'د اليوم' : 'm today'}
                  </span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-balance leading-snug">
              {language === 'ar'
                ? `مرحباً يا ${activeChild.displayName} في رحاب القرآن الهادئة`
                : `Welcome, ${activeChild.displayName}, to Quran World`}
            </h1>

            <p className="text-white/90 text-sm sm:text-base max-w-2xl leading-relaxed">
              {band === '1-2'
                ? language === 'ar'
                  ? 'نستمع معاً بهدوء لآيات الله الجميلة، ونتعرف على قصص وعادات طيبة مع نونو.'
                  : 'Listen calmly to beautiful verses together and explore gentle stories and manners with Nono.'
                : band === '2-3'
                  ? language === 'ar'
                    ? 'اختر سورة قصيرة للاستماع أو الترديد اللطيف، وتعلّم معاني الآيات والآداب اليومية.'
                    : 'Choose a short Surah to listen and gently repeat, learn simple meanings, and practice daily manners.'
                  : language === 'ar'
                    ? 'اقرأ النص العثماني الموثّق واستمع للتلاوة، وتابع رحلة حفظك وتعلم القصص القرآنية والآداب.'
                    : 'Explore verified Uthmani Surahs, practice listen & repeat, track your journey with parents, and enjoy stories & manners.'}
            </p>
          </div>

          <div className="lg:col-span-3 flex flex-col items-center justify-center">
            <NonoCharacter
              mood="listening"
              scarfColor={activeChild.companionScarfColor}
              size="md"
              language={language}
            />
          </div>
        </div>
      </section>

      {/* SCHEMA PENDING / PARENT PAUSED / DAILY LIMIT NOTICES */}
      {isPersistedChild && !quranSchemaReady && (
        <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-[#D97706]/35 text-[#92400E] text-xs sm:text-sm font-bold flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#D97706]" />
          <div>
            <p className="font-extrabold">
              {language === 'ar'
                ? 'عرض قراءة موثّق (بانتظار تفعيل حفظ التقدم في قاعدة البيانات)'
                : 'Verified Read-Only Preview (Progress Storage Pending Migration 0002)'}
            </p>
            <p className="mt-0.5 opacity-90">
              {language === 'ar'
                ? 'يمكنك الآن تصفح السور التسع الموثّقة وقصص القرآن والآداب الإسلامية بشكل كامل. سيتم تفعيل حفظ جلسات الطفل وإعدادات الأهل بمجرد تطبيق التحديث 0002_quran_world.sql.'
                : 'You can browse all 9 verified Surahs, symbolic Quran stories, and Islamic manners right now. Saving child sessions and parent controls activates once migration 0002_quran_world.sql is applied.'}
            </p>
          </div>
        </div>
      )}

      {!childEnabled && (
        <div className="p-5 rounded-2xl bg-[#FEF2F2] border border-[#EF4444]/30 text-[#991B1B] text-sm font-bold flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 shrink-0" />
            <span>
              {language === 'ar'
                ? 'أوقف ولي الأمر قسم عالم القرآن الكريم مؤقتاً لهذا الطفل من لوحة الأهل.'
                : 'Quran World is currently paused by a parent in Parent Controls.'}
            </span>
          </div>
        </div>
      )}

      {dailyLimitReached && childEnabled && (
        <div className="p-5 rounded-2xl bg-[#EFF6FF] border border-[#3B82F6]/30 text-[#1E3A8A] text-sm font-bold flex items-center gap-3">
          <Clock className="w-5 h-5 shrink-0 text-[#2563EB]" />
          <span>
            {language === 'ar'
              ? `ما شاء الله! وصل ${activeChild.displayName} لهدفه اليومي الهادئ (${dailyMaxMinutes} دقيقة). وقت لطيف للراحة واللعب حتى الغد.`
              : `MashaAllah! ${activeChild.displayName} reached today’s peaceful goal (${dailyMaxMinutes} min). Enjoy resting and playing until tomorrow.`}
          </span>
        </div>
      )}

      {/* 6 CORE EXPERIENCES NAVIGATION BAR */}
      <div className="flex flex-wrap gap-2 p-2 rounded-2xl bg-white border border-[#27345C]/12">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                audioCtrlRef.current?.stop();
                setActiveTab(tab.id);
                setFeedbackNotice('');
                setErrorNotice('');
                soundEngine.playPop();
              }}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer transition-colors ${
                isActive
                  ? 'bg-[#047857] text-white shadow-sm'
                  : 'text-[#27345C]/80 hover:bg-[#FFF8E9]'
              }`}
            >
              {tab.icon}
              <span>{language === 'ar' ? tab.ar : tab.en}</span>
            </button>
          );
        })}
      </div>

      {/* FEEDBACK & ERROR BANNERS */}
      {feedbackNotice && (
        <div className="p-3.5 rounded-2xl bg-[#ECFDF5] border border-[#10B981]/40 text-[#065F46] text-xs sm:text-sm font-extrabold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{feedbackNotice}</span>
        </div>
      )}
      {errorNotice && (
        <div className="p-3.5 rounded-2xl bg-[#FFFBEB] border border-[#D97706]/40 text-[#92400E] text-xs sm:text-sm font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorNotice}</span>
        </div>
      )}

      {/* SHARED SURAH SELECTOR BAR FOR LISTEN / SURAHS / REPEAT */}
      {(activeTab === 'listen' || activeTab === 'surahs' || activeTab === 'repeat') && (
        <div className="flex flex-wrap gap-2">
          {orderedAllowedSurahs.map((surah) => {
            const active = selectedSurah?.id === surah.id;
            const prog = surahProgressMap.get(surah.id);
            return (
              <button
                key={surah.id}
                type="button"
                onClick={() => handleSelectSurah(surah.id)}
                className={`min-h-[46px] px-4 py-2 rounded-2xl border-2 text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#064E3B] text-white border-[#064E3B]'
                    : 'bg-white text-[#27345C] border-[#B4862C]/25 hover:border-[#047857]'
                }`}
              >
                <span className="tabular-nums opacity-75">{surah.number}.</span>
                <span>{language === 'ar' ? surah.nameAr : surah.nameEn}</span>
                {prog?.parentConfirmedMemorization && <span aria-label="Confirmed">★</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* =====================================================================
          TAB 1: LISTEN TO QURAN (الاستماع للقرآن)
         ===================================================================== */}
      {activeTab === 'listen' && selectedSurah && (
        <div className="space-y-5">
          {/* Child Stop Position Bookmark Banner */}
          {stopPosition && (
            <div className="p-4 rounded-2xl bg-[#ECFDF5] border border-[#10B981]/35 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-bold text-[#065F46]">
              <span>
                🔖{' '}
                {language === 'ar'
                  ? `آخر موضع توقف: ${allSurahs.find((s) => s.id === stopPosition.surahId)?.nameAr || stopPosition.surahId} · الآية ${formatNumber(stopPosition.ayahNumber, language)}`
                  : `Last saved position: ${allSurahs.find((s) => s.id === stopPosition.surahId)?.nameEn || stopPosition.surahId} · Ayah ${stopPosition.ayahNumber}`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResumeFromBookmark}
                  className="min-h-[38px] px-3.5 rounded-xl bg-[#047857] text-white font-extrabold cursor-pointer"
                >
                  {language === 'ar' ? 'استكمل من هنا' : 'Resume Here'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearQuranStopPosition(activeChild.id);
                    setStopPosition(null);
                  }}
                  className="min-h-[38px] px-3 rounded-xl bg-white border border-[#10B981]/30 text-[#065F46] font-extrabold cursor-pointer"
                >
                  {language === 'ar' ? 'مسح' : 'Clear'}
                </button>
              </div>
            </div>
          )}

          {/* Audio Provenance & Controls Card */}
          <div className="nono-card rounded-3xl p-5 sm:p-6 bg-white space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold text-[#047857]">
                  {language === 'ar' ? 'تلاوة موثّقة ومرخّصة فقط' : 'Verified & Licensed Recitation Only'}
                </p>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#27345C] mt-0.5">
                  {selectedSurah.nameAr} · {selectedSurah.nameEn}
                </h2>
                <p className="text-xs text-[#27345C]/75 font-bold mt-0.5">
                  {`${language === 'ar' ? 'القارئ المعتمد:' : 'Configured Reciter:'} ${displayedReciter.name[language]}`}
                </p>
                <p className="text-[11px] font-bold text-[#047857] mt-0.5">
                  {displayedReciter.attributionText
                    ? displayedReciter.attributionText[language]
                    : catalog?.attributionNotice || 'Quran data provided by Quran.Foundation.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {audioUrlForCurrent ? (
                  <>
                    {playerState.status === 'loading' ? (
                      <button
                        type="button"
                        disabled
                        className="min-h-[48px] px-5 rounded-2xl bg-[#047857]/80 text-white font-extrabold text-sm flex items-center gap-2 opacity-90"
                      >
                        <Clock className="w-5 h-5 animate-spin" />
                        <span>{language === 'ar' ? 'جارٍ تحميل التلاوة...' : 'Loading recitation...'}</span>
                      </button>
                    ) : playerState.status === 'playing' && playerState.playbackMode !== 'technical-sample' ? (
                      <button
                        type="button"
                        onClick={() => audioCtrlRef.current?.pause()}
                        className="nono-btn-tactile min-h-[48px] px-5 rounded-2xl bg-[#D97706] text-white font-extrabold text-sm flex items-center gap-2 cursor-pointer"
                      >
                        <Pause className="w-5 h-5" />
                        <span>{language === 'ar' ? 'إيقاف مؤقت' : 'Pause'}</span>
                      </button>
                    ) : playerState.status === 'paused' && playerState.playbackMode !== 'technical-sample' ? (
                      <button
                        type="button"
                        onClick={() => audioCtrlRef.current?.resume()}
                        className="nono-btn-tactile min-h-[48px] px-5 rounded-2xl bg-[#047857] text-white font-extrabold text-sm flex items-center gap-2 cursor-pointer"
                      >
                        <Play className="w-5 h-5" />
                        <span>{language === 'ar' ? 'متابعة الاستماع' : 'Resume'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!childEnabled || dailyLimitReached}
                        onClick={() => void handlePlaySurahOrAyah('listen')}
                        className="nono-btn-tactile min-h-[48px] px-6 rounded-2xl bg-[#047857] text-white font-extrabold text-sm flex items-center gap-2 cursor-pointer disabled:opacity-45"
                      >
                        <Volume2 className="w-5 h-5" />
                        <span>{language === 'ar' ? 'تشغيل السورة كاملة' : 'Play Full Surah'}</span>
                      </button>
                    )}

                    {(playerState.status === 'playing' ||
                      playerState.status === 'paused' ||
                      playerState.status === 'loading') && (
                      <button
                        type="button"
                        onClick={() => audioCtrlRef.current?.stop()}
                        className="min-h-[48px] px-4 rounded-2xl bg-slate-100 text-[#27345C] font-extrabold text-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <Square className="w-4 h-4" />
                        <span>{language === 'ar' ? 'إيقاف' : 'Stop'}</span>
                      </button>
                    )}
                  </>
                ) : (
                  <div className="px-4 py-3 rounded-2xl bg-[#FFFBEB] border border-[#D97706]/30 text-[#92400E] text-xs font-bold flex items-center gap-2 max-w-md">
                    <VolumeX className="w-5 h-5 shrink-0 text-[#D97706]" />
                    <span>
                      {language === 'ar'
                        ? 'تلاوة الشيخ محمود خليل الحصري بانتظار إتمام التحقق من مصدر القارئ والتسجيلات واعتماد المشرفين (لا تُستخدم أي أصوات آلية للقرآن). يمكنكم القراءة معاً من المصحف أدناه.'
                        : 'Sheikh Al-Husary recitation is awaiting Reciter & Recitation Source Verification, documented licensing, and release approval (no synthetic voice is used for Quran). Read together from the verified Mushaf below.'}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={savingAction || !childEnabled || dailyLimitReached || !quranSchemaReady}
                  onClick={() =>
                    void postQuranAction(
                      `/api/children/${encodeURIComponent(activeChild.id)}/quran/listen`,
                      {
                        surahId: selectedSurah.id,
                        mode: 'listen',
                        ayahNumbers: selectedSurah.ayahs.map((a) => a.number),
                        durationSeconds: 30,
                        reciterId: activeReciter?.id,
                      },
                      `ما شاء الله! سُجلت جلسة استماع هادئة لـ ${selectedSurah.nameAr}.`,
                      `MashaAllah! Quiet listening moment logged for ${selectedSurah.nameEn}.`,
                    )
                  }
                  className="nono-btn-tactile min-h-[48px] px-5 rounded-2xl bg-[#FFD84D] text-[#27345C] font-extrabold text-sm flex items-center gap-2 cursor-pointer disabled:opacity-45"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{language === 'ar' ? 'أتممت الاستماع للسورة' : 'Mark Quiet Listen'}</span>
                </button>
              </div>
            </div>

            {/* Active Opening / Surah / Closing Step Indicator */}
            {playerState.sequencePhase &&
              (playerState.status === 'playing' ||
                playerState.status === 'paused' ||
                playerState.status === 'loading') && (
                <div className="p-2.5 rounded-xl bg-[#ECFDF5] border border-[#10B981]/30 text-[#065F46] text-xs font-extrabold">
                  {playerState.sequencePhase === 'basmala'
                    ? language === 'ar'
                      ? 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ — افتتاح التلاوة'
                      : 'Opening: بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'
                    : playerState.sequencePhase === 'closing'
                      ? language === 'ar'
                        ? 'صَدَقَ اللَّهُ الْعَظِيمُ — ختام التلاوة'
                        : 'Closing Phrase: صَدَقَ اللَّهُ الْعَظِيمُ'
                      : language === 'ar'
                        ? `تلاوة ${selectedSurah.nameAr}`
                        : `Reciting ${selectedSurah.nameEn}`}
                </div>
              )}

            {/* Player Error Banner */}
            {playerState.status === 'error' && playerState.errorMessage && (
              <div className="p-3 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs font-extrabold flex items-center justify-between gap-2">
                <span>{playerState.errorMessage}</span>
                {audioUrlForCurrent && (
                  <button
                    type="button"
                    onClick={() => void handlePlaySurahOrAyah('listen')}
                    className="px-3 py-1.5 rounded-xl bg-[#991B1B] text-white font-extrabold cursor-pointer"
                  >
                    {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
                  </button>
                )}
              </div>
            )}

            {/* Technical Non-Quran Audio Compatibility Check (for Browser / Android WebView verification) */}
            <div className="pt-3 border-t border-[#27345C]/10 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[#27345C]/65 font-bold">
                {language === 'ar'
                  ? 'اختبار تقني لصوت الجهاز (نغمة تجريبية مرخّصة وليست تلاوة قرآنية):'
                  : 'Device Audio Check (licensed non-Quran test chime):'}
              </span>
              <div className="flex items-center gap-2">
                {sampleTestMsg && (
                  <span className="text-[#047857] font-extrabold">{sampleTestMsg}</span>
                )}
                <button
                  type="button"
                  onClick={() => void handlePlayTechnicalSample()}
                  className="min-h-[36px] px-3.5 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-[#27345C] font-extrabold cursor-pointer flex items-center gap-1.5"
                >
                  <Volume2 className="w-4 h-4 text-[#047857]" />
                  <span>{language === 'ar' ? 'اختبار الصوت على الجهاز' : 'Test Device Audio'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* MUSHAF VERIFIED UTHMANI SURFACE */}
          <div className="quran-mushaf-surface rounded-[2rem] p-6 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#78350F]">
              <span>
                {language === 'ar'
                  ? `النص العثماني الموثّق · ${formatNumber(selectedSurah.ayahCount, language)} آيات`
                  : `Verified Uthmani Text · ${selectedSurah.ayahCount} Ayahs`}
              </span>
              <span className="text-[#047857]">
                ✓ {language === 'ar' ? 'مراجع من مصحف المدينة المنورة' : 'Verified Medina Mushaf'}
              </span>
            </div>

            {selectedSurah.hasOpeningBasmalah && (
              <p
                dir="rtl"
                lang="ar"
                translate="no"
                className="notranslate font-quran-uthmani text-center text-2xl sm:text-3xl text-[#064E3B] py-2 border-b border-[#B4862C]/20"
              >
                {QURAN_OPENING_BASMALAH}
              </p>
            )}

            <div className="space-y-4">
              {selectedSurah.ayahs.map((ayah) => {
                const isActiveAyah =
                  playerState.ayahNumber === ayah.number &&
                  playerState.surahId === selectedSurah.id &&
                  (playerState.status === 'playing' || playerState.status === 'loading');
                const ayahAudioUrl = resolveVerifiedAudioUrl(activeReciter, selectedSurah.id, ayah.number);
                return (
                  <div
                    key={ayah.verseKey}
                    className={`p-4 sm:p-5 rounded-2xl border space-y-2 transition-colors ${
                      isActiveAyah
                        ? 'bg-[#ECFDF5] border-[#047857] shadow-sm'
                        : 'bg-white/85 border-[#B4862C]/20'
                    }`}
                  >
                    <p
                      dir="rtl"
                      lang="ar"
                      translate="no"
                      className={`notranslate font-quran-uthmani text-right leading-[2.3] text-[#1E293B] ${
                        band === '1-2' ? 'text-2xl sm:text-4xl' : 'text-2xl sm:text-3xl'
                      }`}
                    >
                      {ayah.textUthmani}{' '}
                      <span className="inline-flex items-center justify-center px-2 text-lg sm:text-xl text-[#B45309] font-sans">
                        ﴿{getArabicDigits(ayah.number)}﴾
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#27345C]/8">
                      <p className="text-xs sm:text-sm font-bold text-[#27345C]/80">
                        {ayah.ageMeaning[bandKey][language]}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {hasPerAyahVerifiedAudio && ayahAudioUrl && (
                          <button
                            type="button"
                            disabled={!childEnabled || dailyLimitReached}
                            onClick={() => void handlePlaySurahOrAyah('listen', ayah.number)}
                            className="min-h-[34px] px-3 rounded-xl bg-[#047857] text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-45"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>{language === 'ar' ? 'اسمع الآية' : 'Play Ayah'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSaveStopBookmark(selectedSurah.id, ayah.number)}
                          className="min-h-[34px] px-2.5 rounded-xl bg-[#FFF8E9] border border-[#B4862C]/25 text-[#78350F] text-[11px] font-extrabold cursor-pointer"
                        >
                          {language === 'ar' ? '🔖 توقفت هنا' : '🔖 Bookmark'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: SHORT SURAHS OVERVIEW (السور القصيرة)
         ===================================================================== */}
      {activeTab === 'surahs' && selectedSurah && (
        <div className="space-y-5">
          <div className="nono-card rounded-3xl p-6 bg-white space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-[#27345C]">
                  {selectedSurah.nameAr} — {selectedSurah.nameEn} ({selectedSurah.englishMeaning})
                </h2>
                <p className="text-sm font-bold text-[#047857] mt-1">
                  💛 {language === 'ar' ? 'القيمة اللطيفة:' : 'Gentle Value:'}{' '}
                  {selectedSurah.gentleValue[language]}
                </p>
              </div>
              {(() => {
                const prog = surahProgressMap.get(selectedSurah.id);
                const status = prog?.status || 'not_started';
                const meta = STATUS_META[status];
                return (
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold ${meta.cls}`}>
                    {meta[language]}
                  </span>
                );
              })()}
            </div>

            <div className="p-4 rounded-2xl bg-[#ECFDF5]/70 border border-[#10B981]/25 space-y-1">
              <p className="text-xs font-extrabold text-[#065F46]">
                {language === 'ar' ? 'شرح مبسّط للأطفال:' : 'Child-Friendly Explanation:'}
              </p>
              <p className="text-sm sm:text-base font-bold text-[#27345C] leading-relaxed">
                {selectedSurah.ageSummary[bandKey][language]}
              </p>
            </div>

            <div className="quran-mushaf-surface rounded-2xl p-5 space-y-3">
              <p className="text-xs font-extrabold text-[#92400E]">
                {language === 'ar'
                  ? 'النص القرآني بالرسم العثماني (محفوظ حرفياً من مصدر موثّق):'
                  : 'Authentic Uthmani Quran Text (Immutable Verified Source):'}
              </p>
              {selectedSurah.hasOpeningBasmalah && (
                <p
                  dir="rtl"
                  lang="ar"
                  translate="no"
                  className="notranslate font-quran-uthmani text-center text-2xl text-[#064E3B]"
                >
                  {QURAN_OPENING_BASMALAH}
                </p>
              )}
              <p
                dir="rtl"
                lang="ar"
                translate="no"
                className="notranslate font-quran-uthmani text-right text-2xl sm:text-3xl text-[#1E293B] leading-[2.4]"
              >
                {selectedSurah.ayahs.map((a) => `${a.textUthmani} ﴿${getArabicDigits(a.number)}﴾ `).join(' ')}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#27345C]/65">
              <span>{selectedSurah.textSource}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('listen')}
                  className="min-h-[44px] px-4 rounded-xl bg-[#047857] text-white font-extrabold cursor-pointer"
                >
                  {language === 'ar' ? 'الذهاب للاستماع' : 'Go to Listen'}
                </button>
                {!listenOnlyMode && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('repeat')}
                    className="min-h-[44px] px-4 rounded-xl bg-[#FFD84D] text-[#27345C] font-extrabold cursor-pointer"
                  >
                    {language === 'ar' ? 'تدرب: استمع وردد' : 'Practice Repeat'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: LISTEN & REPEAT (استمع وردد — بدون مايك أو ذكاء اصطناعي)
         ===================================================================== */}
      {activeTab === 'repeat' && selectedSurah && currentRepeatAyah && (
        <div className="space-y-5">
          {listenOnlyMode ? (
            <div className="nono-card rounded-3xl p-8 text-center space-y-3 bg-white">
              <Headphones className="w-10 h-10 text-[#047857] mx-auto" />
              <h2 className="text-xl font-extrabold text-[#27345C]">
                {language === 'ar'
                  ? 'تم اختيار وضع الاستماع فقط من قِبل ولي الأمر'
                  : 'Listen-Only Mode Enabled by Parent'}
              </h2>
              <p className="text-sm text-[#27345C]/75 max-w-md mx-auto">
                {language === 'ar'
                  ? 'يمكنك الاستماع للسور بهدوء في تبويب «الاستماع للقرآن»، أو تعديل الوضع من إعدادات الأهل.'
                  : 'You can enjoy peaceful listening in the Listen tab, or parents can toggle Listen-Only mode in Parent Controls.'}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('listen')}
                className="nono-btn-tactile min-h-[44px] px-6 rounded-2xl bg-[#047857] text-white font-extrabold text-sm cursor-pointer"
              >
                {language === 'ar' ? 'الانتقال إلى الاستماع' : 'Open Listen Mode'}
              </button>
            </div>
          ) : (
            <div className="nono-card rounded-3xl p-6 sm:p-8 bg-white space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-[#27345C]">
                    {language === 'ar'
                      ? `اسمع وردّد — ${selectedSurah.nameAr}`
                      : `Listen & Repeat — ${selectedSurah.nameEn}`}
                  </h2>
                  <p className="text-xs font-bold text-[#27345C]/70 mt-0.5">
                    {language === 'ar'
                      ? `الآية ${formatNumber(currentRepeatAyah.number, language)} من ${formatNumber(selectedSurah.ayahCount, language)} · عدد مرات التكرار المحددة: ${formatNumber(repeatCount, language)}`
                      : `Ayah ${currentRepeatAyah.number} of ${selectedSurah.ayahCount} · Parent Repeat Setting: ${repeatCount}x`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={repeatAyahIndex <= 0}
                    onClick={() => {
                      audioCtrlRef.current?.stop();
                      setRepeatAyahIndex((i) => Math.max(0, i - 1));
                    }}
                    aria-label="Previous Ayah"
                    className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 font-extrabold text-[#27345C] disabled:opacity-40 cursor-pointer flex items-center justify-center"
                  >
                    {language === 'ar' ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                  </button>
                  <button
                    type="button"
                    disabled={repeatAyahIndex >= selectedSurah.ayahs.length - 1}
                    onClick={() => {
                      audioCtrlRef.current?.stop();
                      setRepeatAyahIndex((i) => Math.min(selectedSurah.ayahs.length - 1, i + 1));
                    }}
                    aria-label="Next Ayah"
                    className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 font-extrabold text-[#27345C] disabled:opacity-40 cursor-pointer flex items-center justify-center"
                  >
                    {language === 'ar' ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Active Ayah Card */}
              <div className="quran-mushaf-surface rounded-3xl p-6 sm:p-8 text-center space-y-4">
                <p
                  dir="rtl"
                  lang="ar"
                  translate="no"
                  className="notranslate font-quran-uthmani text-3xl sm:text-4xl text-[#1E293B]"
                >
                  {currentRepeatAyah.textUthmani}{' '}
                  <span className="text-xl text-[#B45309] font-sans">
                    ﴿{getArabicDigits(currentRepeatAyah.number)}﴾
                  </span>
                </p>
                <p className="text-sm font-bold text-[#065F46]">
                  {currentRepeatAyah.ageMeaning[bandKey][language]}
                </p>

                {playerState.status === 'repeat-window' && (
                  <div className="p-3 rounded-2xl bg-[#ECFDF5] border border-[#10B981]/35 text-[#065F46] text-sm font-extrabold tabular-nums">
                    🌿{' '}
                    {language === 'ar'
                      ? `دورك الآن يا بطل — ردّد الآية بصوتك الهادئ (${formatNumber(playerState.repeatWindowSecondsLeft, language)} ث)`
                      : `Your turn to repeat gently aloud (${playerState.repeatWindowSecondsLeft}s)`}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#27345C]/75">
                    <span>{language === 'ar' ? 'فترة الصمت للترديد:' : 'Pause window:'}</span>
                    {[2, 3, 4, 6].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setRepeatPauseSecs(sec)}
                        className={`min-h-[34px] px-2.5 rounded-xl border font-extrabold cursor-pointer ${
                          repeatPauseSecs === sec
                            ? 'bg-[#047857] text-white border-[#047857]'
                            : 'bg-white text-[#27345C] border-[#27345C]/15'
                        }`}
                      >
                        {formatNumber(sec, language)}s
                      </button>
                    ))}
                  </div>

                  {audioUrlForCurrent ? (
                    <>
                      {playerState.status === 'playing' &&
                      playerState.playbackMode === 'ayah' ? (
                        <button
                          type="button"
                          onClick={() => audioCtrlRef.current?.pause()}
                          className="nono-btn-tactile min-h-[48px] px-6 rounded-2xl bg-[#D97706] text-white font-extrabold text-sm flex items-center gap-2 cursor-pointer"
                        >
                          <Pause className="w-5 h-5" />
                          <span>
                            {language === 'ar'
                              ? `إيقاف مؤقت (${formatNumber(playerState.currentRepeatIndex, language)} / ${formatNumber(playerState.totalRepeats, language)})`
                              : `Pause (${playerState.currentRepeatIndex} / ${playerState.totalRepeats})`}
                          </span>
                        </button>
                      ) : playerState.status === 'paused' &&
                        playerState.playbackMode === 'ayah' ? (
                        <button
                          type="button"
                          onClick={() => audioCtrlRef.current?.resume()}
                          className="nono-btn-tactile min-h-[48px] px-6 rounded-2xl bg-[#047857] text-white font-extrabold text-sm flex items-center gap-2 cursor-pointer"
                        >
                          <Play className="w-5 h-5" />
                          <span>{language === 'ar' ? 'متابعة الترديد' : 'Resume Repeat'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!childEnabled || dailyLimitReached || playerState.status === 'loading'}
                          onClick={() => void handlePlaySurahOrAyah('repeat', currentRepeatAyah.number)}
                          className="nono-btn-tactile min-h-[48px] px-6 rounded-2xl bg-[#047857] text-white font-extrabold text-sm flex items-center gap-2 cursor-pointer disabled:opacity-45"
                        >
                          <RotateCcw className="w-5 h-5" />
                          <span>
                            {playerState.status === 'loading'
                              ? language === 'ar'
                                ? 'جارٍ التحميل...'
                                : 'Loading...'
                              : language === 'ar'
                                ? `شغّل وردد (${formatNumber(repeatCount, language)}×)`
                                : `Play & Repeat (${repeatCount}×)`}
                          </span>
                        </button>
                      )}
                      {(playerState.status === 'playing' ||
                        playerState.status === 'repeat-window' ||
                        playerState.status === 'paused' ||
                        playerState.status === 'loading') && (
                        <button
                          type="button"
                          onClick={() => audioCtrlRef.current?.stop()}
                          className="min-h-[48px] px-4 rounded-2xl bg-slate-100 text-[#27345C] font-extrabold text-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <Square className="w-4 h-4" />
                          <span>{language === 'ar' ? 'إيقاف' : 'Stop'}</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-xs font-bold text-[#92400E] bg-[#FFFBEB] px-3 py-2 rounded-xl border border-[#D97706]/25">
                      {language === 'ar'
                        ? 'اقرأ الآية بصوت هادئ مع طفلك — التلاوة المسجلة بانتظار الاعتماد'
                        : 'Read aloud gently with your child — verified audio recording is pending'}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSaveStopBookmark(selectedSurah.id, currentRepeatAyah.number)}
                    className="min-h-[48px] px-4 rounded-2xl bg-[#FFF8E9] border border-[#B4862C]/30 text-[#78350F] font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🔖 {language === 'ar' ? 'حفظ موضع التوقف' : 'Save Stop Position'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      setCheckedAyahs((prev) =>
                        prev.includes(currentRepeatAyah.number)
                          ? prev.filter((n) => n !== currentRepeatAyah.number)
                          : [...prev, currentRepeatAyah.number],
                      );
                    }}
                    className={`min-h-[48px] px-5 rounded-2xl border-2 font-extrabold text-sm flex items-center gap-2 cursor-pointer ${
                      checkedAyahs.includes(currentRepeatAyah.number)
                        ? 'bg-[#DCFCE7] border-[#10B981] text-[#166534]'
                        : 'bg-white border-[#27345C]/15 text-[#27345C]'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>
                      {checkedAyahs.includes(currentRepeatAyah.number)
                        ? language === 'ar'
                          ? 'تم ترديد هذه الآية ✓'
                          : 'Ayah Practiced ✓'
                        : language === 'ar'
                          ? 'ردّدت هذه الآية!'
                          : 'I Repeated This Ayah!'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-bold text-[#27345C]/70">
                  {language === 'ar'
                    ? 'ملاحظة: لا نسجّل صوت الطفل أو نستخدم التعرف الآلي على الصوت حفاظاً على الخصوصية والدقة.'
                    : 'Privacy & accuracy: we never record child audio or use speech recognition.'}
                </p>
                <button
                  type="button"
                  disabled={savingAction || !childEnabled || dailyLimitReached || !quranSchemaReady}
                  onClick={() =>
                    void postQuranAction(
                      `/api/children/${encodeURIComponent(activeChild.id)}/quran/listen`,
                      {
                        surahId: selectedSurah.id,
                        mode: 'repeat',
                        ayahNumbers:
                          checkedAyahs.length > 0 ? checkedAyahs : [currentRepeatAyah.number],
                        durationSeconds: 30,
                        reciterId: activeReciter?.id,
                      },
                      `أحسنت! تم توثيق جلسة الترديد اللطيفة لسورة ${selectedSurah.nameAr}.`,
                      `Well done! Gentle Listen & Repeat session logged for ${selectedSurah.nameEn}.`,
                    )
                  }
                  className="nono-btn-tactile min-h-[48px] px-6 rounded-2xl bg-[#FFD84D] text-[#27345C] font-extrabold text-sm cursor-pointer disabled:opacity-45"
                >
                  {language === 'ar' ? 'حفظ جلسة الترديد' : 'Save Repeat Practice'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 4: MEMORIZATION JOURNEY (رحلة الحفظ — تأكيد ولي الأمر فقط)
         ===================================================================== */}
      {activeTab === 'memorization' && (
        <div className="space-y-4">
          <div className="nono-card rounded-3xl p-5 bg-[#ECFDF5]/60 border border-[#10B981]/30 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#065F46]">
                {language === 'ar'
                  ? 'رحلة الحفظ والمرافقة الهادئة'
                  : 'Gentle Memorization Journey'}
              </h2>
              <p className="text-xs sm:text-sm font-bold text-[#27345C]/80 mt-0.5">
                {language === 'ar'
                  ? 'الاستماع والترديد يبنِيان الألفة مع السور؛ بينما «تأكيد الحفظ» يتم فقط بيد ولي الأمر في لوحة الأهل.'
                  : 'Listening & repeating build natural familiarity; final “Parent Confirmed” status can only be marked by a Parent.'}
              </p>
            </div>
            {summary && (
              <div className="text-xs sm:text-sm font-extrabold text-[#047857] tabular-nums">
                {language === 'ar'
                  ? `المؤكد من الأهل: ${formatNumber(summary.growthSummary.parentConfirmedCount, language)} / ${formatNumber(orderedAllowedSurahs.length, language)}`
                  : `Parent Confirmed: ${summary.growthSummary.parentConfirmedCount} / ${orderedAllowedSurahs.length}`}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orderedAllowedSurahs.map((surah) => {
              const prog = surahProgressMap.get(surah.id);
              const status: QuranMemorizationStatus = prog?.status || 'not_started';
              const meta = STATUS_META[status];
              return (
                <div
                  key={surah.id}
                  className="nono-card rounded-3xl p-5 bg-white flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-extrabold text-[#047857]">
                          #{formatNumber(surah.number, language)} · {formatNumber(surah.ayahCount, language)}{' '}
                          {language === 'ar' ? 'آيات' : 'ayahs'}
                        </p>
                        <h3 className="text-lg font-extrabold text-[#27345C]">
                          {language === 'ar' ? surah.nameAr : surah.nameEn}
                        </h3>
                      </div>
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold ${meta.cls}`}>
                        {meta[language]}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-[#27345C]/75 space-y-1">
                      <p className="tabular-nums">
                        {language === 'ar'
                          ? `الاستماع: ${formatNumber(prog?.listenCount || 0, language)} · الترديد: ${formatNumber(prog?.repeatSessionsCount || 0, language)}`
                          : `Listens: ${prog?.listenCount || 0} · Repeats: ${prog?.repeatSessionsCount || 0}`}
                      </p>
                      {prog?.parentNote && (
                        <p className="p-2.5 rounded-xl bg-[#FFF8E9] text-[#78350F]">
                          💌 {prog.parentNote}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleSelectSurah(surah.id);
                      setActiveTab('listen');
                    }}
                    className="min-h-[44px] w-full rounded-xl bg-[#FFF8E9] hover:bg-[#ECFDF5] border border-[#047857]/20 text-[#065F46] font-extrabold text-xs sm:text-sm cursor-pointer transition-colors"
                  >
                    {language === 'ar' ? 'افتح السورة للاستماع والترديد' : 'Open Surah to Listen'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 5: QURAN STORIES WORLD (حكايات من القرآن)
         ===================================================================== */}
      {activeTab === 'stories' && (
        <QuranStoriesWorld
          stories={allStories}
          language={language}
          internalBand={band}
          storyProgressDetails={summary?.storyProgressDetails || []}
          legacyStoryCounts={storyProgressMap}
          childEnabled={childEnabled}
          quranSchemaReady={quranSchemaReady}
          savingAction={savingAction}
          onRecordStoryProgress={handleRecordStoryProgress}
        />
      )}

      {/* =====================================================================
          TAB 6: ISLAMIC MANNERS & VALUES (الآداب والقيم الإسلامية)
         ===================================================================== */}
      {activeTab === 'manners' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allManners.map((manner) => {
            const count = mannerProgressMap.get(manner.id) || 0;
            return (
              <div
                key={manner.id}
                className="nono-card rounded-3xl p-5 bg-white flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-4xl" aria-hidden="true">
                      {manner.icon}
                    </span>
                    {count > 0 && (
                      <span className="px-2.5 py-1 rounded-xl bg-[#DCFCE7] text-[#166534] text-xs font-extrabold tabular-nums">
                        {formatNumber(count, language)}×
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-[#27345C]">{manner.title[language]}</h3>
                    <p dir="rtl" className="text-xl font-extrabold text-[#047857] mt-1">
                      {manner.phraseAr}
                    </p>
                    <p className="text-xs font-bold text-[#27345C]/60">{manner.transliteration}</p>
                  </div>

                  <p className="text-xs font-bold text-[#27345C]/80">{manner.whenToUse[language]}</p>

                  <div className="p-3 rounded-2xl bg-[#ECFDF5]/70 border border-[#10B981]/20 text-xs font-bold text-[#065F46]">
                    {manner.agePractice[bandKey][language]}
                  </div>

                  <p className="text-[11px] font-bold text-[#78350F] bg-[#FFF8E9] p-2.5 rounded-xl">
                    👨‍👩‍👧 {manner.togetherPrompt[language]}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={savingAction || !childEnabled || !quranSchemaReady}
                  onClick={() =>
                    void postQuranAction(
                      `/api/children/${encodeURIComponent(activeChild.id)}/quran/manner`,
                      { mannerId: manner.id },
                      `رائع! تم تسجيل تطبيق أدب «${manner.title.ar}» اليوم.`,
                      `MashaAllah! Practiced manner “${manner.title.en}” today.`,
                    )
                  }
                  className="nono-btn-tactile min-h-[46px] w-full rounded-2xl bg-[#FFD84D] text-[#27345C] font-extrabold text-sm cursor-pointer disabled:opacity-45"
                >
                  {language === 'ar' ? 'طبّقتُ هذا الأدب اليوم ★' : 'I Practiced This Manner ★'}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {/* Accessible Quran Foundation & Reciter Attribution Footer */}
      <footer className="rounded-2xl bg-white/85 border border-[#047857]/20 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#27345C]/80">
        <span>
          {catalog?.attributionNotice || 'Quran data provided by Quran.Foundation.'}{' '}
          · {displayedReciter.name[language]}
        </span>
        <span className="text-[11px] text-[#047857]">
          {language === 'ar'
            ? 'النص العثماني محفوظ حرفياً من مصحف المدينة المنورة'
            : 'Immutable Uthmani Mushaf text'}
        </span>
      </footer>
    </div>
  );
};
