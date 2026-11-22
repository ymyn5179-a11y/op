import React, { useState } from 'react';
import { motion } from 'motion/react';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Fingerprint,
  GraduationCap,
  KeyRound,
  MailCheck,
  Plus,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { CinematicWelcomeIntro, INTRO_SKIP_STORAGE_KEY } from '../components/CinematicWelcomeIntro';
import { LegalDocumentsModal } from '../components/LegalDocumentsModal';
import { NonoCharacter } from '../components/NonoCharacter';
import { NonoLandLogo } from '../components/NonoLandLogo';
import { useNonoLand } from '../context/NonoLandContext';
import { CHARACTER_COMPANIONS } from '../data/rewardsAndRoom';
import { getAgeGroupMeta, t, UI_COPY } from '../i18n/translations';
import { AgeGroupId, ChildProfile, Language } from '../types/nonoland';
import { UNIFIED_STAGE_ID } from '../utils/ageAdaptation';
import { soundEngine } from '../utils/soundEngine';
import {
  formatApiErrorMessage,
  POLICY_VERSION,
  validateChildProfileInput,
  validateEmail,
  validateParentName,
  validatePassword,
} from '../utils/validation';

export const SplashScreen: React.FC = () => {
  return <CinematicWelcomeIntro />;
};

export const OnboardingScreen: React.FC = () => {
  const { navigate, language } = useNonoLand();
  const [step, setStep] = useState(0);

  const slides = [
    {
      emoji: '✨',
      isBrandSlide: true,
      title: { ar: 'عالم موحد للمستكشفين الصغار (١–٤ سنوات)', en: 'One Unified World: Little Explorers (1–4 Years)' },
      body: {
        ar: 'تجربة واحدة دافئة تتكيف داخلياً مع عمر الطفل: استكشاف حسي وأصوات لعمر ١–٢ سنة، مفردات وفرز لعمر ٢–٣ سنوات، وحروف وأرقام وقصص لعمر ٣–٤ سنوات.',
        en: 'One unified world that gently adapts inside: sensory play & sounds for 1–2 yrs, vocabulary & sorting for 2–3 yrs, and early letters, patterns & stories for 3–4 yrs.',
      },
      color: 'from-[#8054D9]/15 to-[#FF78B7]/15',
    },
    {
      emoji: '🧭🔬',
      title: { ar: 'مسار ذكي يتكيف مع طفلك', en: 'Adaptive Learning That Adapts to Your Child' },
      body: {
        ar: 'مختبر نونو للاكتشاف يلاحظ المهارات القوية والمهارات التي تحتاج لتدريب لطيف، ويقترح الخطوة التالية دون أي مقارنة أو ضغط.',
        en: "Nono's Discovery Lab observes strengths and gentle practice areas, tailoring the next adventure with zero exam stress.",
      },
      color: 'from-[#39BDF2]/15 to-[#55D98B]/15',
    },
    {
      emoji: '🛡️🏆',
      title: { ar: 'أمان تام، غرف إبداعية، وشهادات', en: 'Parent-Gated Safety, My Room & Certificates' },
      body: {
        ar: 'لا إعلانات ولا تواصل مع غرباء. يحصل الطفل على نجوم وأوسمة وشهادات قابلة للطباعة، ويزيّن غرفته الخاصة بإنجازاته.',
        en: 'Zero ads or public profiles. Children decorate My Room with earned rewards and unlock printable world certificates.',
      },
      color: 'from-[#FFD84D]/25 to-[#FF9360]/15',
    },
  ];

  const current = slides[step];

  return (
    <div className="min-h-screen bg-[#FFF8E9] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl nono-card rounded-3xl p-6 sm:p-10 text-center">
        <div className="flex justify-center mb-4">
          <NonoLandLogo variant="compact" size="sm" language={language} />
        </div>
        <div className={`rounded-3xl bg-gradient-to-br ${current.color} p-8 mb-6`}>
          {'isBrandSlide' in current && current.isBrandSlide ? (
            <div className="flex justify-center mb-4">
              <NonoLandLogo variant="main" size="sm" showWordmark={false} language={language} />
            </div>
          ) : (
            <div className="text-6xl mb-4">{current.emoji}</div>
          )}
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#27345C] text-balance">
            {t(current.title, language)}
          </h2>
          <p className="text-[#27345C]/80 mt-3 text-base sm:text-lg leading-relaxed">
            {t(current.body, language)}
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-6">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setStep(idx)}
              aria-label={`Slide ${idx + 1}`}
              className={`h-3 rounded-full transition-all cursor-pointer ${
                idx === step ? 'w-10 bg-[#8054D9]' : 'w-3 bg-[#27345C]/20'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('splash')}
            className="px-4 py-3 rounded-2xl text-sm font-bold text-[#27345C]/70 hover:text-[#27345C] cursor-pointer"
          >
            {language === 'ar' ? 'رجوع' : 'Back'}
          </button>

          {step < slides.length - 1 ? (
            <button
              type="button"
              onClick={() => {
                soundEngine.playPop();
                setStep(step + 1);
              }}
              className="nono-btn-tactile px-7 py-3 rounded-2xl bg-[#8054D9] text-white font-bold cursor-pointer"
            >
              {language === 'ar' ? 'التالي' : 'Next'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('parent-auth')}
              className="nono-btn-tactile px-7 py-3 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold cursor-pointer"
            >
              {language === 'ar' ? 'متابعة لإعداد الحساب' : 'Continue to Family Setup'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const ParentAuthScreen: React.FC = () => {
  const {
    navigate,
    language,
    parentAccount,
    refreshAuthSession,
    authSession,
    dbUnavailable,
    loginWithPassword,
    loginWithPasskey,
    childLogin,
    childQuickLogin,
    enterSampleDemoMode,
  } = useNonoLand();
  const [entryPortal, setEntryPortal] = useState<'parent' | 'teacher' | 'child' | 'admin'>('parent');
  const [mode, setMode] = useState<
    'register' | 'teacher-login' | 'teacher-register' | 'admin-login' | 'admin-bootstrap' | 'login' | 'forgot' | 'reset'
  >('login');
  const [name, setName] = useState(parentAccount?.isDemoMode ? '' : parentAccount?.name || '');
  const [email, setEmail] = useState(parentAccount?.isDemoMode ? '' : parentAccount?.email || '');
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>(['arabic', 'english', 'math']);
  const [setupSecret, setSetupSecret] = useState('');
  const [adminBootstrapStatus, setAdminBootstrapStatus] = useState<{
    loading: boolean;
    initialized: boolean;
    setupConfigured: boolean;
  }>({ loading: false, initialized: true, setupConfigured: false });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [verifyTokenInput, setVerifyTokenInput] = useState('');
  const [devNotice, setDevNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [legalDocOpen, setLegalDocOpen] = useState<'privacy' | 'terms' | null>(null);

  // Child Login state
  const [childAccessCode, setChildAccessCode] = useState('');
  const [childPin, setChildPin] = useState('');
  const [trustedProfiles, setTrustedProfiles] = useState<
    Array<{ id: string; displayName: string; ageGroup: string }>
  >([]);
  const [trustedDeviceName, setTrustedDeviceName] = useState('');
  const [selectedQuickChildId, setSelectedQuickChildId] = useState<string | null>(null);

  React.useEffect(() => {
    if (entryPortal !== 'child') return;
    let active = true;
    fetch('/api/auth/trusted-device-profiles', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return;
        if (d.trusted && Array.isArray(d.profiles)) {
          setTrustedProfiles(d.profiles);
          setTrustedDeviceName(d.deviceName || '');
        } else {
          setTrustedProfiles([]);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [entryPortal]);

  React.useEffect(() => {
    if (entryPortal !== 'admin') return;
    let active = true;
    setAdminBootstrapStatus((prev) => ({ ...prev, loading: true }));
    fetch('/api/auth/admin-bootstrap/status', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        if (d && typeof d.initialized === 'boolean') {
          setAdminBootstrapStatus({
            loading: false,
            initialized: d.initialized,
            setupConfigured: Boolean(d.setupConfigured),
          });
          if (d.initialized && mode === 'admin-bootstrap') {
            setMode('admin-login');
          }
        } else {
          setAdminBootstrapStatus({ loading: false, initialized: true, setupConfigured: false });
        }
      })
      .catch(() => {
        if (active) {
          setAdminBootstrapStatus({ loading: false, initialized: true, setupConfigured: false });
        }
      });
    return () => {
      active = false;
    };
  }, [entryPortal, mode]);

  const pwEval = validatePassword(password, email, name);

  const handleChildKeypadDigit = (digit: string) => {
    soundEngine.playPop();
    setChildPin((prev) => (prev.length < 6 ? `${prev}${digit}` : prev));
  };

  const handleChildSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const res = selectedQuickChildId
        ? await childQuickLogin(selectedQuickChildId, childPin)
        : await childLogin(childAccessCode, childPin);
      if (!res.ok) {
        setErrorMsg(
          res.error ||
            (language === 'ar' ? 'رمز الدخول أو الرقم السري غير صحيح.' : 'Invalid child access code or PIN.'),
        );
        soundEngine.playEncourage();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setDevNotice('');

    if (mode === 'teacher-register') {
      const nCheck = validateParentName(name);
      if (!nCheck.ok) return setErrorMsg(nCheck.error || 'Invalid teacher name');
      const eCheck = validateEmail(email);
      if (!eCheck.ok) return setErrorMsg(eCheck.error || 'Invalid email');
      if (!pwEval.ok) return setErrorMsg(pwEval.error || 'Weak password');
      if (password !== confirmPassword) {
        return setErrorMsg(
          language === 'ar' ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.',
        );
      }
      if (!termsAccepted) {
        return setErrorMsg(
          language === 'ar' ? 'يرجى الموافقة على شروط المنصة.' : 'Please accept platform terms.',
        );
      }
      setSubmitting(true);
      try {
        const res = await fetch('/api/auth/register-teacher', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: name,
            email,
            subjects: teacherSubjects,
            password,
            confirmPassword,
            termsAccepted: true,
            policyVersion: POLICY_VERSION,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorMsg(
            formatApiErrorMessage(
              res.status,
              data,
              language,
              'Teacher registration failed',
              'تعذر إرسال طلب حساب المعلم.',
            ),
          );
          soundEngine.playEncourage();
          return;
        }
        soundEngine.playSuccess();
        setPassword('');
        setConfirmPassword('');
        setMode('teacher-login');
        setDevNotice(
          language === 'ar'
            ? 'تم استلام طلب حساب المعلم بنجاح! الحساب قيد مراجعة وموافقة الإدارة قبل التفعيل.'
            : 'Teacher account request submitted! Pending administrator approval before login.',
        );
      } catch {
        setErrorMsg(language === 'ar' ? 'تعذر الاتصال بالخادم.' : 'Network error.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'admin-bootstrap') {
      if (!setupSecret.trim()) {
        return setErrorMsg(
          language === 'ar'
            ? 'أدخل مفتاح التهيئة السري (NONOLAND_ADMIN_SETUP_SECRET).'
            : 'Enter the server setup secret (NONOLAND_ADMIN_SETUP_SECRET).',
        );
      }
      const nCheck = validateParentName(name);
      if (!nCheck.ok) return setErrorMsg(nCheck.error || 'Invalid administrator name');
      const eCheck = validateEmail(email);
      if (!eCheck.ok) return setErrorMsg(eCheck.error || 'Invalid email');
      if (!pwEval.ok) return setErrorMsg(pwEval.error || 'Weak password');
      if (password !== confirmPassword) {
        return setErrorMsg(
          language === 'ar' ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.',
        );
      }

      setSubmitting(true);
      try {
        const res = await fetch('/api/auth/admin-bootstrap', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            setupSecret: setupSecret.trim(),
            displayName: name,
            email,
            password,
            confirmPassword,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorMsg(
            formatApiErrorMessage(
              res.status,
              data,
              language,
              'Super Admin bootstrap failed',
              'تعذر إكمال تهيئة المشرف العام.',
            ),
          );
          if (data.initialized) {
            setAdminBootstrapStatus({ loading: false, initialized: true, setupConfigured: false });
            setMode('admin-login');
          }
          soundEngine.playEncourage();
          return;
        }
        setSetupSecret('');
        setPassword('');
        setConfirmPassword('');
        setAdminBootstrapStatus({ loading: false, initialized: true, setupConfigured: false });
        const synced = await refreshAuthSession();
        soundEngine.playSuccess();
        if (synced?.authenticated && synced.user?.role === 'super_admin') {
          navigate('admin-dashboard');
        } else {
          setMode('admin-login');
          setDevNotice(
            language === 'ar'
              ? 'تم إنشاء حساب المشرف العام بنجاح! يمكنك تسجيل الدخول الآن.'
              : 'First Super Admin initialized! Sign in with your new credentials.',
          );
        }
      } catch {
        setErrorMsg(language === 'ar' ? 'تعذر الاتصال بالخادم.' : 'Network error.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'register') {
      const nCheck = validateParentName(name);
      if (!nCheck.ok) return setErrorMsg(nCheck.error || 'Invalid parent name');
      const eCheck = validateEmail(email);
      if (!eCheck.ok) return setErrorMsg(eCheck.error || 'Invalid email');
      if (!pwEval.ok) return setErrorMsg(pwEval.error || 'Weak password');
      if (password !== confirmPassword) {
        return setErrorMsg(
          language === 'ar' ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.',
        );
      }
      if (!termsAccepted) {
        return setErrorMsg(
          language === 'ar'
            ? 'يرجى الموافقة الصريحة على سياسة الخصوصية وشروط الاستخدام.'
            : 'Please accept the Privacy Policy and Terms of Use.',
        );
      }

      setSubmitting(true);
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: name,
            email,
            password,
            termsAccepted: true,
            policyVersion: POLICY_VERSION,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorMsg(
            formatApiErrorMessage(
              res.status,
              data,
              language,
              'Registration failed',
              'تعذر إنشاء حساب ولي الأمر.',
            ),
          );
          soundEngine.playEncourage();
          return;
        }
        const synced = await refreshAuthSession();
        soundEngine.playSuccess();
        if (data.devVerificationToken) {
          setVerifyTokenInput(data.devVerificationToken);
          setDevNotice(
            language === 'ar'
              ? `تم إنشاء حساب ولي الأمر! رمز التحقق التجريبي للبريد: ${data.devVerificationToken}`
              : `Parent account created! Dev email verification token: ${data.devVerificationToken}`,
          );
        } else if (synced?.authenticated && synced.user?.role === 'parent') {
          navigate('parent-dashboard');
        } else {
          setErrorMsg(
            language === 'ar'
              ? 'تم إنشاء الحساب، لكن تعذر تأكيد الجلسة تلقائياً. يرجى تسجيل الدخول.'
              : 'Account created, but session confirmation failed. Please sign in.',
          );
        }
      } catch {
        setErrorMsg(language === 'ar' ? 'تعذر الاتصال بالخادم.' : 'Network error.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'login' || mode === 'teacher-login' || mode === 'admin-login') {
      const eCheck = validateEmail(email);
      if (!eCheck.ok) return setErrorMsg(eCheck.error || 'Invalid email');
      if (!password) {
        return setErrorMsg(language === 'ar' ? 'أدخل كلمة المرور.' : 'Enter your password.');
      }
      setSubmitting(true);
      try {
        const result = await loginWithPassword({
          email,
          password,
          rememberMe,
          portal: entryPortal === 'admin' ? 'admin' : entryPortal === 'teacher' ? 'teacher' : 'parent',
        });
        if (!result.ok) {
          setErrorMsg(
            result.error ||
              (language === 'ar' ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Invalid email or password.'),
          );
          soundEngine.playEncourage();
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'forgot') {
      const eCheck = validateEmail(email);
      if (!eCheck.ok) return setErrorMsg(eCheck.error || 'Invalid email');
      setSubmitting(true);
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorMsg(
            formatApiErrorMessage(
              res.status,
              data,
              language,
              'Could not process password reset request.',
              'تعذر إرسال طلب استعادة كلمة المرور.',
            ),
          );
          return;
        }
        setDevNotice(
          data.devResetToken
            ? `${data.message} (Dev token: ${data.devResetToken})`
            : data.message,
        );
        if (data.devResetToken) setResetToken(data.devResetToken);
        setMode('reset');
      } catch {
        setErrorMsg(language === 'ar' ? 'تعذر الاتصال بالخادم.' : 'Network error.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'reset') {
      if (!resetToken.trim()) {
        return setErrorMsg(language === 'ar' ? 'أدخل رمز استعادة كلمة المرور.' : 'Enter reset token.');
      }
      if (!pwEval.ok) return setErrorMsg(pwEval.error || 'Weak password');
      setSubmitting(true);
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken.trim(), newPassword: password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorMsg(
            formatApiErrorMessage(
              res.status,
              data,
              language,
              'Reset failed',
              'تعذر إعادة تعيين كلمة المرور.',
            ),
          );
          return;
        }
        soundEngine.playSuccess();
        setPassword('');
        setMode('login');
        setDevNotice(
          language === 'ar'
            ? 'تم تحديث كلمة المرور بنجاح وتسجيل الخروج من جميع الجلسات السابقة.'
            : 'Password updated cleanly and all prior sessions revoked.',
        );
      } catch {
        setErrorMsg(language === 'ar' ? 'تعذر الاتصال بالخادم.' : 'Network error.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleVerifyEmail = async () => {
    if (!verifyTokenInput.trim()) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyTokenInput.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(
          formatApiErrorMessage(
            res.status,
            data,
            language,
            'Verification failed',
            'تعذر تأكيد البريد الإلكتروني.',
          ),
        );
        return;
      }
      soundEngine.playSuccess();
      const synced = await refreshAuthSession();
      if (synced?.authenticated && synced.user?.role === 'parent') {
        navigate('parent-dashboard');
      } else {
        setMode('login');
        setDevNotice(
          language === 'ar'
            ? 'تم تأكيد البريد الإلكتروني بنجاح! يمكنك تسجيل الدخول الآن.'
            : 'Email verified! Please sign in to open your Parent Dashboard.',
        );
      }
    } catch {
      setErrorMsg(language === 'ar' ? 'تعذر التحقق الآن.' : 'Verification request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8E9] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl nono-card rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="flex justify-center">
          <NonoLandLogo variant="main" size="sm" showWordmark={false} language={language} />
        </div>

        {/* Four Clearly Separated Top-Level Login Experiences: Parent | Teacher | Child | Admin */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-[#27345C]/8">
          <button
            type="button"
            onClick={() => {
              soundEngine.playPop();
              setEntryPortal('parent');
              setMode('login');
              setErrorMsg('');
              setDevNotice('');
            }}
            className={`py-2.5 px-2 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              entryPortal === 'parent'
                ? 'bg-[#27345C] text-white shadow-md'
                : 'text-[#27345C]/75 hover:bg-white/60'
            }`}
          >
            <UserCheck className="w-4 h-4 text-[#FFD84D] shrink-0" />
            <span>{language === 'ar' ? 'ولي الأمر' : 'Parent'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playPop();
              setEntryPortal('teacher');
              setMode('teacher-login');
              setErrorMsg('');
              setDevNotice('');
            }}
            className={`py-2.5 px-2 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              entryPortal === 'teacher'
                ? 'bg-[#0369A1] text-white shadow-md'
                : 'text-[#27345C]/75 hover:bg-white/60'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-[#FFD84D] shrink-0" />
            <span>{language === 'ar' ? 'المعلم' : 'Teacher'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playPop();
              setEntryPortal('child');
              setErrorMsg('');
              setDevNotice('');
            }}
            className={`py-2.5 px-2 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              entryPortal === 'child'
                ? 'bg-[#8054D9] text-white shadow-md'
                : 'text-[#27345C]/75 hover:bg-white/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#FFD84D] shrink-0" />
            <span>{language === 'ar' ? 'دخول الطفل' : 'Child'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playPop();
              setEntryPortal('admin');
              setMode('admin-login');
              setErrorMsg('');
              setDevNotice('');
            }}
            className={`py-2.5 px-2 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              entryPortal === 'admin'
                ? 'bg-[#1F2937] text-white shadow-md'
                : 'text-[#27345C]/75 hover:bg-white/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#55D98B] shrink-0" />
            <span>{language === 'ar' ? 'الإدارة' : 'Admin'}</span>
          </button>
        </div>

        {entryPortal === 'child' ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#EFE7FF] to-[#E5F6FF] border border-[#8054D9]/20 text-center space-y-1">
              <div className="text-3xl">🧸🌟</div>
              <h2 className="text-xl font-extrabold text-[#27345C]">
                {language === 'ar' ? 'مرحباً أيها المستكشف الصغير!' : 'Welcome, Little Explorer!'}
              </h2>
              <p className="text-xs font-semibold text-[#27345C]/75">
                {language === 'ar'
                  ? 'أدخل رمز دخول الطفل والرقم السري من لوحة ولي الأمر (١–٤ سنوات — بدون بريد إلكتروني)'
                  : 'Enter your Child Access Code & PIN from your Parent Dashboard (no email needed)'}
              </p>
            </div>

            {(errorMsg || dbUnavailable) && (
              <div className="p-3 rounded-2xl bg-[#FF4D6D]/12 border border-[#FF4D6D]/30 text-xs font-bold text-[#FF4D6D]">
                {errorMsg ||
                  (language === 'ar'
                    ? 'قاعدة البيانات غير متاحة حالياً — تم إيقاف تسجيل الدخول حفاظاً على أمان البيانات.'
                    : 'Database unavailable — sign-in is paused safely until PostgreSQL connectivity is restored.')}
              </div>
            )}

            {trustedProfiles.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[#E2F9EC] border border-[#55D98B] space-y-2">
                <div className="text-xs font-extrabold text-[#27345C]">
                  {language === 'ar'
                    ? `اختيار سريع على هذا الجهاز العائلي الموثوق (${trustedDeviceName}):`
                    : `Quick Pick on this Trusted Family Device (${trustedDeviceName}):`}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {trustedProfiles.map((tp) => {
                    const chosen = selectedQuickChildId === tp.id;
                    return (
                      <button
                        key={tp.id}
                        type="button"
                        onClick={() => {
                          soundEngine.playPop();
                          setSelectedQuickChildId(chosen ? null : tp.id);
                          setErrorMsg('');
                        }}
                        className={`p-3 rounded-2xl border-2 text-center cursor-pointer transition-all ${
                          chosen
                            ? 'bg-[#8054D9] text-white border-[#8054D9] shadow-md'
                            : 'bg-white text-[#27345C] border-[#27345C]/15 hover:border-[#8054D9]'
                        }`}
                      >
                        <div className="text-2xl mb-1">🌟</div>
                        <div className="text-sm font-extrabold truncate">{tp.displayName}</div>
                        <div className="text-[10px] opacity-80">
                          {language === 'ar' ? 'أدخل رقمك السري' : 'Enter PIN'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={(e) => void handleChildSignIn(e)} className="space-y-4">
              {!selectedQuickChildId && (
                <div>
                  <label className="block text-sm font-extrabold mb-1.5 text-[#27345C]">
                    {language === 'ar' ? 'رمز دخول الطفل (Access Code)' : 'Child Access Code'}
                  </label>
                  <input
                    type="text"
                    required
                    value={childAccessCode}
                    onChange={(e) => setChildAccessCode(e.target.value.toUpperCase())}
                    placeholder="NL-XXXX-XXXX"
                    dir="ltr"
                    className="w-full h-13 px-4 rounded-2xl bg-[#FFF8E9] border-2 border-[#8054D9]/30 focus:border-[#8054D9] outline-none font-mono-num text-center text-lg font-extrabold tracking-widest uppercase"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-extrabold text-[#27345C]">
                    {language === 'ar' ? 'الرقم السري للطفل (Child PIN)' : 'Child PIN (4–6 digits)'}
                  </label>
                  {selectedQuickChildId && (
                    <button
                      type="button"
                      onClick={() => setSelectedQuickChildId(null)}
                      className="text-xs font-bold text-[#8054D9] underline cursor-pointer"
                    >
                      {language === 'ar' ? 'استخدام رمز الدخول بدلاً من ذلك' : 'Use Access Code instead'}
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={childPin}
                  onChange={(e) => setChildPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••"
                  dir="ltr"
                  className="w-full h-13 px-4 rounded-2xl bg-[#FFF8E9] border-2 border-[#8054D9]/30 focus:border-[#8054D9] outline-none font-mono-num text-center text-2xl tracking-[0.5em] font-extrabold"
                />
                {/* Large child-friendly colorful keypad */}
                <div className="grid grid-cols-5 gap-2 mt-3" dir="ltr">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleChildKeypadDigit(d)}
                      className="h-12 rounded-2xl bg-white border-2 border-[#8054D9]/25 hover:bg-[#EFE7FF] active:scale-95 text-lg font-extrabold text-[#27345C] shadow-sm cursor-pointer"
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setChildPin((p) => p.slice(0, -1))}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold cursor-pointer"
                  >
                    {language === 'ar' ? 'مسح رقم' : 'Backspace'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChildPin('')}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold cursor-pointer"
                  >
                    {language === 'ar' ? 'إعادة ضبط' : 'Clear'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || childPin.length < 4}
                className="w-full nono-btn-tactile h-14 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold text-lg cursor-pointer disabled:opacity-50"
              >
                {submitting
                  ? language === 'ar'
                    ? 'جاري الدخول لعالمك...'
                    : 'Opening your world...'
                  : language === 'ar'
                    ? '🚀 هيا نبدأ اللعب والتعلم!'
                    : '🚀 Enter My Learning World!'}
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-[#27345C]">
                  {entryPortal === 'admin'
                    ? mode === 'admin-bootstrap'
                      ? language === 'ar'
                        ? 'تهيئة أول مشرف عام (مالك المنصة)'
                        : 'Initialize First Super Admin'
                      : language === 'ar'
                        ? 'دخول بوابة الإدارة'
                        : 'Administrator Portal Sign In'
                    : entryPortal === 'teacher'
                      ? mode === 'teacher-register'
                        ? language === 'ar'
                          ? 'طلب تسجيل حساب معلم'
                          : 'Teacher Account Request'
                        : mode === 'forgot'
                          ? language === 'ar'
                            ? 'استعادة كلمة المرور'
                            : 'Forgot Password'
                          : mode === 'reset'
                            ? language === 'ar'
                              ? 'تعيين كلمة مرور جديدة'
                              : 'Reset Password'
                            : language === 'ar'
                              ? 'تسجيل دخول المعلم'
                              : 'Teacher Sign In'
                      : mode === 'register'
                        ? language === 'ar'
                          ? 'إنشاء حساب ولي أمر جديد'
                          : 'Create Parent Account'
                        : mode === 'login'
                          ? language === 'ar'
                            ? 'تسجيل دخول ولي الأمر'
                            : 'Parent Sign In'
                          : mode === 'forgot'
                            ? language === 'ar'
                              ? 'استعادة كلمة المرور'
                              : 'Forgot Password'
                            : language === 'ar'
                              ? 'تعيين كلمة مرور جديدة'
                              : 'Reset Password'}
                </h2>
                <p className="text-xs text-[#27345C]/65">
                  {entryPortal === 'admin'
                    ? language === 'ar'
                      ? 'بوابة محمية لمسؤولي منصة نونو لاند فقط (لا يوجد تسجيل عام للمسؤولين)'
                      : 'Restricted portal for authorized NonoLand Administrators only'
                    : entryPortal === 'teacher'
                      ? language === 'ar'
                        ? 'بوابة المعلمين المعتمدين لإدارة الفصول والواجبات والامتحانات (١–٤ سنوات)'
                        : 'Verified Teacher Portal for classes, homework & assessments (Ages 1–4)'
                      : language === 'ar'
                        ? 'مساحة عائلية خاصة وآمنة — المرحلة الرسمية: المستكشف الصغير (١–٤ سنوات)'
                        : 'Private family space — Official Stage: Little Explorers (1–4 Years)'}
                </p>
              </div>

              {entryPortal === 'admin' ? (
                !adminBootstrapStatus.loading &&
                !adminBootstrapStatus.initialized && (
                  <div className="flex flex-wrap gap-1 bg-[#27345C]/8 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('admin-login');
                        setErrorMsg('');
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        mode === 'admin-login' ? 'bg-white text-[#1F2937] shadow-sm' : 'text-[#27345C]/65'
                      }`}
                    >
                      {language === 'ar' ? 'تسجيل الدخول' : 'Admin Sign In'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('admin-bootstrap');
                        setErrorMsg('');
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        mode === 'admin-bootstrap' ? 'bg-white text-[#1F2937] shadow-sm' : 'text-[#27345C]/65'
                      }`}
                    >
                      {language === 'ar' ? 'إعداد أول مشرف' : 'First-Time Setup'}
                    </button>
                  </div>
                )
              ) : entryPortal === 'teacher' ? (
                <div className="flex flex-wrap gap-1 bg-[#27345C]/8 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('teacher-login');
                      setErrorMsg('');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      mode === 'teacher-login' ? 'bg-white text-[#0369A1] shadow-sm' : 'text-[#27345C]/65'
                    }`}
                  >
                    {language === 'ar' ? 'تسجيل دخول المعلم' : 'Teacher Sign In'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('teacher-register');
                      setErrorMsg('');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      mode === 'teacher-register' ? 'bg-white text-[#0369A1] shadow-sm' : 'text-[#27345C]/65'
                    }`}
                  >
                    {language === 'ar' ? 'طلب حساب معلم' : 'Request Teacher Account'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1 bg-[#27345C]/8 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg('');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      mode === 'login' ? 'bg-white text-[#27345C] shadow-sm' : 'text-[#27345C]/65'
                    }`}
                  >
                    {language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorMsg('');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      mode === 'register' ? 'bg-white text-[#27345C] shadow-sm' : 'text-[#27345C]/65'
                    }`}
                  >
                    {language === 'ar' ? 'حساب جديد' : 'Register'}
                  </button>
                </div>
              )}
            </div>

            {entryPortal === 'admin' && !adminBootstrapStatus.loading && !adminBootstrapStatus.initialized && mode === 'admin-login' && (
              <div className="p-3.5 rounded-2xl bg-[#FFF3CD] border border-[#FFD84D] flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-extrabold text-[#27345C]">
                  {language === 'ar'
                    ? 'لم يتم تهيئة المشرف العام للمنصة بعد.'
                    : 'No Super Admin account has been initialized yet.'}
                </span>
                <button
                  type="button"
                  onClick={() => setMode('admin-bootstrap')}
                  className="px-3 py-1.5 rounded-xl bg-[#1F2937] text-white font-extrabold cursor-pointer"
                >
                  {language === 'ar' ? 'إعداد المشرف العام الأول' : 'Run One-Time Owner Setup'}
                </button>
              </div>
            )}

            {entryPortal === 'admin' && mode === 'admin-bootstrap' && !adminBootstrapStatus.setupConfigured && (
              <div className="p-3.5 rounded-2xl bg-[#E5F6FF] border border-[#39BDF2]/45 text-xs font-bold text-[#27345C] space-y-1">
                <p className="font-extrabold">
                  {language === 'ar'
                    ? 'مطلوب إعداد متغير البيئة NONOLAND_ADMIN_SETUP_SECRET أولاً'
                    : 'NONOLAND_ADMIN_SETUP_SECRET is not configured yet'}
                </p>
                <p className="opacity-80">
                  {language === 'ar'
                    ? 'أضف NONOLAND_ADMIN_SETUP_SECRET في إعدادات البيئة السرية للخادم (AI Studio Secrets) ثم أعد التشغيل لاستخدام هذه الخطوة مرة واحدة فقط.'
                    : 'Set NONOLAND_ADMIN_SETUP_SECRET in your deployment / AI Studio Secrets panel and restart the server, then enter it below once.'}
                </p>
              </div>
            )}

            {authSession.authenticated && authSession.user && !authSession.user.emailVerified && (
              <div className="p-4 rounded-2xl bg-[#E5F6FF] border border-[#39BDF2]/40 space-y-2.5 text-xs">
                <div className="flex items-center gap-2 font-extrabold text-[#27345C]">
                  <MailCheck className="w-4 h-4 text-[#8054D9]" />
                  <span>
                    {language === 'ar'
                      ? 'تأكيد البريد الإلكتروني لإكمال تفعيل الأمان:'
                      : 'Verify your email address to activate full recovery:'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verifyTokenInput}
                    onChange={(e) => setVerifyTokenInput(e.target.value)}
                    placeholder="Verification token"
                    className="flex-1 h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 font-mono-num"
                  />
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleVerifyEmail()}
                    className="px-4 h-10 rounded-xl bg-[#55D98B] text-[#27345C] font-extrabold cursor-pointer"
                  >
                    {language === 'ar' ? 'تأكيد' : 'Verify'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('parent-dashboard')}
                  className="underline font-bold text-[#8054D9] cursor-pointer"
                >
                  {language === 'ar' ? 'المتابعة إلى لوحة ولي الأمر' : 'Continue to Parent Dashboard'}
                </button>
              </div>
            )}

            {devNotice && (
              <div className="p-3 rounded-2xl bg-[#E2F9EC] border border-[#55D98B] text-xs font-bold text-[#27345C] break-all">
                {devNotice}
              </div>
            )}

            {(errorMsg || dbUnavailable) && (
              <div className="p-3 rounded-2xl bg-[#FF4D6D]/12 border border-[#FF4D6D]/30 text-xs font-bold text-[#FF4D6D]">
                {errorMsg ||
                  (language === 'ar'
                    ? 'قاعدة البيانات غير متاحة حالياً — تم إيقاف التسجيل وتسجيل الدخول حفاظاً على أمان البيانات.'
                    : 'Database unavailable — sign-in and registration are paused safely until PostgreSQL connectivity is restored.')}
              </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {mode === 'admin-bootstrap' && (
                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    {language === 'ar'
                      ? 'رمز التهيئة السري للخادم (Setup Secret)'
                      : 'One-Time Server Setup Secret'}
                  </label>
                  <input
                    type="password"
                    required
                    value={setupSecret}
                    onChange={(e) => setSetupSecret(e.target.value)}
                    placeholder="NONOLAND_ADMIN_SETUP_SECRET"
                    autoComplete="off"
                    className="w-full h-12 px-4 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/20 focus:border-[#1F2937] outline-none font-mono-num"
                  />
                </div>
              )}

              {(mode === 'register' || mode === 'teacher-register' || mode === 'admin-bootstrap') && (
                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    {mode === 'admin-bootstrap'
                      ? language === 'ar'
                        ? 'اسم المشرف العام الكامل'
                        : 'Super Admin Full Name'
                      : mode === 'teacher-register'
                        ? language === 'ar'
                          ? 'اسم المعلم الكامل'
                          : 'Teacher Full Name'
                        : language === 'ar'
                          ? 'اسم ولي الأمر'
                          : 'Parent Display Name'}
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      mode === 'admin-bootstrap'
                        ? language === 'ar'
                          ? 'اسم مالك المنصة'
                          : 'Platform Owner Name'
                        : language === 'ar'
                          ? 'مثال: أم سلمى'
                          : 'e.g. Sarah Ahmed'
                    }
                    className="w-full h-12 px-4 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/12 focus:border-[#8054D9] outline-none font-semibold"
                  />
                </div>
              )}

              {mode === 'teacher-register' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-extrabold mb-1.5 text-[#27345C]/80">
                      {language === 'ar' ? 'المواد التي تدرسها:' : 'Teaching Subjects:'}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {(['arabic', 'english', 'math', 'colors-shapes', 'logic', 'world-around-me'] as const).map((sub) => {
                        const active = teacherSubjects.includes(sub);
                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() =>
                              setTeacherSubjects((prev) =>
                                active ? prev.filter((x) => x !== sub) : [...prev, sub],
                              )
                            }
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold border cursor-pointer ${
                              active
                                ? 'bg-[#8054D9] text-white border-[#8054D9]'
                                : 'bg-white text-[#27345C] border-[#27345C]/15'
                            }`}
                          >
                            {sub}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {(mode === 'register' || mode === 'teacher-register' || mode === 'admin-bootstrap' || mode === 'login' || mode === 'teacher-login' || mode === 'admin-login' || mode === 'forgot') && (
                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <input
                    type="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full h-12 px-4 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/12 focus:border-[#8054D9] outline-none font-semibold"
                  />
                </div>
              )}

              {mode === 'reset' && (
                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    {language === 'ar' ? 'رمز الاستعادة' : 'Reset Token'}
                  </label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Token"
                    className="w-full h-12 px-4 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/12 focus:border-[#8054D9] outline-none font-mono-num"
                  />
                </div>
              )}

              {(mode === 'register' || mode === 'teacher-register' || mode === 'admin-bootstrap' || mode === 'login' || mode === 'teacher-login' || mode === 'admin-login' || mode === 'reset') && (
                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    {language === 'ar'
                      ? mode === 'reset' || mode === 'admin-bootstrap'
                        ? 'كلمة مرور قوية (١٢ حرفاً فأكثر)'
                        : 'كلمة المرور'
                      : mode === 'reset' || mode === 'admin-bootstrap'
                        ? 'Strong Password (min 12 chars)'
                        : 'Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full h-12 px-4 pe-12 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/12 focus:border-[#8054D9] outline-none font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label="Toggle password visibility"
                      className="absolute inset-y-0 end-2 px-2 flex items-center text-[#27345C]/65 cursor-pointer"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {(mode === 'register' || mode === 'teacher-register' || mode === 'admin-bootstrap' || mode === 'reset') && password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            pwEval.strength === 'excellent' || pwEval.strength === 'strong'
                              ? 'w-full bg-[#55D98B]'
                              : pwEval.strength === 'fair'
                                ? 'w-2/3 bg-[#FFD84D]'
                                : 'w-1/3 bg-[#FF4D6D]'
                          }`}
                        />
                      </div>
                      <p className="text-[11px] font-bold text-[#27345C]/70">
                        {pwEval.ok
                          ? language === 'ar'
                            ? `قوة كلمة المرور: ${pwEval.strength}`
                            : `Password strength: ${pwEval.strength}`
                          : pwEval.error}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {(mode === 'login' || mode === 'teacher-login' || mode === 'admin-login') && (
                <label className="flex items-center gap-2 text-xs font-bold text-[#27345C]/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 accent-[#8054D9]"
                  />
                  <span>
                    {language === 'ar'
                      ? 'تذكرني على هذا الجهاز بأمان (جلسة ممتدة)'
                      : 'Remember me securely on this device'}
                  </span>
                </label>
              )}

              {(mode === 'register' || mode === 'teacher-register' || mode === 'admin-bootstrap') && (
                <>
                  <div>
                    <label className="block text-sm font-bold mb-1.5">
                      {language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                    </label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full h-12 px-4 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/12 focus:border-[#8054D9] outline-none font-semibold"
                    />
                  </div>

                  {mode !== 'admin-bootstrap' && (
                    <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/12 cursor-pointer text-xs text-[#27345C]/80">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#8054D9]"
                      />
                      <span>
                        {language === 'ar' ? (
                          <>
                            أوافق على{' '}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setLegalDocOpen('privacy');
                              }}
                              className="underline text-[#8054D9] font-extrabold cursor-pointer"
                            >
                              سياسة الخصوصية
                            </button>{' '}
                            و{' '}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setLegalDocOpen('terms');
                              }}
                              className="underline text-[#8054D9] font-extrabold cursor-pointer"
                            >
                              شروط الاستخدام
                            </button>{' '}
                            ({POLICY_VERSION})
                          </>
                        ) : (
                          <>
                            I accept the{' '}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setLegalDocOpen('privacy');
                              }}
                              className="underline text-[#8054D9] font-extrabold cursor-pointer"
                            >
                              Privacy Policy
                            </button>{' '}
                            &{' '}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setLegalDocOpen('terms');
                              }}
                              className="underline text-[#8054D9] font-extrabold cursor-pointer"
                            >
                              Terms of Use
                            </button>{' '}
                            ({POLICY_VERSION})
                          </>
                        )}
                      </span>
                    </label>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={`w-full nono-btn-tactile h-13 rounded-2xl text-white font-extrabold text-base cursor-pointer disabled:opacity-50 ${
                  entryPortal === 'admin'
                    ? 'bg-[#1F2937]'
                    : entryPortal === 'teacher'
                      ? 'bg-[#0369A1]'
                      : 'bg-[#8054D9]'
                }`}
              >
                {submitting
                  ? language === 'ar'
                    ? 'جاري المعالجة...'
                    : 'Processing...'
                  : mode === 'admin-bootstrap'
                    ? language === 'ar'
                      ? 'تفعيل أول مشرف عام والدخول'
                      : 'Initialize First Super Admin'
                    : mode === 'register'
                      ? language === 'ar'
                        ? 'إنشاء حساب ولي الأمر والمتابعة'
                        : 'Create Parent Account'
                      : mode === 'teacher-register'
                        ? language === 'ar'
                          ? 'إرسال طلب حساب المعلم (بانتظار الإدارة)'
                          : 'Submit Teacher Request (Pending Approval)'
                        : mode === 'login' || mode === 'teacher-login' || mode === 'admin-login'
                          ? language === 'ar'
                            ? 'تسجيل الدخول'
                            : 'Sign In'
                          : mode === 'forgot'
                            ? language === 'ar'
                              ? 'إرسال رابط الاستعادة'
                              : 'Request Password Reset'
                            : language === 'ar'
                              ? 'تحديث كلمة المرور'
                              : 'Update Password'}
              </button>
            </form>

            {entryPortal === 'parent' && mode === 'login' && typeof window !== 'undefined' && browserSupportsWebAuthn() && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 text-[11px] font-bold text-[#27345C]/55">
                  <div className="flex-1 h-px bg-[#27345C]/12" />
                  <span>{language === 'ar' ? 'أو' : 'OR'}</span>
                  <div className="flex-1 h-px bg-[#27345C]/12" />
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={async () => {
                    setErrorMsg('');
                    setDevNotice('');
                    setSubmitting(true);
                    try {
                      const res = await loginWithPasskey({ email, rememberMe });
                      if (!res.ok) {
                        setErrorMsg(
                          res.error ||
                            (language === 'ar'
                              ? 'فشل تسجيل الدخول بمفتاح المرور.'
                              : 'Passkey sign-in failed.'),
                        );
                        soundEngine.playEncourage();
                      }
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="w-full h-12 rounded-2xl bg-[#F4EEFF] hover:bg-[#EAE0FF] border-2 border-[#8054D9]/30 text-[#27345C] font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Fingerprint className="w-4 h-4 text-[#8054D9]" />
                  <span>
                    {language === 'ar'
                      ? 'تسجيل الدخول بمفتاح المرور (Passkey)'
                      : 'Sign in with Passkey'}
                  </span>
                </button>
                <p className="text-[11px] font-bold text-center text-[#27345C]/65">
                  {language === 'ar'
                    ? 'اختياري لحسابات أولياء الأمور — يظل البريد الإلكتروني وكلمة المرور متاحين دائماً.'
                    : 'Optional for parent accounts — Email & Password always stays available.'}
                </p>
              </div>
            )}
          </>
        )}

        <div className="pt-3 border-t border-[#27345C]/10 flex flex-wrap items-center justify-between gap-2 text-xs text-[#27345C]/70">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={enterSampleDemoMode} className="underline cursor-pointer">
              {language === 'ar' ? 'المعاينة بالحساب التجريبي' : 'Explore with Sample Family'}
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem(INTRO_SKIP_STORAGE_KEY);
                } catch {
                  // ignore
                }
                navigate('splash');
              }}
              className="underline text-[#8054D9] font-bold cursor-pointer"
            >
              {language === 'ar' ? 'إعادة عرض المقدمة' : 'Replay Welcome Intro'}
            </button>
          </div>
          {(entryPortal === 'parent' || entryPortal === 'teacher') && (mode === 'login' || mode === 'teacher-login') ? (
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setErrorMsg('');
              }}
              className="flex items-center gap-1 text-[#8054D9] font-bold cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}</span>
            </button>
          ) : (
            <button type="button" onClick={() => navigate('splash')} className="cursor-pointer">
              {language === 'ar' ? 'الرئيسية' : 'Back'}
            </button>
          )}
          <div className="w-full flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#27345C]/8 text-[11px] font-bold text-[#27345C]/65">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setLegalDocOpen('privacy')}
                className="underline hover:text-[#8054D9] cursor-pointer"
              >
                {language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
              </button>
              <button
                type="button"
                onClick={() => setLegalDocOpen('terms')}
                className="underline hover:text-[#8054D9] cursor-pointer"
              >
                {language === 'ar' ? 'شروط الاستخدام' : 'Terms of Use'}
              </button>
            </div>
            <span>Quran data provided by Quran.Foundation.</span>
          </div>
        </div>
      </div>

      <LegalDocumentsModal
        open={legalDocOpen !== null}
        activeDoc={legalDocOpen || 'privacy'}
        language={language}
        onChangeDoc={(doc) => setLegalDocOpen(doc)}
        onClose={() => setLegalDocOpen(null)}
      />
    </div>
  );
};

export const CreateChildScreen: React.FC = () => {
  const { navigate, language, createChildProfile, authSession } = useNonoLand();
  const currentYear = new Date().getFullYear();
  const minBirthYear = currentYear - 4;
  const maxBirthYear = currentYear - 1;
  const [displayName, setDisplayName] = useState('');
  const [ageGroup] = useState<AgeGroupId>(UNIFIED_STAGE_ID);
  const [childLang, setChildLang] = useState<Language>(language);
  const [birthYear, setBirthYear] = useState(currentYear - 3);
  const [birthMonth, setBirthMonth] = useState(5);
  const [childPin, setChildPin] = useState('');
  const [interests, setInterests] = useState<string[]>(['animals', 'space']);
  const [companionId, setCompanionId] = useState('nono');
  const [scarfColor, setScarfColor] = useState('#8054D9');
  const [childError, setChildError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<{
    child: ChildProfile;
    accessCode: string;
    pin: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const interestOptions = [
    { id: 'animals', ar: 'الحيوانات 🦁', en: 'Animals 🦁' },
    { id: 'space', ar: 'الفضاء والعلوم 🚀', en: 'Space & Science 🚀' },
    { id: 'letters', ar: 'الحروف والقصص 📖', en: 'Letters & Stories 📖' },
    { id: 'math', ar: 'الأرقام والألغاز 🔢', en: 'Numbers & Puzzles 🔢' },
    { id: 'art', ar: 'الرسم والموسيقى 🎨', en: 'Art & Music 🎨' },
  ];

  const scarfColors = ['#8054D9', '#39BDF2', '#FF78B7', '#55D98B', '#FF9360'];

  const toggleInterest = (id: string) => {
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setChildError('');
    const check = validateChildProfileInput({
      displayName,
      ageGroup,
      language: childLang,
      birthYear,
      birthMonth,
    });
    if (!check.ok || !check.clean) {
      setChildError(check.error || 'Invalid child details');
      soundEngine.playEncourage();
      return;
    }

    if (authSession.authenticated && !/^\d{4,6}$/.test(childPin.trim())) {
      setChildError(
        language === 'ar'
          ? 'يرجى تعيين رقم سري للطفل مكوّن من ٤ إلى ٦ أرقام.'
          : 'Please enter a 4–6 digit numeric Child PIN.',
      );
      soundEngine.playEncourage();
      return;
    }

    setCreating(true);
    try {
      const res = await createChildProfile({
        displayName: check.clean.displayName,
        ageGroup,
        language: childLang,
        birthYear,
        birthMonth,
        interests,
        companionId,
        companionScarfColor: scarfColor,
        pin: childPin.trim() || undefined,
      });
      soundEngine.playSuccess();
      if (res.accessCode) {
        setCreatedReceipt({
          child: res.child,
          accessCode: res.accessCode,
          pin: childPin.trim(),
        });
      } else {
        navigate('parent-dashboard');
      }
    } catch (err) {
      setChildError(err instanceof Error ? err.message : 'Unable to create profile');
      soundEngine.playEncourage();
    } finally {
      setCreating(false);
    }
  };

  if (createdReceipt) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#E5F6FF] to-[#FFF8E9] py-8 px-4 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full nono-card rounded-3xl p-6 sm:p-8 space-y-5 text-center"
        >
          <div className="flex justify-center">
            <NonoLandLogo variant="compact" size="sm" language={language} />
          </div>
          <div className="w-16 h-16 rounded-2xl bg-[#55D98B]/25 text-[#14532D] flex items-center justify-center mx-auto">
            <KeyRound className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-extrabold text-[#27345C]">
              {language === 'ar'
                ? `تم إنشاء ملف ${createdReceipt.child.displayName} بنجاح!`
                : `${createdReceipt.child.displayName}'s Profile Is Ready!`}
            </h2>
            <p className="text-xs font-bold text-[#92400E] bg-[#FEF3C7] border border-[#F59E0B]/40 rounded-2xl p-3">
              {language === 'ar'
                ? 'احفظ رمز دخول الطفل الآن — يُعرض هذا الرمز مرة واحدة عند الإنشاء لحماية خصوصية عائلتك (يمكنك استعراضه أو تدويره لاحقاً من لوحة ولي الأمر).'
                : 'Save this Child Access Code now — it is shown once upon creation to protect your family (you can reveal or rotate it later inside Parent Dashboard).'}
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-[#F4EEFF] border-2 border-[#8054D9]/35 space-y-3">
            <p className="text-xs font-extrabold text-[#8054D9]">
              {language === 'ar' ? 'رمز دخول الطفل المستقل (Access Code)' : 'Unique Child Access Code'}
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span
                dir="ltr"
                className="px-5 py-3 rounded-2xl bg-white border border-[#8054D9]/30 font-mono-num text-2xl font-extrabold tracking-widest text-[#27345C]"
              >
                {createdReceipt.accessCode}
              </span>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(createdReceipt.accessCode);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="h-12 px-4 rounded-2xl bg-[#27345C] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedCode ? <Check className="w-4 h-4 text-[#55D98B]" /> : <Copy className="w-4 h-4" />}
                <span>
                  {copiedCode
                    ? language === 'ar'
                      ? 'تم النسخ!'
                      : 'Copied!'
                    : language === 'ar'
                      ? 'نسخ الرمز'
                      : 'Copy Code'}
                </span>
              </button>
            </div>
            <p className="text-xs font-bold text-[#27345C]/80" dir="ltr">
              {language === 'ar'
                ? `الرقم السري (PIN): ${createdReceipt.pin}`
                : `Child PIN: ${createdReceipt.pin}`}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/12 text-start text-xs space-y-1.5 font-bold text-[#27345C]/85">
            <p className="font-extrabold text-[#27345C]">
              {language === 'ar' ? 'طريقة دخول الطفل لعالمه:' : 'How your child signs in:'}
            </p>
            <p>
              {language === 'ar'
                ? `١. افتح تبويب "دخول الطفل" في شاشة تسجيل الدخول.`
                : `1. Select the "Child" tab on the Login screen.`}
            </p>
            <p>
              {language === 'ar'
                ? `٢. أدخل رمز الدخول (${createdReceipt.accessCode}) ثم الرقم السري (${createdReceipt.pin}).`
                : `2. Enter Access Code (${createdReceipt.accessCode}) and their ${createdReceipt.pin.length}-digit PIN.`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('parent-dashboard')}
            className="w-full nono-btn-tactile h-14 rounded-2xl bg-[#8054D9] text-white font-extrabold text-base cursor-pointer"
          >
            {language === 'ar' ? 'العودة إلى لوحة ولي الأمر' : 'Return to Parent Dashboard'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E5F6FF] to-[#FFF8E9] py-8 px-4">
      <div className="max-w-3xl mx-auto nono-card rounded-3xl p-6 sm:p-8">
        {childError && (
          <div className="mb-4 p-3 rounded-2xl bg-[#FF4D6D]/12 text-xs font-bold text-[#FF4D6D]">
            {childError}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="space-y-2">
            <NonoLandLogo variant="compact" size="sm" language={language} />
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#27345C]">
              {t(UI_COPY.createChildProfile, language)}
            </h2>
            <p className="text-sm text-[#27345C]/70">
              {language === 'ar'
                ? 'نجمع الاسم المستعار والعمر (١–٤ سنوات فقط) ورقم سري لتصميم مساحة طفلك الآمنة'
                : 'We only collect a display name, age band (1–4 years only), and Child PIN for a safe world'}
            </p>
          </div>
          <NonoCharacter mood="waving" scarfColor={scarfColor} size="sm" interactive={false} />
        </div>

        <form onSubmit={(e) => void handleCreate(e)} className="space-y-6">
          {/* Name & Language */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1.5">
                {language === 'ar' ? 'اسم الطفل (المستعار)' : "Child's Display Name"}
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={language === 'ar' ? 'مثال: كريم أو مريم' : 'e.g. Adam or Maya'}
                className="w-full h-12 px-4 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/12 focus:border-[#8054D9] outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1.5">
                {language === 'ar' ? 'اللغة المفضلة للطفل' : 'Preferred Language'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['ar', 'en'] as Language[]).map((lng) => (
                  <button
                    key={lng}
                    type="button"
                    onClick={() => setChildLang(lng)}
                    className={`h-12 rounded-2xl font-bold border-2 cursor-pointer transition-colors ${
                      childLang === lng
                        ? 'bg-[#8054D9] text-white border-[#8054D9]'
                        : 'bg-white text-[#27345C] border-[#27345C]/12'
                    }`}
                  >
                    {lng === 'ar' ? 'العربية (أساسي)' : 'English'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Unified Educational Stage Display */}
          <div>
            <label className="block text-sm font-bold mb-2">
              {language === 'ar' ? 'المرحلة التعليمية المعتمدة' : 'Educational Stage'}
            </label>
            {(() => {
              const meta = getAgeGroupMeta(UNIFIED_STAGE_ID);
              return (
                <div className="p-4 rounded-2xl border-2 bg-white border-[#8054D9] shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-base" style={{ color: meta.color }}>
                      {t(meta.badgeTitle, language)} · {t(meta.label, language)}
                    </span>
                    <Check className="w-5 h-5 text-[#8054D9]" />
                  </div>
                  <p className="text-xs text-[#27345C]/75 mt-1.5">{t(meta.description, language)}</p>
                </div>
              );
            })()}
          </div>

          {/* Birth Month/Year & Child PIN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1 text-[#27345C]/70">
                {language === 'ar'
                  ? `سنة الميلاد (١–٤ سنوات: ${minBirthYear}–${maxBirthYear})`
                  : `Birth Year (Ages 1–4: ${minBirthYear}–${maxBirthYear})`}
              </label>
              <input
                type="number"
                min={minBirthYear}
                max={maxBirthYear}
                value={birthYear}
                onChange={(e) => setBirthYear(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 font-mono-num font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-[#27345C]/70">
                {language === 'ar' ? 'شهر الميلاد' : 'Birth Month'}
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={birthMonth}
                onChange={(e) => setBirthMonth(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 font-mono-num font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-[#27345C]/70">
                {language === 'ar' ? 'الرقم السري للطفل (٤–٦ أرقام)' : 'Child Login PIN (4–6 digits)'}
              </label>
              <input
                type="password"
                inputMode="numeric"
                required={authSession.authenticated}
                maxLength={6}
                dir="ltr"
                value={childPin}
                onChange={(e) => setChildPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="1234"
                className="w-full h-11 px-3 rounded-xl bg-[#FFF8E9] border-2 border-[#8054D9]/30 focus:border-[#8054D9] outline-none font-mono-num font-extrabold text-center tracking-widest"
              />
            </div>
          </div>

          {/* Interests & Companion Color */}
          <div>
            <label className="block text-sm font-bold mb-2">
              {language === 'ar' ? 'اهتمامات الطفل (اختياري)' : 'Child Interests (Optional)'}
            </label>
            <div className="flex flex-wrap gap-2">
              {interestOptions.map((opt) => {
                const active = interests.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleInterest(opt.id)}
                    className={`px-3.5 py-2 rounded-xl text-sm font-bold border cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#FFD84D]/40 border-[#FF9360] text-[#27345C]'
                        : 'bg-white border-[#27345C]/12 text-[#27345C]/70'
                    }`}
                  >
                    {language === 'ar' ? opt.ar : opt.en}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-sm font-bold mb-2">
                {language === 'ar' ? 'اختر الرفيق المفضل' : 'Favorite Companion'}
              </label>
              <div className="flex gap-2">
                {CHARACTER_COMPANIONS.slice(0, 4).map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setCompanionId(ch.id)}
                    className={`flex-1 py-2.5 rounded-2xl border-2 text-center cursor-pointer ${
                      companionId === ch.id ? 'border-[#8054D9] bg-[#8054D9]/10' : 'border-[#27345C]/10 bg-white'
                    }`}
                  >
                    <div className="text-2xl">{ch.emoji}</div>
                    <div className="text-xs font-bold mt-0.5">{t(ch.name, language)}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">
                {language === 'ar' ? 'لون وشاح نونو' : "Nono's Scarf Color"}
              </label>
              <div className="flex gap-3">
                {scarfColors.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setScarfColor(col)}
                    aria-label={col}
                    className={`w-10 h-10 rounded-full border-4 cursor-pointer transition-transform ${
                      scarfColor === col ? 'border-[#27345C] scale-110' : 'border-white'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3">
            <button
              type="button"
              onClick={() => navigate('parent-dashboard')}
              className="px-4 py-3 rounded-2xl text-sm font-bold text-[#27345C]/70 hover:text-[#27345C] cursor-pointer"
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={creating}
              className="nono-btn-tactile h-13 px-8 rounded-2xl bg-[#8054D9] text-white font-extrabold flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
              <span>
                {creating
                  ? language === 'ar'
                    ? 'جاري الإنشاء...'
                    : 'Creating...'
                  : language === 'ar'
                    ? 'إنشاء ملف الطفل وتوليد رمز الدخول'
                    : 'Create Child & Generate Code'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ChildWelcomeScreen: React.FC = () => {
  const { activeChild, language, navigate } = useNonoLand();
  if (!activeChild) return null;
  const greeting =
    language === 'ar'
      ? `أهلاً يا ${activeChild.displayName}! أنا نونو، هيا نلعب لعبة استكشاف صغيرة لنعرف ما تحبه!`
      : `Welcome, ${activeChild.displayName}! I'm Nono — let's play a quick discovery game to tailor your world!`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#39BDF2]/20 via-[#FFF8E9] to-[#FFD84D]/20 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full nono-card rounded-3xl p-8 text-center space-y-6"
      >
        <div className="flex justify-center">
          <NonoLandLogo variant="main" size="sm" showWordmark={false} language={language} />
        </div>
        <NonoCharacter
          mood="excited"
          scarfColor={activeChild.companionScarfColor}
          size="lg"
          speechBubble={greeting}
          language={language}
        />

        <div>
          <h1 className="text-3xl font-extrabold text-[#27345C]">
            {language === 'ar' ? `مرحباً ${activeChild.displayName} في نونو لاند!` : `Welcome to NonoLand, ${activeChild.displayName}!`}
          </h1>
          <p className="text-[#27345C]/75 mt-2">
            {t(getAgeGroupMeta(activeChild.ageGroup).badgeTitle, language)} · {t(getAgeGroupMeta(activeChild.ageGroup).label, language)}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => navigate('baseline-assessment')}
            className="flex-1 nono-btn-tactile h-14 rounded-2xl bg-[#8054D9] text-white font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-5 h-5" />
            <span>{language === 'ar' ? 'ابدأ رحلة الاكتشاف الأولى' : 'Play Baseline Discovery'}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('home')}
            className="h-14 px-5 rounded-2xl bg-white border-2 border-[#27345C]/15 font-bold text-[#27345C] cursor-pointer"
          >
            {language === 'ar' ? 'الدخول للرئيسية مباشرة' : 'Go to Home'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
