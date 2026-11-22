import React from 'react';
import {
  Activity,
  Award,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  UserPlus,
  Users,
} from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { getAgeGroupMeta, t } from '../../i18n/translations';
import { UNIFIED_STAGE_ID } from '../../utils/ageAdaptation';
import { formatChildAgeLabel } from './shared';

interface Props {
  onSelectTab: (tab: string) => void;
  gateVerified: boolean;
}

export const FamilyOverviewPanel: React.FC<Props> = ({ onSelectTab, gateVerified }) => {
  const { activeChild, authSession, childrenList, language, navigate, selectChild } = useNonoLand();
  const totalStars = childrenList.reduce((acc, c) => acc + (c.stars || 0), 0);
  const totalTogether = childrenList.reduce((acc, c) => acc + (c.familyActivitiesCompleted?.length || 0), 0);

  return (
    <div className="space-y-5">
      <div className="nono-card rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-[#F4EEFF] via-white to-[#FFF8E9] border border-[#8054D9]/20 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-xs font-extrabold text-[#8054D9] border border-[#8054D9]/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              {language === 'ar'
                ? 'حساب عائلي معزول بالكامل · المستكشفون الصغار (١–٤ سنوات)'
                : 'Private Isolated Family Space · Little Explorers (1–4 Years)'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
            {language === 'ar'
              ? `مرحباً ${authSession.user?.displayName || authSession.user?.name || 'ولي الأمر'}`
              : `Welcome, ${authSession.user?.displayName || authSession.user?.name || 'Parent'}`}
          </h2>
          <p className="text-xs sm:text-sm font-bold text-[#27345C]/75">
            {language === 'ar'
              ? 'أدِر ملفات أطفالك، رموز الدخول السرية، الأجهزة الموثوقة، وتقارير التقدم من مكان واحد.'
              : 'Manage your children’s profiles, secure Child Access Codes & PINs, trusted devices, and honest learning reports.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold ${
              gateVerified
                ? 'bg-[#DCFCE7] text-[#15803D]'
                : 'bg-[#FEF3C7] text-[#92400E]'
            }`}
          >
            {gateVerified
              ? language === 'ar' ? '🔓 بوابة الوالدين مفتوحة' : '🔓 Parent Gate Verified'
              : language === 'ar' ? '🔒 البوابة الحساسة مقفلة' : '🔒 Sensitive Gate Locked'}
          </span>
          <button
            type="button"
            onClick={() => navigate('create-child')}
            className="min-h-[40px] px-4 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{language === 'ar' ? 'إضافة طفل' : 'Add Child'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="nono-card rounded-2xl p-4 bg-white">
          <p className="text-xs font-bold text-[#27345C]/65 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#8054D9]" />
            <span>{language === 'ar' ? 'أطفال العائلة' : 'Family Children'}</span>
          </p>
          <p className="text-2xl font-extrabold text-[#27345C] mt-1 font-mono-num">{childrenList.length}</p>
        </div>
        <div className="nono-card rounded-2xl p-4 bg-white">
          <p className="text-xs font-bold text-[#27345C]/65 flex items-center gap-1.5">
            <Star className="w-4 h-4 text-[#F59E0B]" />
            <span>{language === 'ar' ? 'نجوم العائلة' : 'Family Stars'}</span>
          </p>
          <p className="text-2xl font-extrabold text-[#F59E0B] mt-1 font-mono-num">{totalStars}</p>
        </div>
        <div className="nono-card rounded-2xl p-4 bg-white">
          <p className="text-xs font-bold text-[#27345C]/65 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#EC4899]" />
            <span>{language === 'ar' ? 'لحظات وقتـنا معاً' : 'Together Time'}</span>
          </p>
          <p className="text-2xl font-extrabold text-[#EC4899] mt-1 font-mono-num">{totalTogether}</p>
        </div>
        <div className="nono-card rounded-2xl p-4 bg-white">
          <p className="text-xs font-bold text-[#27345C]/65 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#16A34A]" />
            <span>{language === 'ar' ? 'الأوسمة والشهادات' : 'Badges & Certs'}</span>
          </p>
          <p className="text-2xl font-extrabold text-[#16A34A] mt-1 font-mono-num">
            {activeChild?.unlockedBadges.length || 0} · {activeChild?.certificates.length || 0}
          </p>
        </div>
      </div>

      {/* Quick Children Cards */}
      <div className="nono-card rounded-3xl p-5 bg-white space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-[#27345C]">
            {language === 'ar' ? 'ملفات أطفالي' : 'My Family Children'}
          </h3>
          <button
            type="button"
            onClick={() => onSelectTab('children-credentials')}
            className="text-xs font-extrabold text-[#8054D9] hover:underline cursor-pointer"
          >
            {language === 'ar' ? 'إدارة الرموز والملفات ←' : 'Manage Codes & Profiles →'}
          </button>
        </div>
        {childrenList.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#FFF8E9] border border-[#8054D9]/20 text-center space-y-3">
            <p className="text-sm font-extrabold text-[#27345C]">
              {language === 'ar'
                ? 'لا يوجد أطفال مسجلون في هذا الحساب العائلي بعد.'
                : 'No child profiles added to your family account yet.'}
            </p>
            <p className="text-xs font-bold text-[#27345C]/70">
              {language === 'ar'
                ? 'أضف ملف طفلك الأول (١–٤ سنوات) للحصول على رمز الدخول والرقم السري الخاصين به.'
                : 'Add your first child profile (ages 1–4) to generate their unique Access Code and Child PIN.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('create-child')}
              className="nono-btn-tactile px-5 py-2.5 rounded-xl bg-[#8054D9] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{language === 'ar' ? 'إضافة طفلك الأول' : 'Add Your First Child'}</span>
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {childrenList.map((child) => {
            const active = child.id === activeChild?.id;
            return (
              <div
                key={child.id}
                className={`p-4 rounded-2xl border-2 space-y-2 ${
                  active ? 'bg-[#F4EEFF]/60 border-[#8054D9]' : 'bg-[#FFF8E9]/60 border-[#27345C]/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-[#27345C]">{child.displayName}</p>
                    <p className="text-[11px] font-bold text-[#27345C]/70">
                      {formatChildAgeLabel(child, language)} · {t(getAgeGroupMeta(UNIFIED_STAGE_ID).label, language)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectChild(child.id)}
                    className={`px-3 py-1 rounded-xl text-[11px] font-extrabold cursor-pointer ${
                      active ? 'bg-[#55D98B]/30 text-[#14532D]' : 'bg-[#27345C] text-white'
                    }`}
                  >
                    {active ? (language === 'ar' ? 'محدد ✓' : 'Selected ✓') : language === 'ar' ? 'عرض' : 'Select'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                  <span className="px-2 py-0.5 rounded-lg bg-white border border-[#27345C]/10">
                    ⭐ {child.stars}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-white border border-[#27345C]/10">
                    📚 {(child.completedActivityIds?.length || 0) + (child.completedDeepLessons?.length || 0) + Object.keys(child.level1Progress || {}).length}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-white border border-[#27345C]/10">
                    🌸 {child.learningGarden?.unlockedItemIds?.length || 1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Quick Navigation Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { tab: 'children-credentials', ar: 'رموز دخول الأطفال', en: 'Child Login Codes', icon: <KeyRound className="w-4 h-4 text-[#8054D9]" /> },
          { tab: 'adaptive-learning', ar: 'الملف التكيفي (١٠ مجالات)', en: 'Adaptive Profile', icon: <Activity className="w-4 h-4 text-[#0369A1]" /> },
          { tab: 'weekly-report', ar: 'التقرير الأسبوعي الحقيقي', en: 'Weekly Report', icon: <Award className="w-4 h-4 text-[#B45309]" /> },
          { tab: 'together-garden', ar: 'وقتنا معاً والحديقة', en: 'Together & Garden', icon: <Sprout className="w-4 h-4 text-[#16A34A]" /> },
        ].map((q) => (
          <button
            key={q.tab}
            type="button"
            onClick={() => onSelectTab(q.tab)}
            className="nono-card p-3.5 rounded-2xl bg-white hover:bg-[#FFF8E9] flex items-center gap-2 text-xs font-extrabold text-[#27345C] cursor-pointer"
          >
            {q.icon}
            <span>{q[language]}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
