import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, RotateCcw, Sparkles, Volume2 } from 'lucide-react';
import { LabExperimentSpec } from '../../data/worldCatalog';
import { Language, LocalizedText, StoredAgeGroupId } from '../../types/nonoland';
import { getInternalAgeBand, isLegacyFiveToEight } from '../../utils/ageAdaptation';
import { soundEngine } from '../../utils/soundEngine';

interface Props {
  experiment: LabExperimentSpec;
  ageGroup: StoredAgeGroupId;
  birthYear?: number;
  birthMonth?: number;
  language: Language;
  alreadyDone: boolean;
  onComplete: () => void;
}

function getAgeTier(
  ageGroup: StoredAgeGroupId,
  birthYear?: number,
  birthMonth?: number,
): 'young' | 'mid' | 'older' {
  if (isLegacyFiveToEight(ageGroup)) return 'older';
  const band = getInternalAgeBand({ ageGroup, birthYear, birthMonth });
  if (band === '1-2') return 'young';
  if (band === '2-3') return 'mid';
  return 'older';
}

export const LabExperimentsStage: React.FC<Props> = ({
  experiment,
  ageGroup,
  birthYear,
  birthMonth,
  language,
  alreadyDone,
  onComplete,
}) => {
  const tier = getAgeTier(ageGroup, birthYear, birthMonth);
  const explanation = experiment.explanationByAge[tier];

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-white/90 border-2 border-[#27345C]/10 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl">{experiment.icon}</span>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
                {experiment.title[language]}
              </h2>
              <p className="text-xs font-bold text-[#27345C]/70">
                {experiment.objective[language]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => soundEngine.speak(experiment.objective[language], language)}
            className="min-h-[44px] px-3.5 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-[#8054D9]" />
            <span>{language === 'ar' ? 'استمع للهدف' : 'Hear Objective'}</span>
          </button>
        </div>

        {experiment.id === 'lab-color-mixing' && (
          <ColorMixingBench language={language} explanation={explanation} alreadyDone={alreadyDone} onDone={onComplete} />
        )}
        {experiment.id === 'lab-volcano' && (
          <VolcanoBench language={language} explanation={explanation} alreadyDone={alreadyDone} onDone={onComplete} />
        )}
        {experiment.id === 'lab-float-sink' && (
          <FloatSinkBench language={language} explanation={explanation} alreadyDone={alreadyDone} onDone={onComplete} />
        )}
        {experiment.id === 'lab-magnet' && (
          <MagnetBench language={language} explanation={explanation} alreadyDone={alreadyDone} onDone={onComplete} />
        )}
        {experiment.id === 'lab-plant-grow' && (
          <PlantGrowBench language={language} explanation={explanation} alreadyDone={alreadyDone} onDone={onComplete} />
        )}
        {experiment.id === 'lab-space-explorer' && (
          <SpaceExplorerBench language={language} explanation={explanation} alreadyDone={alreadyDone} onDone={onComplete} />
        )}
        {experiment.id === 'lab-animal-discovery' && (
          <AnimalHabitatBench language={language} explanation={explanation} alreadyDone={alreadyDone} onDone={onComplete} />
        )}
        {experiment.id === 'lab-scientist-challenges' && (
          <ScientistChallengeBench
            ageGroup={ageGroup}
            birthYear={birthYear}
            birthMonth={birthMonth}
            language={language}
            explanation={explanation}
            alreadyDone={alreadyDone}
            onDone={onComplete}
          />
        )}
      </div>
    </div>
  );
};

const CompletionPanel: React.FC<{
  language: Language;
  explanation: LocalizedText;
  done: boolean;
  alreadyDone: boolean;
  onReplay: () => void;
  onClaim: () => void;
}> = ({ language, explanation, done, alreadyDone, onReplay, onClaim }) => {
  if (!done) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-5 rounded-2xl bg-[#E2F9EC] border-2 border-[#55D98B] p-4 sm:p-5 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-extrabold text-[#1E7E48] flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>{language === 'ar' ? 'الاستنتاج العلمي:' : 'Scientific Discovery:'}</span>
          </p>
          <p className="text-sm sm:text-base font-bold text-[#27345C] leading-relaxed">
            {explanation[language]}
          </p>
        </div>
        <button
          type="button"
          onClick={() => soundEngine.speak(explanation[language], language)}
          className="min-h-[44px] px-3 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold shrink-0 cursor-pointer"
          aria-label="Read explanation aloud"
        >
          <Volume2 className="w-4 h-4 text-[#8054D9]" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onClaim}
          className="nono-btn-tactile min-h-[44px] px-5 py-2.5 rounded-xl bg-[#8054D9] text-white text-sm font-extrabold flex items-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-[#FFD84D]" />
          <span>
            {alreadyDone
              ? language === 'ar'
                ? 'تم حفظ التجربة ✓'
                : 'Experiment Recorded ✓'
              : language === 'ar'
                ? 'سجّل الاكتشاف واجمع النجوم!'
                : 'Claim Discovery Stars!'}
          </span>
        </button>
        <button
          type="button"
          onClick={onReplay}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-[#27345C]/15 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{language === 'ar' ? 'إعادة التجربة' : 'Replay Experiment'}</span>
        </button>
      </div>
    </motion.div>
  );
};

// 1. COLOR MIXING LAB
const ColorMixingBench: React.FC<{
  language: Language;
  explanation: LocalizedText;
  alreadyDone: boolean;
  onDone: () => void;
}> = ({ language, explanation, alreadyDone, onDone }) => {
  const primaries = [
    { id: 'red', hex: '#EF4444', name: { ar: 'أحمر', en: 'Red' } },
    { id: 'blue', hex: '#3B82F6', name: { ar: 'أزرق', en: 'Blue' } },
    { id: 'yellow', hex: '#FACC15', name: { ar: 'أصفر', en: 'Yellow' } },
  ];
  const [picked, setPicked] = useState<string[]>([]);
  const [claimed, setClaimed] = useState(false);

  const mixResult = useMemo(() => {
    if (picked.length < 2) return null;
    const key = [...picked].sort().join('+');
    if (key === 'blue+red') return { hex: '#9333EA', name: { ar: 'بنفسجي رائع 💜', en: 'Vibrant Purple 💜' } };
    if (key === 'red+yellow') return { hex: '#F97316', name: { ar: 'برتقالي دافئ 🧡', en: 'Bright Orange 🧡' } };
    if (key === 'blue+yellow') return { hex: '#22C55E', name: { ar: 'أخضر منعش 💚', en: 'Fresh Green 💚' } };
    return null;
  }, [picked]);

  const toggleFlask = (id: string) => {
    soundEngine.playPop();
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      const next = [...prev, id];
      if (next.length === 2) soundEngine.playSuccess();
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {primaries.map((p) => {
          const active = picked.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleFlask(p.id)}
              className={`min-h-[112px] rounded-2xl p-4 border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                active ? 'border-[#27345C] bg-[#FFF8E9] scale-[1.02]' : 'border-[#27345C]/12 bg-white'
              }`}
            >
              <div className="w-12 h-14 rounded-b-2xl rounded-t-md border-4 border-[#27345C]/25 shadow-inner" style={{ backgroundColor: p.hex }} />
              <span className="font-extrabold text-sm">{p.name[language]}</span>
            </button>
          );
        })}
      </div>

      {/* Mixing Beaker */}
      <div className="rounded-3xl bg-[#FFF8E9] border-2 border-dashed border-[#8054D9]/30 p-6 flex flex-col sm:flex-row items-center justify-center gap-5">
        <div
          className="w-28 h-28 rounded-full border-4 border-white shadow-xl flex items-center justify-center transition-colors duration-500"
          style={{ backgroundColor: mixResult ? mixResult.hex : '#E2E8F0' }}
        >
          <span className="text-3xl">{mixResult ? '✨' : '🧪'}</span>
        </div>
        <div className="text-center sm:text-start">
          <p className="text-xs font-extrabold text-[#8054D9]">
            {language === 'ar' ? 'نتيجة المزج الكيميائي:' : 'Mixed Potion Result:'}
          </p>
          <p className="text-xl font-extrabold text-[#27345C] mt-1">
            {mixResult
              ? mixResult.name[language]
              : language === 'ar'
                ? 'اضغط لونين أساسيين لخلطهما!'
                : 'Tap any 2 primary flasks to mix them!'}
          </p>
        </div>
      </div>

      <CompletionPanel
        language={language}
        explanation={explanation}
        done={Boolean(mixResult)}
        alreadyDone={alreadyDone || claimed}
        onReplay={() => {
          setPicked([]);
          setClaimed(false);
        }}
        onClaim={() => {
          setClaimed(true);
          onDone();
        }}
      />
    </div>
  );
};

// 2. VOLCANO EXPERIMENT
const VolcanoBench: React.FC<{
  language: Language;
  explanation: LocalizedText;
  alreadyDone: boolean;
  onDone: () => void;
}> = ({ language, explanation, alreadyDone, onDone }) => {
  const [hasSoda, setHasSoda] = useState(false);
  const [erupted, setErupted] = useState(false);
  const [claimed, setClaimed] = useState(false);

  return (
    <div className="space-y-4">
      <div className="relative rounded-3xl bg-gradient-to-b from-[#E5F6FF] to-[#FFF3D1] p-6 h-60 flex flex-col items-center justify-end overflow-hidden border border-[#27345C]/10">
        {erupted && (
          <motion.div
            initial={{ y: 20, scale: 0.5, opacity: 0 }}
            animate={{ y: -12, scale: 1.15, opacity: 1 }}
            className="text-5xl mb-1 select-none"
          >
            🫧🌋💥🫧
          </motion.div>
        )}
        <svg viewBox="0 0 240 120" className="w-56 h-28">
          <polygon points="40,120 95,30 145,30 200,120" fill="#8B5A2B" />
          <ellipse cx="120" cy="30" rx="25" ry="7" fill={erupted ? '#FF6B4A' : hasSoda ? '#F1F5F9' : '#5C3A1B'} />
          {erupted && (
            <path d="M100 30 Q120 55 140 30 Q150 75 130 95 Q115 65 100 90 Z" fill="#FF784F" opacity="0.9" />
          )}
        </svg>
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={() => {
            soundEngine.playPop();
            setHasSoda(true);
          }}
          className={`min-h-[48px] px-5 py-3 rounded-2xl font-extrabold text-sm border-2 cursor-pointer ${
            hasSoda ? 'bg-[#55D98B]/20 border-[#55D98B]' : 'bg-white border-[#27345C]/15'
          }`}
        >
          1. {language === 'ar' ? 'أضف مسحوق الصودا 🥄' : 'Add Baking Powder 🥄'}
        </button>

        <button
          type="button"
          disabled={!hasSoda}
          onClick={() => {
            soundEngine.playCelebration();
            setErupted(true);
          }}
          className="nono-btn-tactile min-h-[48px] px-5 py-3 rounded-2xl bg-[#FF9360] text-white font-extrabold text-sm cursor-pointer disabled:opacity-45"
        >
          2. {language === 'ar' ? 'اسكب الخل اللطيف وشاهد الفوران! 🧪' : 'Pour Vinegar & Erupt! 🧪'}
        </button>
      </div>

      <CompletionPanel
        language={language}
        explanation={explanation}
        done={erupted}
        alreadyDone={alreadyDone || claimed}
        onReplay={() => {
          setHasSoda(false);
          setErupted(false);
          setClaimed(false);
        }}
        onClaim={() => {
          setClaimed(true);
          onDone();
        }}
      />
    </div>
  );
};

// 3. FLOATING & SINKING TANK
const FloatSinkBench: React.FC<{
  language: Language;
  explanation: LocalizedText;
  alreadyDone: boolean;
  onDone: () => void;
}> = ({ language, explanation, alreadyDone, onDone }) => {
  const items = [
    { id: 'duck', emoji: '🦆', name: { ar: 'بطة مطاطية', en: 'Rubber Duck' }, floats: true },
    { id: 'wood', emoji: '🪵', name: { ar: 'قطعة خشب', en: 'Wood Block' }, floats: true },
    { id: 'stone', emoji: '🪨', name: { ar: 'حجر ثقيل', en: 'Heavy Stone' }, floats: false },
    { id: 'key', emoji: '🔑', name: { ar: 'مفتاح معدني', en: 'Metal Key' }, floats: false },
  ];
  const [droppedIds, setDroppedIds] = useState<string[]>([]);
  const [claimed, setClaimed] = useState(false);

  const dropItem = (id: string, floats: boolean) => {
    soundEngine.playPop();
    setDroppedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    soundEngine.speak(
      floats
        ? language === 'ar'
          ? 'يطفو فوق الماء!'
          : 'It floats on top!'
        : language === 'ar'
          ? 'يغوص إلى القاع!'
          : 'It sinks to the bottom!',
      language,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-center gap-2.5">
        {items.map((it) => {
          const tested = droppedIds.includes(it.id);
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => dropItem(it.id, it.floats)}
              className={`min-h-[48px] px-4 py-2.5 rounded-2xl border-2 font-extrabold text-sm flex items-center gap-2 cursor-pointer ${
                tested ? 'bg-[#E2F9EC] border-[#55D98B]' : 'bg-white border-[#39BDF2]/40 hover:border-[#39BDF2]'
              }`}
            >
              <span className="text-2xl">{it.emoji}</span>
              <span>{it.name[language]}</span>
            </button>
          );
        })}
      </div>

      {/* Animated Water Tank */}
      <div className="relative h-56 rounded-3xl border-4 border-[#39BDF2]/50 bg-gradient-to-b from-[#F0F9FF] via-[#7DD3FC]/55 to-[#0284C7]/60 overflow-hidden p-4">
        <div className="absolute inset-x-0 top-12 border-t-2 border-dashed border-white/70" />
        <p className="text-xs font-extrabold text-[#0369A1]">
          {language === 'ar' ? 'سطح الماء (أعلى = يطفو | أسفل = يغوص)' : 'Waterline (Top = Floats | Bottom = Sinks)'}
        </p>

        <div className="flex justify-around items-stretch h-40">
          {items.map((it) => {
            if (!droppedIds.includes(it.id)) return <div key={it.id} className="w-16" />;
            return (
              <motion.div
                key={it.id}
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: it.floats ? 10 : 98, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.35 }}
                className="flex flex-col items-center"
              >
                <span className="text-4xl drop-shadow">{it.emoji}</span>
                <span className="text-[10px] font-extrabold bg-white/90 px-2 py-0.5 rounded-full text-[#27345C]">
                  {it.floats
                    ? language === 'ar'
                      ? 'يطفو'
                      : 'Floats'
                    : language === 'ar'
                      ? 'يغوص'
                      : 'Sinks'}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      <CompletionPanel
        language={language}
        explanation={explanation}
        done={droppedIds.length >= 3}
        alreadyDone={alreadyDone || claimed}
        onReplay={() => {
          setDroppedIds([]);
          setClaimed(false);
        }}
        onClaim={() => {
          setClaimed(true);
          onDone();
        }}
      />
    </div>
  );
};

// 4. MAGNET DISCOVERY BENCH
const MagnetBench: React.FC<{
  language: Language;
  explanation: LocalizedText;
  alreadyDone: boolean;
  onDone: () => void;
}> = ({ language, explanation, alreadyDone, onDone }) => {
  const objects = [
    { id: 'clip', emoji: '📎', name: { ar: 'مشبك حديدي', en: 'Steel Paperclip' }, magnetic: true },
    { id: 'key', emoji: '🗝️', name: { ar: 'مفتاح حديد', en: 'Iron Key' }, magnetic: true },
    { id: 'wood', emoji: '🪵', name: { ar: 'قطعة خشب', en: 'Wooden Block' }, magnetic: false },
    { id: 'leaf', emoji: '🍃', name: { ar: 'ورقة شجر', en: 'Leaf' }, magnetic: false },
  ];
  const [tested, setTested] = useState<string[]>([]);
  const [claimed, setClaimed] = useState(false);

  const testObj = (id: string, magnetic: boolean) => {
    setTested((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (magnetic) soundEngine.playSuccess();
    else soundEngine.playPop();
  };

  return (
    <div className="space-y-4 text-center">
      <div className="rounded-3xl bg-[#F5F0FF] p-5 border border-[#8054D9]/25 flex flex-col items-center gap-3">
        <div className="text-5xl">🧲</div>
        <p className="text-xs font-extrabold text-[#8054D9]">
          {language === 'ar'
            ? 'اضغط على كل غرض لتقريبه من المغناطيس!'
            : 'Tap each object to bring it near the magnet!'}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
          {objects.map((o) => {
            const isTested = tested.includes(o.id);
            return (
              <motion.button
                key={o.id}
                type="button"
                animate={isTested && o.magnetic ? { y: -10, scale: 1.04 } : undefined}
                onClick={() => testObj(o.id, o.magnetic)}
                className={`min-h-[96px] rounded-2xl p-3 border-2 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  isTested
                    ? o.magnetic
                      ? 'bg-[#E2F9EC] border-[#55D98B]'
                      : 'bg-white border-slate-300'
                    : 'bg-white border-[#8054D9]/25'
                }`}
              >
                <span className="text-3xl">{o.emoji}</span>
                <span className="text-xs font-extrabold">{o.name[language]}</span>
                {isTested && (
                  <span className="text-[10px] font-bold text-[#27345C]/75">
                    {o.magnetic
                      ? language === 'ar'
                        ? 'ينجذب 🧲'
                        : 'Attracted!'
                      : language === 'ar'
                        ? 'لا ينجذب'
                        : 'Not magnetic'}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      <CompletionPanel
        language={language}
        explanation={explanation}
        done={tested.length >= 3}
        alreadyDone={alreadyDone || claimed}
        onReplay={() => {
          setTested([]);
          setClaimed(false);
        }}
        onClaim={() => {
          setClaimed(true);
          onDone();
        }}
      />
    </div>
  );
};

// 5. PLANT GROWING GREENHOUSE
const PlantGrowBench: React.FC<{
  language: Language;
  explanation: LocalizedText;
  alreadyDone: boolean;
  onDone: () => void;
}> = ({ language, explanation, alreadyDone, onDone }) => {
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(0);
  const [claimed, setClaimed] = useState(false);

  const stageMeta = [
    { emoji: '🌰', label: { ar: 'بذرة في التربة', en: 'Seed in Soil' } },
    { emoji: '🌱', label: { ar: 'برعم أخضر صغير', en: 'Tiny Green Sprout' } },
    { emoji: '🌿', label: { ar: 'ساق وأوراق نامية', en: 'Growing Stem & Leaves' } },
    { emoji: '🌻', label: { ar: 'زهرة متفتحة مشرقة!', en: 'Blooming Sunflower!' } },
  ][stage];

  return (
    <div className="space-y-4 text-center">
      <div className="rounded-3xl bg-gradient-to-b from-[#E0F7FF] via-[#FFF8E9] to-[#D4A373]/40 p-6 border border-[#55D98B]/30">
        <motion.div
          key={stage}
          initial={{ scale: 0.7, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          className="text-6xl sm:text-7xl py-3"
        >
          {stageMeta.emoji}
        </motion.div>
        <p className="font-extrabold text-[#27345C]">{stageMeta.label[language]}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            soundEngine.playPop();
            setStage(1);
          }}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white border-2 border-[#27345C]/15 font-bold text-sm cursor-pointer"
        >
          1. {language === 'ar' ? 'ازرع البذرة 🌱' : 'Plant Seed 🌱'}
        </button>
        <button
          type="button"
          disabled={stage < 1}
          onClick={() => {
            soundEngine.playPop();
            setStage(2);
          }}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#E5F6FF] border-2 border-[#39BDF2] font-bold text-sm cursor-pointer disabled:opacity-40"
        >
          2. {language === 'ar' ? 'اسقها بالماء 💧' : 'Water Gently 💧'}
        </button>
        <button
          type="button"
          disabled={stage < 2}
          onClick={() => {
            soundEngine.playCelebration();
            setStage(3);
          }}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#FFD84D] text-[#27345C] font-extrabold text-sm cursor-pointer disabled:opacity-40"
        >
          3. {language === 'ar' ? 'أضف ضوء الشمس ☀️' : 'Add Sunlight ☀️'}
        </button>
      </div>

      <CompletionPanel
        language={language}
        explanation={explanation}
        done={stage === 3}
        alreadyDone={alreadyDone || claimed}
        onReplay={() => {
          setStage(0);
          setClaimed(false);
        }}
        onClaim={() => {
          setClaimed(true);
          onDone();
        }}
      />
    </div>
  );
};

// 6. SPACE EXPLORER OBSERVATORY
const SpaceExplorerBench: React.FC<{
  language: Language;
  explanation: LocalizedText;
  alreadyDone: boolean;
  onDone: () => void;
}> = ({ language, explanation, alreadyDone, onDone }) => {
  const bodies = [
    {
      id: 'sun',
      emoji: '☀️',
      name: { ar: 'الشمس', en: 'The Sun' },
      fact: { ar: 'نجم متوهج يمنحنا الضوء والدفء لتعيش النباتات والحيوانات.', en: 'Our bright star giving Earth warm light and energy.' },
    },
    {
      id: 'earth',
      emoji: '🌍',
      name: { ar: 'الأرض', en: 'Planet Earth' },
      fact: { ar: 'بيتنا الأزرق الرائع الذي يحتوي على الماء والهواء النقي.', en: 'Our blue planet with liquid water, oxygen, and life.' },
    },
    {
      id: 'mars',
      emoji: '🔴',
      name: { ar: 'المريخ', en: 'Mars' },
      fact: { ar: 'الكوكب الأحمر المغطى بأتربة الحديد والجبال الشاهقة.', en: 'The Red Planet known for rusty iron dust and tall mountains.' },
    },
    {
      id: 'saturn',
      emoji: '🪐',
      name: { ar: 'زحل', en: 'Saturn' },
      fact: { ar: 'كوكب عملاق تحيط به حلقات متلألئة من الجليد والصخور!', en: 'A giant planet wearing dazzling rings of ice and dust!' },
    },
  ];
  const [visited, setVisited] = useState<string[]>(['sun']);
  const [activeId, setActiveId] = useState('sun');
  const [claimed, setClaimed] = useState(false);

  const current = bodies.find((b) => b.id === activeId) || bodies[0];

  const inspectBody = (id: string) => {
    soundEngine.playMusicNote(bodies.findIndex((b) => b.id === id));
    setActiveId(id);
    setVisited((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-center gap-2">
        {bodies.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => inspectBody(b.id)}
            className={`min-h-[44px] px-4 py-2 rounded-2xl border-2 font-extrabold text-sm flex items-center gap-2 cursor-pointer ${
              activeId === b.id ? 'bg-[#27345C] text-[#FFD84D] border-[#FFD84D]' : 'bg-white border-[#27345C]/15'
            }`}
          >
            <span className="text-xl">{b.emoji}</span>
            <span>{b.name[language]}</span>
          </button>
        ))}
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-[#1B2246] via-[#2C2559] to-[#4A3B8F] text-white p-6 flex flex-col sm:flex-row items-center gap-5">
        <div className="w-28 h-28 rounded-full border-4 border-[#FFD84D]/70 bg-black/30 flex items-center justify-center text-6xl shrink-0">
          {current.emoji}
        </div>
        <div className="text-center sm:text-start space-y-1.5">
          <p className="text-xs font-extrabold text-[#39BDF2]">
            {language === 'ar' ? 'منظار التلسكوب الفضائي:' : 'Observatory Telescope View:'}
          </p>
          <h3 className="text-2xl font-extrabold text-[#FFD84D]">{current.name[language]}</h3>
          <p className="text-sm text-white/90 leading-relaxed">{current.fact[language]}</p>
        </div>
      </div>

      <CompletionPanel
        language={language}
        explanation={explanation}
        done={visited.length >= 3}
        alreadyDone={alreadyDone || claimed}
        onReplay={() => {
          setVisited(['sun']);
          setActiveId('sun');
          setClaimed(false);
        }}
        onClaim={() => {
          setClaimed(true);
          onDone();
        }}
      />
    </div>
  );
};

// 7. ANIMAL HABITAT DISCOVERY
const AnimalHabitatBench: React.FC<{
  language: Language;
  explanation: LocalizedText;
  alreadyDone: boolean;
  onDone: () => void;
}> = ({ language, explanation, alreadyDone, onDone }) => {
  const pairs = [
    { id: 'camel', emoji: '🐪', name: { ar: 'الجمل', en: 'Camel' }, habitat: 'desert', habitatLabel: { ar: 'الصحراء 🏜️', en: 'Desert 🏜️' } },
    { id: 'polar', emoji: '🐻‍❄️', name: { ar: 'الدب القطبي', en: 'Polar Bear' }, habitat: 'arctic', habitatLabel: { ar: 'الجليد ❄️', en: 'Arctic Ice ❄️' } },
    { id: 'dolphin', emoji: '🐬', name: { ar: 'الدلفين', en: 'Dolphin' }, habitat: 'ocean', habitatLabel: { ar: 'المحيط 🌊', en: 'Ocean 🌊' } },
  ];
  const [matched, setMatched] = useState<string[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<string>('camel');
  const [claimed, setClaimed] = useState(false);

  const tryMatch = (hab: string) => {
    const target = pairs.find((p) => p.id === selectedAnimal);
    if (!target) return;
    if (target.habitat === hab) {
      soundEngine.playSuccess();
      const next = matched.includes(target.id) ? matched : [...matched, target.id];
      setMatched(next);
      const remaining = pairs.find((p) => !next.includes(p.id));
      if (remaining) setSelectedAnimal(remaining.id);
    } else {
      soundEngine.playEncourage();
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {pairs.map((p) => {
          const done = matched.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelectedAnimal(p.id);
                soundEngine.speak(p.name[language], language);
              }}
              className={`min-h-[92px] rounded-2xl p-3 border-2 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                done
                  ? 'bg-[#E2F9EC] border-[#55D98B]'
                  : selectedAnimal === p.id
                    ? 'bg-[#FFF3D1] border-[#FF9360]'
                    : 'bg-white border-[#27345C]/12'
              }`}
            >
              <span className="text-3xl">{p.emoji}</span>
              <span className="text-xs font-extrabold">{p.name[language]}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {pairs.map((p) => (
          <button
            key={p.habitat}
            type="button"
            onClick={() => tryMatch(p.habitat)}
            className="min-h-[56px] rounded-2xl bg-[#FFF8E9] hover:bg-[#E5F6FF] border-2 border-[#39BDF2]/40 font-extrabold text-sm cursor-pointer"
          >
            {p.habitatLabel[language]}
          </button>
        ))}
      </div>

      <CompletionPanel
        language={language}
        explanation={explanation}
        done={matched.length === pairs.length}
        alreadyDone={alreadyDone || claimed}
        onReplay={() => {
          setMatched([]);
          setSelectedAnimal('camel');
          setClaimed(false);
        }}
        onClaim={() => {
          setClaimed(true);
          onDone();
        }}
      />
    </div>
  );
};

// 8. LITTLE SCIENTIST CHALLENGES
const ScientistChallengeBench: React.FC<{
  ageGroup: StoredAgeGroupId;
  birthYear?: number;
  birthMonth?: number;
  language: Language;
  explanation: LocalizedText;
  alreadyDone: boolean;
  onDone: () => void;
}> = ({ ageGroup, birthYear, birthMonth, language, explanation, alreadyDone, onDone }) => {
  const puzzles = useMemo(() => {
    const tier = getAgeTier(ageGroup, birthYear, birthMonth);
    if (tier === 'young') {
      return [
        {
          q: { ar: 'ماذا تحتاج النبتة لتكبر؟', en: 'What does a little seed need to grow?' },
          options: [
            { id: 'a', label: { ar: 'ماء وشمس 💧☀️', en: 'Water & Sun 💧☀️' }, ok: true },
            { id: 'b', label: { ar: 'حذاء رياضي 👟', en: 'Sneaker 👟' }, ok: false },
          ],
        },
        {
          q: { ar: 'أي جسم يطفو على الماء؟', en: 'Which toy floats on water?' },
          options: [
            { id: 'a', label: { ar: 'صخرة كبيرة 🪨', en: 'Big Rock 🪨' }, ok: false },
            { id: 'b', label: { ar: 'بطة مطاطية 🦆', en: 'Rubber Duck 🦆' }, ok: true },
          ],
        },
      ];
    }
    return [
      {
        q: { ar: 'إذا خلطنا الأزرق والأصفر ماذا ينتج؟', en: 'What color comes from mixing Blue + Yellow?' },
        options: [
          { id: 'a', label: { ar: 'الأخضر 💚', en: 'Green 💚' }, ok: true },
          { id: 'b', label: { ar: 'البني 🤎', en: 'Brown 🤎' }, ok: false },
        ],
      },
      {
        q: { ar: 'أي أداة نستخدم لرؤية الكواكب البعيدة؟', en: 'Which tool helps us see distant planets?' },
        options: [
          { id: 'a', label: { ar: 'التلسكوب 🔭', en: 'Telescope 🔭' }, ok: true },
          { id: 'b', label: { ar: 'المغناطيس 🧲', en: 'Magnet 🧲' }, ok: false },
        ],
      },
      {
        q: { ar: 'أيهما ينجذب للمغناطيس؟', en: 'Which item sticks to a magnet?' },
        options: [
          { id: 'a', label: { ar: 'مفتاح حديدي 🗝️', en: 'Iron Key 🗝️' }, ok: true },
          { id: 'b', label: { ar: 'ورقة دفتر 📄', en: 'Paper Sheet 📄' }, ok: false },
        ],
      },
    ];
  }, [ageGroup]);

  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [hintShake, setHintShake] = useState(false);

  const cur = puzzles[step];

  return (
    <div className="space-y-4">
      {!finished && cur && (
        <div className="rounded-3xl bg-[#FFF8E9] p-5 border border-[#F59E0B]/30 space-y-4">
          <p className="text-xs font-extrabold text-[#D97706] tabular-nums">
            {language === 'ar' ? `التحدي ${step + 1} من ${puzzles.length}` : `Challenge ${step + 1} of ${puzzles.length}`}
          </p>
          <h3 className="text-xl font-extrabold text-[#27345C]">{cur.q[language]}</h3>
          {hintShake && (
            <p className="text-xs font-bold text-[#FF4D6D]">
              {language === 'ar' ? 'قريب جداً! فكر في الملاحظة العلمية وجرب الخيار الآخر!' : 'Almost! Think like a scientist and try the other clue!'}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cur.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (opt.ok) {
                    soundEngine.playSuccess();
                    setHintShake(false);
                    if (step + 1 < puzzles.length) setStep(step + 1);
                    else setFinished(true);
                  } else {
                    soundEngine.playEncourage();
                    setHintShake(true);
                  }
                }}
                className="nono-btn-tactile min-h-[56px] p-4 rounded-2xl bg-white border-2 border-[#27345C]/12 hover:border-[#8054D9] font-extrabold text-base cursor-pointer"
              >
                {opt.label[language]}
              </button>
            ))}
          </div>
        </div>
      )}

      <CompletionPanel
        language={language}
        explanation={explanation}
        done={finished}
        alreadyDone={alreadyDone || claimed}
        onReplay={() => {
          setStep(0);
          setFinished(false);
          setClaimed(false);
        }}
        onClaim={() => {
          setClaimed(true);
          onDone();
        }}
      />
    </div>
  );
};
