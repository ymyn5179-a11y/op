import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Lightbulb, Sparkles, Volume2 } from 'lucide-react';
import { CharacterActor } from './CharacterCast';
import { NonoCharacter } from './NonoCharacter';
import { AppScreen, EmotionalFeedbackPayload, Language } from '../types/nonoland';
import { soundEngine } from '../utils/soundEngine';

interface EmotionalFeedbackBannerProps {
  feedback: EmotionalFeedbackPayload | null;
  language: Language;
  onNavigate?: (screen: AppScreen) => void;
  onDismiss?: () => void;
}

export const EmotionalFeedbackBanner: React.FC<EmotionalFeedbackBannerProps> = ({
  feedback,
  language,
  onNavigate,
  onDismiss,
}) => {
  if (!feedback) return null;

  const isCelebrate = feedback.tone === 'celebrate';
  const isSimplify = feedback.tone === 'simplify';

  const cardStyle = isCelebrate
    ? 'bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5] border-[#55D98B]'
    : isSimplify
      ? 'bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] border-[#FFD84D]'
      : 'bg-gradient-to-br from-[#F3ECFF] to-[#E5F6FF] border-[#8054D9]/40';

  const speakFeedback = () => {
    const parts = [
      feedback.title[language],
      feedback.message[language],
      feedback.hintStep ? feedback.hintStep[language] : '',
      feedback.workedExample ? feedback.workedExample.explanation[language] : '',
    ]
      .filter(Boolean)
      .join('. ');
    soundEngine.speak(parts, language);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`rounded-3xl border-2 p-4 sm:p-5 shadow-sm space-y-3 ${cardStyle}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="shrink-0">
          {feedback.characterId === 'nono' ? (
            <NonoCharacter
              mood={isCelebrate ? 'celebrating' : 'encouraging'}
              size="sm"
              language={language}
            />
          ) : (
            <CharacterActor
              characterId={feedback.characterId}
              mood={isCelebrate ? 'celebrating' : 'encouraging'}
              size="sm"
            />
          )}
        </div>

        <div className="flex-1 min-w-[200px] space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg font-extrabold text-[#27345C] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#8054D9] shrink-0" />
              <span>{feedback.title[language]}</span>
            </h3>
            <button
              type="button"
              onClick={speakFeedback}
              className="min-h-[36px] px-3 rounded-xl bg-white/90 border border-[#27345C]/12 text-xs font-extrabold text-[#27345C] flex items-center gap-1 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5 text-[#8054D9]" />
              <span>{language === 'ar' ? 'استمع' : 'Listen'}</span>
            </button>
          </div>
          <p className="text-sm font-bold text-[#27345C]/85">{feedback.message[language]}</p>

          {feedback.hintStep && (
            <div className="p-3 rounded-2xl bg-white/85 border border-[#8054D9]/20 flex items-start gap-2 text-xs sm:text-sm font-bold text-[#27345C]">
              <Lightbulb className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
              <span>{feedback.hintStep[language]}</span>
            </div>
          )}

          {feedback.workedExample && (
            <div className="p-3.5 rounded-2xl bg-white border-2 border-[#FFD84D] space-y-1.5">
              <p className="text-[11px] font-extrabold text-[#B45309]">
                {language === 'ar' ? 'مثال موضّح خطوة بخطوة:' : 'Worked Visual Example:'}
              </p>
              <p className="text-lg sm:text-xl font-extrabold text-[#27345C] text-center py-1 bg-[#FFF8E9] rounded-xl">
                {feedback.workedExample.visual}
              </p>
              <p className="text-xs sm:text-sm font-bold text-[#27345C]/85">
                {feedback.workedExample.explanation[language]}
              </p>
            </div>
          )}

          {feedback.simplifiedSteps && feedback.simplifiedSteps.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {feedback.simplifiedSteps.map((step, i) => (
                <div
                  key={i}
                  className="px-3 py-2 rounded-xl bg-white/80 text-xs font-bold text-[#27345C] flex items-center gap-2"
                >
                  <span className="w-5 h-5 rounded-full bg-[#8054D9] text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span>{step[language]}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {feedback.recommendedRevisionScreen && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate(feedback.recommendedRevisionScreen!)}
                className="min-h-[40px] px-4 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <span>{language === 'ar' ? 'تدريب مبسّط على هذه المهارة' : 'Gentle Practice for This Skill'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="min-h-[40px] px-3.5 rounded-xl bg-white/85 border border-[#27345C]/15 text-xs font-extrabold text-[#27345C] cursor-pointer"
              >
                {language === 'ar' ? 'حسناً' : 'Got it'}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
