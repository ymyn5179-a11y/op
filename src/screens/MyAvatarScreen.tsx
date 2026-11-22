import React, { useEffect, useState } from 'react';
import { Check, Palette, Save, Sparkles, User } from 'lucide-react';
import { ChildAvatarPreview } from '../components/CharacterCast';
import { useNonoLand } from '../context/NonoLandContext';
import { DEFAULT_AVATAR_CONFIG } from '../data/worldCatalog';
import { ChildAvatarConfig } from '../types/nonoland';
import { soundEngine } from '../utils/soundEngine';

const SKIN_TONES = ['#FDE2C8', '#F6C7A3', '#E0A882', '#C5855C', '#8C583A'];
const HAIR_COLORS = ['#27345C', '#5C3A1B', '#C07A38', '#8054D9', '#FF78B7', '#1E293B'];
const OUTFIT_COLORS = ['#8054D9', '#39BDF2', '#FF78B7', '#55D98B', '#FF9360', '#F59E0B'];

export const MyAvatarScreen: React.FC = () => {
  const { activeChild, language, navigate, saveAvatarConfig } = useNonoLand();
  const [draft, setDraft] = useState<ChildAvatarConfig>(() => ({
    ...DEFAULT_AVATAR_CONFIG,
    ...(activeChild?.avatarConfig || {}),
  }));
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (!activeChild) return;
    setDraft({ ...DEFAULT_AVATAR_CONFIG, ...(activeChild.avatarConfig || {}) });
  }, [activeChild]);

  if (!activeChild) return null;

  const ownedShop = activeChild.ownedShopItemIds || [];

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg('');
    try {
      await saveAvatarConfig(draft);
      soundEngine.playCelebration();
      setSavedMsg(language === 'ar' ? 'تم حفظ شخصيتك الرمزية الرائعة! ✨' : 'Your custom avatar is saved! ✨');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#27345C] flex items-center gap-2">
            <User className="w-7 h-7 text-[#8054D9]" />
            <span>{language === 'ar' ? `شخصية ${activeChild.displayName} في نونو لاند` : `${activeChild.displayName}'s Avatar Studio`}</span>
          </h1>
          <p className="text-sm text-[#27345C]/75">
            {language === 'ar'
              ? 'صمّم شكلك اللطيف واختر تسريحتك وملابسك وإكسسواراتك!'
              : 'Customize hair, outfit, colors, accessories, and cheerful expressions!'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('reward-shop')}
          className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#FFF3D1] border border-[#FFD84D] text-xs font-extrabold text-[#27345C] flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-[#FF9360]" />
          <span>{language === 'ar' ? 'فتح ملابس جديدة من المتجر' : 'Unlock Outfits in Star Shop'}</span>
        </button>
      </div>

      {savedMsg && (
        <div className="rounded-2xl bg-[#E2F9EC] border-2 border-[#55D98B] px-4 py-3 text-sm font-extrabold text-[#1E7E48] flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{savedMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Live Preview Card */}
        <div className="lg:col-span-5 nono-card rounded-[2rem] p-6 bg-gradient-to-br from-[#F3ECFF] via-white to-[#E5F6FF] flex flex-col items-center gap-5">
          <div className="w-64 h-64 rounded-[2rem] bg-white border-4 border-[#FFD84D]/70 shadow-xl flex items-center justify-center p-4">
            <ChildAvatarPreview avatar={draft} size="lg" />
          </div>

          <div className="text-center">
            <h2 className="text-xl font-extrabold text-[#27345C]">{activeChild.displayName}</h2>
            <p className="text-xs font-bold text-[#8054D9] mt-0.5">
              {language === 'ar' ? 'مستكشف نونو لاند المبدع' : 'Creative NonoLand Explorer'}
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="nono-btn-tactile w-full min-h-[52px] rounded-2xl bg-[#8054D9] text-white font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ شخصيتي' : 'Save My Avatar')}</span>
          </button>
        </div>

        {/* Customization Panel */}
        <div className="lg:col-span-7 nono-card rounded-[2rem] p-6 space-y-5">
          {/* Skin Tone & Hair Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-extrabold mb-2">{language === 'ar' ? 'لون البشرة:' : 'Skin Tone:'}</p>
              <div className="flex flex-wrap gap-2">
                {SKIN_TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      setDraft((d) => ({ ...d, skinTone: tone }));
                    }}
                    aria-label={tone}
                    className={`w-10 h-10 rounded-full border-4 cursor-pointer ${
                      draft.skinTone === tone ? 'border-[#8054D9] scale-110' : 'border-white shadow'
                    }`}
                    style={{ backgroundColor: tone }}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-extrabold mb-2">{language === 'ar' ? 'لون الشعر:' : 'Hair Color:'}</p>
              <div className="flex flex-wrap gap-2">
                {HAIR_COLORS.map((hc) => (
                  <button
                    key={hc}
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      setDraft((d) => ({ ...d, hairColor: hc }));
                    }}
                    aria-label={hc}
                    className={`w-10 h-10 rounded-full border-4 cursor-pointer ${
                      draft.hairColor === hc ? 'border-[#FFD84D] scale-110' : 'border-white shadow'
                    }`}
                    style={{ backgroundColor: hc }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Hair Style */}
          <div>
            <p className="text-xs font-extrabold mb-2">{language === 'ar' ? 'تسريحة الشعر:' : 'Hair Style:'}</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'classic', ar: 'كلاسيكي', en: 'Classic' },
                  { id: 'curly', ar: 'مجعد لطيف', en: 'Curly' },
                  { id: 'bob', ar: 'قصير أنيق', en: 'Bob' },
                  { id: 'spiky', ar: 'حيوي', en: 'Spiky' },
                  { id: 'braids', ar: 'ضفائر', en: 'Braids' },
                  { id: 'cap-hair', ar: 'مع قبعة 🧢', en: 'Cap 🧢' },
                ] as const
              ).map((hs) => (
                <button
                  key={hs.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    setDraft((d) => ({ ...d, hairStyle: hs.id }));
                  }}
                  className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-extrabold cursor-pointer ${
                    draft.hairStyle === hs.id ? 'bg-[#8054D9] text-white border-[#8054D9]' : 'bg-white border-[#27345C]/15'
                  }`}
                >
                  {language === 'ar' ? hs.ar : hs.en}
                </button>
              ))}
            </div>
          </div>

          {/* Outfit & Outfit Color */}
          <div className="space-y-3">
            <p className="text-xs font-extrabold">{language === 'ar' ? 'الملابس والمظهر:' : 'Outfit Style:'}</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'explorer', ar: 'مستكشف 🧭', en: 'Explorer 🧭', lockedBy: null },
                  { id: 'artist', ar: 'فنان 🎨', en: 'Artist 🎨', lockedBy: null },
                  { id: 'scientist', ar: 'عالم 🧪', en: 'Scientist 🧪', lockedBy: null },
                  { id: 'sporty', ar: 'رياضي ⚽', en: 'Sporty ⚽', lockedBy: null },
                  { id: 'astronaut', ar: 'رائد فضاء 👩‍🚀', en: 'Astronaut 👩‍🚀', lockedBy: 'shop-avatar-astronaut' },
                  { id: 'royal', ar: 'ملكي 👑', en: 'Royal Crown 👑', lockedBy: 'shop-avatar-royal' },
                ] as const
              ).map((of) => {
                const locked = Boolean(of.lockedBy && !ownedShop.includes(of.lockedBy));
                return (
                  <button
                    key={of.id}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      soundEngine.playPop();
                      setDraft((d) => ({ ...d, outfit: of.id }));
                    }}
                    className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-extrabold cursor-pointer ${
                      locked
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : draft.outfit === of.id
                          ? 'bg-[#39BDF2] text-[#27345C] border-[#39BDF2]'
                          : 'bg-white border-[#27345C]/15'
                    }`}
                  >
                    {language === 'ar' ? of.ar : of.en} {locked ? '🔒' : ''}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Palette className="w-4 h-4 text-[#8054D9]" />
              {OUTFIT_COLORS.map((oc) => (
                <button
                  key={oc}
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    setDraft((d) => ({ ...d, outfitColor: oc }));
                  }}
                  aria-label={oc}
                  className={`w-9 h-9 rounded-full border-4 cursor-pointer ${
                    draft.outfitColor === oc ? 'border-[#27345C] scale-110' : 'border-white shadow'
                  }`}
                  style={{ backgroundColor: oc }}
                />
              ))}
            </div>
          </div>

          {/* Accessories & Expression */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-extrabold mb-2">{language === 'ar' ? 'الإكسسوارات:' : 'Accessories:'}</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'none', ar: 'بدون', en: 'None' },
                    { id: 'glasses', ar: 'نظارة 👓', en: 'Glasses 👓' },
                    { id: 'star-pin', ar: 'دبوس نجمة ⭐', en: 'Star Pin ⭐' },
                    { id: 'headband', ar: 'طوق 🌸', en: 'Headband 🌸' },
                    { id: 'cape', ar: 'وشاح بطل 🦸', en: 'Cape 🦸' },
                    { id: 'backpack', ar: 'حقيبة 🎒', en: 'Backpack 🎒' },
                  ] as const
                ).map((ac) => (
                  <button
                    key={ac.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      setDraft((d) => ({ ...d, accessory: ac.id }));
                    }}
                    className={`min-h-[44px] px-3 rounded-xl border text-xs font-extrabold cursor-pointer ${
                      draft.accessory === ac.id ? 'bg-[#FF78B7] text-white border-[#FF78B7]' : 'bg-white border-[#27345C]/15'
                    }`}
                  >
                    {language === 'ar' ? ac.ar : ac.en}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-extrabold mb-2">{language === 'ar' ? 'التعبير السعيد:' : 'Expression:'}</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'happy', ar: 'سعيد 😊', en: 'Happy 😊' },
                    { id: 'curious', ar: 'فضولي 🧐', en: 'Curious 🧐' },
                    { id: 'proud', ar: 'فخور 😎', en: 'Proud 😎' },
                    { id: 'silly', ar: 'مرح 😜', en: 'Playful 😜' },
                  ] as const
                ).map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      setDraft((d) => ({ ...d, expression: ex.id }));
                    }}
                    className={`min-h-[44px] px-3 rounded-xl border text-xs font-extrabold cursor-pointer ${
                      draft.expression === ex.id ? 'bg-[#55D98B] text-[#27345C] border-[#55D98B]' : 'bg-white border-[#27345C]/15'
                    }`}
                  >
                    {language === 'ar' ? ex.ar : ex.en}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
