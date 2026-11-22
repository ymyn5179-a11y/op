import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Cookie, Gamepad2, Heart, PawPrint, Sparkles } from 'lucide-react';
import { useNonoLand } from '../context/NonoLandContext';
import { DEFAULT_PET_STATE, PET_PRESET_NAMES, PET_SPECIES } from '../data/worldCatalog';
import { PetSpeciesId } from '../types/nonoland';
import { soundEngine } from '../utils/soundEngine';

export const MyPetScreen: React.FC = () => {
  const { activeChild, language, navigate, interactWithPet } = useNonoLand();
  const [petMotion, setPetMotion] = useState<'idle' | 'bounce' | 'spin'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  if (!activeChild) return null;

  const pet = activeChild.petState || DEFAULT_PET_STATE;
  const ownedShop = activeChild.ownedShopItemIds || [];

  const species = PET_SPECIES.find((s) => s.id === pet.speciesId) || PET_SPECIES[0];
  const presetName = PET_PRESET_NAMES.find((n) => n.id === pet.presetNameId) || PET_PRESET_NAMES[0];

  const handleAdopt = async (speciesId: PetSpeciesId) => {
    soundEngine.playCelebration();
    setPetMotion('bounce');
    setTimeout(() => setPetMotion('idle'), 800);
    await interactWithPet({ action: 'adopt', speciesId, presetNameId: pet.presetNameId });
    setStatusMessage(
      language === 'ar'
        ? 'مبارك! رحّب بصديقك الأليف الجديد في مسكنه السعيد!'
        : 'Hurray! Welcome your cozy new pet friend!',
    );
  };

  const handleFeed = async () => {
    soundEngine.playSuccess();
    setPetMotion('bounce');
    setTimeout(() => setPetMotion('idle'), 750);
    await interactWithPet({ action: 'feed' });
    setStatusMessage(
      language === 'ar'
        ? `يم يم! استمتع ${presetName.label.ar} بوجبة ${species.favoriteTreat.ar}!`
        : `Yum! ${presetName.label.en} loved the ${species.favoriteTreat.en}!`,
    );
  };

  const handlePlay = async () => {
    soundEngine.playCelebration();
    setPetMotion('spin');
    setTimeout(() => setPetMotion('idle'), 800);
    await interactWithPet({ action: 'play' });
    setStatusMessage(
      language === 'ar'
        ? `${species.soundLabel.ar} — اللعب معاً ممتع جداً!`
        : `${species.soundLabel.en} — Playtime makes everyone smile!`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#27345C] flex items-center gap-2">
            <PawPrint className="w-7 h-7 text-[#FF78B7]" />
            <span>{language === 'ar' ? `مسكن أليف ${activeChild.displayName}` : `${activeChild.displayName}'s Virtual Pet Sanctuary`}</span>
          </h1>
          <p className="text-sm text-[#27345C]/75">
            {language === 'ar'
              ? 'اختر صديقاً لطيفاً، أطلق عليه اسماً مرحاً، أطعمه والعب معه بدون أي قلق!'
              : 'Adopt a friendly companion, pick a fun name, feed treats, and play positive games anytime!'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('reward-shop')}
          className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#FFF3D1] border border-[#FFD84D] text-xs font-extrabold text-[#27345C] flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-[#FF9360]" />
          <span>{language === 'ar' ? 'ألعاب وسرر جديدة من المتجر' : 'Pet Toys in Star Shop'}</span>
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-2xl bg-[#E2F9EC] border-2 border-[#55D98B] px-4 py-3 text-sm font-extrabold text-[#1E7E48]">
          {statusMessage}
        </div>
      )}

      {/* Main Cozy Sanctuary Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 nono-card rounded-[2rem] p-6 bg-gradient-to-b from-[#FFF3D1] via-[#FFF8E9] to-[#E2F9EC] flex flex-col items-center justify-between text-center space-y-5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {pet.habitatDecor.includes('shop-pet-cushion') && <span className="text-3xl" title="Cozy Cloud Bed">☁️</span>}
            {pet.accessories.includes('shop-pet-bowtie') && <span className="text-3xl" title="Rainbow Bowtie">🎀</span>}
            {pet.habitatDecor.includes('shop-pet-ball') && <span className="text-3xl" title="Glowing Star Ball">⚽</span>}
          </div>

          <motion.div
            animate={
              petMotion === 'bounce'
                ? { y: [0, -24, 0, -14, 0], scale: [1, 1.12, 1] }
                : petMotion === 'spin'
                  ? { rotate: [0, 12, -12, 0], scale: [1, 1.15, 1] }
                  : { y: [0, -5, 0] }
            }
            transition={{ duration: 0.7 }}
            className="w-44 h-44 rounded-full bg-white border-4 border-[#FFD84D] shadow-xl flex items-center justify-center text-8xl select-none cursor-pointer"
            onClick={() => void handlePlay()}
          >
            {species.emoji}
          </motion.div>

          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-[#27345C]">
              {presetName.label[language]} · {species.name[language]}
            </h2>
            <p className="text-xs font-extrabold text-[#1E7E48]">
              {language === 'ar'
                ? `سعيد ومرتاح دائما · رعاية: ${pet.careCount} · لعب: ${pet.playCount}`
                : `Always Happy & Cozy · Treats: ${pet.careCount} · Playtime: ${pet.playCount}`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              type="button"
              onClick={() => void handleFeed()}
              className="nono-btn-tactile min-h-[52px] rounded-2xl bg-[#FF9360] text-white font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Cookie className="w-5 h-5" />
              <span>{language === 'ar' ? `أطعمه (${species.favoriteTreat.ar})` : `Feed (${species.favoriteTreat.en})`}</span>
            </button>

            <button
              type="button"
              onClick={() => void handlePlay()}
              className="nono-btn-tactile min-h-[52px] rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Gamepad2 className="w-5 h-5" />
              <span>{language === 'ar' ? 'العب واقفز!' : 'Play & Jump!'}</span>
            </button>
          </div>
        </div>

        {/* Adoption, Naming & Habitat Decor Panel */}
        <div className="lg:col-span-6 space-y-5">
          <div className="nono-card rounded-3xl p-6 space-y-3">
            <h3 className="font-extrabold text-lg text-[#27345C] flex items-center gap-2">
              <Heart className="w-5 h-5 text-[#FF4D6D]" />
              <span>{language === 'ar' ? 'اختر نوع حيوانك الأليف:' : 'Choose Your Pet Friend:'}</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {PET_SPECIES.map((sp) => {
                const active = pet.adopted && pet.speciesId === sp.id;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => void handleAdopt(sp.id)}
                    className={`min-h-[88px] p-3 rounded-2xl border-2 text-center cursor-pointer transition-all ${
                      active ? 'bg-[#FFF3D1] border-[#FF9360]' : 'bg-white border-[#27345C]/10 hover:border-[#8054D9]'
                    }`}
                  >
                    <div className="text-4xl">{sp.emoji}</div>
                    <p className="text-xs font-extrabold mt-1">{sp.name[language]}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="nono-card rounded-3xl p-6 space-y-3">
            <h3 className="font-extrabold text-base text-[#27345C]">
              {language === 'ar' ? 'اختر اسماً لطيفاً:' : 'Pick a Friendly Name:'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {PET_PRESET_NAMES.map((nm) => (
                <button
                  key={nm.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    void interactWithPet({ action: 'rename', presetNameId: nm.id });
                  }}
                  className={`min-h-[44px] px-4 rounded-xl border text-xs font-extrabold cursor-pointer ${
                    pet.presetNameId === nm.id
                      ? 'bg-[#8054D9] text-white border-[#8054D9]'
                      : 'bg-white border-[#27345C]/15'
                  }`}
                >
                  {nm.label[language]}
                </button>
              ))}
            </div>
          </div>

          <div className="nono-card rounded-3xl p-6 space-y-3">
            <h3 className="font-extrabold text-base text-[#27345C]">
              {language === 'ar' ? 'إكسسوارات ومسكن الأليف (من المتجر):' : 'Pet Accessories & Habitat Decor:'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'shop-pet-bowtie', type: 'accessory' as const, emoji: '🎀', ar: 'ربطة قوس قزح', en: 'Rainbow Bowtie' },
                { id: 'shop-pet-cushion', type: 'habitat' as const, emoji: '☁️', ar: 'وسادة الغيمة', en: 'Cloud Bed' },
                { id: 'shop-pet-ball', type: 'habitat' as const, emoji: '⚽', ar: 'كرة النجوم', en: 'Star Ball' },
              ].map((it) => {
                const unlocked = ownedShop.includes(it.id);
                const equipped =
                  it.type === 'accessory'
                    ? pet.accessories.includes(it.id)
                    : pet.habitatDecor.includes(it.id);
                return (
                  <button
                    key={it.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => {
                      soundEngine.playPop();
                      void interactWithPet({
                        action: 'decorate',
                        ...(it.type === 'accessory' ? { accessoryId: it.id } : { habitatId: it.id }),
                      });
                    }}
                    className={`min-h-[44px] px-3.5 rounded-xl border-2 text-xs font-extrabold cursor-pointer ${
                      !unlocked
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : equipped
                          ? 'bg-[#E2F9EC] border-[#55D98B] text-[#1E7E48]'
                          : 'bg-white border-[#27345C]/15'
                    }`}
                  >
                    {it.emoji} {language === 'ar' ? it.ar : it.en} {!unlocked ? '🔒' : equipped ? '✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
