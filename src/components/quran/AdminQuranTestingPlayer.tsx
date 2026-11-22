import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Headphones,
  Lock,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { QURAN_OPENING_BASMALAH, QURAN_SURAHS } from '../../data/quranCatalog';
import {
  QuranAudioController,
  type QuranPlayerState,
  buildSurahRecitationSequence,
  formatAudioTime,
  resolveControlledTestingAudioUrl,
} from '../../utils/quranAudioPlayer';
import type { QuranPhraseAudioAssetConfig } from '../../types/nonoland';

interface TestingAudioEndpointResponse {
  ok: boolean;
  configured: boolean;
  testingMode: 'ADMIN_INTERNAL_TESTING_ONLY';
  releasedToFamilies: false;
  verificationStatus: 'pending_verification';
  autoApproved: false;
  autoPublished: false;
  displayedAttribution?: string;
  surahAudioUrls?: Record<string, string>;
  ayahAudioUrls?: Record<string, string>;
  basmalaIncludedBySurah?: Record<string, boolean>;
  testingBasmalaUrl?: string | null;
  testingBasmalaSource?: 'admin_configured' | 'qf_1_1_candidate' | 'none';
  testingClosingUrl?: string | null;
  phraseAssets?: {
    basmala: QuranPhraseAudioAssetConfig;
    closing: QuranPhraseAudioAssetConfig;
  };
  surahCount?: number;
  ayahCount?: number;
  totalResources?: number;
  fetchedAt?: string | null;
  fromCache?: boolean;
  error?: string;
}

interface Props {
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  previewSurahAudioUrls?: Record<string, string>;
  previewAyahAudioUrls?: Record<string, string>;
  previewBasmalaIncludedBySurah?: Record<string, boolean>;
  phraseAssets?: {
    basmala: QuranPhraseAudioAssetConfig;
    closing: QuranPhraseAudioAssetConfig;
  };
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}

const TOTAL_CURATED_AYAHS = QURAN_SURAHS.reduce((sum, s) => sum + s.ayahCount, 0);

function getArabicDigits(n: number): string {
  return new Intl.NumberFormat('ar-EG', { useGrouping: false }).format(n);
}

export const AdminQuranTestingPlayer: React.FC<Props> = ({
  apiFetch,
  previewSurahAudioUrls,
  previewAyahAudioUrls,
  previewBasmalaIncludedBySurah,
  phraseAssets: propPhraseAssets,
  onNotice,
  onError,
}) => {
  const { language } = useNonoLand();
  const [surahAudioUrls, setSurahAudioUrls] = useState<Record<string, string>>({});
  const [ayahAudioUrls, setAyahAudioUrls] = useState<Record<string, string>>({});
  const [basmalaIncludedBySurah, setBasmalaIncludedBySurah] = useState<Record<string, boolean>>({});
  const [loadedPhraseAssets, setLoadedPhraseAssets] = useState<{
    basmala: QuranPhraseAudioAssetConfig;
    closing: QuranPhraseAudioAssetConfig;
  } | null>(null);
  const [testingBasmalaUrl, setTestingBasmalaUrl] = useState<string | null>(null);
  const [testingClosingUrl, setTestingClosingUrl] = useState<string | null>(null);
  const [urlsLoading, setUrlsLoading] = useState(false);
  const [urlsError, setUrlsError] = useState('');
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [sequenceNotice, setSequenceNotice] = useState<string>('');

  const [selectedSurahId, setSelectedSurahId] = useState<string>(QURAN_SURAHS[0]?.id || 'surah-1');
  const [selectedAyahNum, setSelectedAyahNum] = useState<number>(1);
  const [repeatCount, setRepeatCount] = useState<number>(1);
  const [lastPlayTarget, setLastPlayTarget] = useState<{ mode: 'surah' | 'ayah'; ayahNumber?: number }>({
    mode: 'ayah',
    ayahNumber: 1,
  });

  const [playerState, setPlayerState] = useState<QuranPlayerState>({
    status: 'idle',
    playbackMode: null,
    surahId: null,
    ayahNumber: null,
    currentRepeatIndex: 1,
    totalRepeats: 1,
    repeatWindowSecondsLeft: 0,
    currentTimeSeconds: 0,
    durationSeconds: 0,
    activeUrl: null,
    sequencePhase: null,
  });

  const audioCtrlRef = useRef<QuranAudioController | null>(null);

  useEffect(() => {
    const ctrl = new QuranAudioController((next) => setPlayerState(next));
    audioCtrlRef.current = ctrl;
    return () => {
      ctrl.dispose();
    };
  }, []);

  // Adopt server-returned URLs from Preview Quran Foundation if available (never autoplays audio)
  useEffect(() => {
    const sKeys = previewSurahAudioUrls ? Object.keys(previewSurahAudioUrls).length : 0;
    const aKeys = previewAyahAudioUrls ? Object.keys(previewAyahAudioUrls).length : 0;
    if (sKeys > 0 || aKeys > 0) {
      setSurahAudioUrls(previewSurahAudioUrls || {});
      setAyahAudioUrls(previewAyahAudioUrls || {});
      if (previewBasmalaIncludedBySurah) {
        setBasmalaIncludedBySurah(previewBasmalaIncludedBySurah);
      }
      setUrlsError('');
      setFetchedAt(new Date().toISOString());
    }
  }, [previewSurahAudioUrls, previewAyahAudioUrls, previewBasmalaIncludedBySurah]);

  const effectivePhraseAssets = propPhraseAssets || loadedPhraseAssets;
  const resolvedBasmalaTestUrl =
    effectivePhraseAssets?.basmala.audioUrl || testingBasmalaUrl || ayahAudioUrls['1:1'] || null;
  const resolvedClosingTestUrl =
    effectivePhraseAssets?.closing.audioUrl || testingClosingUrl || null;

  const loadTestingAudioUrls = async (forceRefresh = false) => {
    setUrlsLoading(true);
    setUrlsError('');
    onError('');
    try {
      const url = forceRefresh
        ? '/api/admin/quran/internal-testing-audio?refresh=1'
        : '/api/admin/quran/internal-testing-audio';
      const res = await apiFetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (/text\/html/i.test(contentType)) {
        const msg = 'Server is still starting up (HTML returned). Wait a moment and retry.';
        setUrlsError(msg);
        onError(msg);
        return;
      }
      const data = (await res.json()) as TestingAudioEndpointResponse;
      if (!res.ok || !data.ok) {
        const msg = data.error || 'Failed to load Quran Foundation testing audio URLs from server.';
        setUrlsError(msg);
        onError(msg);
        return;
      }
      const nextSurahs = data.surahAudioUrls || {};
      const nextAyahs = data.ayahAudioUrls || {};
      setSurahAudioUrls(nextSurahs);
      setAyahAudioUrls(nextAyahs);
      setBasmalaIncludedBySurah(data.basmalaIncludedBySurah || {});
      if (data.phraseAssets) setLoadedPhraseAssets(data.phraseAssets);
      setTestingBasmalaUrl(data.testingBasmalaUrl || null);
      setTestingClosingUrl(data.testingClosingUrl || null);
      setFetchedAt(data.fetchedAt || new Date().toISOString());
      onNotice(
        language === 'ar'
          ? `تم تحميل ${Object.keys(nextSurahs).length} سورة و${Object.keys(nextAyahs).length} آية للاختبار الداخلي فقط (بدون تشغيل تلقائي).`
          : `Loaded ${Object.keys(nextSurahs).length} Surahs & ${Object.keys(nextAyahs).length} Ayahs for Controlled Admin Testing (user-initiated playback only).`,
      );
    } catch {
      const msg = language === 'ar' ? 'تعذّر الاتصال بالخادم لجلب روابط التلاوة.' : 'Network error loading Quran Foundation audio URLs.';
      setUrlsError(msg);
      onError(msg);
    } finally {
      setUrlsLoading(false);
    }
  };

  const selectedSurah = useMemo(
    () => QURAN_SURAHS.find((s) => s.id === selectedSurahId) || QURAN_SURAHS[0],
    [selectedSurahId],
  );

  const selectedAyah = useMemo(
    () => selectedSurah.ayahs.find((a) => a.number === selectedAyahNum) || selectedSurah.ayahs[0],
    [selectedSurah, selectedAyahNum],
  );

  const surahUrlCount = Object.keys(surahAudioUrls).length;
  const ayahUrlCount = Object.keys(ayahAudioUrls).length;
  const totalUrlsLoaded = surahUrlCount + ayahUrlCount;

  const selectedSurahAudioUrl = resolveControlledTestingAudioUrl(
    surahAudioUrls,
    ayahAudioUrls,
    selectedSurah.id,
  );
  const selectedAyahAudioUrl = resolveControlledTestingAudioUrl(
    surahAudioUrls,
    ayahAudioUrls,
    selectedSurah.id,
    selectedAyah.number,
  );

  const selectedSurahIndex = QURAN_SURAHS.findIndex((s) => s.id === selectedSurah.id);

  const activeSequencePlan = useMemo(
    () =>
      buildSurahRecitationSequence({
        surah: selectedSurah,
        surahAudioUrl: selectedSurahAudioUrl,
        basmalaAudioUrl: resolvedBasmalaTestUrl,
        closingPhraseAudioUrl: resolvedClosingTestUrl,
        basmalaAlreadyIncludedInRecording: basmalaIncludedBySurah[selectedSurah.id],
        requireApprovedBasmala: false,
      }),
    [
      selectedSurah,
      selectedSurahAudioUrl,
      resolvedBasmalaTestUrl,
      resolvedClosingTestUrl,
      basmalaIncludedBySurah,
    ],
  );

  const playingSurah =
    (playerState.surahId && QURAN_SURAHS.find((s) => s.id === playerState.surahId)) || null;
  const playingAyah =
    playingSurah && playerState.ayahNumber !== null
      ? playingSurah.ayahs.find((a) => a.number === playerState.ayahNumber) || null
      : null;

  const currentTime = playerState.currentTimeSeconds ?? 0;
  const duration = playerState.durationSeconds ?? 0;
  const remainingTime = duration > 0 ? Math.max(0, duration - currentTime) : 0;
  const isPlayingOrPausedOrLoading =
    playerState.status === 'playing' ||
    playerState.status === 'paused' ||
    playerState.status === 'loading' ||
    playerState.status === 'repeat-window';

  const startSurahPlayback = async (surahId = selectedSurah.id, repeats = 1) => {
    const ctrl = audioCtrlRef.current;
    if (!ctrl) return;
    const targetSurah = QURAN_SURAHS.find((s) => s.id === surahId) || selectedSurah;
    const url = resolveControlledTestingAudioUrl(surahAudioUrls, ayahAudioUrls, surahId);
    const plan = buildSurahRecitationSequence({
      surah: targetSurah,
      surahAudioUrl: url,
      basmalaAudioUrl: resolvedBasmalaTestUrl,
      closingPhraseAudioUrl: resolvedClosingTestUrl,
      basmalaAlreadyIncludedInRecording: basmalaIncludedBySurah[surahId],
      requireApprovedBasmala: false,
    });
    setSequenceNotice('');
    setLastPlayTarget({ mode: 'surah' });
    await ctrl.playSurahSequence({
      surahId,
      steps: plan.steps,
      repeatCount: repeats,
      repeatPauseSeconds: repeats > 1 ? 1 : 0,
      onSequenceCompleted: () => {
        setSequenceNotice(
          language === 'ar'
            ? plan.willPlayClosing
              ? `اكتمل تسلسل تلاوة ${targetSurah.nameAr} بالكامل بعد انتهاء عبارة «صَدَقَ اللَّهُ الْعَظِيمُ».`
              : `اكتملت تلاوة ${targetSurah.nameAr} (بدون عبارة الختام لعدم اعتماد ملفها بعد).`
            : plan.willPlayClosing
              ? `Completed full sequence for ${targetSurah.nameEn} after closing phrase finished.`
              : `Completed ${targetSurah.nameEn} recitation (closing phrase disabled until an approved asset is configured).`,
        );
      },
    });
  };

  const startAyahPlayback = async (
    surahId = selectedSurah.id,
    ayahNum = selectedAyah.number,
    repeats = repeatCount,
  ) => {
    const ctrl = audioCtrlRef.current;
    if (!ctrl) return;
    setSequenceNotice('');
    const url = resolveControlledTestingAudioUrl(surahAudioUrls, ayahAudioUrls, surahId, ayahNum);
    setLastPlayTarget({ mode: 'ayah', ayahNumber: ayahNum });
    await ctrl.playControlledTestingUrl({
      url,
      mode: 'ayah',
      surahId,
      ayahNumber: ayahNum,
      repeatCount: repeats,
      repeatPauseSeconds: repeats > 1 ? 1 : 0,
    });
  };

  const handleSelectSurah = (surahId: string) => {
    audioCtrlRef.current?.stop();
    setSequenceNotice('');
    setSelectedSurahId(surahId);
    setSelectedAyahNum(1);
    setLastPlayTarget({ mode: 'surah' });
  };

  const handlePrevSurah = () => {
    if (selectedSurahIndex <= 0) return;
    const prevSurah = QURAN_SURAHS[selectedSurahIndex - 1];
    handleSelectSurah(prevSurah.id);
  };

  const handleNextSurah = () => {
    if (selectedSurahIndex < 0 || selectedSurahIndex >= QURAN_SURAHS.length - 1) return;
    const nextSurah = QURAN_SURAHS[selectedSurahIndex + 1];
    handleSelectSurah(nextSurah.id);
  };

  const handlePrevAyah = () => {
    if (selectedAyahNum <= 1) return;
    const prevNum = selectedAyahNum - 1;
    setSelectedAyahNum(prevNum);
    if (totalUrlsLoaded > 0) {
      void startAyahPlayback(selectedSurah.id, prevNum, repeatCount);
    } else {
      audioCtrlRef.current?.stop();
    }
  };

  const handleNextAyah = () => {
    if (selectedAyahNum >= selectedSurah.ayahCount) return;
    const nextNum = selectedAyahNum + 1;
    setSelectedAyahNum(nextNum);
    if (totalUrlsLoaded > 0) {
      void startAyahPlayback(selectedSurah.id, nextNum, repeatCount);
    } else {
      audioCtrlRef.current?.stop();
    }
  };

  const handleReplayCurrent = () => {
    const activeSurahId = playerState.surahId || selectedSurah.id;
    const targetMode = playerState.playbackMode === 'surah' || lastPlayTarget.mode === 'surah' ? 'surah' : 'ayah';
    if (targetMode === 'surah') {
      void startSurahPlayback(activeSurahId, 1);
    } else {
      const targetAyah = playerState.ayahNumber ?? lastPlayTarget.ayahNumber ?? selectedAyah.number;
      void startAyahPlayback(activeSurahId, targetAyah, 1);
    }
  };

  const handleRepeatCurrentAyah = () => {
    const targetRepeat = Math.max(2, repeatCount);
    setRepeatCount(targetRepeat);
    void startAyahPlayback(selectedSurah.id, selectedAyah.number, targetRepeat);
  };

  return (
    <div className="nono-card rounded-3xl p-5 bg-white border-2 border-[#047857]/25 space-y-4 text-xs">
      {/* EXPLICIT RELEASE RESTRICTION BANNER */}
      <div className="p-3.5 rounded-2xl bg-[#FFFBEB] border border-[#D97706]/40 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[#92400E] font-extrabold text-xs sm:text-sm">
            <Lock className="w-4 h-4 shrink-0 text-[#D97706]" />
            <span>
              {language === 'ar'
                ? 'وضع الاختبار الداخلي للإدارة فقط — غير متاح للأطفال أو العائلات بعد'
                : 'ADMIN / INTERNAL TESTING MODE ONLY — NOT EXPOSED TO CHILDREN OR FAMILIES'}
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-lg bg-[#FEF3C7] text-[#92400E] font-mono-num text-[11px] font-extrabold" dir="ltr">
            verificationStatus=pending_verification · autoApproved=false · autoPublished=false
          </span>
        </div>
        <p className="text-[#92400E]/90 font-bold">
          {language === 'ar'
            ? 'هذا المشغّل مخصّص لاختبار المشرفين فقط باستخدام روابط Quran Foundation الخادمة (بدون حفظ حالة اعتماد أو نشر عام). النشر العام ما زال يتطلب إتمام التحقق من مصدر القارئ والتسجيلات وتأكيدات المشرف واعتماد البسملة.'
            : 'Internal admin testing playback using server-fetched Quran Foundation URLs. Public release remains locked until Reciter & Recitation Source Verification, administrator compliance confirmations, and Basmala asset approval are explicitly completed.'}
        </p>
      </div>

      {/* HEADER, ATTRIBUTION & SERVER URL LOADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-[#27345C] flex items-center gap-2">
            <Headphones className="w-5 h-5 text-[#047857]" />
            <span>
              {language === 'ar'
                ? 'مشغّل التلاوة القرآنية — وضع الاختبار المتحكّم به'
                : 'Quran World Audio Player — Controlled Testing Mode'}
            </span>
          </h3>
          <p className="text-xs font-extrabold text-[#047857] mt-0.5" dir="ltr">
            Quran data provided by Quran.Foundation. · Reciter ID 6 · Sheikh Mahmoud Khalil Al-Husary – Hafs 'an Asim – Murattal
          </p>
          <p className="text-[11px] text-[#27345C]/65 font-bold mt-0.5">
            {language === 'ar'
              ? `النطاق المعتمد للاختبار: ${QURAN_SURAHS.length} سور · ${TOTAL_CURATED_AYAHS} آية · التشغيل يتم بطلب المستخدم فقط (بدون تشغيل تلقائي)`
              : `Testing Scope: ${QURAN_SURAHS.length} curated Surahs · ${TOTAL_CURATED_AYAHS} Ayahs · User-initiated playback only (autoplay disabled)`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-xl font-mono-num font-extrabold ${
              totalUrlsLoaded > 0 ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-slate-100 text-[#27345C]/75'
            }`}
            dir="ltr"
          >
            URLs: {surahUrlCount}/9 Surahs · {ayahUrlCount}/40 Ayahs
          </span>
          <button
            type="button"
            disabled={urlsLoading}
            onClick={() => void loadTestingAudioUrls(totalUrlsLoaded > 0)}
            className="min-h-[38px] px-3.5 rounded-xl bg-[#047857] text-white font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${urlsLoading ? 'animate-spin' : ''}`} />
            <span>
              {totalUrlsLoaded > 0
                ? language === 'ar'
                  ? 'تحديث الروابط من الخادم'
                  : 'Refresh Server Audio URLs'
                : language === 'ar'
                  ? 'جلب روابط التلاوة للاختبار'
                  : 'Load Server Audio URLs'}
            </span>
          </button>
        </div>
      </div>

      {urlsError && (
        <div className="p-3 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{urlsError}</span>
        </div>
      )}

      {totalUrlsLoaded === 0 && !urlsLoading && (
        <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#27345C]/12 text-[#27345C]/80 font-bold flex flex-wrap items-center justify-between gap-2">
          <span>
            {language === 'ar'
              ? 'اضغط على "جلب روابط التلاوة للاختبار" (أو "معاينة Quran Foundation" أعلاه) لتحميل روابط الـ 9 سور والـ 40 آية من الخادم.'
              : 'Click "Load Server Audio URLs" (or run "Preview Quran Foundation" above) to fetch the 9 Surah and 40 Ayah HTTPS URLs from the backend.'}
          </span>
        </div>
      )}

      {/* 9 CURATED SURAHS SELECTOR */}
      <div className="space-y-1.5">
        <p className="font-extrabold text-[#27345C]/75">
          {language === 'ar' ? 'السور التسع المختارة (40 آية):' : 'Curated Surahs (9 Surahs · 40 Ayahs):'}
        </p>
        <div className="flex flex-wrap gap-2">
          {QURAN_SURAHS.map((surah) => {
            const active = selectedSurah.id === surah.id;
            const hasSurahUrl = Boolean(surahAudioUrls[surah.id]);
            return (
              <button
                key={surah.id}
                type="button"
                onClick={() => handleSelectSurah(surah.id)}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl border-2 font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#064E3B] text-white border-[#064E3B]'
                    : 'bg-[#FFFDF7] text-[#27345C] border-[#B4862C]/25 hover:border-[#047857]'
                }`}
              >
                <span className="tabular-nums opacity-75">{surah.number}.</span>
                <span>{language === 'ar' ? surah.nameAr : surah.nameEn}</span>
                <span className="text-[10px] opacity-80">({surah.ayahCount})</span>
                {totalUrlsLoaded > 0 && !hasSurahUrl && <VolumeX className="w-3.5 h-3.5 text-[#DC2626]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTROLLED PLAYER CONSOLE */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#F8FAFC] to-[#ECFDF5]/60 border border-[#047857]/25 space-y-4">
        {/* Clear Indication of Currently Playing / Selected Surah & Ayah */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-lg bg-[#064E3B] text-white text-[10px] font-extrabold">
                {playingSurah && isPlayingOrPausedOrLoading
                  ? language === 'ar'
                    ? 'قيد التشغيل الآن'
                    : 'NOW PLAYING'
                  : language === 'ar'
                    ? 'السورة والآية المحددة'
                    : 'SELECTED TARGET'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono-num font-extrabold ${
                  playerState.status === 'playing'
                    ? 'bg-[#DCFCE7] text-[#166534]'
                    : playerState.status === 'paused'
                      ? 'bg-[#FEF3C7] text-[#92400E]'
                      : playerState.status === 'loading' || playerState.status === 'repeat-window'
                        ? 'bg-[#E0F2FE] text-[#0369A1]'
                        : playerState.status === 'error' || playerState.status === 'unavailable'
                          ? 'bg-[#FEE2E2] text-[#991B1B]'
                          : 'bg-slate-200 text-[#27345C]'
                }`}
                dir="ltr"
              >
                {playerState.status}
                {playerState.totalRepeats > 1
                  ? ` · repeat ${playerState.currentRepeatIndex}/${playerState.totalRepeats}`
                  : ''}
              </span>
            </div>

            <h4 className="text-base sm:text-lg font-extrabold text-[#27345C]">
              {(playingSurah && isPlayingOrPausedOrLoading ? playingSurah : selectedSurah).number}.{' '}
              {(playingSurah && isPlayingOrPausedOrLoading ? playingSurah : selectedSurah).nameAr} ·{' '}
              {(playingSurah && isPlayingOrPausedOrLoading ? playingSurah : selectedSurah).nameEn}
            </h4>

            <p className="font-bold text-[#047857]">
              {playerState.playbackMode === 'surah' && isPlayingOrPausedOrLoading
                ? language === 'ar'
                  ? `وضع التشغيل: السورة كاملة (${(playingSurah || selectedSurah).ayahCount} آيات)${
                      playerState.sequenceTotalSteps
                        ? ` · الخطوة ${playerState.sequenceStepIndex || 1}/${playerState.sequenceTotalSteps}: ${
                            playerState.sequencePhase === 'basmala'
                              ? 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'
                              : playerState.sequencePhase === 'closing'
                                ? 'صَدَقَ اللَّهُ الْعَظِيمُ (خاتمة غير قرآنية)'
                                : 'تلاوة السورة (Quran Foundation)'
                          }`
                        : ''
                    }`
                  : `Mode: Full Surah Sequence (${(playingSurah || selectedSurah).ayahCount} Ayahs)${
                      playerState.sequenceTotalSteps
                        ? ` · Step ${playerState.sequenceStepIndex || 1}/${playerState.sequenceTotalSteps}: ${
                            playerState.sequencePhase === 'basmala'
                              ? 'Opening Basmala'
                              : playerState.sequencePhase === 'closing'
                                ? 'Closing Phrase (Sadaq Allah Al-Azeem)'
                                : 'Surah Recitation (Quran Foundation)'
                          }`
                        : ''
                    }`
                : language === 'ar'
                  ? `الآية: ${selectedAyah.number} من ${selectedSurah.ayahCount} (${selectedAyah.verseKey})`
                  : `Ayah: ${playingAyah && isPlayingOrPausedOrLoading ? playingAyah.number : selectedAyah.number} of ${
                      (playingSurah && isPlayingOrPausedOrLoading ? playingSurah : selectedSurah).ayahCount
                    } (${(playingAyah && isPlayingOrPausedOrLoading ? playingAyah : selectedAyah).verseKey})`}
            </p>

            {/* Opening & Closing Sequence Inspection Badges */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-extrabold">
              <span
                className={`px-2 py-0.5 rounded-lg ${
                  activeSequencePlan.basmalaAlreadyIncluded
                    ? 'bg-[#E0F2FE] text-[#0369A1]'
                    : resolvedBasmalaTestUrl
                      ? 'bg-[#DCFCE7] text-[#166534]'
                      : 'bg-[#FEF3C7] text-[#92400E]'
                }`}
              >
                {activeSequencePlan.basmalaAlreadyIncluded
                  ? language === 'ar'
                    ? 'البسملة: مدمجة أصلاً في تلاوة السورة (لن تتكرر ✓)'
                    : 'Basmala: Already included in recording (1:1 · no duplicate ✓)'
                  : resolvedBasmalaTestUrl
                    ? language === 'ar'
                      ? `البسملة قبل السورة: ستُشغّل أولاً (${effectivePhraseAssets?.basmala.status || 'qf_candidate'})`
                      : `Pre-Surah Basmala: Will play first (${effectivePhraseAssets?.basmala.status || 'qf_1_1_candidate'})`
                    : language === 'ar'
                      ? 'البسملة قبل السورة: بانتظار رابط معتمد'
                      : 'Pre-Surah Basmala: Disabled (no URL loaded)'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-lg ${
                  resolvedClosingTestUrl
                    ? effectivePhraseAssets?.closing.status === 'approved'
                      ? 'bg-[#DCFCE7] text-[#166534]'
                      : 'bg-[#FEF3C7] text-[#92400E]'
                    : 'bg-slate-200 text-[#27345C]/80'
                }`}
              >
                {resolvedClosingTestUrl
                  ? language === 'ar'
                    ? `عبارة الختام «صَدَقَ اللَّهُ الْعَظِيمُ»: ستُشغّل بعد السورة (${effectivePhraseAssets?.closing.status || 'configured'})`
                    : `Closing «Sadaq Allah Al-Azeem»: Plays after Surah (${effectivePhraseAssets?.closing.status || 'configured'})`
                  : language === 'ar'
                    ? 'عبارة الختام «صَدَقَ اللَّهُ الْعَظِيمُ»: معطّلة (لا يوجد تسجيل مرخّص بعد — غير مصنّعة)'
                    : 'Closing «Sadaq Allah Al-Azeem»: Disabled (not configured · never fabricated)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5" dir="ltr">
            <span className="font-bold text-[#27345C]/75">Ayah Repeat:</span>
            {[1, 2, 3].map((cnt) => (
              <button
                key={cnt}
                type="button"
                onClick={() => setRepeatCount(cnt)}
                className={`px-2.5 py-1 rounded-lg font-extrabold cursor-pointer ${
                  repeatCount === cnt
                    ? 'bg-[#27345C] text-white'
                    : 'bg-white border border-[#27345C]/15 text-[#27345C]'
                }`}
              >
                {cnt}x
              </button>
            ))}
          </div>
        </div>

        {/* Highlighted Active Ayah Text Preview */}
        <div className="p-3.5 rounded-2xl bg-[#FFFDF7] border border-[#B4862C]/25">
          <p
            dir="rtl"
            lang="ar"
            translate="no"
            className="notranslate font-quran-uthmani text-right text-xl sm:text-2xl leading-[2.2] text-[#1E293B]"
          >
            {(playingAyah && isPlayingOrPausedOrLoading ? playingAyah : selectedAyah).textUthmani}{' '}
            <span className="text-base text-[#B45309] font-sans">
              ﴿{getArabicDigits((playingAyah && isPlayingOrPausedOrLoading ? playingAyah : selectedAyah).number)}﴾
            </span>
          </p>
        </div>

        {/* PROGRESS BAR & ELAPSED / REMAINING TIME */}
        <div className="space-y-1.5" dir="ltr">
          <input
            type="range"
            aria-label="Audio playback position"
            min={0}
            max={duration > 0 ? duration : 100}
            step={0.25}
            value={duration > 0 ? Math.min(currentTime, duration) : 0}
            disabled={duration <= 0 || (!isPlayingOrPausedOrLoading && playerState.status !== 'completed')}
            onChange={(e) => audioCtrlRef.current?.seek(Number(e.target.value))}
            className="w-full accent-[#047857] cursor-pointer disabled:opacity-50"
          />
          <div className="flex items-center justify-between text-[11px] font-mono-num font-bold text-[#27345C]/75">
            <span>Elapsed: {formatAudioTime(currentTime)}</span>
            <span>
              Remaining: {duration > 0 ? `-${formatAudioTime(remainingTime)}` : '0:00'} / Total:{' '}
              {formatAudioTime(duration)}
            </span>
          </div>
        </div>

        {/* TRANSPORT CONTROLS (USER-INITIATED ONLY) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Play Full Surah */}
          <button
            type="button"
            disabled={!selectedSurahAudioUrl || urlsLoading}
            onClick={() => void startSurahPlayback(selectedSurah.id, 1)}
            className="min-h-[40px] px-3.5 rounded-xl bg-[#047857] text-white font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
          >
            <Volume2 className="w-4 h-4" />
            <span>{language === 'ar' ? 'تشغيل السورة كاملة' : 'Play Full Surah'}</span>
          </button>

          {/* Play / Pause / Resume Toggle for Current Selection */}
          {playerState.status === 'loading' ? (
            <button
              type="button"
              disabled
              className="min-h-[40px] px-3.5 rounded-xl bg-[#0369A1] text-white font-extrabold flex items-center gap-1.5 opacity-90"
            >
              <Clock className="w-4 h-4 animate-spin" />
              <span>{language === 'ar' ? 'جارٍ التحميل...' : 'Loading audio...'}</span>
            </button>
          ) : playerState.status === 'playing' ? (
            <button
              type="button"
              onClick={() => audioCtrlRef.current?.pause()}
              className="min-h-[40px] px-3.5 rounded-xl bg-[#D97706] text-white font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Pause className="w-4 h-4" />
              <span>{language === 'ar' ? 'إيقاف مؤقت' : 'Pause'}</span>
            </button>
          ) : playerState.status === 'paused' ? (
            <button
              type="button"
              onClick={() => audioCtrlRef.current?.resume()}
              className="min-h-[40px] px-3.5 rounded-xl bg-[#047857] text-white font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>{language === 'ar' ? 'استكمال من الموضع الحالي' : 'Resume'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!selectedAyahAudioUrl || urlsLoading}
              onClick={() => void startAyahPlayback(selectedSurah.id, selectedAyah.number, repeatCount)}
              className="min-h-[40px] px-3.5 rounded-xl bg-[#27345C] text-white font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
            >
              <Play className="w-4 h-4" />
              <span>{language === 'ar' ? 'تشغيل الآية المحددة' : 'Play Selected Ayah'}</span>
            </button>
          )}

          {/* Previous / Next Ayah */}
          <button
            type="button"
            disabled={selectedAyahNum <= 1}
            onClick={handlePrevAyah}
            className="min-h-[40px] px-3 rounded-xl bg-white border border-[#27345C]/15 text-[#27345C] font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{language === 'ar' ? 'الآية السابقة' : 'Prev Ayah'}</span>
          </button>
          <button
            type="button"
            disabled={selectedAyahNum >= selectedSurah.ayahCount}
            onClick={handleNextAyah}
            className="min-h-[40px] px-3 rounded-xl bg-white border border-[#27345C]/15 text-[#27345C] font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <span>{language === 'ar' ? 'الآية التالية' : 'Next Ayah'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Replay Current Surah / Ayah */}
          <button
            type="button"
            disabled={
              totalUrlsLoaded === 0 ||
              (lastPlayTarget.mode === 'surah' ? !selectedSurahAudioUrl : !selectedAyahAudioUrl)
            }
            onClick={handleReplayCurrent}
            className="min-h-[40px] px-3 rounded-xl bg-white border border-[#27345C]/15 text-[#27345C] font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <RotateCcw className="w-4 h-4" />
            <span>
              {lastPlayTarget.mode === 'surah' || playerState.playbackMode === 'surah'
                ? language === 'ar'
                  ? 'إعادة السورة'
                  : 'Replay Surah'
                : language === 'ar'
                  ? 'إعادة الآية'
                  : 'Replay Ayah'}
            </span>
          </button>

          {/* Repeat Current Ayah */}
          <button
            type="button"
            disabled={!selectedAyahAudioUrl || urlsLoading}
            onClick={handleRepeatCurrentAyah}
            className="min-h-[40px] px-3 rounded-xl bg-[#8054D9] text-white font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
          >
            <Repeat className="w-4 h-4" />
            <span>{language === 'ar' ? `تكرار الآية (${Math.max(2, repeatCount)}x)` : `Repeat Ayah (${Math.max(2, repeatCount)}x)`}</span>
          </button>

          {/* Previous / Next Surah */}
          <button
            type="button"
            disabled={selectedSurahIndex <= 0}
            onClick={handlePrevSurah}
            className="min-h-[40px] px-3 rounded-xl bg-white border border-[#047857]/25 text-[#047857] font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{language === 'ar' ? 'السورة السابقة' : 'Prev Surah'}</span>
          </button>
          <button
            type="button"
            disabled={selectedSurahIndex < 0 || selectedSurahIndex >= QURAN_SURAHS.length - 1}
            onClick={handleNextSurah}
            className="min-h-[40px] px-3 rounded-xl bg-white border border-[#047857]/25 text-[#047857] font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <span>{language === 'ar' ? 'السورة التالية' : 'Next Surah'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Stop */}
          {isPlayingOrPausedOrLoading && (
            <button
              type="button"
              onClick={() => audioCtrlRef.current?.stop()}
              className="min-h-[40px] px-3 rounded-xl bg-slate-200 text-[#27345C] font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Square className="w-4 h-4" />
              <span>{language === 'ar' ? 'إيقاف' : 'Stop'}</span>
            </button>
          )}
        </div>

        {sequenceNotice && (
          <div className="p-2.5 rounded-xl bg-[#ECFDF5] border border-[#10B981]/35 text-[#065F46] font-extrabold">
            {sequenceNotice}
          </div>
        )}

        {/* AUDIO ERROR STATE WITH RETRY */}
        {(playerState.status === 'error' || playerState.status === 'unavailable') && playerState.errorMessage && (
          <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] font-bold flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                [{playerState.errorCode || 'ERROR'}] {playerState.errorMessage}
              </span>
            </div>
            {(selectedAyahAudioUrl || selectedSurahAudioUrl) && (
              <button
                type="button"
                onClick={handleReplayCurrent}
                className="px-3 py-1 rounded-lg bg-[#991B1B] text-white font-extrabold cursor-pointer"
              >
                {language === 'ar' ? 'إعادة المحاولة' : 'Retry Audio'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ALL AYAHS LIST FOR SELECTED SURAH */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-extrabold text-[#27345C]">
            {language === 'ar'
              ? `آيات ${selectedSurah.nameAr} (${selectedSurah.ayahCount} آيات)`
              : `${selectedSurah.nameEn} Ayahs (${selectedSurah.ayahCount} Ayahs)`}
          </p>
          {fetchedAt && (
            <span className="text-[11px] text-[#27345C]/60 font-mono-num" dir="ltr">
              Loaded: {new Date(fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {selectedSurah.hasOpeningBasmalah && (
          <p
            dir="rtl"
            lang="ar"
            translate="no"
            className="notranslate font-quran-uthmani text-center text-lg text-[#064E3B] py-1"
          >
            {QURAN_OPENING_BASMALAH}
          </p>
        )}

        <div className="space-y-2 max-h-[340px] overflow-y-auto pe-1">
          {selectedSurah.ayahs.map((ayah) => {
            const url = resolveControlledTestingAudioUrl(
              surahAudioUrls,
              ayahAudioUrls,
              selectedSurah.id,
              ayah.number,
            );
            const isSelected = selectedAyah.number === ayah.number;
            const isCurrentlyPlayingThisAyah =
              playerState.surahId === selectedSurah.id &&
              playerState.playbackMode === 'ayah' &&
              playerState.ayahNumber === ayah.number &&
              (playerState.status === 'playing' || playerState.status === 'loading' || playerState.status === 'paused');

            return (
              <div
                key={ayah.verseKey}
                className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3 transition-colors ${
                  isCurrentlyPlayingThisAyah
                    ? 'bg-[#ECFDF5] border-[#047857]'
                    : isSelected
                      ? 'bg-[#FFFDF7] border-[#B4862C]/50'
                      : 'bg-white border-[#27345C]/10'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedAyahNum(ayah.number)}
                  className="flex-1 text-right cursor-pointer"
                >
                  <p
                    dir="rtl"
                    lang="ar"
                    translate="no"
                    className="notranslate font-quran-uthmani text-lg sm:text-xl leading-relaxed text-[#1E293B]"
                  >
                    {ayah.textUthmani}{' '}
                    <span className="text-sm text-[#B45309] font-sans">﴿{getArabicDigits(ayah.number)}﴾</span>
                  </p>
                </button>

                <div className="flex items-center gap-2 shrink-0" dir="ltr">
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-mono-num text-[11px] font-extrabold text-[#27345C]/75">
                    {ayah.verseKey}
                  </span>
                  {url ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAyahNum(ayah.number);
                        void startAyahPlayback(selectedSurah.id, ayah.number, repeatCount);
                      }}
                      className="min-h-[34px] px-3 rounded-xl bg-[#047857] text-white font-extrabold flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{isCurrentlyPlayingThisAyah ? 'Replay' : 'Play'}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-[#27345C]/50 font-bold">
                      {totalUrlsLoaded > 0 ? 'URL missing' : 'Load URLs first'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
