import React, { useEffect, useState } from 'react';
import { Droplets, Sparkles, Sprout, Sun } from 'lucide-react';
import { useNonoLand } from '../context/NonoLandContext';
import {
  DEFAULT_LEARNING_GARDEN_STATE,
  GARDEN_ITEMS_CATALOG,
  sanitizeLearningGarden,
} from '../data/gardenCatalog';
import { GardenPlacement, LearningGardenState } from '../types/nonoland';
import { soundEngine } from '../utils/soundEngine';

const MILESTONE_RULES: Array<{
  key: string;
  itemId: string;
  ar: string;
  en: string;
}> = [
  { key: 'first-lesson', itemId: 'garden-sun-flower', ar: 'إكمال أول درس أو قصة', en: 'Finish your first lesson' },
  { key: 'two-lessons', itemId: 'garden-olive-tree', ar: 'إكمال درسين في الأكاديمية', en: 'Complete 2 academy lessons' },
  { key: 'reading-stage', itemId: 'garden-blue-butterfly', ar: 'إتقان مرحلة قراءة', en: 'Master a reading stage' },
  { key: 'creative-work', itemId: 'garden-rainbow-tulip', ar: 'رسم لوحة أو عزف لحن', en: 'Save a drawing or melody' },
  { key: 'three-stories', itemId: 'garden-story-stone', ar: 'إكمال ٣ قصص', en: 'Finish 3 stories' },
  { key: 'together-time', itemId: 'garden-family-blossom', ar: 'نشاط وقتنا معاً مع العائلة', en: 'Complete a Together Time activity' },
  { key: 'lab-experiment', itemId: 'garden-science-sprout', ar: 'تجربة في مختبر نونو', en: 'Run a Discovery Lab experiment' },
  { key: 'twelve-stars', itemId: 'garden-star-lantern', ar: 'جمع ١٢ نجمة تعلم', en: 'Collect 12 learning stars' },
  { key: 'care-three', itemId: 'garden-ladybug', ar: 'سقي الحديقة ٣ مرات', en: 'Water your garden 3 times' },
  { key: 'five-milestones', itemId: 'garden-cherry-tree', ar: 'تسجيل ٥ أنشطة تعليمية', en: 'Reach 5 joyful activities' },
];

export const LearningGardenPanel: React.FC = () => {
  const { activeChild, authSession, language, updateChildProfile, refreshChildrenList } = useNonoLand();
  const [garden, setGarden] = useState<LearningGardenState>(() =>
    sanitizeLearningGarden(activeChild?.learningGarden || DEFAULT_LEARNING_GARDEN_STATE),
  );
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string>('');

  useEffect(() => {
    if (!activeChild) return;
    setGarden(sanitizeLearningGarden(activeChild.learningGarden || DEFAULT_LEARNING_GARDEN_STATE));
    if (!authSession.authenticated || activeChild.id.startsWith('demo-')) return;
    fetch(`/api/children/${encodeURIComponent(activeChild.id)}/garden`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.garden) {
          setGarden(sanitizeLearningGarden(d.garden));
        }
      })
      .catch(() => {});
  }, [activeChild, authSession.authenticated]);

  if (!activeChild) return null;

  const syncGardenLocal = (nextGarden: LearningGardenState) => {
    setGarden(nextGarden);
    updateChildProfile(activeChild.id, { learningGarden: nextGarden });
  };

  const handleWaterGarden = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback('');
    try {
      if (authSession.authenticated && authSession.csrfToken && !activeChild.id.startsWith('demo-')) {
        const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/garden/water`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': authSession.csrfToken,
          },
          body: JSON.stringify({ instanceId: selectedPlacementId || undefined }),
        });
        const data = await res.json();
        if (res.ok && data.garden) {
          setGarden(sanitizeLearningGarden(data.garden));
          await refreshChildrenList();
          soundEngine.playSuccess();
          setFeedback(
            language === 'ar'
              ? 'سقيتَ الحديقة بحب! النباتات تنمو بسعادة 💧🌱'
              : 'You gently watered your garden! Every plant loves your care 💧🌱',
          );
          return;
        }
      }

      const next: LearningGardenState = {
        ...garden,
        wateringCount: garden.wateringCount + 1,
        lastWateredAt: new Date().toISOString(),
        placements: garden.placements.map((p, idx) =>
          (selectedPlacementId ? p.instanceId === selectedPlacementId : idx === 0)
            ? { ...p, growthStage: Math.min(3, p.growthStage + 1) as 1 | 2 | 3 }
            : p,
        ),
      };
      soundEngine.playSuccess();
      syncGardenLocal(next);
      setFeedback(language === 'ar' ? 'سقيتَ الحديقة بسعادة 💧' : 'Garden watered! 💧');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveThemeOrPlacements = async (
    nextTheme?: LearningGardenState['theme'],
    nextPlacements?: GardenPlacement[],
  ) => {
    const updated = sanitizeLearningGarden({
      ...garden,
      theme: nextTheme || garden.theme,
      placements: nextPlacements || garden.placements,
    });
    setGarden(updated);

    if (authSession.authenticated && authSession.csrfToken && !activeChild.id.startsWith('demo-')) {
      const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/garden/arrange`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': authSession.csrfToken,
        },
        body: JSON.stringify({
          theme: updated.theme,
          placements: updated.placements,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.garden) setGarden(sanitizeLearningGarden(d.garden));
      }
    } else {
      updateChildProfile(activeChild.id, { learningGarden: updated });
    }
  };

  const handlePlaceUnlockedItem = (itemId: string) => {
    if (!garden.unlockedItemIds.includes(itemId)) return;
    const count = garden.placements.length;
    const nextPlacement: GardenPlacement = {
      instanceId: `gp-${Date.now()}-${count}`,
      itemId,
      x: 18 + ((count * 17) % 66),
      y: 42 + ((count * 13) % 38),
      growthStage: 1,
    };
    soundEngine.playPop();
    void handleSaveThemeOrPlacements(undefined, [...garden.placements, nextPlacement]);
  };

  const handleStageTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedPlacementId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(Math.min(88, Math.max(12, ((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.round(Math.min(86, Math.max(28, ((e.clientY - rect.top) / rect.height) * 100)));
    const nextPlacements = garden.placements.map((p) =>
      p.instanceId === selectedPlacementId ? { ...p, x, y } : p,
    );
    setSelectedPlacementId(null);
    soundEngine.playPop();
    void handleSaveThemeOrPlacements(undefined, nextPlacements);
  };

  const handleClaimMilestone = async (milestoneKey: string) => {
    if (busy) return;
    setBusy(true);
    setFeedback('');
    try {
      if (authSession.authenticated && authSession.csrfToken && !activeChild.id.startsWith('demo-')) {
        const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/garden/claim-milestone`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': authSession.csrfToken,
          },
          body: JSON.stringify({ milestoneKey }),
        });
        const data = await res.json();
        if (res.ok && data.garden) {
          setGarden(sanitizeLearningGarden(data.garden));
          await refreshChildrenList();
          soundEngine.playCelebration();
          setFeedback(
            data.awarded
              ? language === 'ar'
                ? 'تهانينا! تفتّحت زهرة أو مفاجأة جديدة في حديقتك 🌸'
                : 'Hooray! A new Learning Garden treasure bloomed 🌸'
              : language === 'ar'
                ? 'هذه المكافأة موجودة بالفعل في حديقتك الجميلة ✓'
                : 'Already unlocked in your garden ✓',
          );
          return;
        }
        setFeedback(
          data.error ||
            (language === 'ar' ? 'أكمل الخطوة التعليمية أولاً لتتفتح الزهرة!' : 'Complete the learning step first to bloom this reward!'),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const themeBg =
    garden.theme === 'starlight-garden'
      ? 'from-[#1E2749] via-[#312E81] to-[#1E3A5F]'
      : garden.theme === 'spring-rain'
        ? 'from-[#DBEAFE] via-[#E0F2FE] to-[#DCFCE7]'
        : 'from-[#E0F7FF] via-[#FFF8E9] to-[#DCFCE7]';

  return (
    <div className="space-y-5">
      <div className="nono-card rounded-3xl p-5 sm:p-6 bg-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
              <Sprout className="w-6 h-6 text-[#16A34A]" />
              <span>
                {language === 'ar'
                  ? `حديقة ${activeChild.displayName} للتعلّم والزهور`
                  : `${activeChild.displayName}'s Learning Garden`}
              </span>
            </h2>
            <p className="text-xs font-bold text-[#27345C]/70">
              {language === 'ar'
                ? 'حديقة دافئة غير عقابية — النباتات لا تذبل أبداً وتزدهر مع كل درس وقصة ونشاط عائلي!'
                : 'A calm, non-punitive garden — plants never wilt and keep growing with every story, lesson, and Together Time!'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'sunny-meadow' as const, ar: '☀️ مرج مشمس', en: '☀️ Sunny Meadow' },
                { id: 'spring-rain' as const, ar: '🌦️ ربيع دافئ', en: '🌦️ Spring Rain' },
                { id: 'starlight-garden' as const, ar: '🌙 سماء النجوم', en: '🌙 Starlight' },
              ] as const
            ).map((th) => (
              <button
                key={th.id}
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  void handleSaveThemeOrPlacements(th.id);
                }}
                className={`min-h-[38px] px-3 rounded-xl text-xs font-extrabold border cursor-pointer ${
                  garden.theme === th.id
                    ? 'bg-[#8054D9] text-white border-[#8054D9]'
                    : 'bg-[#FFF8E9] border-[#27345C]/12 text-[#27345C]'
                }`}
              >
                {th[language]}
              </button>
            ))}

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleWaterGarden()}
              className="nono-btn-tactile min-h-[42px] px-4 rounded-2xl bg-[#39BDF2] text-[#27345C] text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Droplets className="w-4 h-4" />
              <span>
                {language === 'ar' ? `اسقِ الحديقة (${garden.wateringCount})` : `Water Garden (${garden.wateringCount})`}
              </span>
            </button>
          </div>
        </div>

        {feedback && (
          <div className="p-3 rounded-2xl bg-[#DCFCE7] border border-[#22C55E] text-xs font-extrabold text-[#14532D]">
            {feedback}
          </div>
        )}

        {/* Interactive Visual Garden Stage */}
        <div
          onClick={handleStageTap}
          className={`relative h-[300px] sm:h-[340px] rounded-[2rem] border-4 border-white shadow-inner overflow-hidden bg-gradient-to-b ${themeBg} select-none ${
            selectedPlacementId ? 'cursor-crosshair' : ''
          }`}
        >
          <div className="absolute top-4 end-6 text-4xl">
            {garden.theme === 'starlight-garden' ? '🌙' : garden.theme === 'spring-rain' ? '🌦️' : '☀️'}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#55D98B]/80 to-[#86EFAC]/55 border-t-4 border-white/60" />

          {garden.placements.map((pl) => {
            const def = GARDEN_ITEMS_CATALOG.find((g) => g.id === pl.itemId) || GARDEN_ITEMS_CATALOG[0];
            const isSelected = selectedPlacementId === pl.instanceId;
            return (
              <button
                key={pl.instanceId}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.playPop();
                  setSelectedPlacementId(isSelected ? null : pl.instanceId);
                }}
                style={{ left: `${pl.x}%`, top: `${pl.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer transition-transform hover:scale-110 ${
                  isSelected ? 'ring-4 ring-[#8054D9] bg-white/75 rounded-2xl p-1.5' : ''
                }`}
                title={def.name[language]}
              >
                <span className={pl.growthStage === 3 ? 'text-5xl' : pl.growthStage === 2 ? 'text-4xl' : 'text-3xl'}>
                  {def.emoji}
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-white/85 text-[10px] font-extrabold text-[#27345C] shadow-sm mt-0.5">
                  {'🌱'.repeat(pl.growthStage)}
                </span>
              </button>
            );
          })}

          {selectedPlacementId && (
            <div className="absolute bottom-3 start-4 px-3 py-1.5 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold shadow">
              {language === 'ar' ? 'اضغط في أي مكان داخل الحديقة لنقل النبات!' : 'Tap anywhere inside the garden to move this item!'}
            </div>
          )}
        </div>

        {/* Unlocked Garden Catalog + Milestones */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6 space-y-2.5">
            <h3 className="text-sm font-extrabold text-[#27345C] flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-[#F59E0B]" />
              <span>{language === 'ar' ? 'كنوز الحديقة المفتوحة (اضغط للوضع)' : 'Unlocked Garden Treasures (Tap to Place)'}</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {GARDEN_ITEMS_CATALOG.map((item) => {
                const unlocked = garden.unlockedItemIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => handlePlaceUnlockedItem(item.id)}
                    className={`p-3 rounded-2xl border-2 text-center ${
                      unlocked
                        ? 'bg-[#FFF8E9] border-[#FFD84D] hover:border-[#8054D9] cursor-pointer'
                        : 'bg-slate-100 border-slate-200 opacity-55 cursor-not-allowed'
                    }`}
                  >
                    <div className="text-3xl">{item.emoji}</div>
                    <p className="text-[11px] font-extrabold text-[#27345C] mt-1">{item.name[language]}</p>
                    <p className="text-[10px] text-[#27345C]/65">{item.milestoneHint[language]}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-6 space-y-2.5">
            <h3 className="text-sm font-extrabold text-[#27345C] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#8054D9]" />
              <span>{language === 'ar' ? 'إنجازات الحديقة القابلة للفتح' : 'Garden Milestone Rewards'}</span>
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pe-1">
              {MILESTONE_RULES.map((m) => {
                const claimed = garden.milestonesUnlocked.includes(m.key);
                const def = GARDEN_ITEMS_CATALOG.find((g) => g.id === m.itemId);
                return (
                  <div
                    key={m.key}
                    className="p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#27345C]/10 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{def?.emoji || '🌸'}</span>
                      <div>
                        <p className="font-extrabold text-[#27345C]">{m[language]}</p>
                        <p className="text-[10px] text-[#27345C]/65">{def?.name[language]}</p>
                      </div>
                    </div>
                    {claimed ? (
                      <span className="px-2.5 py-1 rounded-xl bg-[#DCFCE7] text-[#15803D] font-extrabold shrink-0">
                        ✓ {language === 'ar' ? 'متفتح' : 'Bloomed'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleClaimMilestone(m.key)}
                        className="px-3 py-1.5 rounded-xl bg-[#8054D9] text-white font-extrabold cursor-pointer shrink-0"
                      >
                        {language === 'ar' ? 'افتح 🌸' : 'Claim 🌸'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
