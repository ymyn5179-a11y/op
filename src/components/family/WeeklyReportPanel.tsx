import React, { useEffect, useState } from 'react';
import { Calendar, Download, FileBarChart2, Printer } from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { SKILL_LABELS } from '../../i18n/translations';
import { WeeklyReportData } from '../../types/nonoland';
import { familyApi } from './shared';

export const WeeklyReportPanel: React.FC = () => {
  const { activeChild, authSession, childrenList, language, navigate, selectChild } = useNonoLand();
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeChild || !authSession.authenticated || activeChild.id.startsWith('demo-')) {
      setReport(null);
      return;
    }
    setLoading(true);
    const qs = selectedWeek ? `?weekStart=${encodeURIComponent(selectedWeek)}` : '';
    void familyApi<{ report: WeeklyReportData; availableWeeks: string[] }>(
      `/api/family/children/${encodeURIComponent(activeChild.id)}/weekly-report${qs}`,
      authSession.csrfToken,
    ).then((res) => {
      setLoading(false);
      if (res.ok && res.data) {
        setReport(res.data.report);
        setAvailableWeeks(res.data.availableWeeks || []);
      }
    });
  }, [activeChild?.id, authSession.authenticated, authSession.csrfToken, selectedWeek]);

  if (!activeChild) {
    return (
      <div className="nono-card rounded-3xl p-8 bg-white text-center space-y-3">
        <FileBarChart2 className="w-8 h-8 text-[#8054D9] mx-auto" />
        <p className="text-base font-extrabold text-[#27345C]">
          {language === 'ar'
            ? 'أضف ملف طفل لعرض التقرير الأسبوعي للعائلة'
            : 'Add a child profile to view Weekly Family Progress Reports'}
        </p>
        <button
          type="button"
          onClick={() => navigate('create-child')}
          className="nono-btn-tactile px-5 py-2.5 rounded-xl bg-[#8054D9] text-white text-xs sm:text-sm font-extrabold cursor-pointer"
        >
          {language === 'ar' ? '+ إضافة طفل' : '+ Add Child'}
        </button>
      </div>
    );
  }

  const handleDownloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nonoland-weekly-${report.childName}-${report.weekStart}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="nono-card rounded-3xl p-5 sm:p-6 bg-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
              <FileBarChart2 className="w-6 h-6 text-[#8054D9]" />
              <span>{language === 'ar' ? 'تقرير التقدم الأسبوعي للعائلة' : 'Weekly Family Progress Report'}</span>
            </h2>
            <p className="text-xs font-bold text-[#27345C]/70">
              {language === 'ar'
                ? 'محسوب بدقة من الجلسات والدروس المسجلة خلال الأسبوع (توقيت UTC · بدون أرقام تقديرية مصطنعة).'
                : 'Calculated strictly from genuine recorded timestamps (Monday–Sunday UTC · zero fabricated screen time).'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeChild.id}
              onChange={(e) => selectChild(e.target.value)}
              className="min-h-[38px] px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-xs font-extrabold"
            >
              {childrenList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>

            {availableWeeks.length > 0 && (
              <select
                value={selectedWeek || report?.weekStart || availableWeeks[0]}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="min-h-[38px] px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-xs font-mono-num font-bold"
              >
                {availableWeeks.map((wk) => (
                  <option key={wk} value={wk}>
                    {language === 'ar' ? `أسبوع ${wk}` : `Week of ${wk}`}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[38px] px-3 rounded-xl bg-[#27345C] text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
            </button>
            <button
              type="button"
              disabled={!report}
              onClick={handleDownloadJson}
              className="min-h-[38px] px-3 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-45"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'تصدير' : 'Export'}</span>
            </button>
          </div>
        </div>

        {loading && <p className="text-xs font-bold text-[#27345C]/70">{language === 'ar' ? 'جارٍ التحميل...' : 'Loading report...'}</p>}

        {report && (
          <>
            <div className="p-4 rounded-2xl bg-[#F4EEFF] border border-[#8054D9]/20 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-extrabold text-[#27345C]">{report.summaryMessage[language]}</p>
              <span className="text-xs font-mono-num font-bold text-[#6D28D9] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {report.weekStart} → {report.weekEnd}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  ar: 'وقت التعلم المسجل',
                  en: 'Recorded Minutes',
                  val: `${report.metrics.totalMinutes}m`,
                  delta: report.comparisonPreviousWeek.minutesDelta,
                },
                {
                  ar: 'الأيام النشطة',
                  en: 'Active Days',
                  val: `${report.metrics.activeDaysCount} / 7`,
                },
                {
                  ar: 'الدروس المكتملة / المحاولات',
                  en: 'Completed / Attempted',
                  val: `${report.metrics.lessonsCompleted} / ${report.metrics.lessonsAttempted}`,
                  delta: report.comparisonPreviousWeek.lessonsDelta,
                },
                {
                  ar: 'النجوم المكتسبة',
                  en: 'Stars Earned',
                  val: `${report.metrics.starsEarned} ⭐`,
                  delta: report.comparisonPreviousWeek.starsDelta,
                },
              ].map((kpi, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10">
                  <p className="text-[11px] font-bold text-[#27345C]/70">{kpi[language]}</p>
                  <p className="text-2xl font-extrabold text-[#27345C] font-mono-num mt-1">{kpi.val}</p>
                  {typeof kpi.delta === 'number' && (
                    <p className="text-[11px] font-bold text-[#8054D9] mt-0.5">
                      {kpi.delta >= 0 ? `+${kpi.delta}` : kpi.delta}{' '}
                      {language === 'ar' ? 'مقارنة بالأسبوع السابق' : 'vs previous week'}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#27345C]/10 space-y-2.5">
                <p className="text-xs font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'النشاط اليومي خلال الأسبوع' : 'Daily Activity Breakdown'}
                </p>
                <div className="grid grid-cols-7 gap-1.5 items-end h-28 pt-2">
                  {report.dailyBreakdown.map((d) => {
                    const hPct = d.activitiesCount > 0 ? Math.min(100, Math.max(20, d.activitiesCount * 22)) : 8;
                    return (
                      <div key={d.date} className="flex flex-col items-center gap-1 h-full justify-end">
                        <span className="text-[10px] font-mono-num font-bold text-[#8054D9]">
                          {d.activitiesCount > 0 ? d.activitiesCount : '0'}
                        </span>
                        <div
                          className={`w-full rounded-lg ${
                            d.activitiesCount > 0 ? 'bg-[#8054D9]' : 'bg-slate-200'
                          }`}
                          style={{ height: `${hPct}%` }}
                        />
                        <span className="text-[9px] font-mono-num text-[#27345C]/65">{d.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#E5F6FF]/55 border border-[#39BDF2]/30 space-y-2.5 text-xs">
                <p className="font-extrabold text-[#0369A1]">
                  {language === 'ar' ? 'التركيز الموصى به للأسبوع القادم' : 'Recommended Focus Next'}
                </p>
                <p className="font-extrabold text-sm text-[#27345C]">
                  {report.recommendedFocus.label[language]}
                </p>
                <p className="font-bold text-[#27345C]/80">{report.recommendedFocus.suggestion[language]}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {report.strongSkills.slice(0, 3).map((sk) => (
                    <span key={sk} className="px-2 py-0.5 rounded-lg bg-[#DCFCE7] text-[#15803D] font-extrabold">
                      ✓ {SKILL_LABELS[sk][language]}
                    </span>
                  ))}
                  {report.supportSkills.slice(0, 2).map((sk) => (
                    <span key={sk} className="px-2 py-0.5 rounded-lg bg-[#FFEDD5] text-[#9A3412] font-extrabold">
                      🌱 {SKILL_LABELS[sk][language]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
