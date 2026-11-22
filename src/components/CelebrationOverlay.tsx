import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Award, Sparkles, Star } from 'lucide-react';
import { REWARD_BADGES } from '../data/rewardsAndRoom';
import { useNonoLand } from '../context/NonoLandContext';
import { t } from '../i18n/translations';
import { NonoCharacter } from './NonoCharacter';

export const CelebrationOverlay: React.FC = () => {
  const {
    showCelebration,
    dismissCelebration,
    lastAttempt,
    lastNewlyUnlockedBadge,
    lastNewlyIssuedCert,
    language,
    activeChild,
    navigate,
  } = useNonoLand();

  if (!showCelebration || !lastAttempt || !activeChild) return null;

  const badge = lastNewlyUnlockedBadge
    ? REWARD_BADGES.find((b) => b.id === lastNewlyUnlockedBadge)
    : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#27345C]/55 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.85, y: 24 }}
          animate={{ scale: 1, y: 0 }}
          className="relative w-full max-w-md rounded-3xl bg-[#FFF8E9] border-4 border-[#FFD84D] p-6 text-center shadow-2xl overflow-hidden"
        >
          {/* Floating celebration stars */}
          <div className="flex justify-center gap-3 mb-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1 + i * 0.12, type: 'spring' }}
              >
                <Star className="w-10 h-10 text-[#FFD84D] fill-[#FFD84D] drop-shadow" />
              </motion.div>
            ))}
          </div>

          <div className="flex justify-center my-1">
            <NonoCharacter
              mood="celebrating"
              scarfColor={activeChild.companionScarfColor}
              size="md"
              language={language}
            />
          </div>

          <h2 className="text-2xl font-extrabold text-[#27345C] mt-1">
            {language === 'ar'
              ? `أحسنت يا ${activeChild.displayName}!`
              : `Hooray, ${activeChild.displayName}!`}
          </h2>
          <p className="text-[#27345C]/80 font-semibold mt-1">
            {language === 'ar'
              ? `حصلت على +${lastAttempt.starsEarned} نجوم ذهبية`
              : `You earned +${lastAttempt.starsEarned} golden stars!`}
          </p>

          {badge && (
            <div className="mt-4 rounded-2xl bg-white p-3 border-2 border-[#8054D9]/25 flex items-center gap-3 text-start">
              <span className="text-3xl">{badge.emoji}</span>
              <div>
                <p className="text-xs font-bold text-[#8054D9]">
                  {language === 'ar' ? 'وسام جديد!' : 'New Badge Unlocked!'}
                </p>
                <p className="font-bold text-[#27345C]">{t(badge.title, language)}</p>
              </div>
            </div>
          )}

          {lastNewlyIssuedCert && (
            <div className="mt-3 rounded-2xl bg-[#55D98B]/20 p-3 border-2 border-[#55D98B] flex items-center gap-3 text-start">
              <Award className="w-8 h-8 text-[#27345C] shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#27345C]">
                  {language === 'ar' ? 'شهادة إنجاز جديدة!' : 'New Certificate Earned!'}
                </p>
                <p className="font-bold text-sm text-[#27345C]">
                  {t(lastNewlyIssuedCert.achievementTitle, language)}
                </p>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                dismissCelebration();
                navigate('game-results');
              }}
              className="flex-1 nono-btn-tactile rounded-2xl bg-[#8054D9] text-white font-bold py-3 px-4 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{language === 'ar' ? 'عرض النتيجة والمقترح التالي' : 'See Results & Next Step'}</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
