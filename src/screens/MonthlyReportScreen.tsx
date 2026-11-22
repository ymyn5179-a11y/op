import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  Flame,
  Printer,
  Save,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { NonoLandLogo } from '../components/NonoLandLogo';
import { useNonoLand } from '../context/NonoLandContext';
import { DEFAULT_NEXT_MONTH_PLAN } from '../data/worldCatalog';
import { buildMonthlyReport, getCurrentMonthKey } from '../engine/monthlyReportEngine';
import { formatNumber, getAgeGroupMeta, t } from '../i18n/translations';
import { LearningPlanGoal, MonthlyReportData } from '../types/nonoland';
import { exportMonthlyReportPdf } from '../utils/pdfReportExporter';
import { soundEngine } from '../utils/soundEngine';

export const MonthlyReportScreen: React.FC = () => {
  const { activeChild, authSession, language, navigate, saveLearningPlan } = useNonoLand();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthKey());
  const [compareMonth, setCompareMonth] = useState<string>('');
  const [report, setReport] = useState<MonthlyReportData | null>(() =>
    activeChild ? buildMonthlyReport(activeChild, getCurrentMonthKey()) : null,
  );
  const [planDraft, setPlanDraft] = useState<LearningPlanGoal[]>(() =>
    activeChild?.nextMonthPlan?.length ? activeChild.nextMonthPlan : DEFAULT_NEXT_MONTH_PLAN,
  );
  const [savingPlan, setSavingPlan] = useState(false);
  const [planSavedMsg, setPlanSavedMsg] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft;
  const isParentOrAdmin =
    !authSession.authenticated ||
    authSession.user?.role === 'parent' ||
    ['super_admin', 'admin', 'content_admin'].includes(authSession.user?.role || '');

  useEffect(() => {
    if (!activeChild) return;
    setPlanDraft(
      activeChild.nextMonthPlan?.length ? activeChild.nextMonthPlan : DEFAULT_NEXT_MONTH_PLAN,
    );
  }, [activeChild]);

  useEffect(() => {
    if (!activeChild) return;
    const localReport = buildMonthlyReport(
      activeChild,
      selectedMonth,
      compareMonth || undefined,
    );
    setReport(localReport);

    if (!authSession.authenticated) return;
    let cancelled = false;
    const params = new URLSearchParams({ month: selectedMonth });
    if (compareMonth) params.set('compareWith', compareMonth);

    fetch(`/api/children/${encodeURIComponent(activeChild.id)}/monthly-report?${params.toString()}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.report) {
          setReport(data.report);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeChild, authSession.authenticated, selectedMonth, compareMonth]);

  if (!activeChild || !report) return null;

  const handleSavePlan = async () => {
    setSavingPlan(true);
    setPlanSavedMsg('');
    try {
      await saveLearningPlan({ nextMonthPlan: planDraft });
      soundEngine.playSuccess();
      setPlanSavedMsg(
        language === 'ar'
          ? 'تم حفظ خطة الشهر القادم لملف الطفل ✓'
          : 'Next month learning plan saved ✓',
      );
    } catch {
      soundEngine.playEncourage();
      setPlanSavedMsg(
        language === 'ar'
          ? 'تعديل الخطة مخصص لحساب ولي الأمر فقط'
          : 'Only parents can modify learning plans',
      );
    } finally {
      setSavingPlan(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      soundEngine.playPop();
      await exportMonthlyReportPdf(report, language);
      soundEngine.playSuccess();
    } finally {
      setExportingPdf(false);
    }
  };

  const notEnoughText = language === 'ar' ? 'لا توجد بيانات كافية بعد' : 'Not enough data';

  return (
    <div className="space-y-6">
      {/* Screen Header Controls (Hidden when printing) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('parent-dashboard')}
            className="min-h-[44px] px-4 rounded-xl bg-white border border-[#27345C]/15 text-xs sm:text-sm font-extrabold text-[#27345C] flex items-center gap-1.5 cursor-pointer"
          >
            <BackIcon className="w-4 h-4" />
            <span>{language === 'ar' ? 'لوحة الأهل' : 'Parent Dashboard'}</span>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'التقرير الشهري لتطور الطفل' : 'Monthly Child Development Report'}
            </h1>
            <p className="text-xs text-[#27345C]/70">
              {report.childName} · {t(getAgeGroupMeta(report.ageGroup).label, language)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={exportingPdf}
            className="nono-btn-tactile min-h-[44px] px-4 rounded-xl bg-[#8054D9] text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>
              {exportingPdf
                ? language === 'ar'
                  ? 'جاري تجهيز PDF...'
                  : 'Preparing PDF...'
                : language === 'ar'
                  ? 'تنزيل التقرير (PDF)'
                  : 'Download PDF Report'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[44px] px-4 rounded-xl bg-[#27345C] text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* Month & Comparison Controls */}
      <div className="nono-card rounded-3xl p-4 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-extrabold text-[#27345C]">
            <Calendar className="w-4 h-4 text-[#8054D9]" />
            <span>{language === 'ar' ? 'اختر الشهر:' : 'Select Month:'}</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="min-h-[40px] px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 font-bold"
            >
              {report.availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-extrabold text-[#27345C]">
            <TrendingUp className="w-4 h-4 text-[#39BDF2]" />
            <span>{language === 'ar' ? 'مقارنة مع شهر:' : 'Compare With:'}</span>
            <select
              value={compareMonth}
              onChange={(e) => setCompareMonth(e.target.value)}
              className="min-h-[40px] px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 font-bold"
            >
              <option value="">{language === 'ar' ? 'بدون مقارنة' : 'None'}</option>
              {report.availableMonths
                .filter((m) => m !== selectedMonth)
                .map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>
          </label>
        </div>

        {report.comparison && (
          <div className="text-xs font-bold text-[#27345C] px-3 py-1.5 rounded-xl bg-[#E5F6FF] border border-[#39BDF2]/30">
            {report.comparison.baselineAvailable ? (
              <span>
                {language === 'ar'
                  ? `مقارنة مع ${report.comparison.compareMonthKey}: الدروس (${report.comparison.lessonsDelta >= 0 ? '+' : ''}${report.comparison.lessonsDelta}) · الدقائق (${report.comparison.minutesDelta >= 0 ? '+' : ''}${report.comparison.minutesDelta}د)`
                  : `vs ${report.comparison.compareMonthKey}: Lessons (${report.comparison.lessonsDelta >= 0 ? '+' : ''}${report.comparison.lessonsDelta}) · Minutes (${report.comparison.minutesDelta >= 0 ? '+' : ''}${report.comparison.minutesDelta}m)`}
              </span>
            ) : (
              <span>
                {language === 'ar'
                  ? `لا توجد لقطة تاريخية للشهر ${report.comparison.compareMonthKey} للمقارنة.`
                  : `Not enough historical snapshot data for ${report.comparison.compareMonthKey}.`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* PRINTABLE REPORT SHEET */}
      <div id="printable-monthly-report" className="space-y-6">
        {/* Banner Header */}
        <section className="rounded-[2rem] p-6 sm:p-8 bg-gradient-to-br from-[#6236B8] via-[#8054D9] to-[#39BDF2] text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <NonoLandLogo variant="compact" size="lg" showWordmark={false} tone="dark" language={language} />
              <div className="space-y-1.5">
                <p className="text-xs font-extrabold text-[#FFD84D]">
                  {language === 'ar'
                    ? 'نونو لاند · التقرير الشهري الموثق'
                    : 'NonoLand · Monthly Progress Overview'}
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold">
                  {report.childName} — {report.monthKey}
                </h2>
              <p className="text-xs sm:text-sm text-white/90">
                {language === 'ar'
                  ? `المرحلة التعليمية: ${t(getAgeGroupMeta(report.ageGroup).label, language)} · بيانات حقيقية مبنية على سجل التعلم`
                  : `Stage: ${t(getAgeGroupMeta(report.ageGroup).label, language)} · Calculated strictly from saved activity records`}
              </p>
              </div>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white/15 border border-white/25 flex items-center gap-3">
              <Flame className="w-7 h-7 text-[#FFD84D]" />
              <div>
                <p className="text-xs font-bold text-white/80">
                  {language === 'ar' ? 'السلسلة التعليمية' : 'Learning Streak'}
                </p>
                <p className="text-2xl font-extrabold tabular-nums">
                  {formatNumber(report.learningStreakDays, language)}{' '}
                  {language === 'ar' ? 'أيام' : 'day(s)'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* KPI Cards Grid */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {
              ar: 'أيام التعلم',
              en: 'Learning Days',
              val: formatNumber(report.learningDaysCount, language),
              color: '#8054D9',
            },
            {
              ar: 'وقت التعلم',
              en: 'Time Spent',
              val: `${formatNumber(report.totalLearningMinutes, language)}m`,
              color: '#39BDF2',
            },
            {
              ar: 'دروس متقنة',
              en: 'Lessons Done',
              val: formatNumber(report.completedLessonsCount, language),
              color: '#55D98B',
            },
            {
              ar: 'أنشطة وألعاب',
              en: 'Activities',
              val: formatNumber(report.completedActivitiesCount, language),
              color: '#FF9360',
            },
            {
              ar: 'تجارب المختبر',
              en: 'Lab Sims',
              val: formatNumber(report.completedLabCount, language),
              color: '#6366F1',
            },
            {
              ar: 'قصص وتقييمات',
              en: 'Stories & Exams',
              val: formatNumber(report.completedStoriesCount + report.assessmentsCount, language),
              color: '#FF78B7',
            },
          ].map((k) => (
            <div key={k.en} className="nono-card rounded-2xl p-4 text-center">
              <p className="text-2xl sm:text-3xl font-extrabold font-mono-num" style={{ color: k.color }}>
                {k.val}
              </p>
              <p className="text-xs font-bold text-[#27345C]/75 mt-1">
                {language === 'ar' ? k.ar : k.en}
              </p>
            </div>
          ))}
        </section>

        {/* 6-Subject Breakdown (Honest Baseline vs Current vs Delta) */}
        <section className="nono-card rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#8054D9]" />
                <span>
                  {language === 'ar'
                    ? 'الأداء حسب المجالات السبعة (بداية الشهر مقابل الحالي)'
                    : '7-Domain Growth Breakdown (Starting Baseline vs Current)'}
                </span>
              </h3>
              <p className="text-xs text-[#27345C]/70 mt-0.5">
                {language === 'ar'
                  ? 'نلتزم بالدقة الكاملة: إذا لم تتوفر نقطة بداية مسجلة يظهر "لا توجد بيانات كافية بعد".'
                  : 'Transparent analytics: when historical baseline snapshots are absent, "Not enough data" is shown explicitly.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.subjectBreakdown.map((subj) => (
              <div
                key={subj.subjectKey}
                className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-extrabold text-base text-[#27345C]">
                    {t(subj.title, language)}
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-lg bg-white border border-[#27345C]/10 text-[11px] font-extrabold text-[#8054D9]">
                    {t(subj.currentLevelLabel, language)}
                  </span>
                </div>

                {subj.subjectKey === 'quran-values' ? (
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-white border border-[#27345C]/8">
                      <p className="text-[10px] font-bold text-[#27345C]/60">
                        {language === 'ar' ? 'الأنشطة والجلسات' : 'Moments Logged'}
                      </p>
                      <p className="text-xs sm:text-sm font-extrabold text-[#047857] tabular-nums mt-0.5">
                        {formatNumber(subj.completedLessonsAndActivities, language)}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-[#27345C]/8">
                      <p className="text-[10px] font-bold text-[#27345C]/60">
                        {language === 'ar' ? 'نظام التقييم' : 'Assessment'}
                      </p>
                      <p className="text-xs sm:text-sm font-extrabold text-[#27345C] mt-0.5">
                        {language === 'ar' ? 'مستقل عن الاختبارات' : 'Exam-Free'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-white border border-[#27345C]/8">
                      <p className="text-[10px] font-bold text-[#27345C]/60">
                        {language === 'ar' ? 'نقطة البداية' : 'Start Baseline'}
                      </p>
                      <p className="text-xs sm:text-sm font-extrabold text-[#27345C] tabular-nums mt-0.5">
                        {subj.baselineAvailable && subj.baselineAccuracyPct !== null
                          ? `${subj.baselineAccuracyPct}%`
                          : notEnoughText}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-[#27345C]/8">
                      <p className="text-[10px] font-bold text-[#27345C]/60">
                        {language === 'ar' ? 'المستوى الحالي' : 'Current'}
                      </p>
                      <p className="text-xs sm:text-sm font-extrabold text-[#39BDF2] tabular-nums mt-0.5">
                        {subj.currentAccuracyPct !== null ? `${subj.currentAccuracyPct}%` : notEnoughText}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-[#27345C]/8">
                      <p className="text-[10px] font-bold text-[#27345C]/60">
                        {language === 'ar' ? 'التحسن' : 'Change'}
                      </p>
                      <p
                        className={`text-xs sm:text-sm font-extrabold tabular-nums mt-0.5 ${
                          subj.improvementDeltaPct === null
                            ? 'text-[#64748B]'
                            : subj.improvementDeltaPct >= 0
                              ? 'text-[#166534]'
                              : 'text-[#B45309]'
                        }`}
                      >
                        {subj.improvementDeltaPct !== null
                          ? `${subj.improvementDeltaPct >= 0 ? '+' : ''}${subj.improvementDeltaPct}%`
                          : notEnoughText}
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-xs text-[#27345C]/80 leading-relaxed">{t(subj.note, language)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Achievements, Strengths & Gentle Focus */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="nono-card rounded-3xl p-5 space-y-3">
            <h3 className="font-extrabold text-base text-[#27345C] flex items-center gap-2">
              <Award className="w-5 h-5 text-[#FF9360]" />
              <span>{language === 'ar' ? 'الإنجازات والأوسمة' : 'Achievements Earned'}</span>
            </h3>
            {report.achievementsEarned.length === 0 ? (
              <p className="text-xs text-[#27345C]/70">
                {language === 'ar'
                  ? 'لم تُفتح أوسمة بعد؛ سيُضاف كل وسام تلقائياً عند إتمام نشاطه.'
                  : 'No badges unlocked yet; badges appear automatically upon milestone completion.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {report.achievementsEarned.map((b) => (
                  <span
                    key={b.id}
                    className="px-3 py-1.5 rounded-xl bg-[#FFF8E9] border border-[#FFD84D] text-xs font-extrabold text-[#27345C]"
                  >
                    {b.emoji} {t(b.title, language)}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs font-bold text-[#8054D9]">
              {language === 'ar'
                ? `إجمالي النجوم: ${formatNumber(report.starsEarnedTotal, language)} · الشهادات: ${formatNumber(report.certificatesCount, language)}`
                : `Total Stars: ${report.starsEarnedTotal} · Certificates: ${report.certificatesCount}`}
            </p>
          </div>

          <div className="nono-card rounded-3xl p-5 space-y-3 bg-[#E2F9EC]/45">
            <h3 className="font-extrabold text-base text-[#14532D] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#166534]" />
              <span>{language === 'ar' ? 'أبرز نقاط القوة' : 'Highlighted Strengths'}</span>
            </h3>
            <ul className="space-y-2 text-xs font-bold text-[#27345C]/85">
              {report.strengths.map((s, idx) => (
                <li key={idx} className="p-2.5 rounded-xl bg-white/80 border border-[#55D98B]/30">
                  {t(s, language)}
                </li>
              ))}
            </ul>
          </div>

          <div className="nono-card rounded-3xl p-5 space-y-3 bg-[#FFF3D1]/50">
            <h3 className="font-extrabold text-base text-[#92400E] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D97706]" />
              <span>{language === 'ar' ? 'مجالات تحتاج دعم لطيف' : 'Gentle Attention Areas'}</span>
            </h3>
            <ul className="space-y-2 text-xs font-bold text-[#27345C]/85">
              {report.areasNeedingAttention.map((s, idx) => (
                <li key={idx} className="p-2.5 rounded-xl bg-white/80 border border-[#FFD84D]/50">
                  {t(s, language)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Reading Adventure & Shared Family Co-Play Summary */}
        {(() => {
          const masteredReadingCount = Object.values(activeChild.readingStageProgress || {}).filter(
            (s) => s.mastered,
          ).length;
          const nextReadingStage = Math.min(8, masteredReadingCount + 1);
          return (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="nono-card rounded-3xl p-5 space-y-2.5 bg-[#FFF8E9]/80">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-[#27345C]">
                    {language === 'ar' ? 'تقدّم مغامرة القراءة (٨ مراحل)' : 'Reading Adventure Mastery (8 Stages)'}
                  </h3>
                  <span className="px-2.5 py-1 rounded-xl bg-[#FF9360]/20 text-[#9A3412] text-xs font-extrabold font-mono-num">
                    {masteredReadingCount} / 8
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-white border border-[#27345C]/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#FF9360] to-[#8054D9]"
                    style={{
                      width: `${Math.round((masteredReadingCount / 8) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-[#27345C]/75">
                  {language === 'ar'
                    ? `المرحلة الحالية: المرحلة ${nextReadingStage} · يتم فتح كل مرحلة بعد إتقان السابقة.`
                    : `Current stage: Stage ${nextReadingStage} · Sequential prerequisite mastery enforced.`}
                </p>
              </div>

              <div className="nono-card rounded-3xl p-5 space-y-2.5 bg-[#E2F9EC]/50">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-[#14532D]">
                    {language === 'ar' ? 'الأنشطة العائلية المشتركة' : 'Parent-Child Shared Activities'}
                  </h3>
                  <span className="px-2.5 py-1 rounded-xl bg-[#55D98B]/30 text-[#14532D] text-xs font-extrabold font-mono-num">
                    {(activeChild.familyActivitiesCompleted || []).length}
                  </span>
                </div>
                <p className="text-xs text-[#27345C]/80 leading-relaxed">
                  {language === 'ar'
                    ? 'تُوثَّق جلسات اللعب والقراءة المشتركة مع الأهل بشكل مستقل لتشجيع العادات الإيجابية دون تضخيم نسب الإتقان الأكاديمي المستقل للطفل.'
                    : 'Shared parent-child activities are logged separately to celebrate bonding and habits without inflating independent academic mastery scores.'}
                </p>
              </div>
            </section>
          );
        })()}

        {/* Editable Next Month Learning Plan */}
        <section className="nono-card rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-extrabold text-[#27345C]">
                {language === 'ar' ? 'خطة التعلم للشهر القادم' : 'Next Month Learning Plan'}
              </h3>
              <p className="text-xs text-[#27345C]/70">
                {language === 'ar'
                  ? 'يمكن لولي الأمر تعديل الأهداف الأسبوعية والشهرية وحفظها مباشرة.'
                  : 'Parents can tailor target goal counts and focus notes for the upcoming month.'}
              </p>
            </div>
            {isParentOrAdmin && (
              <button
                type="button"
                onClick={() => void handleSavePlan()}
                disabled={savingPlan}
                className="print:hidden min-h-[44px] px-4 rounded-xl bg-[#8054D9] text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>
                  {savingPlan
                    ? language === 'ar'
                      ? 'جاري الحفظ...'
                      : 'Saving...'
                    : language === 'ar'
                      ? 'حفظ الخطة'
                      : 'Save Plan'}
                </span>
              </button>
            )}
          </div>

          {planSavedMsg && (
            <p className="text-xs font-extrabold text-[#166534] bg-[#E2F9EC] px-3 py-2 rounded-xl">
              {planSavedMsg}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {planDraft.map((goal, idx) => (
              <div
                key={goal.id}
                className={`p-4 rounded-2xl border-2 space-y-2 ${
                  goal.enabled ? 'bg-[#FFF8E9] border-[#8054D9]/25' : 'bg-slate-50 border-slate-200 opacity-65'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer font-extrabold text-sm text-[#27345C]">
                    <input
                      type="checkbox"
                      checked={goal.enabled}
                      disabled={!isParentOrAdmin}
                      onChange={(e) =>
                        setPlanDraft((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, enabled: e.target.checked } : item)),
                        )
                      }
                      className="w-4 h-4 accent-[#8054D9]"
                    />
                    <span>{t(goal.title, language)}</span>
                  </label>
                  <div className="flex items-center gap-1 text-xs font-extrabold">
                    <span>{language === 'ar' ? 'الهدف:' : 'Goal:'}</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      disabled={!isParentOrAdmin}
                      value={goal.targetCount}
                      onChange={(e) =>
                        setPlanDraft((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, targetCount: Math.max(1, Math.min(30, Number(e.target.value) || 1)) }
                              : item,
                          ),
                        )
                      }
                      className="w-14 h-8 px-2 rounded-lg bg-white border border-[#27345C]/15 text-center font-mono-num"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  disabled={!isParentOrAdmin}
                  value={language === 'ar' ? goal.focusNote.ar : goal.focusNote.en}
                  onChange={(e) =>
                    setPlanDraft((prev) =>
                      prev.map((item, i) =>
                        i === idx
                          ? {
                              ...item,
                              focusNote: {
                                ...item.focusNote,
                                [language]: e.target.value,
                              },
                            }
                          : item,
                      ),
                    )
                  }
                  className="w-full h-9 px-3 rounded-xl bg-white border border-[#27345C]/12 text-xs font-semibold text-[#27345C]"
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
