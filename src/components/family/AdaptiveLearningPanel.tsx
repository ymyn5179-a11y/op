import React, { useEffect, useState } from 'react';
import { Brain, Compass, Sparkles } from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { AdaptiveLearningProfileData, AdaptiveSkillStatus } from '../../types/nonoland';
import { familyApi } from './shared';

const STATUS_BADGES: Record<AdaptiveSkillStatus, { ar: string; en: string; cls: string }> = {
  'not-started': { ar: 'لم يبدأ بعد', en: 'Not Started', cls: 'bg-slate-100 text-slate-600' },
  learning: { ar: 'قيد التعرّف', en: 'Learning', cls: 'bg-[#E5F6FF] text-[#0369A1]' },
  practicing: { ar: 'يتدرب حالياً', en: 'Practicing', cls: 'bg-[#FEF3C7] text-[#92400E]' },
  improving: { ar: 'يتحسن باستمرار', en: 'Improving', cls: 'bg-[#F3ECFF] text-[#6D28D9]' },
  demonstrated: { ar: 'تم إتقانه بأدلة', en: 'Demonstrated', cls: 'bg-[#DCFCE7] text-[#15803D]' },
  'needs-revision': { ar: 'يستفيد من مراجعة', en: 'Needs Gentle Review', cls: 'bg-[#FFEDD5] text-[#9A3412]' },
};

export const AdaptiveLearningPanel: React.FC = () => {
  const { activeChild, authSession, language, navigate } = useNonoLand();
  const [profile, setProfile] = useState<AdaptiveLearningProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeChild || !authSession.authenticated || activeChild.id.startsWith('demo-')) {
      setProfile(null);
      return;
    }
    setLoading(true);
    void familyApi<AdaptiveLearningProfileData>(
      `/api/family/children/${encodeURIComponent(activeChild.id)}/adaptive-profile`,
      authSession.csrfToken,
    ).then((res) => {
      setLoading(false);
      if (res.ok && res.data) setProfile(res.data);
    });
  }, [activeChild?.id, authSession.authenticated, authSession.csrfToken]);

  if (!activeChild) {
    return (
      <div className="nono-card rounded-3xl p-8 bg-white text-center space-y-3">
        <Brain className="w-8 h-8 text-[#8054D9] mx-auto" />
        <p className="text-base font-extrabold text-[#27345C]">
          {language === 'ar'
            ? 'أضف ملف طفل لعرض الملف التعليمي التكيفي'
            : 'Add a child profile to view the Adaptive Learning Profile'}
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

  return (
    <div className="space-y-5">
      <div className="nono-card rounded-3xl p-5 sm:p-6 bg-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
              <Brain className="w-6 h-6 text-[#8054D9]" />
              <span>
                {language === 'ar'
                  ? `الملف التعليمي التكيفي — ${activeChild.displayName}`
                  : `Adaptive Learning Profile — ${activeChild.displayName}`}
              </span>
            </h2>
            <p className="text-xs font-bold text-[#27345C]/70">
              {language === 'ar'
                ? 'تتبع تطوري شفاف لـ ١٠ مجالات مهارية (أدلة متعددة · بدون تصنيفات طبية أو اختبارات ذكاء).'
                : 'Transparent developmental view across 10 skill domains (multi-evidence mastery · non-diagnostic & no IQ labels).'}
            </p>
          </div>
          <span className="px-3 py-1 rounded-xl bg-[#F3ECFF] text-xs font-extrabold text-[#8054D9]">
            {profile?.stageLabel[language] || (language === 'ar' ? 'المستكشف الصغير (١–٤ سنوات)' : 'Little Explorers (1–4 Years)')}
          </span>
        </div>

        {loading && (
          <p className="text-xs font-bold text-[#27345C]/65">
            {language === 'ar' ? 'جاري حساب الملف التكيفي...' : 'Calculating adaptive profile...'}
          </p>
        )}

        {profile?.nextRecommendedActivity && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#E5F6FF] to-[#FFF8E9] border border-[#39BDF2]/40 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 max-w-2xl">
              <p className="text-xs font-extrabold text-[#0369A1] flex items-center gap-1.5">
                <Compass className="w-4 h-4" />
                <span>
                  {language === 'ar'
                    ? `التوصية التعليمية التالية: ${profile.nextRecommendedActivity.title.ar}`
                    : `Recommended Next Activity: ${profile.nextRecommendedActivity.title.en}`}
                </span>
              </p>
              <p className="text-xs sm:text-sm font-bold text-[#27345C]">
                {profile.nextRecommendedActivity.reason[language]}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('academy')}
              className="min-h-[40px] px-4 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'افتح الأكاديمية' : 'Open Academy'}</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(profile?.skills || []).map((sk) => {
            const badge = STATUS_BADGES[sk.status];
            return (
              <div
                key={sk.skillId}
                className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#27345C]/10 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-sm text-[#27345C]">{sk.label[language]}</span>
                  <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold ${badge.cls}`}>
                    {badge[language]}
                  </span>
                </div>
                <p className="text-xs text-[#27345C]/75 font-bold">{sk.note[language]}</p>
                <div className="flex items-center justify-between text-[11px] font-mono-num text-[#27345C]/65">
                  <span>
                    {language === 'ar'
                      ? `الدقة: ${sk.attempts > 0 ? `${sk.accuracy}%` : '—'} · الأدلة: ${sk.evidenceCount}`
                      : `Accuracy: ${sk.attempts > 0 ? `${sk.accuracy}%` : '—'} · Signals: ${sk.evidenceCount}`}
                  </span>
                  <span>
                    {language === 'ar' ? `الدروس: ${sk.completedLessonsCount}` : `Lessons: ${sk.completedLessonsCount}`}
                  </span>
                </div>
              </div>
            );
          })}

          {!profile && !loading && (
            <p className="text-xs font-bold text-[#27345C]/70 col-span-2">
              {language === 'ar'
                ? 'سجّل دخول ولي الأمر وحدد ملف طفل محفوظ لعرض التحليل التكيفي الكامل من الخادم.'
                : 'Sign in with a verified Parent Account and select a child profile to view live server-calculated adaptive milestones.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
