import React, { useState } from 'react';
import { CheckCircle2, Clock, Heart, MessageCircle, Sparkles, Sprout, Users } from 'lucide-react';
import { useNonoLand } from '../context/NonoLandContext';
import { TOGETHER_ACTIVITIES_CATALOG } from '../data/togetherActivities';
import { formatDate } from '../i18n/translations';
import { soundEngine } from '../utils/soundEngine';

export const FamilyActivitiesScreen: React.FC = () => {
  const { activeChild, language, completeFamilyActivity, navigate } = useNonoLand();
  const [selectedId, setSelectedId] = useState(TOGETHER_ACTIVITIES_CATALOG[0].id);
  const [selectedMicroChoice, setSelectedMicroChoice] = useState<string | null>(null);
  const [parentChecklistDone, setParentChecklistDone] = useState(false);
  const [reflection, setReflection] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  if (!activeChild) return null;

  const activeSpec =
    TOGETHER_ACTIVITIES_CATALOG.find((a) => a.id === selectedId) || TOGETHER_ACTIVITIES_CATALOG[0];
  const history = activeChild.familyActivitiesCompleted || [];

  const handleLogTogetherTime = async () => {
    setSaving(true);
    setNotice('');
    try {
      const choiceObj = activeSpec.childMicroTask.choices.find((c) => c.id === selectedMicroChoice);
      const composedNote = [
        choiceObj ? `${choiceObj.emoji} ${choiceObj.label[language]}` : '',
        reflection.trim(),
      ]
        .filter(Boolean)
        .join(' · ');

      const res = await completeFamilyActivity({
        activityKey: activeSpec.id,
        title: activeSpec.title,
        durationMinutes: activeSpec.durationMinutes,
        reflectionNote: composedNote || undefined,
      });

      setReflection('');
      setSelectedMicroChoice(null);
      setParentChecklistDone(false);
      setNotice(
        language === 'ar'
          ? `لحظة رائعة لوقتـنا معاً! تم تسجيل النشاط في سجل ${activeChild.displayName} (+${res.starsAdded} نجوم وفتح زهرة في حديقة التعلم) 🌸`
          : `Wonderful Together Time moment! Logged for ${activeChild.displayName} (+${res.starsAdded} stars & Learning Garden blossom unlocked) 🌸`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="nono-card rounded-[2rem] p-5 sm:p-6 bg-gradient-to-r from-[#FCE7F3] via-[#FFF8E9] to-[#E5F6FF] flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-xs font-extrabold text-[#EC4899]">
            <Users className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'وقتنا معاً · الآباء والأطفال (١–٤ سنوات)' : 'Together Time · Parent & Child (Ages 1–4)'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#27345C]">
            {language === 'ar' ? 'أنشطة وقتنا معاً العائلية' : 'Parent & Child Together Time'}
          </h1>
          <p className="text-xs sm:text-sm font-bold text-[#27345C]/75">
            {language === 'ar'
              ? '١٠ أنشطة تفاعلية دافئة تُقوّي التواصل وتمنح زهرة في الحديقة، وتُحفظ بشكل مستقل عن تقييم المهارات الفردية للطفل.'
              : '10 guided family activities that nurture bonding and bloom your child’s garden—kept separate from independent child skill scores.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-4 py-2.5 rounded-2xl bg-white border border-[#27345C]/10 text-xs font-extrabold text-[#27345C]">
            {language === 'ar' ? `اللحظات المسجلة: ${history.length}` : `Moments Logged: ${history.length}`}
          </div>
          <button
            type="button"
            onClick={() => navigate('my-room')}
            className="min-h-[42px] px-4 rounded-2xl bg-[#55D98B] text-[#27345C] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <Sprout className="w-4 h-4" />
            <span>{language === 'ar' ? 'شاهد الحديقة 🌸' : 'View Garden 🌸'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* All 10 Together Time Categories */}
        <div className="lg:col-span-4 space-y-2.5 max-h-[680px] overflow-y-auto pe-1">
          {TOGETHER_ACTIVITIES_CATALOG.map((act) => {
            const active = selectedId === act.id;
            const doneCount = history.filter((h) => h.activityKey === act.id).length;
            return (
              <button
                key={act.id}
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  setSelectedId(act.id);
                  setSelectedMicroChoice(null);
                  setParentChecklistDone(false);
                  setNotice('');
                }}
                className={`w-full p-4 rounded-2xl border-2 text-start flex items-start justify-between gap-2.5 cursor-pointer transition-all ${
                  active ? 'bg-[#F3ECFF] border-[#8054D9]' : 'bg-white border-[#27345C]/12 hover:border-[#8054D9]/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-2xl">{act.emoji}</span>
                  <div>
                    <p className="text-sm font-extrabold text-[#27345C]">{act.title[language]}</p>
                    <p className="text-[11px] font-bold text-[#27345C]/65 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>
                        {act.durationMinutes} {language === 'ar' ? 'دقائق' : 'min'}
                      </span>
                    </p>
                  </div>
                </div>
                {doneCount > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-[#DCFCE7] text-[#15803D] text-[10px] font-extrabold shrink-0">
                    ✓ {doneCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Interactive Guided Co-Play Workspace */}
        <div className="lg:col-span-8 space-y-5">
          <div className="nono-card p-6 bg-white space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
                <span className="text-3xl">{activeSpec.emoji}</span>
                <span>{activeSpec.title[language]}</span>
              </h2>
              <span className="px-3 py-1 rounded-xl bg-[#FFF8E9] text-xs font-extrabold text-[#B45309] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {activeSpec.durationMinutes} {language === 'ar' ? 'دقائق' : 'min'}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-[#E5F6FF]/75 space-y-1">
                <p className="text-xs font-extrabold text-[#0369A1]">
                  {language === 'ar' ? 'الهدف التربوي:' : 'Learning Objective:'}
                </p>
                <p className="text-xs sm:text-sm font-bold text-[#27345C]">{activeSpec.objective[language]}</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#F3ECFF]/75 space-y-1">
                <p className="text-xs font-extrabold text-[#6D28D9]">
                  {language === 'ar' ? 'توجيه ولي الأمر:' : 'Parent Guidance:'}
                </p>
                <p className="text-xs sm:text-sm font-bold text-[#27345C]">{activeSpec.parentInstruction[language]}</p>
              </div>
            </div>

            {/* Toddler-Friendly Child Micro-Task */}
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#FFF8E9] to-[#FCE7F3]/50 border-2 border-[#FFD84D] space-y-3">
              <p className="text-sm font-extrabold text-[#27345C] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#EC4899]" />
                <span>{activeSpec.childMicroTask.prompt[language]}</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {activeSpec.childMicroTask.choices.map((ch) => {
                  const chosen = selectedMicroChoice === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playSuccess();
                        soundEngine.speak(ch.label[language], language);
                        setSelectedMicroChoice(ch.id);
                      }}
                      className={`min-h-[68px] p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition-transform ${
                        chosen
                          ? 'bg-[#DCFCE7] border-[#22C55E] scale-[1.02] shadow-sm'
                          : 'bg-white border-[#27345C]/12 hover:border-[#8054D9]'
                      }`}
                    >
                      <span className="text-3xl">{ch.emoji}</span>
                      <span className="text-xs font-extrabold text-[#27345C]">{ch.label[language]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conversation Spark + Follow-Up Tip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-[#FFD84D] space-y-1">
                <p className="text-xs font-extrabold text-[#B45309] flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'سؤال للحوار معاً:' : 'Conversation Prompt:'}</span>
                </p>
                <p className="text-xs sm:text-sm font-extrabold text-[#27345C]">{activeSpec.conversationPrompt[language]}</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#E2F9EC]/75 border border-[#55D98B] space-y-1">
                <p className="text-xs font-extrabold text-[#15803D]">
                  {language === 'ar' ? 'نصيحة الاستمرار:' : 'Follow-Up Tip:'}
                </p>
                <p className="text-xs sm:text-sm font-bold text-[#27345C]">{activeSpec.followUpTip[language]}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playPop();
                setParentChecklistDone(!parentChecklistDone);
              }}
              className={`w-full p-3.5 rounded-2xl border-2 text-start text-xs sm:text-sm font-extrabold flex items-center justify-between cursor-pointer ${
                parentChecklistDone
                  ? 'bg-[#DCFCE7] border-[#22C55E] text-[#14532D]'
                  : 'bg-[#F8FAFC] border-[#27345C]/12 text-[#27345C]'
              }`}
            >
              <span>
                {language === 'ar'
                  ? 'نفّذنا النشاط معاً بروح دافئة ومرحة!'
                  : 'We completed this guided moment together warmly!'}
              </span>
              {parentChecklistDone && <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />}
            </button>

            <div className="space-y-3 pt-2 border-t border-[#27345C]/10">
              <input
                type="text"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                maxLength={180}
                placeholder={
                  language === 'ar'
                    ? 'ملاحظة قصيرة من ولي الأمر (اختياري): ماذا أحب طفلك؟'
                    : 'Optional parent memory note: What made your child smile?'
                }
                className="w-full min-h-[44px] px-4 rounded-xl border border-[#27345C]/20 text-xs font-bold"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleLogTogetherTime()}
                className="min-h-[48px] px-6 rounded-2xl bg-[#EC4899] text-white font-extrabold text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Heart className="w-4 h-4 fill-current" />
                <span>
                  {saving
                    ? language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...'
                    : language === 'ar' ? 'حفظ لحظة وقتـنا معاً ❤️' : 'Save Together Time Moment ❤️'}
                </span>
              </button>
              {notice && <p className="text-xs sm:text-sm font-extrabold text-[#16A34A]">{notice}</p>}
            </div>
          </div>

          {/* Recorded Shared Moments with Guardian Attribution */}
          {history.length > 0 && (
            <div className="nono-card p-5 bg-white space-y-3">
              <h3 className="text-base font-extrabold text-[#27345C]">
                {language === 'ar' ? 'سجل لحظات وقتـنا معاً العائلية' : 'Family Together Time Journal'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pe-1">
                {history.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 space-y-1 text-xs"
                  >
                    <p className="font-extrabold text-[#27345C]">{item.title[language]}</p>
                    <p className="text-[#27345C]/70 font-bold">
                      {item.durationMinutes} {language === 'ar' ? 'د' : 'min'} · {formatDate(item.completedAt, language)}
                      {item.guardianName ? ` · ${item.guardianName}` : ''}
                    </p>
                    {item.reflectionNote && (
                      <p className="text-[#8054D9] font-bold italic">“{item.reflectionNote}”</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
