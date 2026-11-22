import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Compass,
  FlaskConical,
  HelpCircle,
  Microscope,
  Sparkles,
  Star,
  Volume2,
} from 'lucide-react';
import labWorkshopImg from '../assets/images/discovery_lab_workshop_1794739849710.jpg';
import { LabExperimentsStage } from '../components/lab/LabExperimentsStage';
import { SmartAdaptiveAssessmentPanel } from '../components/lab/SmartAdaptiveAssessmentPanel';
import { NonoCharacter } from '../components/NonoCharacter';
import { NonoLandLogo } from '../components/NonoLandLogo';
import { useNonoLand } from '../context/NonoLandContext';
import { LAB_EXPERIMENTS } from '../data/worldCatalog';
import { getWorldById } from '../data/worlds';
import { formatNumber, getAgeGroupMeta, SKILL_LABELS, t, UI_COPY } from '../i18n/translations';
import { SkillId } from '../types/nonoland';
import { soundEngine } from '../utils/soundEngine';

export const DiscoveryLabScreen: React.FC<{ isBaseline?: boolean }> = ({ isBaseline = false }) => {
  const { activeChild, language, completeLabExperiment } = useNonoLand();
  const [labZone, setLabZone] = useState<'experiments' | 'assessment'>(
    isBaseline ? 'assessment' : 'experiments',
  );
  const [selectedExpId, setSelectedExpId] = useState<string>(LAB_EXPERIMENTS[0].id);
  const [labFeedbackBanner, setLabFeedbackBanner] = useState<string | null>(null);

  const activeExperiment = useMemo(
    () => LAB_EXPERIMENTS.find((e) => e.id === selectedExpId) || LAB_EXPERIMENTS[0],
    [selectedExpId],
  );

  if (!activeChild) return null;

  const completedLabIds = activeChild.completedLabIds || [];

  const handleCompleteExperiment = async () => {
    const res = await completeLabExperiment(activeExperiment.id, activeExperiment.starsReward);
    soundEngine.playCelebration();
    setLabFeedbackBanner(
      res.starsAdded > 0
        ? language === 'ar'
          ? `أحسنت يا عالم نونو لاند! تم تسجيل تجربة "${activeExperiment.title.ar}" ومنحك +${res.starsAdded} نجوم!`
          : `Awesome discovery! "${activeExperiment.title.en}" recorded and +${res.starsAdded} stars earned!`
        : language === 'ar'
          ? `تمت إعادة تجربة "${activeExperiment.title.ar}" بنجاح!`
          : `"${activeExperiment.title.en}" replayed cleanly!`,
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner + Mode Switcher */}
      <div className="nono-card rounded-[2rem] overflow-hidden">
        <div className="relative h-44 sm:h-56">
          <img
            src={labWorkshopImg}
            alt={t(UI_COPY.lab.title, language)}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#27345C]/90 via-[#27345C]/45 to-transparent flex flex-wrap items-end justify-between gap-4 p-5 sm:p-7">
            <div className="text-white space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-[#FFD84D]">
                <NonoLandLogo variant="badge" size="xs" tone="dark" language={language} />
                <span>
                  {t(getAgeGroupMeta(activeChild.ageGroup).label, language)} ·{' '}
                  {language === 'ar'
                    ? `${formatNumber(completedLabIds.length, language)} / ${formatNumber(LAB_EXPERIMENTS.length, language)} تجارب علمية مكتشفة`
                    : `${completedLabIds.length} / ${LAB_EXPERIMENTS.length} Science Labs Explored`}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold flex items-center gap-2.5">
                <FlaskConical className="w-7 h-7 text-[#39BDF2]" />
                <span>{language === 'ar' ? 'مختبر نونو العلمي التفاعلي' : "Nono's Interactive Science Lab"}</span>
              </h1>
            </div>

            {!isBaseline && (
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm p-1.5 rounded-2xl border border-white/25">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    setLabZone('experiments');
                  }}
                  className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    labZone === 'experiments' ? 'bg-[#FFD84D] text-[#27345C]' : 'text-white hover:bg-white/10'
                  }`}
                >
                  <Microscope className="w-4 h-4" />
                  <span>{language === 'ar' ? 'منضدة التجارب (٨)' : 'Science Bench (8)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    setLabZone('assessment');
                  }}
                  className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    labZone === 'assessment' ? 'bg-[#39BDF2] text-[#27345C]' : 'text-white hover:bg-white/10'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{language === 'ar' ? 'اكتشاف المهارات الذكي' : 'Adaptive Skill Check'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WORLD 1 INTERACTIVE 2-ZONE SCIENTIFIC SANDBOX */}
      {labZone === 'experiments' && !isBaseline && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Zone 1: Experiment Selector & Nono Scientist Guide */}
          <div className="lg:col-span-4 space-y-4">
            <div className="nono-card rounded-3xl p-5 bg-gradient-to-br from-[#F3ECFF] to-[#E5F6FF] space-y-3">
              <div className="flex items-center gap-3">
                <NonoCharacter
                  mood="thinking"
                  scarfColor={activeChild.companionScarfColor}
                  size="sm"
                  language={language}
                />
                <div>
                  <p className="text-xs font-extrabold text-[#8054D9]">
                    {language === 'ar' ? 'مرشدك العالم نونو' : 'Scientist Guide Nono'}
                  </p>
                  <p className="text-sm font-bold text-[#27345C] leading-snug mt-0.5">
                    {activeExperiment.nonoIntro[language]}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => soundEngine.speak(activeExperiment.nonoIntro[language], language)}
                className="w-full min-h-[44px] rounded-xl bg-white border border-[#27345C]/12 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-4 h-4 text-[#8054D9]" />
                <span>{language === 'ar' ? 'استمع لشرح نونو' : 'Hear Nono’s Intro'}</span>
              </button>
            </div>

            <div className="nono-card rounded-3xl p-4 space-y-2.5">
              <h2 className="text-sm font-extrabold text-[#27345C] px-1">
                {language === 'ar' ? 'اختر تجربة علمية آمنة:' : 'Choose a Safe Experiment:'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                {LAB_EXPERIMENTS.map((exp) => {
                  const selected = exp.id === activeExperiment.id;
                  const done = completedLabIds.includes(exp.id);
                  return (
                    <button
                      key={exp.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playPop();
                        setSelectedExpId(exp.id);
                        setLabFeedbackBanner(null);
                      }}
                      className={`min-h-[56px] w-full p-3 rounded-2xl border-2 text-start flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                        selected
                          ? 'bg-[#FFF8E9] border-[#8054D9] shadow-sm'
                          : 'bg-white border-[#27345C]/10 hover:border-[#8054D9]/45'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-2xl shrink-0">{exp.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-[#27345C] truncate">{exp.title[language]}</p>
                          <p className="text-[11px] font-bold" style={{ color: exp.accentColor }}>
                            {exp.shortTag[language]} · +{exp.starsReward} ⭐
                          </p>
                        </div>
                      </div>
                      {done && <CheckCircle2 className="w-5 h-5 text-[#55D98B] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Zone 2: Interactive Experiment Bench */}
          <div className="lg:col-span-8 space-y-4">
            {labFeedbackBanner && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-[#FFF3D1] border-2 border-[#FFD84D] p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2 text-sm font-extrabold text-[#27345C]">
                  <Star className="w-5 h-5 fill-[#FFD84D] text-[#FF9360] shrink-0" />
                  <span>{labFeedbackBanner}</span>
                </div>
              </motion.div>
            )}

            <LabExperimentsStage
              key={activeExperiment.id}
              experiment={activeExperiment}
              ageGroup={activeChild.ageGroup}
              birthYear={activeChild.birthYear}
              birthMonth={activeChild.birthMonth}
              language={language}
              alreadyDone={completedLabIds.includes(activeExperiment.id)}
              onComplete={() => void handleCompleteExperiment()}
            />
          </div>
        </div>
      )}

      {/* SMART ADAPTIVE ASSESSMENT ENGINE (10 FORMATS, SERVER-GRADED) */}
      {(labZone === 'assessment' || isBaseline) && (
        <SmartAdaptiveAssessmentPanel isBaseline={isBaseline} />
      )}
    </div>
  );
};

export const AssessmentResultsScreen: React.FC = () => {
  const { lastAssessment, activeChild, language, navigate } = useNonoLand();
  if (!activeChild) return null;
  const result = lastAssessment || activeChild.assessmentHistory[0];

  if (!result) {
    return (
      <div className="nono-card rounded-3xl p-8 text-center">
        <button
          type="button"
          onClick={() => navigate('discovery-lab')}
          className="px-6 py-3 rounded-2xl bg-[#8054D9] text-white font-bold cursor-pointer"
        >
          {t(UI_COPY.lab.startSession, language)}
        </button>
      </div>
    );
  }

  const recWorld = getWorldById(result.recommendedWorldId);

  return (
    <div className="max-w-3xl mx-auto nono-card rounded-[2rem] p-6 sm:p-10 space-y-6">
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <NonoCharacter
            mood="celebrating"
            scarfColor={activeChild.companionScarfColor}
            size="md"
            language={language}
          />
        </div>
        <h1 className="text-3xl font-extrabold text-[#27345C]">
          {language === 'ar'
            ? `اكتشفنا مهاراتك يا ${activeChild.displayName}!`
            : `Skills Discovered, ${activeChild.displayName}!`}
        </h1>
        <p className="text-sm text-[#27345C]/75">
          {language === 'ar'
            ? `أتممت ${formatNumber(result.questionsCompleted, language)} تحديات وحصلت على +${result.starsEarned} نجوم!`
            : `Completed ${result.questionsCompleted} challenges and earned +${result.starsEarned} stars!`}
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="font-extrabold text-lg text-[#27345C]">
          {language === 'ar' ? 'المهارات التي تم استكشافها:' : 'Skills Explored:'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(result.skillBreakdown) as SkillId[]).map((sk) => {
            const item = result.skillBreakdown[sk]!;
            const pct = Math.round((item.correct / item.total) * 100);
            const meta = SKILL_LABELS[sk];
            return (
              <div key={sk} className="rounded-2xl bg-[#FFF8E9] p-4 border border-[#27345C]/10">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>{t(meta, language)}</span>
                  <span className="font-mono-num" style={{ color: meta.color }}>
                    {item.correct}/{item.total}
                  </span>
                </div>
                <div className="mt-2 h-2.5 rounded-full bg-white overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(15, pct)}%`, backgroundColor: meta.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-[#8054D9]/12 to-[#55D98B]/15 p-5 border-2 border-[#8054D9]/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold text-[#8054D9] flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>{language === 'ar' ? 'أول مغامرة مقترحة لك' : 'Your Recommended Next World'}</span>
          </p>
          <p className="text-xl font-extrabold text-[#27345C] mt-1">
            {recWorld.guardianEmoji} {t(recWorld.name, language)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('world-detail', { worldId: recWorld.id })}
            className="nono-btn-tactile px-5 py-3 rounded-2xl bg-[#8054D9] text-white font-bold flex items-center gap-2 cursor-pointer"
          >
            <Compass className="w-4 h-4" />
            <span>{language === 'ar' ? 'انطلق للعالم' : 'Explore World'}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('home')}
            className="px-4 py-3 rounded-2xl bg-white border border-[#27345C]/15 font-bold cursor-pointer"
          >
            {t(UI_COPY.nav.home, language)}
          </button>
        </div>
      </div>
    </div>
  );
};
