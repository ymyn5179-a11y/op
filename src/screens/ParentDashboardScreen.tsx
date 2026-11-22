import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Bot,
  Calendar,
  Check,
  ClipboardCheck,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileBarChart2,
  Film,
  Fingerprint,
  Flame,
  History,
  KeyRound,
  Laptop,
  LayoutGrid,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  Trash2,
  UserPlus,
  Users,
  Volume2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { CertificateModal } from '../components/CertificateModal';
import { NonoLandLogo } from '../components/NonoLandLogo';
import { useNonoLand } from '../context/NonoLandContext';

const FamilyOverviewPanel = lazy(() =>
  import('../components/family/FamilyOverviewPanel').then((m) => ({ default: m.FamilyOverviewPanel })),
);
const MyChildrenCredentialsPanel = lazy(() =>
  import('../components/family/MyChildrenCredentialsPanel').then((m) => ({
    default: m.MyChildrenCredentialsPanel,
  })),
);
const AdaptiveLearningPanel = lazy(() =>
  import('../components/family/AdaptiveLearningPanel').then((m) => ({ default: m.AdaptiveLearningPanel })),
);
const WeeklyReportPanel = lazy(() =>
  import('../components/family/WeeklyReportPanel').then((m) => ({ default: m.WeeklyReportPanel })),
);
const TogetherAndGardenOverviewPanel = lazy(() =>
  import('../components/family/TogetherAndGardenOverviewPanel').then((m) => ({
    default: m.TogetherAndGardenOverviewPanel,
  })),
);
const ContentPrivacyPanel = lazy(() =>
  import('../components/family/ContentPrivacyPanel').then((m) => ({ default: m.ContentPrivacyPanel })),
);
const NonoAiControlsPanel = lazy(() =>
  import('../components/family/NonoAiControlsPanel').then((m) => ({ default: m.NonoAiControlsPanel })),
);
const GuardiansPanel = lazy(() =>
  import('../components/family/GuardiansPanel').then((m) => ({ default: m.GuardiansPanel })),
);
const TrustedDevicesPanel = lazy(() =>
  import('../components/family/TrustedDevicesPanel').then((m) => ({ default: m.TrustedDevicesPanel })),
);
const FamilyActivityLogPanel = lazy(() =>
  import('../components/family/FamilyActivityLogPanel').then((m) => ({ default: m.FamilyActivityLogPanel })),
);
const ParentGatePanel = lazy(() =>
  import('../components/family/ParentGatePanel').then((m) => ({ default: m.ParentGatePanel })),
);
const PasskeysPanel = lazy(() =>
  import('../components/family/PasskeysPanel').then((m) => ({ default: m.PasskeysPanel })),
);
const ParentQuranSettingsPanel = lazy(() =>
  import('../components/quran/ParentQuranSettingsPanel').then((m) => ({
    default: m.ParentQuranSettingsPanel,
  })),
);
import { PARENT_OFFLINE_ACTIVITIES } from '../data/academyData';
import { AGE_CURRICULUM_OUTCOMES } from '../data/deepCurriculum';
import { ALL_LEVEL1_LESSONS, getLevel1LessonsBySubject } from '../data/level1Curriculum';
import { DEFAULT_PARENT_SCHEDULE, REPORT_SUBJECT_LABELS } from '../data/worldCatalog';
import { OFFICIAL_YOUTUBE_CHANNEL } from '../data/funZoneData';
import { LEARNING_WORLDS } from '../data/worlds';
import { generateParentInsights } from '../engine/adaptiveEngine';
import {
  calculateStreakDays,
  computeChildSubjectMetrics,
  type QuranGrowthMetricsInput,
} from '../engine/monthlyReportEngine';
import { formatDate, formatNumber, getAgeGroupMeta, SKILL_LABELS, t, UI_COPY } from '../i18n/translations';
import {
  ActivityTimelineEvent,
  Certificate,
  LocalizedText,
  ParentSchedulePreferences,
  ReportSubjectKey,
  SecurityEventLog,
  SkillId,
  YouTubeCategory,
} from '../types/nonoland';
import { UNIFIED_STAGE_ID } from '../utils/ageAdaptation';
import { soundEngine } from '../utils/soundEngine';

function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '').slice(0, 11);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    const v = u.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const parts = u.pathname.split('/').filter(Boolean);
    const embedIdx = parts.findIndex((p) => p === 'embed' || p === 'shorts');
    if (embedIdx >= 0 && parts[embedIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[embedIdx + 1])) {
      return parts[embedIdx + 1];
    }
  } catch {
    return null;
  }
  return null;
}

export const ParentDashboardScreen: React.FC = () => {
  const {
    language,
    activeChild,
    childrenList,
    selectChild,
    updateChildProfile,
    parentSettings,
    updateParentSettings,
    subscription,
    updateSubscription,
    navigate,
    toggleDownloadWorld,
    isOnline,
    simulatedOffline,
    setSimulatedOffline,
    pendingSyncCount,
    offlineQueue,
    lastSyncedAt,
    syncOfflineQueue,
    resetAllData,
    curatedVideos,
    addCuratedVideo,
    toggleApproveVideo,
    toggleFeatureVideo,
    removeCuratedVideo,
    authSession,
    isChildSession,
    exitChildMode,
    logoutParent,
    logoutAllDevices,
    saveLearningPlan,
    toggleChildAiAssistant,
  } = useNonoLand();

  // Parental Gate Challenge (Server Parent Gate PIN/Password when authenticated; math check in sample preview)
  const [gateUnlocked, setGateUnlocked] = useState(() => Boolean(authSession.authenticated && !isChildSession));
  const [serverGateVerified, setServerGateVerified] = useState(false);
  const [hasParentPin, setHasParentPin] = useState(false);
  const [gateRemainingSeconds, setGateRemainingSeconds] = useState(0);
  const [gateVerifyMode, setGateVerifyMode] = useState<'password' | 'pin'>('password');
  const [gateInput, setGateInput] = useState('');
  const [gateError, setGateError] = useState(false);
  const [gateErrorText, setGateErrorText] = useState('');
  const [securityLogs, setSecurityLogs] = useState<SecurityEventLog[]>([]);
  const [activeSessionsCount, setActiveSessionsCount] = useState<number>(0);
  const challenge = useMemo(() => ({ a: 7, b: 4, answer: 28 }), []);

  type DashboardTab =
    | 'overview'
    | 'children-credentials'
    | 'adaptive-learning'
    | 'weekly-report'
    | 'together-garden'
    | 'quran-world'
    | 'content-privacy'
    | 'ai-controls'
    | 'guardians'
    | 'devices'
    | 'passkeys'
    | 'security-log'
    | 'parent-gate'
    | 'reports'
    | 'profiles'
    | 'controls'
    | 'offline'
    | 'youtube';

  const [tab, setTab] = useState<DashboardTab>('overview');
  const [quranGrowthSummary, setQuranGrowthSummary] = useState<QuranGrowthMetricsInput | null>(null);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [timelineCatFilter, setTimelineCatFilter] = useState<'all' | ActivityTimelineEvent['category']>('all');
  const [timelineRangeFilter, setTimelineRangeFilter] = useState<'7d' | '30d' | 'all'>('30d');
  const [scheduleDraft, setScheduleDraft] = useState<ParentSchedulePreferences>(() => ({
    ...DEFAULT_PARENT_SCHEDULE,
    ...(activeChild?.parentSchedule || {}),
  }));
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState('');
  const [aiToggleSaving, setAiToggleSaving] = useState(false);
  const [aiToggleMsg, setAiToggleMsg] = useState('');
  const [parentOverview, setParentOverview] = useState<{
    child?: { studentUserEmail?: string };
    assignedExams?: Array<{
      assignmentId: string;
      examId: string;
      examTitle: LocalizedText;
      subject: string;
      level: number;
      teacherName: string;
      deadline: string;
      status: string;
      resultsReleased: boolean;
      score?: number;
      totalMarks?: number;
      percentage?: number;
      passed?: boolean;
      submittedAt?: string;
    }>;
    assignedHomeworks?: Array<{
      submissionId: string;
      assignmentId: string;
      title: LocalizedText;
      subject: string;
      homeworkType: string;
      teacherName: string;
      deadline: string;
      status: string;
      score?: number;
      totalMarks?: number;
      percentage?: number;
      passed?: boolean;
      teacherFeedback?: string;
      submittedAt?: string;
    }>;
  } | null>(null);

  // Child student login creation state
  const [studentCredChildId, setStudentCredChildId] = useState<string | null>(null);
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentCredMsg, setStudentCredMsg] = useState('');
  const [studentCredErr, setStudentCredErr] = useState('');
  const [studentCredSaving, setStudentCredSaving] = useState(false);

  // Curated YouTube Form State
  const [ytInput, setYtInput] = useState('');
  const [ytTitleAr, setYtTitleAr] = useState('');
  const [ytTitleEn, setYtTitleEn] = useState('');
  const [ytCategory, setYtCategory] = useState<YouTubeCategory>('stories');
  const [ytError, setYtError] = useState('');
  const [ytApiConfigured, setYtApiConfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/youtube/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setYtApiConfigured(Boolean(data.configured));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setScheduleDraft({
      ...DEFAULT_PARENT_SCHEDULE,
      ...(activeChild?.parentSchedule || {}),
    });
    setScheduleMsg('');
  }, [activeChild?.id, activeChild?.parentSchedule]);

  useEffect(() => {
    if (!authSession.authenticated || isChildSession) {
      setServerGateVerified(false);
      return;
    }
    if (authSession.user?.role === 'parent' || authSession.user?.role === 'super_admin') {
      setGateUnlocked(true);
    }
    let cancelled = false;
    fetch('/api/parent/gate/status', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const verified = Boolean(d.verified);
        const hasPin = Boolean(d.hasParentPin);
        setServerGateVerified(verified);
        setHasParentPin(hasPin);
        setGateRemainingSeconds(Number(d.remainingSeconds || 0));
        if (hasPin) setGateVerifyMode('pin');
        if (verified) setGateUnlocked(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authSession.authenticated, authSession.user?.role, isChildSession]);

  useEffect(() => {
    if (!gateUnlocked || !authSession.authenticated || isChildSession) return;
    let cancelled = false;
    fetch('/api/parent/security-logs', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setSecurityLogs(data.logs || []);
          setActiveSessionsCount(data.activeSessionsCount || 0);
        }
      })
      .catch(() => {});
    if (activeChild?.id) {
      fetch(`/api/parent/children/${encodeURIComponent(activeChild.id)}/overview`, {
        credentials: 'include',
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data) setParentOverview(data);
        })
        .catch(() => {});
      fetch(`/api/children/${encodeURIComponent(activeChild.id)}/quran`, {
        credentials: 'include',
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled) setQuranGrowthSummary(data?.growthSummary || null);
        })
        .catch(() => {
          if (!cancelled) setQuranGrowthSummary(null);
        });
    } else {
      setParentOverview(null);
      setQuranGrowthSummary(null);
    }
    return () => {
      cancelled = true;
    };
  }, [gateUnlocked, authSession.authenticated, isChildSession, activeChild?.id]);

  // Strict RBAC guard in UI (backed by server deny-by-default rules): Child sessions cannot open Parent Controls
  if (isChildSession) {
    return (
      <div className="max-w-md mx-auto my-8 nono-card rounded-3xl p-6 sm:p-8 text-center space-y-5">
        <div className="flex justify-center">
          <NonoLandLogo variant="compact" size="sm" language={language} />
        </div>
        <div className="w-14 h-14 rounded-2xl bg-[#27345C] text-[#FFD84D] flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-extrabold text-[#27345C]">
            {language === 'ar' ? 'هذا القسم مخصّص لولي الأمر فقط 🔒' : 'Parent Area Only 🔒'}
          </h1>
          <p className="text-sm font-bold text-[#27345C]/75">
            {language === 'ar'
              ? 'أنت مسجل الدخول الآن بحساب الطفل. لفتح لوحة تحكم العائلة، يجب تسجيل الخروج من جلسة الطفل والدخول بحساب ولي الأمر.'
              : 'You are currently in Child Learning Mode. To open Parent Controls, exit child mode and sign in with a Parent account.'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => navigate('home')}
            className="flex-1 h-11 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm cursor-pointer"
          >
            {language === 'ar' ? 'العودة لعالمي 🌟' : 'Back to My World 🌟'}
          </button>
          <button
            type="button"
            onClick={() => void exitChildMode()}
            className="flex-1 h-11 rounded-2xl bg-slate-100 text-[#27345C] font-extrabold text-sm cursor-pointer"
          >
            {language === 'ar' ? 'دخول ولي الأمر' : 'Parent Sign In'}
          </button>
        </div>
      </div>
    );
  }

  const handleGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(false);
    setGateErrorText('');
    if (authSession.authenticated && authSession.csrfToken) {
      try {
        const body =
          gateVerifyMode === 'pin' && hasParentPin
            ? { pin: gateInput }
            : { password: gateInput };
        const res = await fetch('/api/parent/gate/verify', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': authSession.csrfToken,
          },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as {
          verified?: boolean;
          hasParentPin?: boolean;
          remainingSeconds?: number;
          error?: string;
        };
        if (res.ok && data.verified) {
          soundEngine.playSuccess();
          setGateUnlocked(true);
          setServerGateVerified(true);
          setHasParentPin(Boolean(data.hasParentPin));
          setGateRemainingSeconds(Number(data.remainingSeconds || 900));
          setGateError(false);
          setGateInput('');
          return;
        }
        setGateErrorText(data.error || '');
      } catch {
        // fail closed
      }
      soundEngine.playEncourage();
      setGateError(true);
      return;
    }

    if (Number(gateInput.trim()) === challenge.answer) {
      soundEngine.playSuccess();
      setGateUnlocked(true);
      setGateError(false);
    } else {
      soundEngine.playEncourage();
      setGateError(true);
    }
  };

  if (!gateUnlocked) {
    return (
      <div className="max-w-md mx-auto my-8 nono-card rounded-3xl p-6 sm:p-8 text-center space-y-5">
        <div className="flex justify-center">
          <NonoLandLogo variant="compact" size="sm" language={language} />
        </div>
        <div className="w-14 h-14 rounded-2xl bg-[#27345C] text-[#FFD84D] flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-[#27345C]">
            {t(UI_COPY.parent.gateTitle, language)}
          </h1>
          <p className="text-sm text-[#27345C]/75 mt-1">
            {authSession.authenticated
              ? language === 'ar'
                ? 'أدخل كلمة مرور حساب ولي الأمر للدخول للوحة التحكم'
                : 'Enter your Parent Account password to unlock controls'
              : t(UI_COPY.parent.gateSubtitle, language)}
          </p>
        </div>

        <form onSubmit={(e) => void handleGateSubmit(e)} className="space-y-4">
          {authSession.authenticated && hasParentPin && (
            <div className="flex justify-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setGateVerifyMode('pin');
                  setGateInput('');
                }}
                className={`px-3 py-1.5 rounded-xl font-extrabold cursor-pointer ${
                  gateVerifyMode === 'pin' ? 'bg-[#8054D9] text-white' : 'bg-[#FFF8E9] text-[#27345C]'
                }`}
              >
                {language === 'ar' ? 'رمز PIN الأبوي' : 'Parent PIN'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGateVerifyMode('password');
                  setGateInput('');
                }}
                className={`px-3 py-1.5 rounded-xl font-extrabold cursor-pointer ${
                  gateVerifyMode === 'password' ? 'bg-[#8054D9] text-white' : 'bg-[#FFF8E9] text-[#27345C]'
                }`}
              >
                {language === 'ar' ? 'كلمة المرور' : 'Password'}
              </button>
            </div>
          )}
          {!authSession.authenticated && (
            <div className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/12 font-mono-num text-2xl font-extrabold text-[#27345C]">
              {challenge.a} × {challenge.b} = ?
            </div>
          )}
          <input
            type={authSession.authenticated ? 'password' : 'number'}
            inputMode={authSession.authenticated && gateVerifyMode === 'pin' && hasParentPin ? 'numeric' : undefined}
            value={gateInput}
            onChange={(e) => setGateInput(e.target.value)}
            placeholder={
              authSession.authenticated
                ? gateVerifyMode === 'pin' && hasParentPin
                  ? language === 'ar' ? 'أدخل رمز PIN الأبوي' : 'Enter Parent PIN'
                  : language === 'ar' ? 'كلمة مرور ولي الأمر' : 'Parent Password'
                : language === 'ar'
                  ? 'اكتب الناتج'
                  : 'Enter answer'
            }
            className="w-full h-12 px-4 rounded-2xl bg-white border-2 border-[#27345C]/15 focus:border-[#8054D9] outline-none text-center font-mono-num text-lg font-bold"
            required
          />
          {gateError && (
            <p className="text-xs font-bold text-[#FF4D6D]">
              {gateErrorText
                ? gateErrorText
                : authSession.authenticated
                  ? language === 'ar'
                    ? 'بيانات التحقق غير صحيحة'
                    : 'Incorrect verification PIN or password'
                  : language === 'ar'
                    ? 'حاول مرة أخرى (تلميح: ٢٨)'
                    : 'Try again!'}
            </p>
          )}
          <div className="flex gap-2">
            {authSession.authenticated ? (
              <button
                type="button"
                onClick={() => setLogoutModalOpen(true)}
                className="flex-1 h-12 rounded-2xl bg-[#FF4D6D]/12 text-[#991B1B] font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{language === 'ar' ? 'تسجيل الخروج' : 'Log Out'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('home')}
                className="flex-1 h-12 rounded-2xl bg-slate-100 font-bold text-sm cursor-pointer"
              >
                {language === 'ar' ? 'عودة للطفل' : 'Back'}
              </button>
            )}
            <button
              type="submit"
              className="flex-1 nono-btn-tactile h-12 rounded-2xl bg-[#27345C] text-white font-bold text-sm cursor-pointer"
            >
              {language === 'ar' ? 'دخول' : 'Unlock'}
            </button>
          </div>
        </form>
        {logoutModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
            <div className="nono-card rounded-3xl p-6 bg-white max-w-sm w-full space-y-4 text-center">
              <h2 className="text-lg font-extrabold text-[#27345C]">
                {language === 'ar' ? 'تأكيد تسجيل الخروج' : 'Confirm Log Out'}
              </h2>
              <p className="text-xs font-bold text-[#27345C]/75">
                {language === 'ar'
                  ? 'هل تريد تسجيل الخروج من حساب ولي الأمر؟ سيتم إنهاء الجلسة الحالية بأمان.'
                  : 'Are you sure you want to log out of your Parent Account? Your session will be closed securely.'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLogoutModalOpen(false)}
                  className="flex-1 h-11 rounded-2xl bg-slate-100 text-[#27345C] font-extrabold text-xs cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLogoutModalOpen(false);
                    void logoutParent();
                  }}
                  className="flex-1 h-11 rounded-2xl bg-[#FF4D6D] text-white font-extrabold text-xs cursor-pointer"
                >
                  {language === 'ar' ? 'نعم، تسجيل الخروج' : 'Yes, Log Out'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const insights = activeChild ? generateParentInsights(activeChild) : [];
  const exploredWorldsCount = activeChild ? new Set(activeChild.attempts.map((a) => a.worldId)).size : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <NonoLandLogo variant="compact" size="md" showWordmark={false} language={language} />
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#27345C]">
              {t(UI_COPY.parent.dashboardTitle, language)}
            </h1>
            <p className="text-sm text-[#27345C]/70">
              {activeChild
                ? language === 'ar'
                  ? `عرض تقارير وإعدادات: ${activeChild.displayName}`
                  : `Viewing reports & settings for: ${activeChild.displayName}`
                : language === 'ar'
                  ? 'لا يوجد أطفال مسجلون بعد — أضف طفلك الأول للبدء'
                  : 'No child profiles added yet — add your first child to begin'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('create-child')}
            className="px-4 py-2.5 rounded-xl bg-[#8054D9] text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{language === 'ar' ? 'إضافة طفل' : 'Add Child'}</span>
          </button>
          <button
            type="button"
            onClick={() => setLogoutModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#FF4D6D]/12 hover:bg-[#FF4D6D]/20 text-[#991B1B] border border-[#FF4D6D]/25 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{language === 'ar' ? 'تسجيل الخروج' : 'Log Out'}</span>
          </button>
        </div>
      </div>

      {/* Unified Family Dashboard Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-2xl border border-[#27345C]/12">
        {[
          { id: 'overview' as const, label: { ar: 'نظرة عامة للعائلة', en: 'Family Overview' }, icon: <LayoutGrid className="w-4 h-4" /> },
          { id: 'children-credentials' as const, label: { ar: 'الأطفال ورموز الدخول', en: 'Children & Codes' }, icon: <KeyRound className="w-4 h-4" /> },
          { id: 'adaptive-learning' as const, label: { ar: 'الملف التكيفي', en: 'Adaptive Profile' }, icon: <Activity className="w-4 h-4" /> },
          { id: 'weekly-report' as const, label: { ar: 'التقرير الأسبوعي', en: 'Weekly Report' }, icon: <FileBarChart2 className="w-4 h-4" /> },
          { id: 'together-garden' as const, label: { ar: 'وقتنا معاً والحديقة', en: 'Together & Garden' }, icon: <Sprout className="w-4 h-4" /> },
          { id: 'quran-world' as const, label: { ar: 'عالم القرآن والتحفيظ', en: 'Quran World' }, icon: <BookOpen className="w-4 h-4" /> },
          { id: 'content-privacy' as const, label: { ar: 'المحتوى والخصوصية', en: 'Content & Privacy' }, icon: <ShieldCheck className="w-4 h-4" /> },
          { id: 'ai-controls' as const, label: { ar: 'مساعد نونو الصوتي', en: 'Nono AI & Voice' }, icon: <Bot className="w-4 h-4" /> },
          { id: 'guardians' as const, label: { ar: 'أولياء الأمور', en: 'Guardians' }, icon: <Users className="w-4 h-4" /> },
          { id: 'devices' as const, label: { ar: 'الأجهزة الموثوقة', en: 'Trusted Devices' }, icon: <Laptop className="w-4 h-4" /> },
          { id: 'passkeys' as const, label: { ar: 'مفاتيح المرور (Passkeys)', en: 'Passkeys' }, icon: <Fingerprint className="w-4 h-4" /> },
          { id: 'security-log' as const, label: { ar: 'سجل الأمان', en: 'Security Log' }, icon: <History className="w-4 h-4" /> },
          { id: 'parent-gate' as const, label: { ar: 'بوابة الحماية PIN', en: 'Parent Gate' }, icon: <Lock className="w-4 h-4" /> },
          { id: 'reports' as const, label: UI_COPY.parent.overviewTab, icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'controls' as const, label: UI_COPY.parent.controlsTab, icon: <Volume2 className="w-4 h-4" /> },
          { id: 'offline' as const, label: UI_COPY.parent.offlineTab, icon: <Download className="w-4 h-4" /> },
          { id: 'youtube' as const, label: { ar: 'فيديوهات يوتيوب الآمنة', en: 'Curated YouTube' }, icon: <Film className="w-4 h-4" /> },
        ].map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              tab === tb.id ? 'bg-[#27345C] text-white' : 'text-[#27345C]/75 hover:bg-slate-50'
            }`}
          >
            {tb.icon}
            <span>{t(tb.label, language)}</span>
          </button>
        ))}
      </div>

      {/* UNIFIED MODULAR FAMILY DASHBOARD PANELS */}
      <Suspense
        fallback={
          <div className="nono-card rounded-3xl p-8 text-center text-sm font-bold text-[#27345C]/70">
            {language === 'ar' ? 'جاري تحميل القسم...' : 'Loading section...'}
          </div>
        }
      >
        {tab === 'overview' && (
          <FamilyOverviewPanel
            onSelectTab={(nextTab) => setTab(nextTab as DashboardTab)}
            gateVerified={serverGateVerified}
          />
        )}
        {tab === 'children-credentials' && (
          <MyChildrenCredentialsPanel
            gateVerified={serverGateVerified}
            onRequestGateUnlock={() => setTab('parent-gate')}
          />
        )}
        {tab === 'adaptive-learning' && <AdaptiveLearningPanel />}
        {tab === 'weekly-report' && <WeeklyReportPanel />}
        {tab === 'together-garden' && <TogetherAndGardenOverviewPanel />}
        {tab === 'quran-world' && (
          <ParentQuranSettingsPanel
            gateVerified={serverGateVerified}
            onRequestGateUnlock={() => setTab('parent-gate')}
          />
        )}
        {tab === 'content-privacy' && (
          <ContentPrivacyPanel
            gateVerified={serverGateVerified}
            onRequestGateUnlock={() => setTab('parent-gate')}
          />
        )}
        {tab === 'ai-controls' && (
          <NonoAiControlsPanel
            gateVerified={serverGateVerified}
            onRequestGateUnlock={() => setTab('parent-gate')}
          />
        )}
        {tab === 'guardians' && (
          <GuardiansPanel
            gateVerified={serverGateVerified}
            onRequestGateUnlock={() => setTab('parent-gate')}
          />
        )}
        {tab === 'devices' && (
          <TrustedDevicesPanel
            gateVerified={serverGateVerified}
            onRequestGateUnlock={() => setTab('parent-gate')}
          />
        )}
        {tab === 'passkeys' && <PasskeysPanel />}
        {tab === 'security-log' && <FamilyActivityLogPanel />}
        {tab === 'parent-gate' && (
          <ParentGatePanel
            gateVerified={serverGateVerified}
            hasParentPin={hasParentPin}
            remainingSeconds={gateRemainingSeconds}
            onGateStateChange={(verified, hasPin, remSec) => {
              setServerGateVerified(verified);
              setHasParentPin(hasPin);
              setGateRemainingSeconds(remSec);
            }}
          />
        )}
      </Suspense>

      {/* TAB 1: LEARNING REPORTS & DATA-BACKED INSIGHTS */}
      {tab === 'reports' && !activeChild && (
        <div className="nono-card rounded-3xl p-8 bg-white text-center space-y-3">
          <p className="text-base font-extrabold text-[#27345C]">
            {language === 'ar'
              ? 'أضف ملف طفل لعرض تقارير التقدم والمهارات'
              : 'Add a child profile to view learning & progress reports'}
          </p>
          <button
            type="button"
            onClick={() => navigate('create-child')}
            className="nono-btn-tactile px-5 py-2.5 rounded-xl bg-[#8054D9] text-white text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{language === 'ar' ? 'إضافة طفل جديد' : 'Add Child Profile'}</span>
          </button>
        </div>
      )}
      {tab === 'reports' && activeChild && (
        <div className="space-y-5">
          {/* Plain-Language Curriculum Summary (X of 75 Foundations Lessons) */}
          {(() => {
            const l1Mastered = Object.values(activeChild.level1Progress || {}).filter((p) => p.status === 'demonstrated').length;
            const totalDone = l1Mastered;
            const strongestSkill = (Object.keys(activeChild.skillProgress) as SkillId[])
              .filter((k) => activeChild.skillProgress[k].attempts > 0)
              .sort((a, b) => activeChild.skillProgress[b].accuracy - activeChild.skillProgress[a].accuracy)[0];
            const needsSkill = (Object.keys(activeChild.skillProgress) as SkillId[])
              .filter((k) => activeChild.skillProgress[k].attempts > 0 && activeChild.skillProgress[k].accuracy < 75)
              .sort((a, b) => activeChild.skillProgress[a].accuracy - activeChild.skillProgress[b].accuracy)[0];

            return (
              <div className="nono-card rounded-3xl p-5 bg-gradient-to-br from-[#F4EEFF] via-white to-[#FFF8E9] border border-[#8054D9]/20 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-extrabold text-[#8054D9]">
                    {language === 'ar' ? 'ملخص الأهل الواضح (١–٤ سنوات)' : 'Clear Parent Summary (Ages 1–4)'}
                  </p>
                  <h2 className="text-xl font-extrabold text-[#27345C]">
                    {language === 'ar'
                      ? `أكمل ${activeChild.displayName} ${formatNumber(totalDone, language)} من أصل ٧٥ درساً تأسيسياً`
                      : `${activeChild.displayName} has completed ${totalDone} of 75 Foundations lessons`}
                  </h2>
                  <p className="text-xs font-bold text-[#27345C]/75">
                    {strongestSkill
                      ? language === 'ar'
                        ? `أقوى مهارة: ${t(SKILL_LABELS[strongestSkill], language)} (${activeChild.skillProgress[strongestSkill].accuracy}%)`
                        : `Strongest area: ${t(SKILL_LABELS[strongestSkill], language)} (${activeChild.skillProgress[strongestSkill].accuracy}%)`
                      : language === 'ar'
                        ? 'سيظهر تحليل المهارات بمجرد بدء الأنشطة المسجلة.'
                        : 'Skill strengths appear as soon as recorded practice begins.'}
                    {needsSkill &&
                      (language === 'ar'
                        ? ` · يحتاج لمزيد من التدريب اللطيف في: ${t(SKILL_LABELS[needsSkill], language)}`
                        : ` · Gentle practice suggested in: ${t(SKILL_LABELS[needsSkill], language)}`)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-4 py-2 rounded-2xl bg-white border border-[#8054D9]/20 font-extrabold text-lg text-[#8054D9] tabular-nums">
                    {totalDone} / 75
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('monthly-report')}
                    className="nono-btn-tactile min-h-[44px] px-4 rounded-2xl bg-[#8054D9] text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileBarChart2 className="w-4 h-4" />
                    <span>{language === 'ar' ? 'التقرير الشهري و PDF' : 'Monthly Report & PDF'}</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="nono-card rounded-2xl p-4">
              <p className="text-xs font-bold text-[#27345C]/65 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-[#FF9360]" />
                <span>{language === 'ar' ? 'السلسلة التعليمية' : 'Learning Streak'}</span>
              </p>
              <p className="text-3xl font-extrabold text-[#FF9360] mt-1 font-mono-num">
                {formatNumber(
                  activeChild.learningStreakDays ?? calculateStreakDays(activeChild.activeDaysHistory),
                  language,
                )}{' '}
                <span className="text-sm font-bold text-[#27345C]/70">
                  {language === 'ar' ? 'أيام' : 'days'}
                </span>
              </p>
            </div>
            <div className="nono-card rounded-2xl p-4">
              <p className="text-xs font-bold text-[#27345C]/65">
                {language === 'ar' ? 'الأنشطة المكتملة' : 'Activities Completed'}
              </p>
              <p className="text-3xl font-extrabold text-[#8054D9] mt-1 font-mono-num">
                {formatNumber(activeChild.completedActivityIds.length, language)}
              </p>
            </div>
            <div className="nono-card rounded-2xl p-4">
              <p className="text-xs font-bold text-[#27345C]/65">
                {language === 'ar' ? 'وقت التعلم' : 'Learning Time'}
              </p>
              <p className="text-3xl font-extrabold text-[#39BDF2] mt-1 font-mono-num">
                {formatNumber(activeChild.totalLearningMinutes, language)}m
              </p>
            </div>
            <div className="nono-card rounded-2xl p-4">
              <p className="text-xs font-bold text-[#27345C]/65">
                {language === 'ar' ? 'العوالم المستكشفة' : 'Worlds Explored'}
              </p>
              <p className="text-3xl font-extrabold text-[#55D98B] mt-1 font-mono-num">
                {formatNumber(exploredWorldsCount, language)} / 10
              </p>
            </div>
            <div className="nono-card rounded-2xl p-4 col-span-2 lg:col-span-1">
              <p className="text-xs font-bold text-[#27345C]/65">
                {language === 'ar' ? 'الشهادات والأوسمة' : 'Certificates & Badges'}
              </p>
              <p className="text-3xl font-extrabold text-[#FF9360] mt-1 font-mono-num">
                {activeChild.certificates.length} · {activeChild.unlockedBadges.length}
              </p>
            </div>
          </div>

          {/* Interactive SVG Domain Analytics Chart & Activity Timeline */}
          {(() => {
            const domainMetrics = computeChildSubjectMetrics(activeChild, quranGrowthSummary);
            const domainKeys = Object.keys(REPORT_SUBJECT_LABELS) as ReportSubjectKey[];
            const domainColors: Record<ReportSubjectKey, string> = {
              arabic: '#8054D9',
              english: '#39BDF2',
              math: '#F59E0B',
              logic: '#6366F1',
              creative: '#FF78B7',
              general: '#55D98B',
              'quran-values': '#047857',
            };

            const mergedEvents: ActivityTimelineEvent[] = [
              ...(activeChild.activityTimeline || []),
              ...(activeChild.attempts || []).slice(0, 20).map((att) => ({
                id: `att-${att.id}`,
                timestamp: att.completedAt,
                category: 'game' as const,
                title: {
                  ar: `نشاط: ${att.activityId}`,
                  en: `Activity: ${att.activityId}`,
                },
                detail: {
                  ar: `الدقة ${att.accuracy}%`,
                  en: `${att.accuracy}% accuracy`,
                },
                starsEarned: att.accuracy >= 80 ? 3 : 1,
              })),
            ]
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            const nowMs = Date.now();
            const filteredEvents = mergedEvents.filter((evt) => {
              if (timelineCatFilter !== 'all' && evt.category !== timelineCatFilter) return false;
              const ageDays = (nowMs - new Date(evt.timestamp).getTime()) / 86400_000;
              if (timelineRangeFilter === '7d' && ageDays > 7) return false;
              if (timelineRangeFilter === '30d' && ageDays > 30) return false;
              return true;
            });

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Visual SVG Chart */}
                <div className="lg:col-span-6 nono-card rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-[#8054D9]" />
                      <span>
                        {language === 'ar'
                          ? 'الرسم البياني لمجالات التعلم السبعة'
                          : '7-Domain Performance & Activity Chart'}
                      </span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => navigate('monthly-report')}
                      className="text-xs font-extrabold text-[#8054D9] hover:underline cursor-pointer"
                    >
                      {language === 'ar' ? 'تقرير مفصل ←' : 'Full Monthly Report →'}
                    </button>
                  </div>

                  <svg viewBox="0 0 460 210" className="w-full h-48 bg-[#FFFDF7] rounded-2xl border border-[#27345C]/10 p-2">
                    {[0, 25, 50, 75, 100].map((tick) => {
                      const y = 170 - (tick / 100) * 135;
                      return (
                        <g key={tick}>
                          <line x1="36" y1={y} x2="445" y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
                          <text x="8" y={y + 4} fontSize="10" fill="#64748B" fontWeight="700">
                            {tick}%
                          </text>
                        </g>
                      );
                    })}
                    {domainKeys.map((dk, idx) => {
                      const m = domainMetrics[dk];
                      const isQuranValues = dk === 'quran-values';
                      const pct = isQuranValues
                        ? Math.min(100, m.completedCount * 12)
                        : (m.accuracyPct ?? 0);
                      const barH = (pct / 100) * 135;
                      const x = 46 + idx * 56;
                      const y = 170 - barH;
                      return (
                        <g key={dk}>
                          <rect
                            x={x}
                            y={pct > 0 ? y : 164}
                            width="32"
                            height={pct > 0 ? barH : 6}
                            rx="7"
                            fill={pct > 0 ? domainColors[dk] : '#CBD5E1'}
                          />
                          <text x={x + 16} y={pct > 0 ? Math.max(20, y - 6) : 158} textAnchor="middle" fontSize="10" fontWeight="800" fill="#27345C">
                            {isQuranValues
                              ? m.completedCount > 0
                                ? `${m.completedCount}`
                                : '—'
                              : m.accuracyPct !== null
                                ? `${pct}%`
                                : '—'}
                          </text>
                          <text x={x + 16} y="192" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#27345C">
                            {dk === 'quran-values' ? 'QURAN' : dk.slice(0, 6).toUpperCase()}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  <p className="text-[11px] text-[#27345C]/65">
                    {language === 'ar'
                      ? 'مجال القرآن والقيم يعرض عدد لحظات الاستماع والقصص والآداب المستقلة تماماً عن نسب الاختبارات. الرمز (—) يعني عدم توفر محاولات كافية بعد.'
                      : 'Quran & Values shows logged spiritual moments completely independent of exam percentages. Bars marked (—) indicate no recorded accuracy data yet.'}
                  </p>
                </div>

                {/* Filterable Activity Timeline */}
                <div className="lg:col-span-6 nono-card rounded-3xl p-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-extrabold text-[#27345C]">
                      {language === 'ar' ? 'السجل الزمني للأنشطة' : 'Filterable Activity Timeline'}
                    </h2>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={timelineCatFilter}
                        onChange={(e) => setTimelineCatFilter(e.target.value as typeof timelineCatFilter)}
                        className="min-h-[36px] px-2.5 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-xs font-bold"
                      >
                        <option value="all">{language === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
                        <option value="quran">{language === 'ar' ? 'عالم القرآن' : 'Quran World'}</option>
                        <option value="lesson">{language === 'ar' ? 'الدروس' : 'Lessons'}</option>
                        <option value="game">{language === 'ar' ? 'الألعاب' : 'Games'}</option>
                        <option value="lab">{language === 'ar' ? 'المختبر' : 'Lab'}</option>
                        <option value="story">{language === 'ar' ? 'القصص' : 'Stories'}</option>
                        <option value="creative">{language === 'ar' ? 'الإبداع' : 'Creative'}</option>
                        <option value="pet">{language === 'ar' ? 'الأليف' : 'Pet'}</option>
                        <option value="reward">{language === 'ar' ? 'المكافآت' : 'Rewards'}</option>
                        <option value="family">{language === 'ar' ? 'العائلة' : 'Family'}</option>
                      </select>
                      <select
                        value={timelineRangeFilter}
                        onChange={(e) => setTimelineRangeFilter(e.target.value as typeof timelineRangeFilter)}
                        className="min-h-[36px] px-2.5 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-xs font-bold"
                      >
                        <option value="7d">{language === 'ar' ? 'آخر ٧ أيام' : 'Last 7d'}</option>
                        <option value="30d">{language === 'ar' ? 'آخر ٣٠ يوماً' : 'Last 30d'}</option>
                        <option value="all">{language === 'ar' ? 'كل الأوقات' : 'All Time'}</option>
                      </select>
                    </div>
                  </div>

                  {filteredEvents.length === 0 ? (
                    <p className="text-xs text-[#27345C]/70 py-8 text-center">
                      {language === 'ar'
                        ? 'لا توجد أحداث مطابقة لهذه التصفية حتى الآن.'
                        : 'No recorded activity events match this filter yet.'}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
                      {filteredEvents.slice(0, 15).map((evt) => (
                        <div
                          key={evt.id}
                          className="p-3 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <p className="font-extrabold text-[#27345C]">{t(evt.title, language)}</p>
                            <p className="text-[#27345C]/65">
                              {t(evt.detail, language)} · {formatDate(evt.timestamp, language)}
                            </p>
                          </div>
                          {typeof evt.starsEarned === 'number' && evt.starsEarned > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-[#FFD84D]/45 font-extrabold text-[#78350F] shrink-0">
                              +{evt.starsEarned} ⭐
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Level 1 Curriculum Report (Calculated Strictly from Real Saved Progress) */}
          {(() => {
            const l1Map = activeChild.level1Progress || {};
            const allValues = Object.values(l1Map);
            const demonstrated = allValues.filter((p) => p.status === 'demonstrated').length;
            const needsRev = allValues.filter((p) => p.status === 'needs-revision').length;
            const inProg = allValues.filter((p) => p.status === 'learning' || p.status === 'practicing' || p.status === 'improving').length;
            const recommended =
              ALL_LEVEL1_LESSONS.find((l) => l1Map[l.id]?.status === 'needs-revision') ||
              ALL_LEVEL1_LESSONS.find((l) => !l1Map[l.id] || l1Map[l.id].status !== 'demonstrated');

            const domainRows = [
              { id: 'arabic' as const, ar: 'العربية', en: 'Arabic', total: 28 },
              { id: 'english' as const, ar: 'الإنجليزية', en: 'English', total: 26 },
              { id: 'numbers' as const, ar: 'الأرقام', en: 'Numbers', total: 11 },
              { id: 'colors' as const, ar: 'الألوان', en: 'Colors', total: 10 },
            ];

            return (
              <div className="nono-card rounded-3xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-[#27345C]">
                      {language === 'ar'
                        ? 'تقرير المستوى الأول (٧٥ درساً رسمياً)'
                        : 'Level 1 Progress Report (75 Official Lessons)'}
                    </h2>
                    <p className="text-xs text-[#27345C]/70">
                      {language === 'ar'
                        ? `محسوب مباشرة من سجل الطفل المحفوظ · متقن: ${demonstrated} · قيد التعلّم: ${inProg} · يحتاج مراجعة: ${needsRev}`
                        : `Calculated from real saved progress · Demonstrated: ${demonstrated} · In Progress: ${inProg} · Needs Revision: ${needsRev}`}
                    </p>
                  </div>
                  {recommended && (
                    <button
                      type="button"
                      onClick={() => navigate('academy')}
                      className="px-4 py-2 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold cursor-pointer"
                    >
                      {language === 'ar' ? `الدرس المقترح: ${recommended.id}` : `Next Recommended: ${recommended.id}`}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {domainRows.map((dr) => {
                    const lessonsInDom = getLevel1LessonsBySubject(dr.id);
                    const done = lessonsInDom.filter((l) => l1Map[l.id]?.status === 'demonstrated').length;
                    return (
                      <div key={dr.id} className="p-3.5 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10">
                        <p className="text-xs font-extrabold text-[#27345C]">
                          {language === 'ar' ? dr.ar : dr.en}
                        </p>
                        <p className="text-2xl font-extrabold text-[#8054D9] font-mono-num mt-1">
                          {done} / {dr.total}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Assigned Teacher Exams & Permitted Results */}
          {authSession.authenticated &&
            parentOverview?.assignedExams &&
            parentOverview.assignedExams.length > 0 && (
              <div className="nono-card rounded-3xl p-6 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-[#8054D9]" />
                    <span>
                      {language === 'ar'
                        ? 'الامتحانات المدرسية المعينة من المعلمين'
                        : 'Teacher-Assigned Exams & Released Results'}
                    </span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => navigate('exams')}
                    className="px-3 py-1.5 rounded-xl bg-[#8054D9] text-white text-xs font-bold cursor-pointer"
                  >
                    {language === 'ar' ? 'فتح الامتحانات' : 'Open Exams'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {parentOverview.assignedExams.map((ae) => (
                    <div
                      key={ae.assignmentId}
                      className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-extrabold text-sm text-[#27345C]">
                          {t(ae.examTitle, language)}
                        </p>
                        <p className="text-[#27345C]/65">
                          {ae.teacherName} · {ae.subject} · {ae.status}
                        </p>
                      </div>
                      {ae.resultsReleased && ae.percentage !== undefined ? (
                        <span
                          className={`px-2.5 py-1 rounded-xl font-extrabold font-mono-num shrink-0 ${
                            ae.passed
                              ? 'bg-[#55D98B]/25 text-[#27345C]'
                              : 'bg-[#FF4D6D]/15 text-[#FF4D6D]'
                          }`}
                        >
                          {ae.score}/{ae.totalMarks} ({ae.percentage}%)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-[#27345C]/70 font-bold shrink-0">
                          {ae.status === 'completed'
                            ? language === 'ar'
                              ? 'بانتظار إعلان النتيجة'
                              : 'Pending Release'
                            : language === 'ar'
                              ? 'قيد الانتظار'
                              : 'Assigned'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Assigned Homework & Authorized Teacher Feedback */}
          {authSession.authenticated &&
            parentOverview?.assignedHomeworks &&
            parentOverview.assignedHomeworks.length > 0 && (
              <div className="nono-card rounded-3xl p-6 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#39BDF2]" />
                    <span>
                      {language === 'ar'
                        ? 'الواجبات المدرسية وملاحظات المعلم'
                        : 'Assigned Homework & Teacher Feedback'}
                    </span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => navigate('homework')}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#39BDF2] text-white text-xs font-bold cursor-pointer"
                  >
                    {language === 'ar' ? 'فتح الواجبات' : 'Open Homework'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {parentOverview.assignedHomeworks.map((hw) => (
                    <div
                      key={hw.submissionId}
                      className="p-4 rounded-2xl bg-[#E5F6FF]/50 border border-[#39BDF2]/25 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-extrabold text-sm text-[#27345C]">{t(hw.title, language)}</p>
                        <span className="px-2 py-0.5 rounded-lg bg-white border font-extrabold text-[#8054D9]">
                          {hw.status}
                          {hw.percentage !== undefined ? ` · ${hw.percentage}%` : ''}
                        </span>
                      </div>
                      <p className="text-[#27345C]/70 font-bold">
                        {hw.teacherName} · {hw.subject} · Due {new Date(hw.deadline).toLocaleDateString()}
                      </p>
                      {hw.teacherFeedback && (
                        <p className="p-2 rounded-xl bg-white text-[#14532D] font-bold">
                          {language === 'ar' ? 'ملاحظة المعلم:' : 'Teacher feedback:'} {hw.teacherFeedback}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Data-Backed Learning Insights + Skill Progress */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 nono-card rounded-3xl p-6 space-y-4">
              <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#8054D9]" />
                <span>{language === 'ar' ? 'ملخصات التعلم المخصصة' : 'Evidence-Based Learning Insights'}</span>
              </h2>
              <div className="space-y-3">
                {insights.map((ins) => (
                  <div key={ins.id} className="p-3.5 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 text-sm font-semibold text-[#27345C]">
                    {t(ins.text, language)}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#27345C]/65 leading-relaxed">
                {t(UI_COPY.parent.noMedicalDisclaimer, language)}
              </p>
            </div>

            <div className="lg:col-span-7 nono-card rounded-3xl p-6 space-y-4">
              <h2 className="text-lg font-extrabold text-[#27345C]">
                {language === 'ar' ? 'تقدم المهارات التعليمية' : 'Skill Mastery Breakdown'}
              </h2>
              <div className="space-y-3">
                {(Object.keys(activeChild.skillProgress) as SkillId[]).map((sk) => {
                  const prog = activeChild.skillProgress[sk];
                  const meta = SKILL_LABELS[sk];
                  return (
                    <div key={sk} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span>{t(meta, language)}</span>
                        <span className="font-mono-num text-[#27345C]/75">
                          {prog.attempts > 0
                            ? `${prog.accuracy}% (${prog.attempts} ${language === 'ar' ? 'محاولات' : 'tries'})`
                            : language === 'ar'
                              ? 'لم يمارس بعد'
                              : 'Not explored yet'}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${prog.attempts > 0 ? Math.max(8, prog.accuracy) : 0}%`,
                            backgroundColor: meta.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Assessment History */}
          {activeChild.assessmentHistory.length > 0 && (
            <div className="nono-card rounded-3xl p-6 space-y-3">
              <h2 className="text-lg font-extrabold text-[#27345C]">
                {language === 'ar' ? 'سجل جلسات مختبر الاكتشاف' : 'Discovery Lab Assessment History'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeChild.assessmentHistory.map((h) => (
                  <div key={h.id} className="p-3.5 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 text-sm">
                    <p className="font-bold text-[#27345C]">
                      {h.mode === 'baseline'
                        ? language === 'ar'
                          ? 'تقييم البداية'
                          : 'Baseline Assessment'
                        : language === 'ar'
                          ? 'جلسة مختبر نونو'
                          : 'Discovery Lab'}
                    </p>
                    <p className="text-xs text-[#27345C]/70 mt-1 font-mono-num">
                      {h.correctAnswers}/{h.questionsCompleted} · {formatDate(h.date, language)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Concept-Level Evidence (Multi-Sensory Mastery) & Offline Parent-Child Activities */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 nono-card rounded-3xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#8054D9]" />
                  <span>
                    {language === 'ar'
                      ? 'سجل إتقان المفاهيم والرحلات العميقة'
                      : 'Deep Concept Mastery & Revision Log'}
                  </span>
                </h2>
                <span className="text-xs font-extrabold text-[#8054D9] font-mono-num">
                  {(activeChild.completedDeepLessons || []).length}{' '}
                  {language === 'ar' ? 'رحلة عميقة مكتملة' : 'deep journeys completed'}
                </span>
              </div>

              {/* Age-Based Curriculum Focus */}
              <div className="p-3.5 rounded-2xl bg-[#F3E8FF]/60 border border-[#8054D9]/15 text-xs space-y-1">
                <p className="font-extrabold text-[#8054D9]">
                  {t(AGE_CURRICULUM_OUTCOMES['1-4'].title, language)}
                </p>
                <p className="text-[#27345C]/80">
                  {t(AGE_CURRICULUM_OUTCOMES['1-4'].expectedOutcome, language)}
                </p>
              </div>

              {Object.values(activeChild.conceptMastery || {}).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.values(activeChild.conceptMastery || {})
                    .slice(0, 10)
                    .map((c) => {
                      const statusLabel =
                        c.status === 'well-understood'
                          ? { ar: 'متقن', en: 'Well Understood', cls: 'bg-[#55D98B]/25 text-[#27345C]' }
                          : c.needsRevision || c.status === 'needs-revision'
                            ? { ar: 'يحتاج مراجعة', en: 'Needs Revision', cls: 'bg-[#FF9360]/20 text-[#27345C]' }
                            : c.status === 'improving'
                              ? { ar: 'يتحسن', en: 'Improving', cls: 'bg-[#39BDF2]/20 text-[#27345C]' }
                              : { ar: 'قيد التدريب', en: 'Practicing', cls: 'bg-[#FFD84D]/30 text-[#27345C]' };
                      return (
                        <div
                          key={c.conceptId}
                          className="p-3 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 flex items-center justify-between gap-2"
                        >
                          <div>
                            <p className="font-bold text-sm text-[#27345C]">{t(c.label, language)}</p>
                            <p className="text-[11px] text-[#27345C]/65 font-mono-num">
                              {c.correctCount}✓ / {c.mistakesCount}↺ · {(c.completedLessonStages || []).length}{' '}
                              {language === 'ar' ? 'مراحل' : 'stages'}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-extrabold shrink-0 ${statusLabel.cls}`}>
                            {language === 'ar' ? statusLabel.ar : statusLabel.en}
                          </span>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-[#27345C]/70">
                  {language === 'ar'
                    ? 'عندما يبدأ طفلك رحلات الـ١٠ مراحل في أكاديمية نونو، ستظهر هنا تفاصيل كل مفهوم وما يحتاج لمراجعة.'
                    : 'Once your child completes multi-stage lessons in Nono’s Academy, concept-level mastery appears here.'}
                </p>
              )}
            </div>

            <div className="lg:col-span-5 nono-card rounded-3xl p-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-[#27345C]">
                  {language === 'ar'
                    ? 'أنشطة منزلية ومشتركة مع الطفل'
                    : 'Shared Parent-Child Activities'}
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('family-activities')}
                  className="px-3 py-1 rounded-xl bg-[#55D98B]/25 text-[#14532D] text-xs font-extrabold cursor-pointer"
                >
                  {language === 'ar' ? 'فتح الأنشطة' : 'Co-Play Hub'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-2xl bg-[#FFF3D1] border border-[#FFD84D]/50">
                  <p className="font-bold text-[#27345C]/70">
                    {language === 'ar' ? 'مراحل القراءة المتقنة' : 'Reading Stages'}
                  </p>
                  <p className="text-xl font-extrabold text-[#9A3412] font-mono-num mt-0.5">
                    {Object.values(activeChild.readingStageProgress || {}).filter((s) => s.mastered).length} / 8
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-[#E2F9EC] border border-[#55D98B]/40">
                  <p className="font-bold text-[#27345C]/70">
                    {language === 'ar' ? 'جلسات اللعب العائلي' : 'Family Co-Play'}
                  </p>
                  <p className="text-xl font-extrabold text-[#14532D] font-mono-num mt-0.5">
                    {(activeChild.familyActivitiesCompleted || []).length}
                  </p>
                </div>
              </div>
              <div className="space-y-2.5">
                {PARENT_OFFLINE_ACTIVITIES.map((act) => (
                  <div key={act.id} className="p-3.5 rounded-2xl bg-[#E2F9EC]/70 border border-[#55D98B]/40">
                    <p className="font-extrabold text-sm text-[#27345C]">{t(act.title, language)}</p>
                    <p className="text-xs text-[#27345C]/75 mt-1 leading-relaxed">{t(act.desc, language)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Official Exams History & Earned Certificates */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-6 nono-card rounded-3xl p-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-[#FF9360]" />
                  <span>{language === 'ar' ? 'نتائج امتحانات نونو الرسمية والتدريبية' : 'Exam Results & Attempt History'}</span>
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('exams')}
                  className="px-3 py-1.5 rounded-xl bg-[#8054D9] text-white text-xs font-bold cursor-pointer"
                >
                  {language === 'ar' ? 'فتح الامتحانات' : 'Go to Exams'}
                </button>
              </div>
              {(activeChild.examHistory || []).length === 0 ? (
                <p className="text-sm text-[#27345C]/70">
                  {language === 'ar'
                    ? 'لم يخض الطفل أي امتحان بعد. يمكنه البدء بالتدريب المجاني أو الامتحان الرسمي من ٤٠ سؤالاً.'
                    : 'No exams completed yet. Try free practice or take a 40-question official exam.'}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {(activeChild.examHistory || []).map((ex) => (
                    <div
                      key={ex.id}
                      className="p-3.5 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-extrabold text-sm text-[#27345C]">
                          {ex.subject.toUpperCase()} · {ex.mode === 'official' ? (language === 'ar' ? 'امتحان رسمي' : 'Official') : (language === 'ar' ? 'تدريب' : 'Practice')}
                        </p>
                        <p className="text-[#27345C]/65">
                          {formatDate(ex.completedAt, language)}
                          {ex.weakLessonTitles.length > 0 && !ex.passed
                            ? ` · ${language === 'ar' ? 'راجع:' : 'Revise:'} ${ex.weakLessonTitles.slice(0, 2).map((w) => t(w, language)).join(', ')}`
                            : ''}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-xl font-extrabold font-mono-num shrink-0 ${
                          ex.passed ? 'bg-[#55D98B]/25 text-[#27345C]' : 'bg-[#FF4D6D]/15 text-[#FF4D6D]'
                        }`}
                      >
                        {ex.score}/{ex.totalQuestions} ({ex.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-6 nono-card rounded-3xl p-6 space-y-3">
              <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
                <Award className="w-5 h-5 text-[#8054D9]" />
                <span>{language === 'ar' ? 'شهادات الطفل القابلة للطباعة والتحقق' : 'Child Certificates & Verification'}</span>
              </h2>
              {activeChild.certificates.length === 0 ? (
                <p className="text-sm text-[#27345C]/70">
                  {language === 'ar'
                    ? 'تصدر الشهادات تلقائياً عند إتمام العوالم أو النجاح بنسبة ٧٠٪ في الامتحان الرسمي.'
                    : 'Certificates appear here when worlds are completed or an official exam passes ≥ 70%.'}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {activeChild.certificates.map((cert) => (
                    <div
                      key={cert.id}
                      className="p-3.5 rounded-2xl bg-[#FFF8E9] border border-[#FFD84D] flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-extrabold text-sm text-[#27345C]">
                          {t(cert.achievementTitle, language)}
                        </p>
                        <p className="text-[11px] text-[#27345C]/65 font-mono-num">
                          {cert.uniqueCode} · {formatDate(cert.issuedAt, language)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCert(cert)}
                        className="px-3 py-1.5 rounded-xl bg-[#27345C] text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'عرض وطباعة' : 'View / Print'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CHILD PROFILES */}
      {tab === 'profiles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'ملفات الأطفال في العائلة' : 'Family Child Profiles'}
            </h2>
            <button
              type="button"
              onClick={() => navigate('create-child')}
              className="nono-btn-tactile px-4 py-2.5 rounded-xl bg-[#8054D9] text-white text-sm font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t(UI_COPY.createChildProfile, language)}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {childrenList.map((child) => {
              const isSelected = child.id === activeChild?.id;
              return (
                <div
                  key={child.id}
                  className={`nono-card rounded-3xl p-5 border-2 ${
                    isSelected ? 'border-[#8054D9]' : 'border-transparent'
                  } space-y-3`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-extrabold text-[#27345C]">{child.displayName}</h3>
                      <p className="text-xs font-bold text-[#8054D9]">
                        {t(getAgeGroupMeta(child.ageGroup).label, language)} ·{' '}
                        {child.language === 'ar' ? 'العربية' : 'English'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectChild(child.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                        isSelected ? 'bg-[#55D98B]/25 text-[#27345C]' : 'bg-[#27345C] text-white'
                      }`}
                    >
                      {isSelected
                        ? language === 'ar'
                          ? 'نشط الآن ✓'
                          : 'Active ✓'
                        : language === 'ar'
                          ? 'تبديل'
                          : 'Switch'}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#27345C]/10">
                    <span className="px-3 py-1 rounded-xl bg-[#8054D9]/12 border border-[#8054D9]/30 text-xs font-extrabold text-[#8054D9]">
                      🌟 {t(getAgeGroupMeta(UNIFIED_STAGE_ID).label, language)}
                    </span>
                  </div>

                  {/* Direct Student Login Setup by Parent */}
                  {authSession.authenticated && (
                    <div className="pt-3 border-t border-[#27345C]/10 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[#27345C]">
                          {language === 'ar' ? 'حساب دخول مباشر للطالب' : 'Student Exam Login'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setStudentCredChildId(studentCredChildId === child.id ? null : child.id);
                            setStudentCredMsg('');
                            setStudentCredErr('');
                          }}
                          className="text-xs font-extrabold text-[#8054D9] hover:underline cursor-pointer"
                        >
                          {studentCredChildId === child.id
                            ? language === 'ar'
                              ? 'إغلاق'
                              : 'Close'
                            : child.studentUserId
                              ? language === 'ar'
                                ? 'تحديث بيانات الدخول'
                                : 'Update Student Login'
                              : language === 'ar'
                                ? '+ إنشاء دخول للطالب'
                                : '+ Set Student Login'}
                        </button>
                      </div>

                      {studentCredChildId === child.id && (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            setStudentCredSaving(true);
                            setStudentCredErr('');
                            setStudentCredMsg('');
                            try {
                              const headers: Record<string, string> = {
                                'Content-Type': 'application/json',
                              };
                              if (authSession.csrfToken) {
                                headers['x-csrf-token'] = authSession.csrfToken;
                              }
                              const res = await fetch(
                                `/api/parent/children/${encodeURIComponent(child.id)}/student-account`,
                                {
                                  method: 'POST',
                                  credentials: 'include',
                                  headers,
                                  body: JSON.stringify({
                                    email: studentEmail,
                                    password: studentPassword,
                                  }),
                                },
                              );
                              const data = await res.json();
                              if (!res.ok) {
                                setStudentCredErr(data.error || 'Could not save student login');
                              } else {
                                setStudentCredMsg(
                                  language === 'ar'
                                    ? `تم حفظ حساب الطالب: ${data.studentUser?.email}`
                                    : `Student login saved: ${data.studentUser?.email}`,
                                );
                                setStudentEmail('');
                                setStudentPassword('');
                              }
                            } catch {
                              setStudentCredErr('Network error saving student login');
                            } finally {
                              setStudentCredSaving(false);
                            }
                          }}
                          className="space-y-2 p-3 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10"
                        >
                          <input
                            type="email"
                            value={studentEmail}
                            onChange={(e) => setStudentEmail(e.target.value)}
                            placeholder={language === 'ar' ? 'بريد دخول الطالب' : 'Student login email'}
                            className="w-full h-9 px-3 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold"
                            required
                          />
                          <input
                            type="password"
                            value={studentPassword}
                            onChange={(e) => setStudentPassword(e.target.value)}
                            placeholder={
                              language === 'ar'
                                ? 'كلمة مرور قوية (١٢+ حرفاً)'
                                : 'Strong password (12+ chars)'
                            }
                            className="w-full h-9 px-3 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold"
                            required
                          />
                          {studentCredErr && (
                            <p className="text-[11px] font-bold text-[#FF4D6D]">{studentCredErr}</p>
                          )}
                          {studentCredMsg && (
                            <p className="text-[11px] font-bold text-[#27345C]">{studentCredMsg}</p>
                          )}
                          <button
                            type="submit"
                            disabled={studentCredSaving}
                            className="w-full h-9 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold cursor-pointer"
                          >
                            {studentCredSaving
                              ? language === 'ar'
                                ? 'جاري الحفظ...'
                                : 'Saving...'
                              : language === 'ar'
                                ? 'حفظ حساب الطالب'
                                : 'Save Student Credentials'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: AUDIO, SCREEN TIME & CHILD PRIVACY */}
      {tab === 'controls' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="nono-card rounded-3xl p-6 space-y-5">
            <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-[#8054D9]" />
              <span>{language === 'ar' ? 'إعدادات الصوت والوقت' : 'Audio & Screen Time Controls'}</span>
            </h2>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 rounded-2xl bg-[#FFF8E9] cursor-pointer">
                <span className="font-bold text-sm">
                  {language === 'ar' ? 'كتم جميع الأصوات' : 'Mute All Audio'}
                </span>
                <input
                  type="checkbox"
                  checked={parentSettings.muted}
                  onChange={(e) => updateParentSettings({ muted: e.target.checked })}
                  className="w-5 h-5 accent-[#8054D9]"
                />
              </label>

              <label className="min-h-[44px] flex items-center justify-between p-3 rounded-2xl bg-[#FFF8E9] cursor-pointer">
                <span className="font-bold text-sm">
                  {language === 'ar' ? 'القراءة الصوتية للتعليمات والقصص' : 'Voice Narration for Instructions & Stories'}
                </span>
                <input
                  type="checkbox"
                  checked={parentSettings.voiceNarration}
                  onChange={(e) => updateParentSettings({ voiceNarration: e.target.checked })}
                  className="w-5 h-5 accent-[#8054D9]"
                />
              </label>

              <label className="min-h-[44px] flex items-center justify-between p-3 rounded-2xl bg-[#F4EEFF] border border-[#8054D9]/20 cursor-pointer">
                <div>
                  <span className="font-bold text-sm block text-[#27345C]">
                    {language === 'ar' ? 'تقليل الحركة (إمكانية الوصول)' : 'Reduced Motion Accessibility'}
                  </span>
                  <span className="text-xs text-[#27345C]/65">
                    {language === 'ar'
                      ? 'يوقف الاهتزازات والرسوم المتحركة المستمرة لراحة الطفل البصرية.'
                      : 'Minimizes animations and floating motion across the platform.'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(parentSettings.reducedMotion)}
                  onChange={(e) => updateParentSettings({ reducedMotion: e.target.checked })}
                  className="w-5 h-5 accent-[#8054D9] shrink-0"
                />
              </label>

              {/* Per-Child Nono AI Companion Control */}
              {activeChild && (
              <div className="p-3.5 rounded-2xl bg-[#E5F6FF]/70 border border-[#39BDF2]/30 space-y-2">
                <label className="min-h-[44px] flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <span className="font-extrabold text-sm block text-[#27345C]">
                      {language === 'ar'
                        ? `مساعد نونو الذكي (${activeChild.displayName})`
                        : `Nono AI Assistant (${activeChild.displayName})`}
                    </span>
                    <span className="text-xs text-[#27345C]/70">
                      {language === 'ar'
                        ? 'مقيّد بالمنهج التعليمي وبحد أقصى ٤٠ رسالة يومياً ويمنع طلب أي معلومات شخصية أو مشتريات.'
                        : 'Curriculum-scoped, PII-filtered, 40 msg/day cap, zero open browsing or purchases.'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={aiToggleSaving}
                    checked={activeChild.aiAssistantEnabled !== false}
                    onChange={async (e) => {
                      const nextVal = e.target.checked;
                      setAiToggleSaving(true);
                      setAiToggleMsg('');
                      const res = await toggleChildAiAssistant(activeChild.id, nextVal);
                      setAiToggleSaving(false);
                      if (res.ok) {
                        soundEngine.playPop();
                        setAiToggleMsg(
                          nextVal
                            ? language === 'ar'
                              ? 'تم تفعيل مساعد نونو الذكي لهذا الطفل ✓'
                              : 'Nono AI enabled for this child ✓'
                            : language === 'ar'
                              ? 'تم إيقاف مساعد نونو الذكي لهذا الطفل ✓'
                              : 'Nono AI paused for this child ✓',
                        );
                      } else {
                        setAiToggleMsg(res.error || 'Error updating AI preference');
                      }
                    }}
                    className="w-5 h-5 accent-[#8054D9] shrink-0"
                  />
                </label>
                {aiToggleMsg && (
                  <p className="text-xs font-extrabold text-[#14532D] bg-[#E2F9EC] px-2.5 py-1.5 rounded-xl">
                    {aiToggleMsg}
                  </p>
                )}
              </div>
              )}

              <div>
                <div className="flex justify-between text-sm font-bold mb-1">
                  <span>{language === 'ar' ? 'مستوى المؤثرات الصوتية' : 'Sound Effects Volume'}</span>
                  <span className="font-mono-num">{Math.round(parentSettings.sfxVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={parentSettings.sfxVolume}
                  onChange={(e) => updateParentSettings({ sfxVolume: Number(e.target.value) })}
                  className="w-full accent-[#8054D9]"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm font-bold mb-1">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#FF9360]" />
                    {language === 'ar' ? 'الحد اليومي المقترح للشاشة' : 'Daily Screen-Time Preference'}
                  </span>
                  <span className="font-mono-num">{parentSettings.dailyScreenTimeMinutes} min</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={90}
                  step={15}
                  value={parentSettings.dailyScreenTimeMinutes}
                  onChange={(e) =>
                    updateParentSettings({ dailyScreenTimeMinutes: Number(e.target.value) })
                  }
                  className="w-full accent-[#FF9360]"
                />
              </div>
            </div>
          </div>

          <div className="nono-card rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#55D98B]" />
              <span>{language === 'ar' ? 'أمان الطفل والخصوصية' : 'Child Safety & Privacy Controls'}</span>
            </h2>
            <ul className="space-y-2.5 text-sm text-[#27345C]/80">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#55D98B] shrink-0" />
                <span>
                  {language === 'ar'
                    ? 'لا توجد ملفات عامة للأطفال ولا محادثات مفتوحة مع غرباء.'
                    : 'No public child profiles, no open chat, and zero stranger interaction.'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#55D98B] shrink-0" />
                <span>
                  {language === 'ar'
                    ? 'لا يتم طلب الميكروفون أو الكاميرا لاستخدام التطبيق.'
                    : 'Microphone and camera permissions are never required for normal play.'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#55D98B] shrink-0" />
                <span>
                  {authSession.authenticated && authSession.user
                    ? language === 'ar'
                      ? `متصل بحساب الأهل الموثّق (${authSession.user.email}) · جلسات نشطة: ${activeSessionsCount}`
                      : `Signed in as ${authSession.user.email} · Active sessions: ${activeSessionsCount}`
                    : language === 'ar'
                      ? 'في وضع المعاينة المحلي؛ سجّل حساب الأهل لتفعيل المزامنة وحماية الجلسات على الخادم.'
                      : 'Running in local preview; register a Parent Account to activate server-backed auth & audit logs.'}
                </span>
              </li>
            </ul>

            {authSession.authenticated && (
              <div className="space-y-3 pt-2 border-t border-[#27345C]/10">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void logoutParent()}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 text-[#27345C] text-xs font-extrabold cursor-pointer"
                  >
                    {language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void logoutAllDevices()}
                    className="px-3.5 py-2 rounded-xl bg-[#FF9360]/18 text-[#27345C] text-xs font-extrabold cursor-pointer"
                  >
                    {language === 'ar' ? 'تسجيل الخروج من جميع الأجهزة' : 'Log Out All Devices'}
                  </button>
                </div>
                {securityLogs.length > 0 && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    <p className="text-xs font-extrabold text-[#27345C]/70">
                      {language === 'ar' ? 'سجل الأمان الأخير' : 'Recent Account Security Log'}
                    </p>
                    {securityLogs.slice(0, 6).map((lg) => (
                      <div key={lg.id} className="p-2 rounded-xl bg-[#FFF8E9] text-[11px] flex justify-between gap-2">
                        <span className="font-bold text-[#27345C]">{lg.eventType}</span>
                        <span className="text-[#27345C]/65 truncate">{lg.summary}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-[#27345C]/10">
              <button
                type="button"
                onClick={resetAllData}
                className="px-4 py-2 rounded-xl bg-[#FF4D6D]/12 text-[#FF4D6D] text-xs font-extrabold cursor-pointer hover:bg-[#FF4D6D]/20"
              >
                {language === 'ar' ? 'إعادة ضبط البيانات التجريبية' : 'Reset Local Demo Data'}
              </button>
            </div>
          </div>

          {/* Learning Schedule & Parent Notifications Preferences */}
          {activeChild && (
          <div className="lg:col-span-2 nono-card rounded-3xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#8054D9]" />
                  <span>
                    {language === 'ar'
                      ? 'جدول التعلم الأسبوعي وتفضيلات التنبيهات'
                      : 'Weekly Learning Schedule & Notification Controls'}
                  </span>
                </h2>
                <p className="text-xs text-[#27345C]/70">
                  {language === 'ar'
                    ? `مخصص للطفل: ${activeChild.displayName}`
                    : `Saved per child profile: ${activeChild.displayName}`}
                </p>
              </div>
              <button
                type="button"
                disabled={savingSchedule}
                onClick={async () => {
                  setSavingSchedule(true);
                  setScheduleMsg('');
                  try {
                    await saveLearningPlan({ parentSchedule: scheduleDraft });
                    soundEngine.playSuccess();
                    setScheduleMsg(
                      language === 'ar'
                        ? 'تم حفظ جدول التعلم والتنبيهات ✓'
                        : 'Learning schedule & preferences saved ✓',
                    );
                  } finally {
                    setSavingSchedule(false);
                  }
                }}
                className="nono-btn-tactile min-h-[44px] px-4 rounded-xl bg-[#8054D9] text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{language === 'ar' ? 'حفظ الجدول' : 'Save Schedule'}</span>
              </button>
            </div>

            {scheduleMsg && (
              <p className="text-xs font-extrabold text-[#166534] bg-[#E2F9EC] px-3 py-2 rounded-xl">
                {scheduleMsg}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <p className="text-xs font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'الأيام المفضلة للتعلم' : 'Preferred Learning Days'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const).map((day) => {
                    const active = scheduleDraft.preferredDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          setScheduleDraft((prev) => ({
                            ...prev,
                            preferredDays: active
                              ? prev.preferredDays.filter((d) => d !== day)
                              : [...prev.preferredDays, day],
                          }))
                        }
                        className={`min-h-[40px] px-3 rounded-xl text-xs font-extrabold border cursor-pointer uppercase ${
                          active
                            ? 'bg-[#8054D9] text-white border-[#8054D9]'
                            : 'bg-white border-[#27345C]/15 text-[#27345C]'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>{language === 'ar' ? 'الهدف اليومي المقترح' : 'Daily Learning Goal'}</span>
                    <span className="font-mono-num">{scheduleDraft.dailyGoalMinutes} min</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={60}
                    step={5}
                    value={scheduleDraft.dailyGoalMinutes}
                    onChange={(e) =>
                      setScheduleDraft((prev) => ({ ...prev, dailyGoalMinutes: Number(e.target.value) }))
                    }
                    className="w-full accent-[#8054D9]"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center justify-between p-3 rounded-2xl bg-[#FFF8E9] cursor-pointer text-xs font-bold">
                  <span>{language === 'ar' ? 'ملخص أسبوعي لتطور الطفل' : 'Weekly Progress Summary'}</span>
                  <input
                    type="checkbox"
                    checked={scheduleDraft.weeklySummaryEmail}
                    onChange={(e) =>
                      setScheduleDraft((prev) => ({ ...prev, weeklySummaryEmail: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#8054D9]"
                  />
                </label>
                <label className="flex items-center justify-between p-3 rounded-2xl bg-[#FFF8E9] cursor-pointer text-xs font-bold">
                  <span>{language === 'ar' ? 'تنبيهات الإنجازات والشهادات' : 'Achievement & Certificate Alerts'}</span>
                  <input
                    type="checkbox"
                    checked={scheduleDraft.achievementAlerts}
                    onChange={(e) =>
                      setScheduleDraft((prev) => ({ ...prev, achievementAlerts: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#8054D9]"
                  />
                </label>
                <label className="flex items-center justify-between p-3 rounded-2xl bg-[#FFF8E9] text-xs font-bold">
                  <span>{language === 'ar' ? 'وقت التذكير اليومي' : 'Preferred Reminder Time'}</span>
                  <input
                    type="time"
                    value={scheduleDraft.reminderTime}
                    onChange={(e) =>
                      setScheduleDraft((prev) => ({ ...prev, reminderTime: e.target.value }))
                    }
                    className="h-9 px-2 rounded-xl bg-white border border-[#27345C]/15 font-mono-num"
                  />
                </label>
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      {/* TAB 4: OFFLINE CONTENT & FREEMIUM SUBSCRIPTION */}
      {tab === 'offline' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="nono-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
                {isOnline ? <Wifi className="w-5 h-5 text-[#55D98B]" /> : <WifiOff className="w-5 h-5 text-[#FF9360]" />}
                <span>{language === 'ar' ? 'المحتوى المحمّل والمزامنة' : 'Downloaded Worlds & Offline Sync'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setSimulatedOffline(!simulatedOffline)}
                className="px-3 py-1.5 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-xs font-bold cursor-pointer"
              >
                {simulatedOffline
                  ? language === 'ar'
                    ? 'استعادة الاتصال'
                    : 'Go Online'
                  : language === 'ar'
                    ? 'تجربة وضع عدم الاتصال'
                    : 'Test Offline Mode'}
              </button>
            </div>

            {pendingSyncCount > 0 && (
              <div className="p-3 rounded-2xl bg-[#FFD84D]/25 flex items-center justify-between text-xs font-bold">
                <span>
                  {language === 'ar'
                    ? `يوجد ${pendingSyncCount} نشاط محفوظ محلياً بانتظار المزامنة`
                    : `${pendingSyncCount} queued attempt(s) saved locally`}
                </span>
                {isOnline && (
                  <button
                    type="button"
                    onClick={() => void syncOfflineQueue()}
                    className="min-h-[38px] px-3 py-1 rounded-lg bg-[#27345C] text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{language === 'ar' ? 'مزامنة الآن' : 'Sync Now'}</span>
                  </button>
                )}
              </div>
            )}

            <div className="p-3 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 space-y-2 text-xs">
              <div className="flex items-center justify-between font-extrabold text-[#27345C]">
                <span>{language === 'ar' ? 'سجل المزامنة والعمل دون إنترنت' : 'Offline Activity Queue Status'}</span>
                {lastSyncedAt && (
                  <span className="text-[11px] font-bold text-[#27345C]/65 tabular-nums">
                    {language === 'ar' ? 'آخر مزامنة:' : 'Last synced:'} {new Date(lastSyncedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
              {offlineQueue.length === 0 ? (
                <p className="text-[#27345C]/65 font-bold">
                  {language === 'ar'
                    ? 'جميع الأنشطة متزامنة ولا توجد عناصر معلّقة.'
                    : 'All recorded activities are synced cleanly.'}
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1.5">
                  {offlineQueue.slice(-8).reverse().map((q) => (
                    <div key={q.idempotencyKey} className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#27345C]/10">
                      <span className="font-bold text-[#27345C]">
                        {String(q.payload.activityId || q.kind)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg font-extrabold ${
                          q.status === 'synced'
                            ? 'bg-[#55D98B]/25 text-[#14532D]'
                            : 'bg-[#FFD84D]/40 text-[#78350F]'
                        }`}
                      >
                        {q.status === 'synced'
                          ? language === 'ar'
                            ? 'تمت المزامنة ✓'
                            : 'Synced to Server ✓'
                          : language === 'ar'
                            ? 'محفوظ محلياً'
                            : 'Saved Locally'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {LEARNING_WORLDS.map((w) => {
                const downloaded = Boolean(activeChild?.downloadedWorldIds.includes(w.id));
                return (
                  <button
                    key={w.id}
                    type="button"
                    disabled={!activeChild}
                    onClick={() => toggleDownloadWorld(w.id)}
                    className={`p-3 rounded-2xl border text-start flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50 ${
                      downloaded ? 'bg-[#55D98B]/15 border-[#55D98B]' : 'bg-white border-[#27345C]/12'
                    }`}
                  >
                    <span className="text-xs font-bold text-[#27345C] truncate">
                      {w.guardianEmoji} {t(w.name, language)}
                    </span>
                    <span className="text-[11px] font-extrabold shrink-0">
                      {downloaded ? '✓' : '+'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Freemium Subscription Screen (Parent-Controlled) */}
          <div className="nono-card rounded-3xl p-6 space-y-4">
            <div>
              <h2 className="text-xl font-extrabold text-[#27345C]">
                {language === 'ar' ? 'باقات نونو لاند (تحكم الأهل فقط)' : 'NonoLand Plans (Parent-Controlled)'}
              </h2>
              <p className="text-xs text-[#27345C]/70 mt-1">
                {language === 'ar'
                  ? 'المحتوى الأساسي متاح مجاناً دائماً. واجهة الباقات هنا للمعاينة بدون بوابة دفع مفعّلة.'
                  : 'Core learning worlds are free. Billing gateway is not connected in this preview environment.'}
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                { id: 'free' as const, ar: 'الباقة المجانية — استكشاف العوالم الأساسية', en: 'Free — Core 10 Worlds & Activities' },
                { id: 'monthly' as const, ar: 'الاشتراك الشهري — قصص ومسارات متقدمة', en: 'Monthly — Extended Stories & Paths' },
                { id: 'quarterly' as const, ar: 'الاشتراك ربع السنوي — تقارير موسعة', en: 'Quarterly — Extended Family Reports' },
                { id: 'annual' as const, ar: 'الاشتراك السنوي — التجربة العائلية الكاملة', en: 'Annual — Full Family Universe' },
              ].map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => updateSubscription(plan.id)}
                  className={`w-full p-3.5 rounded-2xl border-2 text-start flex items-center justify-between cursor-pointer ${
                    subscription.tier === plan.id
                      ? 'border-[#8054D9] bg-[#8054D9]/10'
                      : 'border-[#27345C]/10 bg-white'
                  }`}
                >
                  <span className="font-bold text-sm text-[#27345C]">
                    {language === 'ar' ? plan.ar : plan.en}
                  </span>
                  {subscription.tier === plan.id && <Check className="w-4 h-4 text-[#8054D9]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CURATED YOUTUBE & CONTENT MANAGER (@Future-p6l) */}
      {tab === 'youtube' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 nono-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
                <Film className="w-5 h-5 text-[#FF4D6D]" />
                <span>{language === 'ar' ? 'إضافة فيديو معتمد' : 'Add Verified YouTube Video'}</span>
              </h2>
              <a
                href={OFFICIAL_YOUTUBE_CHANNEL.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-[#8054D9] flex items-center gap-1 hover:underline"
              >
                <span>@Future-p6l</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="p-3 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 text-xs text-[#27345C]/80">
              {ytApiConfigured
                ? language === 'ar'
                  ? 'حالة الخادم: YOUTUBE_API_KEY مفعّل — يتم جلب المقاطع الرسمية وتظهر في منطقة المرح.'
                  : 'Server status: YOUTUBE_API_KEY is configured and fetching official uploads.'
                : language === 'ar'
                  ? 'حالة الخادم: YOUTUBE_API_KEY غير مضبوط. يمكنك إضافة روابط أو معرّفات الفيديوهات الحقيقية يدوياً هنا لتظهر لطفلك بأمان.'
                  : 'Server status: YOUTUBE_API_KEY is not set. Add verified video URLs or IDs manually below to publish them safely to your child.'}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsedId = extractYouTubeId(ytInput);
                if (!parsedId) {
                  setYtError(
                    language === 'ar'
                      ? 'يرجى إدخال رابط يوتيوب صحيح أو معرّف فيديو مكوّن من ١١ حرفاً.'
                      : 'Please enter a valid YouTube URL or 11-character Video ID.',
                  );
                  return;
                }
                addCuratedVideo({
                  videoId: parsedId,
                  title: {
                    ar: ytTitleAr.trim() || ytTitleEn.trim() || 'فيديو نونو لاند',
                    en: ytTitleEn.trim() || ytTitleAr.trim() || 'NonoLand Video',
                  },
                  category: ytCategory,
                  ageGroups: ['1-4'],
                  approvedByParent: true,
                  featured: false,
                });
                soundEngine.playSuccess();
                setYtInput('');
                setYtTitleAr('');
                setYtTitleEn('');
                setYtError('');
              }}
              className="space-y-3"
            >
              <input
                type="text"
                value={ytInput}
                onChange={(e) => setYtInput(e.target.value)}
                placeholder={language === 'ar' ? 'رابط الفيديو أو Video ID (11 حرفاً)' : 'YouTube URL or 11-char Video ID'}
                className="w-full h-11 px-3.5 rounded-xl bg-white border-2 border-[#27345C]/15 text-sm"
                required
              />
              <input
                type="text"
                value={ytTitleAr}
                onChange={(e) => setYtTitleAr(e.target.value)}
                placeholder={language === 'ar' ? 'عنوان الفيديو بالعربية' : 'Arabic Title'}
                className="w-full h-11 px-3.5 rounded-xl bg-white border-2 border-[#27345C]/15 text-sm"
              />
              <input
                type="text"
                value={ytTitleEn}
                onChange={(e) => setYtTitleEn(e.target.value)}
                placeholder={language === 'ar' ? 'عنوان الفيديو بالإنجليزية' : 'English Title'}
                className="w-full h-11 px-3.5 rounded-xl bg-white border-2 border-[#27345C]/15 text-sm"
              />
              <select
                value={ytCategory}
                onChange={(e) => setYtCategory(e.target.value as YouTubeCategory)}
                className="w-full h-11 px-3.5 rounded-xl bg-white border-2 border-[#27345C]/15 text-sm font-bold"
              >
                <option value="stories">{language === 'ar' ? 'قصص' : 'Stories'}</option>
                <option value="cartoons">{language === 'ar' ? 'رسوم تعليمية' : 'Educational Cartoons'}</option>
                <option value="songs">{language === 'ar' ? 'أغاني أصلية' : 'Original Songs'}</option>
                <option value="adventures">{language === 'ar' ? 'مغامرات' : 'Adventures'}</option>
              </select>
              {ytError && <p className="text-xs font-bold text-[#FF4D6D]">{ytError}</p>}
              <button
                type="submit"
                className="w-full nono-btn-tactile h-11 rounded-xl bg-[#8054D9] text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'ar' ? 'إضافة واعتماد الفيديو' : 'Add & Approve Video'}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 nono-card rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'قائمة الفيديوهات المعتمدة للأطفال' : 'Curated Child-Safe Video List'}
            </h2>
            {curatedVideos.length === 0 ? (
              <p className="text-sm text-[#27345C]/70">
                {language === 'ar'
                  ? 'لا توجد فيديوهات مضافة يدوياً بعد. أضف رابط فيديو من قناة نونو لاند الرسمية ليظهر في منطقة المرح.'
                  : 'No manually curated videos yet. Add a verified video link on the left to publish it inside Nono’s Fun Zone.'}
              </p>
            ) : (
              <div className="space-y-3">
                {curatedVideos.map((vid) => (
                  <div
                    key={vid.id}
                    className="p-3.5 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/12 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-extrabold text-sm text-[#27345C]">{t(vid.title, language)}</p>
                      <p className="text-xs text-[#27345C]/65 font-mono-num">
                        ID: {vid.videoId} · {vid.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleApproveVideo(vid.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                          vid.approvedByParent ? 'bg-[#55D98B] text-[#27345C]' : 'bg-slate-200 text-[#27345C]/70'
                        }`}
                      >
                        {vid.approvedByParent
                          ? language === 'ar'
                            ? 'معتمد ✓'
                            : 'Approved ✓'
                          : language === 'ar'
                            ? 'مخفي'
                            : 'Hidden'}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFeatureVideo(vid.id)}
                        aria-label="Toggle featured"
                        className={`p-2 rounded-xl cursor-pointer ${
                          vid.featured ? 'bg-[#FFD84D] text-[#27345C]' : 'bg-white border border-slate-200'
                        }`}
                      >
                        <Star className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCuratedVideo(vid.id)}
                        aria-label="Remove video"
                        className="p-2 rounded-xl bg-[#FF4D6D]/12 text-[#FF4D6D] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedCert && (
        <CertificateModal
          certificate={selectedCert}
          language={language}
          onClose={() => setSelectedCert(null)}
        />
      )}

      {logoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="nono-card rounded-3xl p-6 bg-white max-w-sm w-full space-y-4 text-center">
            <h2 className="text-lg font-extrabold text-[#27345C]">
              {language === 'ar' ? 'تأكيد تسجيل الخروج' : 'Confirm Log Out'}
            </h2>
            <p className="text-xs font-bold text-[#27345C]/75">
              {language === 'ar'
                ? 'هل تريد تسجيل الخروج من حساب ولي الأمر؟ سيتم مسح بيانات الجلسة المحلية بأمان.'
                : 'Are you sure you want to log out? Local cache and your active session will be cleared securely.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLogoutModalOpen(false)}
                className="flex-1 h-11 rounded-2xl bg-slate-100 text-[#27345C] font-extrabold text-xs cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLogoutModalOpen(false);
                  void logoutParent();
                }}
                className="flex-1 h-11 rounded-2xl bg-[#FF4D6D] text-white font-extrabold text-xs cursor-pointer"
              >
                {language === 'ar' ? 'نعم، تسجيل الخروج' : 'Yes, Log Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
