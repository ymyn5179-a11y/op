import React, { useMemo, useState } from 'react';
import { CheckCircle2, ShoppingBag, Sparkles, Star } from 'lucide-react';
import { useNonoLand } from '../context/NonoLandContext';
import { REWARD_SHOP_ITEMS } from '../data/worldCatalog';
import { formatNumber } from '../i18n/translations';
import { RewardShopItem } from '../types/nonoland';
import { soundEngine } from '../utils/soundEngine';

export const RewardShopScreen: React.FC = () => {
  const { activeChild, language, redeemShopItem } = useNonoLand();
  const [cat, setCat] = useState<'all' | RewardShopItem['category']>('all');
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (cat === 'all') return REWARD_SHOP_ITEMS;
    return REWARD_SHOP_ITEMS.filter((i) => i.category === cat);
  }, [cat]);

  if (!activeChild) return null;

  const owned = activeChild.ownedShopItemIds || [];

  const handleBuy = async (item: RewardShopItem) => {
    setBuyingId(item.id);
    setNotice(null);
    try {
      const res = await redeemShopItem(item.id);
      if (res.ok) {
        soundEngine.playCelebration();
        setNotice({
          ok: true,
          msg: language === 'ar' ? `رائع! اقتنيت "${item.name.ar}" بنجومك المكتسبة!` : `Yay! Unlocked "${item.name.en}" with your stars!`,
        });
      } else {
        soundEngine.playEncourage();
        setNotice({ ok: false, msg: res.error || (language === 'ar' ? 'نجومك غير كافية بعد — العب أنشطة جديدة!' : 'Keep learning to earn a few more stars!') });
      }
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#27345C] flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-[#FF9360]" />
            <span>{language === 'ar' ? 'متجر المكافآت بالنجوم' : 'NonoLand Star Reward Shop'}</span>
          </h1>
          <p className="text-sm text-[#27345C]/75">
            {language === 'ar'
              ? 'استبدل النجوم التي كسبتها بتعلمك بملابس وأثاث ومظاهر رائعة — بدون أي أموال حقيقية!'
              : 'Trade learning stars for avatar outfits, pet toys, room treasures & charms — zero real money!'}
          </p>
        </div>

        <div className="px-5 py-2.5 rounded-2xl bg-[#FFD84D]/35 border-2 border-[#FFD84D] flex items-center gap-2 font-extrabold text-[#27345C]">
          <Star className="w-5 h-5 fill-[#FFD84D] text-[#FF9360]" />
          <span className="tabular-nums text-lg">{formatNumber(activeChild.stars, language)}</span>
          <span className="text-xs">{language === 'ar' ? 'نجمة متاحة' : 'Stars'}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all' as const, ar: 'الكل', en: 'All' },
          { id: 'avatar' as const, ar: 'شخصيتي', en: 'My Avatar' },
          { id: 'pet' as const, ar: 'حيواني الأليف', en: 'My Pet' },
          { id: 'room' as const, ar: 'غرفتي', en: 'My Room' },
          { id: 'island' as const, ar: 'الجزر', en: 'Islands' },
          { id: 'character' as const, ar: 'الشخصيات', en: 'Characters' },
        ].map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setCat(tb.id)}
            className={`min-h-[44px] px-4 rounded-2xl border-2 text-xs sm:text-sm font-extrabold cursor-pointer ${
              cat === tb.id ? 'bg-[#8054D9] text-white border-[#8054D9]' : 'bg-white border-[#27345C]/12'
            }`}
          >
            {language === 'ar' ? tb.ar : tb.en}
          </button>
        ))}
      </div>

      {notice && (
        <div
          className={`rounded-2xl p-4 text-sm font-extrabold border-2 ${
            notice.ok ? 'bg-[#E2F9EC] border-[#55D98B] text-[#1E7E48]' : 'bg-[#FFF3D1] border-[#FFD84D] text-[#B45309]'
          }`}
        >
          {notice.msg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => {
          const isOwned = owned.includes(item.id);
          const canAfford = activeChild.stars >= item.costStars;
          return (
            <div key={item.id} className="nono-card rounded-3xl p-5 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-4xl">{item.emoji}</span>
                  {isOwned ? (
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#1E7E48] bg-[#E2F9EC] px-2.5 py-1 rounded-xl">
                      <CheckCircle2 className="w-4 h-4" />
                      {language === 'ar' ? 'مملوك ✓' : 'Owned ✓'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#27345C] bg-[#FFF3D1] px-2.5 py-1 rounded-xl tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-[#FFD84D] text-[#FF9360]" />
                      {item.costStars}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-extrabold text-[#27345C]">{item.name[language]}</h2>
                <p className="text-xs text-[#27345C]/75 leading-relaxed">{item.description[language]}</p>
              </div>

              <button
                type="button"
                disabled={isOwned || !canAfford || buyingId === item.id}
                onClick={() => void handleBuy(item)}
                className={`nono-btn-tactile min-h-[48px] w-full rounded-2xl text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  isOwned
                    ? 'bg-[#E2F9EC] text-[#1E7E48]'
                    : canAfford
                      ? 'bg-[#8054D9] text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isOwned
                    ? language === 'ar'
                      ? 'مفتوح في حسابك!'
                      : 'Already Unlocked!'
                    : canAfford
                      ? language === 'ar'
                        ? `اقتنِ بـ ${item.costStars} نجوم`
                        : `Unlock for ${item.costStars} Stars`
                      : language === 'ar'
                        ? `تحتاج ${item.costStars - activeChild.stars} نجمة أخرى`
                        : `Need ${item.costStars - activeChild.stars} more stars`}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
