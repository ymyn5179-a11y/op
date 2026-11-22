import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Eye,
  KeyRound,
  Plus,
  RefreshCw,
  Settings,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { t, formatDate, formatNumber } from '../i18n/translations';
import {
  AgeGroupId,
  Certificate,
  CmsLessonRecord,
  ConceptDomain,
  ExamAttemptSummary,
  ExamConfig,
  ExamQuestionItem,
  ExamSubject,
  Language,
  RecommendedAgeRange,
} from '../types/nonoland';
import { getRecommendedAgeLabel, getSafeStageDisplay } from '../utils/ageAdaptation';
import { soundEngine } from '../utils/soundEngine';
import { CertificateModal } from './CertificateModal';

import { useNonoLand } from '../context/NonoLandContext';

interface AdminOverviewResponse {
  examConfig: ExamConfig;
  customLessons: CmsLessonRecord[];
  customQuestions: ExamQuestionItem[];
  builtInQuestionsCount: number;
  certificates: Certificate[];
  examAttempts: ExamAttemptSummary[];
}

export const AdminCmsPanel: React.FC<{ language: Language }> = ({ language }) => {
  const { authSession } = useNonoLand();
  const [pin, setPin] = useState('');
  const [unlockedPin, setUnlockedPin] = useState<string | null>(null);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [subTab, setSubTab] = useState<'config' | 'lessons' | 'questions' | 'certificates'>('config');
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [statusBanner, setStatusBanner] = useState('');

  // Exam Config Form
  const [priceEgp, setPriceEgp] = useState(50);
  const [passPct, setPassPct] = useState(70);
  const [qCount, setQCount] = useState(40);

  // Add Lesson Form
  const [lsTitleAr, setLsTitleAr] = useState('');
  const [lsTitleEn, setLsTitleEn] = useState('');
  const [lsExplAr, setLsExplAr] = useState('');
  const [lsExplEn, setLsExplEn] = useState('');
  const [lsDomain, setLsDomain] = useState<ConceptDomain>('colors-shapes');
  const [lsSymbol, setLsSymbol] = useState('');
  const [lsImageUrl, setLsImageUrl] = useState('');
  const [lsAudioUrl, setLsAudioUrl] = useState('');
  const [lsExamples, setLsExamples] = useState('');
  const [lsRecommendedAge, setLsRecommendedAge] = useState<RecommendedAgeRange>('1-4');

  // Add Question Form
  const [qSubject, setQSubject] = useState<ExamSubject>('arabic');
  const [qPromptAr, setQPromptAr] = useState('');
  const [qPromptEn, setQPromptEn] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qCorrect, setQCorrect] = useState<'a' | 'b' | 'c'>('a');
  const [qLessonAr, setQLessonAr] = useState('');
  const [qLessonEn, setQLessonEn] = useState('');
  const [qRecommendedAge, setQRecommendedAge] = useState<RecommendedAgeRange>('1-4');

  const adminHeaders = (pinVal: string, json = false): Record<string, string> => {
    const h: Record<string, string> = { 'x-admin-pin': pinVal };
    if (json) h['Content-Type'] = 'application/json';
    if (authSession.csrfToken) h['x-csrf-token'] = authSession.csrfToken;
    return h;
  };

  const fetchOverview = async (adminPin: string) => {
    setLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/admin/overview', {
        credentials: 'include',
        headers: adminHeaders(adminPin),
      });
      if (!res.ok) {
        setAuthError(
          res.status === 403
            ? language === 'ar'
              ? 'حساب الأهل لا يملك صلاحيات الإدارة (RBAC)'
              : 'Parent account does not have Admin role (403 Forbidden)'
            : language === 'ar'
              ? 'رمز الإدارة غير صحيح'
              : 'Invalid Admin PIN',
        );
        setLoading(false);
        return false;
      }
      const data = (await res.json()) as AdminOverviewResponse;
      setOverview(data);
      setPriceEgp(data.examConfig.examPriceEgp);
      setPassPct(data.examConfig.passingPercentage);
      setQCount(data.examConfig.questionsPerExam);
      setUnlockedPin(adminPin);
      setLoading(false);
      return true;
    } catch {
      setAuthError(
        language === 'ar' ? 'تعذر الاتصال بالخادم' : 'Unable to reach admin API',
      );
      setLoading(false);
      return false;
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await fetchOverview(pin.trim());
    if (ok) soundEngine.playSuccess();
    else soundEngine.playEncourage();
  };

  const notify = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(''), 3000);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockedPin) return;
    const res = await fetch('/api/admin/exam-config', {
      method: 'PUT',
      credentials: 'include',
      headers: adminHeaders(unlockedPin, true),
      body: JSON.stringify({
        examPriceEgp: Number(priceEgp),
        passingPercentage: Number(passPct),
        questionsPerExam: Number(qCount),
      }),
    });
    if (res.ok) {
      soundEngine.playSuccess();
      await fetchOverview(unlockedPin);
      notify(language === 'ar' ? 'تم حفظ إعدادات الامتحانات والسعر بنجاح' : 'Exam settings & pricing saved!');
    }
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockedPin || !lsTitleAr.trim() || !lsTitleEn.trim()) return;
    const payload: Omit<CmsLessonRecord, 'id' | 'updatedAt'> = {
      title: { ar: lsTitleAr.trim(), en: lsTitleEn.trim() },
      summary: { ar: lsExplAr.trim() || lsTitleAr.trim(), en: lsExplEn.trim() || lsTitleEn.trim() },
      domain: lsDomain,
      ageGroups: ['1-4'] as AgeGroupId[],
      recommendedAgeRange: lsRecommendedAge,
      targetSymbol: lsSymbol.trim() || '✨',
      imageUrl: lsImageUrl.trim() || undefined,
      audioUrl: lsAudioUrl.trim() || undefined,
      examples: lsExamples
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((item) => ({
          visual: lsSymbol.trim() || '🌟',
          label: { ar: item, en: item },
        })),
      published: true,
    };
    const res = await fetch('/api/admin/lessons', {
      method: 'POST',
      credentials: 'include',
      headers: adminHeaders(unlockedPin, true),
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      soundEngine.playSuccess();
      setLsTitleAr('');
      setLsTitleEn('');
      setLsExplAr('');
      setLsExplEn('');
      setLsSymbol('');
      setLsImageUrl('');
      setLsAudioUrl('');
      setLsExamples('');
      await fetchOverview(unlockedPin);
      notify(language === 'ar' ? 'تم إضافة ونشر الدرس في الأكاديمية!' : 'Lesson created & published!');
    }
  };

  const handleToggleLessonPublish = async (ls: CmsLessonRecord) => {
    if (!unlockedPin) return;
    await fetch(`/api/admin/lessons/${ls.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: adminHeaders(unlockedPin, true),
      body: JSON.stringify({ published: !ls.published }),
    });
    await fetchOverview(unlockedPin);
  };

  const handleDeleteLesson = async (id: string) => {
    if (!unlockedPin) return;
    await fetch(`/api/admin/lessons/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: adminHeaders(unlockedPin),
    });
    await fetchOverview(unlockedPin);
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockedPin || !qPromptAr.trim() || !qOptA.trim() || !qOptB.trim()) return;
    const payload = {
      subject: qSubject === 'comprehensive' ? 'arabic' : qSubject,
      ageGroups: ['1-4'] as AgeGroupId[],
      recommendedAgeRange: qRecommendedAge,
      type: 'problem-solving' as const,
      difficulty: 2 as const,
      lessonRefId: `cms-ref-${Date.now()}`,
      lessonTitle: {
        ar: qLessonAr.trim() || 'درس إضافي من الإدارة',
        en: qLessonEn.trim() || 'Custom Curriculum Lesson',
      },
      prompt: {
        ar: qPromptAr.trim(),
        en: qPromptEn.trim() || qPromptAr.trim(),
      },
      options: [
        { id: 'a', label: { ar: qOptA.trim(), en: qOptA.trim() }, visual: qOptA.trim() },
        { id: 'b', label: { ar: qOptB.trim(), en: qOptB.trim() }, visual: qOptB.trim() },
        ...(qOptC.trim() ? [{ id: 'c', label: { ar: qOptC.trim(), en: qOptC.trim() }, visual: qOptC.trim() }] : []),
      ],
      correctOptionId: qCorrect,
      explanation: {
        ar: `الإجابة الصحيحة هي الخيار ${qCorrect.toUpperCase()}.`,
        en: `The correct choice is option ${qCorrect.toUpperCase()}.`,
      },
      published: true,
    };
    const res = await fetch('/api/admin/questions', {
      method: 'POST',
      credentials: 'include',
      headers: adminHeaders(unlockedPin, true),
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      soundEngine.playSuccess();
      setQPromptAr('');
      setQPromptEn('');
      setQOptA('');
      setQOptB('');
      setQOptC('');
      setQLessonAr('');
      setQLessonEn('');
      await fetchOverview(unlockedPin);
      notify(language === 'ar' ? 'تمت إضافة السؤال إلى بنك الامتحانات!' : 'Question added to exam bank!');
    }
  };

  const handleToggleQuestionPublish = async (q: ExamQuestionItem) => {
    if (!unlockedPin) return;
    await fetch(`/api/admin/questions/${q.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: adminHeaders(unlockedPin, true),
      body: JSON.stringify({ published: q.published === false }),
    });
    await fetchOverview(unlockedPin);
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!unlockedPin) return;
    await fetch(`/api/admin/questions/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: adminHeaders(unlockedPin),
    });
    await fetchOverview(unlockedPin);
  };

  const handleToggleCertRevoke = async (cert: Certificate) => {
    if (!unlockedPin) return;
    await fetch(`/api/admin/certificates/${encodeURIComponent(cert.uniqueCode)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: adminHeaders(unlockedPin, true),
      body: JSON.stringify({ revoked: !cert.revoked }),
    });
    await fetchOverview(unlockedPin);
  };

  if (!unlockedPin || !overview) {
    return (
      <div className="max-w-md mx-auto nono-card rounded-3xl p-6 sm:p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#27345C] text-[#FFD84D] flex items-center justify-center mx-auto">
          <KeyRound className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-[#27345C]">
            {language === 'ar' ? 'نظام إدارة المحتوى والامتحانات (Admin CMS)' : 'Admin Content & Exam CMS'}
          </h2>
          <p className="text-xs text-[#27345C]/75 mt-1">
            {language === 'ar'
              ? 'أدخل رمز الإدارة المُعدّ على الخادم لإدارة الدروس، بنك الأسئلة، سعر الامتحان، والشهادات.'
              : 'Enter the server-configured Admin PIN to manage lessons, exam bank, exam pricing, and certificates.'}
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-3">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder={language === 'ar' ? 'رمز الإدارة (PIN)' : 'Admin PIN'}
            className="w-full h-12 px-4 rounded-2xl bg-white border-2 border-[#27345C]/15 text-center font-mono-num text-lg font-bold outline-none focus:border-[#8054D9]"
            required
          />
          {authError && <p className="text-xs font-bold text-[#FF4D6D]">{authError}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full nono-btn-tactile h-12 rounded-2xl bg-[#27345C] text-white font-extrabold text-sm cursor-pointer"
          >
            {loading
              ? language === 'ar'
                ? 'جاري التحقق...'
                : 'Verifying...'
              : language === 'ar'
                ? 'فتح لوحة الإدارة'
                : 'Unlock Admin CMS'}
          </button>
        </form>
      </div>
    );
  }

  const passedCount = overview.examAttempts.filter((a) => a.passed).length;

  return (
    <div className="space-y-5">
      {/* Admin KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="nono-card rounded-2xl p-4">
          <p className="text-xs font-bold text-[#27345C]/65">
            {language === 'ar' ? 'بنك الأسئلة الإجمالي' : 'Exam Bank Questions'}
          </p>
          <p className="text-2xl font-extrabold text-[#8054D9] font-mono-num mt-1">
            {formatNumber(overview.builtInQuestionsCount + overview.customQuestions.length, language)}
          </p>
        </div>
        <div className="nono-card rounded-2xl p-4">
          <p className="text-xs font-bold text-[#27345C]/65">
            {language === 'ar' ? 'دروس الإدارة المضافة' : 'Custom CMS Lessons'}
          </p>
          <p className="text-2xl font-extrabold text-[#39BDF2] font-mono-num mt-1">
            {formatNumber(overview.customLessons.length, language)}
          </p>
        </div>
        <div className="nono-card rounded-2xl p-4">
          <p className="text-xs font-bold text-[#27345C]/65">
            {language === 'ar' ? 'محاولات الامتحان / الناجحون' : 'Exam Attempts / Passed'}
          </p>
          <p className="text-2xl font-extrabold text-[#55D98B] font-mono-num mt-1">
            {overview.examAttempts.length} · {passedCount}✓
          </p>
        </div>
        <div className="nono-card rounded-2xl p-4">
          <p className="text-xs font-bold text-[#27345C]/65">
            {language === 'ar' ? 'الشهادات الصادرة' : 'Issued Certificates'}
          </p>
          <p className="text-2xl font-extrabold text-[#FF9360] font-mono-num mt-1">
            {formatNumber(overview.certificates.length, language)}
          </p>
        </div>
      </div>

      {statusBanner && (
        <div className="p-3.5 rounded-2xl bg-[#E2F9EC] border border-[#55D98B] text-xs sm:text-sm font-extrabold text-[#27345C] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#55D98B]" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 bg-white p-1.5 rounded-2xl border border-[#27345C]/12">
          {[
            { id: 'config' as const, icon: <Settings className="w-4 h-4" />, ar: 'إعدادات الامتحان والسعر', en: 'Exam & Pricing' },
            { id: 'lessons' as const, icon: <BookOpen className="w-4 h-4" />, ar: 'إدارة الدروس', en: 'Lessons CMS' },
            { id: 'questions' as const, icon: <Database className="w-4 h-4" />, ar: 'بنك الأسئلة', en: 'Question Bank' },
            { id: 'certificates' as const, icon: <Award className="w-4 h-4" />, ar: 'الشهادات والتحليلات', en: 'Certificates & Logs' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                subTab === item.id ? 'bg-[#8054D9] text-white' : 'text-[#27345C]/75 hover:bg-slate-50'
              }`}
            >
              {item.icon}
              <span>{language === 'ar' ? item.ar : item.en}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => fetchOverview(unlockedPin)}
          className="px-3 py-2 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{language === 'ar' ? 'تحديث البيانات' : 'Refresh'}</span>
        </button>
      </div>

      {/* SUBTAB 1: EXAM CONFIG & PRICING */}
      {subTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="nono-card rounded-3xl p-6 space-y-5 max-w-2xl">
          <h3 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#8054D9]" />
            <span>{language === 'ar' ? 'إعدادات الامتحانات الرسمية والتسعير' : 'Official Exam Configuration'}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="space-y-1.5 text-xs font-extrabold text-[#27345C]">
              <span>{language === 'ar' ? 'سعر الشهادة (جنيه مصري)' : 'Exam Price (EGP)'}</span>
              <input
                type="number"
                min={0}
                max={1000}
                value={priceEgp}
                onChange={(e) => setPriceEgp(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-xl bg-white border-2 border-[#27345C]/15 font-mono-num text-base"
              />
            </label>

            <label className="space-y-1.5 text-xs font-extrabold text-[#27345C]">
              <span>{language === 'ar' ? 'نسبة النجاح المطلوبة (%)' : 'Passing Percentage (%)'}</span>
              <input
                type="number"
                min={50}
                max={100}
                value={passPct}
                onChange={(e) => setPassPct(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-xl bg-white border-2 border-[#27345C]/15 font-mono-num text-base"
              />
            </label>

            <label className="space-y-1.5 text-xs font-extrabold text-[#27345C]">
              <span>{language === 'ar' ? 'عدد أسئلة الامتحان الرسمي' : 'Questions Per Official Exam'}</span>
              <input
                type="number"
                min={10}
                max={60}
                value={qCount}
                onChange={(e) => setQCount(Number(e.target.value))}
                className="w-full h-11 px-3 rounded-xl bg-white border-2 border-[#27345C]/15 font-mono-num text-base"
              />
            </label>
          </div>

          <button
            type="submit"
            className="nono-btn-tactile px-6 py-3 rounded-xl bg-[#8054D9] text-white font-extrabold text-sm cursor-pointer"
          >
            {language === 'ar' ? 'حفظ الإعدادات على الخادم' : 'Save Exam Configuration'}
          </button>
        </form>
      )}

      {/* SUBTAB 2: LESSONS CMS */}
      {subTab === 'lessons' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleCreateLesson} className="lg:col-span-5 nono-card rounded-3xl p-6 space-y-3">
            <h3 className="text-lg font-extrabold text-[#27345C]">
              {language === 'ar' ? 'إضافة درس جديد للأكاديمية' : 'Add New Academy Lesson'}
            </h3>
            <input
              type="text"
              value={lsTitleAr}
              onChange={(e) => setLsTitleAr(e.target.value)}
              placeholder={language === 'ar' ? 'عنوان الدرس بالعربية' : 'Arabic Title'}
              className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 text-sm"
              required
            />
            <input
              type="text"
              value={lsTitleEn}
              onChange={(e) => setLsTitleEn(e.target.value)}
              placeholder={language === 'ar' ? 'عنوان الدرس بالإنجليزية' : 'English Title'}
              className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 text-sm"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={lsDomain}
                onChange={(e) => setLsDomain(e.target.value as ConceptDomain)}
                className="h-10 px-2.5 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold"
              >
                <option value="arabic">Arabic</option>
                <option value="english">English</option>
                <option value="numbers">Math & Numbers</option>
                <option value="colors-shapes">Colors & Shapes</option>
                <option value="science">Science & World</option>
              </select>
              <input
                type="text"
                value={lsSymbol}
                onChange={(e) => setLsSymbol(e.target.value)}
                placeholder={language === 'ar' ? 'رمز أو إيموجي (اختياري)' : 'Symbol / Emoji'}
                className="h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 text-sm"
              />
            </div>
            <textarea
              value={lsExplAr}
              onChange={(e) => setLsExplAr(e.target.value)}
              placeholder={language === 'ar' ? 'شرح مبسط بالعربية' : 'Arabic Explanation'}
              className="w-full p-3 rounded-xl bg-white border border-[#27345C]/15 text-sm min-h-[70px]"
            />
            <textarea
              value={lsExplEn}
              onChange={(e) => setLsExplEn(e.target.value)}
              placeholder={language === 'ar' ? 'شرح مبسط بالإنجليزية' : 'English Explanation'}
              className="w-full p-3 rounded-xl bg-white border border-[#27345C]/15 text-sm min-h-[70px]"
            />
            <input
              type="url"
              value={lsImageUrl}
              onChange={(e) => setLsImageUrl(e.target.value)}
              placeholder={language === 'ar' ? 'رابط صورة (اختياري)' : 'Image URL (optional)'}
              className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 text-xs"
            />
            <input
              type="url"
              value={lsAudioUrl}
              onChange={(e) => setLsAudioUrl(e.target.value)}
              placeholder={language === 'ar' ? 'رابط صوت (اختياري)' : 'Audio URL (optional)'}
              className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 text-xs"
            />
            <input
              type="text"
              value={lsExamples}
              onChange={(e) => setLsExamples(e.target.value)}
              placeholder={language === 'ar' ? 'أمثلة مفصولة بفاصلة (تفاحة, وردة)' : 'Comma-separated examples (Apple, Rose)'}
              className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 text-xs"
            />
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-[#27345C]/75">
                {language === 'ar'
                  ? 'المرحلة الموحدة: المستكشفون الصغار (١–٤ سنوات) · التدرج الداخلي الموصى به:'
                  : 'Unified Stage: Little Explorers (1–4 Years) · Internal Recommended Age Range:'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['1-4', '1-2', '2-3', '3-4'] as const).map((band) => (
                  <button
                    key={band}
                    type="button"
                    onClick={() => setLsRecommendedAge(band)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                      lsRecommendedAge === band ? 'bg-[#8054D9] text-white border-[#8054D9]' : 'bg-white border-[#27345C]/15'
                    }`}
                  >
                    {getRecommendedAgeLabel(band, language)}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              className="w-full nono-btn-tactile h-11 rounded-xl bg-[#55D98B] text-[#27345C] font-extrabold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'ar' ? 'نشر الدرس الآن' : 'Publish Lesson'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 nono-card rounded-3xl p-6 space-y-3">
            <h3 className="text-lg font-extrabold text-[#27345C]">
              {language === 'ar' ? 'الدروس المنشورة والمحفوظة' : 'Saved & Published CMS Lessons'}
            </h3>
            {overview.customLessons.length === 0 ? (
              <p className="text-sm text-[#27345C]/70">
                {language === 'ar'
                  ? 'لا توجد دروس إضافية مضافة من لوحة الإدارة بعد.'
                  : 'No custom CMS lessons yet. Add one on the left to publish directly into Nono’s Academy.'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {overview.customLessons.map((ls) => (
                  <div
                    key={ls.id}
                    className="p-3.5 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/12 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <p className="font-extrabold text-sm text-[#27345C]">
                        {ls.targetSymbol ? `${ls.targetSymbol} · ` : ''}{t(ls.title, language)}
                      </p>
                      <p className="text-[11px] text-[#27345C]/65">
                        {ls.domain} · {getSafeStageDisplay(ls.ageGroups[0] || '1-4', language)} ({getRecommendedAgeLabel(ls.recommendedAgeRange || '1-4', language)})
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleLessonPublish(ls)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                          ls.published ? 'bg-[#55D98B] text-[#27345C]' : 'bg-slate-200 text-[#27345C]/70'
                        }`}
                      >
                        {ls.published ? (language === 'ar' ? 'منشور' : 'Published') : (language === 'ar' ? 'مسودة' : 'Draft')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLesson(ls.id)}
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

      {/* SUBTAB 3: QUESTION BANK CMS */}
      {subTab === 'questions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleCreateQuestion} className="lg:col-span-5 nono-card rounded-3xl p-6 space-y-3">
            <h3 className="text-lg font-extrabold text-[#27345C]">
              {language === 'ar' ? 'إضافة سؤال جديد لبنك الامتحانات' : 'Add Custom Exam Question'}
            </h3>
            <select
              value={qSubject}
              onChange={(e) => setQSubject(e.target.value as ExamSubject)}
              className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold"
            >
              <option value="arabic">Arabic</option>
              <option value="english">English</option>
              <option value="math">Math</option>
              <option value="colors-science">Colors & Science</option>
            </select>
            <input
              type="text"
              value={qPromptAr}
              onChange={(e) => setQPromptAr(e.target.value)}
              placeholder={language === 'ar' ? 'نص السؤال بالعربية' : 'Question Prompt (Arabic)'}
              className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 text-sm"
              required
            />
            <input
              type="text"
              value={qPromptEn}
              onChange={(e) => setQPromptEn(e.target.value)}
              placeholder={language === 'ar' ? 'نص السؤال بالإنجليزية' : 'Question Prompt (English)'}
              className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={qOptA}
                onChange={(e) => setQOptA(e.target.value)}
                placeholder="Option A"
                className="h-10 px-2.5 rounded-xl bg-white border border-[#27345C]/15 text-xs"
                required
              />
              <input
                type="text"
                value={qOptB}
                onChange={(e) => setQOptB(e.target.value)}
                placeholder="Option B"
                className="h-10 px-2.5 rounded-xl bg-white border border-[#27345C]/15 text-xs"
                required
              />
              <input
                type="text"
                value={qOptC}
                onChange={(e) => setQOptC(e.target.value)}
                placeholder="Option C"
                className="h-10 px-2.5 rounded-xl bg-white border border-[#27345C]/15 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span>{language === 'ar' ? 'الإجابة الصحيحة:' : 'Correct:'}</span>
              {(['a', 'b', 'c'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setQCorrect(opt)}
                  className={`px-3 py-1 rounded-lg border cursor-pointer uppercase ${
                    qCorrect === opt ? 'bg-[#55D98B] border-[#55D98B] text-[#27345C]' : 'bg-white border-[#27345C]/15'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={qLessonAr}
                onChange={(e) => setQLessonAr(e.target.value)}
                placeholder={language === 'ar' ? 'اسم الدرس المرتبط (عربي)' : 'Lesson Tag (AR)'}
                className="h-10 px-2.5 rounded-xl bg-white border border-[#27345C]/15 text-xs"
              />
              <input
                type="text"
                value={qLessonEn}
                onChange={(e) => setQLessonEn(e.target.value)}
                placeholder={language === 'ar' ? 'اسم الدرس المرتبط (إنجليزي)' : 'Lesson Tag (EN)'}
                className="h-10 px-2.5 rounded-xl bg-white border border-[#27345C]/15 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-[#27345C]/75">
                {language === 'ar'
                  ? 'النطاق العمري الموصى به (ضمن المستكشفون الصغار ١–٤ سنوات):'
                  : 'Recommended Age Range (inside Little Explorers 1–4):'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['1-4', '1-2', '2-3', '3-4'] as const).map((band) => (
                  <button
                    key={band}
                    type="button"
                    onClick={() => setQRecommendedAge(band)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                      qRecommendedAge === band ? 'bg-[#8054D9] text-white border-[#8054D9]' : 'bg-white border-[#27345C]/15'
                    }`}
                  >
                    {getRecommendedAgeLabel(band, language)}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              className="w-full nono-btn-tactile h-11 rounded-xl bg-[#8054D9] text-white font-extrabold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'ar' ? 'إضافة السؤال للبنك' : 'Add Question'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 nono-card rounded-3xl p-6 space-y-3">
            <h3 className="text-lg font-extrabold text-[#27345C]">
              {language === 'ar'
                ? `الأسئلة المخصصة (${overview.customQuestions.length}) + ${overview.builtInQuestionsCount} سؤالاً معتمداً`
                : `Custom Questions (${overview.customQuestions.length}) + ${overview.builtInQuestionsCount} Built-In Questions`}
            </h3>
            {overview.customQuestions.length === 0 ? (
              <p className="text-sm text-[#27345C]/70">
                {language === 'ar'
                  ? 'يحتوي النظام بالفعل على أسئلة معتمدة ومصممة لمرحلة المستكشفون الصغار (١–٤ سنوات)، ويمكنك إضافة أسئلة مخصصة من النموذج.'
                  : 'Validated Little Explorers (1–4 Years) questions are already active across all 4 subjects. Add extra questions on the left.'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {overview.customQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="p-3.5 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/12 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="max-w-md">
                      <p className="font-bold text-sm text-[#27345C]">{t(q.prompt, language)}</p>
                      <p className="text-[11px] text-[#27345C]/65">
                        {q.subject} · {getSafeStageDisplay(q.ageGroups[0] || '1-4', language)} ({getRecommendedAgeLabel(q.recommendedAgeRange || '1-4', language)}) · Correct: {q.correctOptionId.toUpperCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleQuestionPublish(q)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                          q.published !== false ? 'bg-[#55D98B] text-[#27345C]' : 'bg-slate-200 text-[#27345C]/70'
                        }`}
                      >
                        {q.published !== false ? (language === 'ar' ? 'مفعل' : 'Active') : (language === 'ar' ? 'مخفي' : 'Hidden')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
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

      {/* SUBTAB 4: CERTIFICATES & EXAM ANALYTICS */}
      {subTab === 'certificates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 nono-card rounded-3xl p-6 space-y-3">
            <h3 className="text-lg font-extrabold text-[#27345C]">
              {language === 'ar' ? 'الشهادات الرسمية الصادرة' : 'Issued Official Certificates'}
            </h3>
            {overview.certificates.length === 0 ? (
              <p className="text-sm text-[#27345C]/70">
                {language === 'ar'
                  ? 'لم تصدر شهادات رسمية بعد. تصدر الشهادة تلقائياً عند اجتياز امتحان رسمي بنسبة ٧٠٪ فأكثر.'
                  : 'No official certificates issued yet. Certificates auto-generate upon passing an official verified exam (≥70%).'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {overview.certificates.map((cert) => (
                  <div
                    key={cert.uniqueCode}
                    className="p-3.5 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/12 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <p className="font-extrabold text-sm text-[#27345C]">
                        {cert.childName} · <span className="font-mono-num text-[#8054D9]">{cert.uniqueCode}</span>
                      </p>
                      <p className="text-[11px] text-[#27345C]/65">
                        {cert.score}/{cert.totalQuestions} ({cert.percentage}%) · {formatDate(cert.issuedAt, language)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCert(cert)}
                        className="px-3 py-1.5 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'عرض' : 'View'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleCertRevoke(cert)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                          cert.revoked
                            ? 'bg-[#FF4D6D]/15 text-[#FF4D6D]'
                            : 'bg-[#55D98B]/20 text-[#27345C]'
                        }`}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>
                          {cert.revoked
                            ? language === 'ar'
                              ? 'ملغاة (استعادة)'
                              : 'Revoked (Restore)'
                            : language === 'ar'
                              ? 'سارية (إلغاء)'
                              : 'Active (Revoke)'}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-6 nono-card rounded-3xl p-6 space-y-3">
            <h3 className="text-lg font-extrabold text-[#27345C]">
              {language === 'ar' ? 'سجل الامتحانات الأخيرة على الخادم' : 'Server Exam Attempt Logs'}
            </h3>
            {overview.examAttempts.length === 0 ? (
              <p className="text-sm text-[#27345C]/70">
                {language === 'ar' ? 'لا توجد محاولات امتحانات مسجلة بعد.' : 'No completed exam attempts recorded yet.'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {overview.examAttempts.slice(0, 10).map((att) => (
                  <div
                    key={att.id}
                    className="p-3 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-extrabold text-[#27345C]">
                        {att.childName} · {att.subject} ({att.mode})
                      </p>
                      <p className="text-[#27345C]/65">
                        {formatDate(att.completedAt, language)} · {att.ageGroup}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg font-extrabold font-mono-num ${
                        att.passed ? 'bg-[#55D98B]/25 text-[#27345C]' : 'bg-[#FF4D6D]/15 text-[#FF4D6D]'
                      }`}
                    >
                      {att.score}/{att.totalQuestions} ({att.percentage}%)
                    </span>
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
    </div>
  );
};
