import React from 'react';
import { Heart, Sprout, Users } from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { GARDEN_ITEMS_CATALOG } from '../../data/gardenCatalog';
import { formatDate } from '../../i18n/translations';

export const TogetherAndGardenOverviewPanel: React.FC = () => {
  const { activeChild, language, navigate } = useNonoLand();

  if (!activeChild) {
    return (
      <div className="nono-card rounded-3xl p-8 bg-white text-center space-y-3">
        <Sprout className="w-8 h-8 text-[#16A34A] mx-auto" />
        <p className="text-base font-extrabold text-[#27345C]">
          {language === 'ar'
            ? 'أضف ملف طفل لمتابعة حديقة التعلم وأنشطة وقتنا معاً'
            : 'Add a child profile to track Learning Garden & Together Time'}
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

  const moments = activeChild.familyActivitiesCompleted || [];
  const garden = activeChild.learningGarden;
  const unlockedIds = garden?.unlockedItemIds || ['garden-sun-flower'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-6 nono-card rounded-3xl p-6 bg-white space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#EC4899]" />
            <span>{language === 'ar' ? 'سجل وقتـنا معاً العائلي' : 'Together Time Co-Play Log'}</span>
          </h2>
          <button
            type="button"
            onClick={() => navigate('family-activities')}
            className="px-3.5 py-2 rounded-xl bg-[#EC4899] text-white text-xs font-extrabold cursor-pointer"
          >
            {language === 'ar' ? 'ابدأ نشاطاً معاً ❤️' : 'Open Together Time ❤️'}
          </button>
        </div>

        <p className="text-xs font-bold text-[#27345C]/70">
          {language === 'ar'
            ? 'الأنشطة المشتركة تمنح نقاط تواصل وزهوراً في الحديقة وتُسجَّل باسم ولي الأمر المشارك دون التأثير على دقة المهارات الفردية.'
            : 'Guided parent-child moments are attributed to the participating guardian and stay strictly separate from independent child skill scores.'}
        </p>

        {moments.length === 0 ? (
          <div className="p-5 rounded-2xl bg-[#FFF8E9] text-center text-xs font-bold text-[#27345C]/70">
            {language === 'ar'
              ? 'لم تُسجَّل أنشطة وقتنا معاً بعد لهذا الطفل.'
              : 'No Together Time activities logged yet for this child.'}
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pe-1">
            {moments.slice(0, 12).map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-2xl bg-[#FCE7F3]/35 border border-[#EC4899]/20 flex items-start justify-between gap-2 text-xs"
              >
                <div>
                  <p className="font-extrabold text-[#27345C] flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-[#EC4899] fill-current" />
                    <span>{m.title[language]}</span>
                  </p>
                  <p className="text-[#27345C]/70 font-bold">
                    {m.durationMinutes} {language === 'ar' ? 'د' : 'min'} · {formatDate(m.completedAt, language)}
                    {m.guardianName ? ` · ${m.guardianName}` : ''}
                  </p>
                  {m.reflectionNote && (
                    <p className="text-[#8054D9] italic mt-0.5">“{m.reflectionNote}”</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lg:col-span-6 nono-card rounded-3xl p-6 bg-white space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
            <Sprout className="w-5 h-5 text-[#16A34A]" />
            <span>{language === 'ar' ? 'حديقة التعلم الخاصة بالطفل' : 'Child Learning Garden Progress'}</span>
          </h2>
          <button
            type="button"
            onClick={() => navigate('my-room')}
            className="px-3.5 py-2 rounded-xl bg-[#55D98B] text-[#27345C] text-xs font-extrabold cursor-pointer"
          >
            {language === 'ar' ? 'زيارة الحديقة 🌱' : 'Visit Garden 🌱'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-[#DCFCE7]/60">
            <p className="font-bold text-[#14532D]">{language === 'ar' ? 'النباتات المفتوحة' : 'Garden Treasures'}</p>
            <p className="text-2xl font-extrabold font-mono-num text-[#15803D]">
              {unlockedIds.length} / {GARDEN_ITEMS_CATALOG.length}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-[#E0F2FE]/70">
            <p className="font-bold text-[#0369A1]">{language === 'ar' ? 'مرات السقي اللطيف' : 'Watering Sessions'}</p>
            <p className="text-2xl font-extrabold font-mono-num text-[#0284C7]">
              {garden?.wateringCount || 0} 💧
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {GARDEN_ITEMS_CATALOG.map((item) => {
            const has = unlockedIds.includes(item.id);
            return (
              <span
                key={item.id}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                  has ? 'bg-[#FFF8E9] border-[#FFD84D] text-[#27345C]' : 'bg-slate-100 border-slate-200 opacity-50'
                }`}
              >
                <span>{item.emoji}</span>
                <span>{item.name[language]}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
