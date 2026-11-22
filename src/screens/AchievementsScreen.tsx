import React, { useState } from 'react';
import { Award, Lock, ShoppingBag, Star } from 'lucide-react';
import { CertificateModal } from '../components/CertificateModal';
import { useNonoLand } from '../context/NonoLandContext';
import { CHARACTER_COMPANIONS, REWARD_BADGES } from '../data/rewardsAndRoom';
import { getWorldById } from '../data/worlds';
import { formatDate, formatNumber, t, UI_COPY } from '../i18n/translations';
import { Certificate } from '../types/nonoland';
import { soundEngine } from '../utils/soundEngine';

export const AchievementsScreen: React.FC = () => {
  const { activeChild, language, navigate } = useNonoLand();
  const [tab, setTab] = useState<'badges' | 'certificates' | 'characters'>('badges');
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);

  if (!activeChild) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#27345C] flex items-center gap-2">
            <Award className="w-7 h-7 text-[#FF9360]" />
            <span>{t(UI_COPY.nav.achievements, language)}</span>
          </h1>
          <p className="text-sm text-[#27345C]/75">
            {language === 'ar'
              ? `مجموع نجوم ${activeChild.displayName}: ${formatNumber(activeChild.stars, language)} نجمة`
              : `${activeChild.displayName}'s Collection · ${activeChild.stars} Stars Earned`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.playPop();
              navigate('reward-shop');
            }}
            className="nono-btn-tactile min-h-[44px] px-4 rounded-2xl bg-[#FFD84D] text-[#27345C] text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{language === 'ar' ? 'متجر الجوائز بالنجوم' : 'Star Reward Shop'}</span>
          </button>

          {/* Segmented Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-white rounded-2xl border border-[#27345C]/12">
            {[
              { id: 'badges' as const, ar: 'الأوسمة والجوائز', en: 'Badges' },
              { id: 'certificates' as const, ar: 'الشهادات', en: 'Certificates' },
              { id: 'characters' as const, ar: 'الشخصيات', en: 'Characters' },
            ].map((tb) => (
              <button
                key={tb.id}
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  setTab(tb.id);
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                  tab === tb.id ? 'bg-[#8054D9] text-white' : 'text-[#27345C]/75 hover:text-[#27345C]'
                }`}
              >
                {language === 'ar' ? tb.ar : tb.en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB 1: BADGES */}
      {tab === 'badges' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REWARD_BADGES.map((badge) => {
            const unlocked = activeChild.unlockedBadges.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`nono-card rounded-3xl p-5 flex items-start gap-4 ${
                  unlocked ? '' : 'opacity-65'
                }`}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                  style={{ backgroundColor: `${badge.color}30` }}
                >
                  {unlocked ? badge.emoji : '🔒'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-[#27345C]">{t(badge.title, language)}</h3>
                  </div>
                  <p className="text-xs text-[#27345C]/75 mt-1">{t(badge.description, language)}</p>
                  <p className="text-[11px] font-bold mt-2" style={{ color: unlocked ? '#55D98B' : '#8054D9' }}>
                    {unlocked
                      ? language === 'ar'
                        ? 'تم الحصول عليه ✓'
                        : 'Unlocked ✓'
                      : t(badge.ruleDescription, language)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: CERTIFICATES GALLERY */}
      {tab === 'certificates' && (
        <div className="space-y-4">
          {activeChild.certificates.length === 0 ? (
            <div className="nono-card rounded-3xl p-8 text-center space-y-3">
              <Award className="w-12 h-12 text-[#FFD84D] mx-auto" />
              <h2 className="text-xl font-extrabold text-[#27345C]">
                {language === 'ar' ? 'لا توجد شهادات بعد' : 'No Certificates Issued Yet'}
              </h2>
              <p className="text-sm text-[#27345C]/75 max-w-md mx-auto">
                {language === 'ar'
                  ? 'أكمل نشاطين داخل أي عالم تعليمي لتحصل على شهادة إنجاز رسمية باسمك قابلة للطباعة!'
                  : 'Complete 2 learning activities in any educational world to earn an official printable certificate!'}
              </p>
              <button
                type="button"
                onClick={() => navigate('map')}
                className="nono-btn-tactile px-6 py-3 rounded-2xl bg-[#8054D9] text-white font-bold cursor-pointer"
              >
                {t(UI_COPY.nav.map, language)}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeChild.certificates.map((cert) => {
                const world = getWorldById(cert.worldId);
                return (
                  <div
                    key={cert.id}
                    className="nono-card rounded-3xl p-6 border-2 flex flex-col justify-between gap-4"
                    style={{ borderColor: `${world.primaryColor}50` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-extrabold" style={{ color: world.primaryColor }}>
                          {t(cert.worldName, language)}
                        </p>
                        <h3 className="text-xl font-extrabold text-[#27345C] mt-1">
                          {t(cert.achievementTitle, language)}
                        </h3>
                        <p className="text-xs text-[#27345C]/65 mt-1 font-mono-num">
                          ID: {cert.uniqueCode} · {formatDate(cert.issuedAt, language)}
                        </p>
                      </div>
                      <span className="text-4xl">{world.guardianEmoji}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedCert(cert)}
                      className="nono-btn-tactile w-full py-2.5 rounded-xl text-white font-bold text-sm cursor-pointer"
                      style={{ backgroundColor: world.primaryColor }}
                    >
                      {language === 'ar' ? 'معاينة وطباعة الشهادة (PDF)' : 'View & Print Certificate (PDF)'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CHARACTER COLLECTION */}
      {tab === 'characters' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CHARACTER_COMPANIONS.map((ch) => {
            const unlocked = activeChild.unlockedCharacters.includes(ch.id);
            const world = getWorldById(ch.worldId);
            return (
              <div
                key={ch.id}
                className={`nono-card rounded-3xl p-5 space-y-3 ${unlocked ? '' : 'opacity-70'}`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
                    style={{ backgroundColor: `${ch.color}25` }}
                  >
                    {ch.emoji}
                  </div>
                  {!unlocked && (
                    <span className="text-xs font-bold text-[#27345C]/60 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      {t(world.name, language)}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-[#27345C]">{t(ch.name, language)}</h3>
                  <p className="text-xs font-bold" style={{ color: ch.color }}>
                    {t(ch.role, language)}
                  </p>
                  <p className="text-sm text-[#27345C]/75 mt-2">{t(ch.personality, language)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Printable & Verifiable Certificate Modal */}
      {selectedCert && (
        <CertificateModal
          certificate={selectedCert}
          language={language}
          onClose={() => setSelectedCert(null)}
        />
      )}
    </div>
  );
};
