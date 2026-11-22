import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Award,
  Gamepad2,
  Heart,
  Lamp,
  Lock,
  Palette,
  Plus,
  RotateCcw,
  Sparkles,
  Sprout,
  Trash2,
  Undo2,
} from 'lucide-react';
import { LearningGardenPanel } from '../components/LearningGardenPanel';
import { NonoCharacter } from '../components/NonoCharacter';
import { NonoLandLogo } from '../components/NonoLandLogo';
import { useNonoLand } from '../context/NonoLandContext';
import { REWARD_BADGES, ROOM_ITEMS } from '../data/rewardsAndRoom';
import { DEFAULT_PET_STATE, DEFAULT_ROOM_CONFIG, PET_PRESET_NAMES, PET_SPECIES } from '../data/worldCatalog';
import { t, UI_COPY } from '../i18n/translations';
import { PlacedRoomItem, RoomConfig } from '../types/nonoland';
import { soundEngine } from '../utils/soundEngine';

const WALL_COLORS = ['#FFF3D1', '#E5F6FF', '#F3ECFF', '#FFEAF3', '#E2F9EC', '#1E2749'];

export const MyRoomScreen: React.FC = () => {
  const {
    activeChild,
    language,
    navigate,
    saveRoomState,
    interactWithPet,
  } = useNonoLand();

  const roomConfig: RoomConfig = useMemo(
    () => ({ ...DEFAULT_ROOM_CONFIG, ...(activeChild?.roomConfig || {}) }),
    [activeChild?.roomConfig],
  );

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [bouncingId, setBouncingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'decorate' | 'style' | 'toys' | 'garden' | 'wall'>('decorate');
  const [undoStack, setUndoStack] = useState<Array<{ cfg: RoomConfig; items: PlacedRoomItem[] }>>([]);
  const [collisionNotice, setCollisionNotice] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  if (!activeChild) return null;

  const placedItems = activeChild.placedRoomItems || [];

  const pushUndo = (cfg: RoomConfig, items: PlacedRoomItem[]) => {
    setUndoStack((prev) => [{ cfg, items }, ...prev].slice(0, 12));
  };

  const updateRoomConfig = (patch: Partial<RoomConfig>) => {
    pushUndo(roomConfig, placedItems);
    const nextCfg: RoomConfig = { ...roomConfig, ...patch };
    soundEngine.playPop();
    void saveRoomState(nextCfg, placedItems);
  };

  const hasOverlap = (x: number, y: number, ignoreId?: string) => {
    return placedItems.some((p) => {
      if (p.instanceId === ignoreId) return false;
      const dist = Math.hypot(p.x - x, p.y - y);
      return dist < 10;
    });
  };

  const handleStagePlaceOrMove = (clientX: number, clientY: number) => {
    if (!selectedInstanceId || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = Math.round(Math.min(88, Math.max(12, ((clientX - rect.left) / rect.width) * 100)));
    const y = Math.round(Math.min(84, Math.max(22, ((clientY - rect.top) / rect.height) * 100)));

    if (hasOverlap(x, y, selectedInstanceId)) {
      soundEngine.playEncourage();
      setCollisionNotice(
        language === 'ar'
          ? 'هذا المكان مشغول بعنصر آخر، اختر مساحة فارغة قريبة!'
          : 'That spot already holds another item—tap an open space nearby!',
      );
      return;
    }
    setCollisionNotice(null);
    pushUndo(roomConfig, placedItems);
    const nextItems = placedItems.map((p) => (p.instanceId === selectedInstanceId ? { ...p, x, y } : p));
    setSelectedInstanceId(null);
    soundEngine.playPop();
    void saveRoomState(roomConfig, nextItems);
  };

  const handlePlaceNewItem = (itemId: string) => {
    pushUndo(roomConfig, placedItems);
    // Find collision-free spot cleanly
    let candidateX = 24;
    let candidateY = 66;
    for (let i = 0; i < 16; i += 1) {
      const tx = 18 + ((i * 19) % 68);
      const ty = 46 + ((i * 13) % 34);
      if (!hasOverlap(tx, ty)) {
        candidateX = tx;
        candidateY = ty;
        break;
      }
    }
    const nextItems: PlacedRoomItem[] = [
      ...placedItems,
      { instanceId: `rm-${Date.now()}`, itemId, x: candidateX, y: candidateY },
    ];
    soundEngine.playPop();
    void saveRoomState(roomConfig, nextItems);
  };

  const handleRemoveItem = (instanceId: string) => {
    pushUndo(roomConfig, placedItems);
    const nextItems = placedItems.filter((p) => p.instanceId !== instanceId);
    soundEngine.playPop();
    void saveRoomState(roomConfig, nextItems);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const [last, ...rest] = undoStack;
    setUndoStack(rest);
    soundEngine.playPop();
    void saveRoomState(last.cfg, last.items);
  };

  const handleResetRoom = () => {
    pushUndo(roomConfig, placedItems);
    soundEngine.playPop();
    void saveRoomState(DEFAULT_ROOM_CONFIG, placedItems.slice(0, 2));
  };

  const petState = activeChild.petState || DEFAULT_PET_STATE;
  const petSpecies = PET_SPECIES.find((p) => p.id === petState.speciesId) || PET_SPECIES[0];
  const petName = PET_PRESET_NAMES.find((n) => n.id === petState.presetNameId)?.label || PET_PRESET_NAMES[0].label;

  const isDarkWall = roomConfig.wallColor === '#1E2749' || roomConfig.lighting === 'nightlight';

  return (
    <div className="space-y-6">
      {/* Header + Undo / Reset Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <NonoLandLogo variant="compact" size="md" showWordmark={false} language={language} />
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#27345C] flex items-center gap-2">
              <Palette className="w-7 h-7 text-[#FF78B7]" />
              <span>
                {language === 'ar'
                  ? `غرفة ${activeChild.displayName} الذكية`
                  : `${activeChild.displayName}'s Dream Room`}
              </span>
            </h1>
            <p className="text-sm text-[#27345C]/75">
              {language === 'ar'
                ? 'صمّم الجدران والأرضية، رتّب أثاثك، اعتنِ بحديقتك وأليفك، واعرض أوسمتك ولوحاتك!'
                : 'Customize walls, rugs & lighting, arrange toys safely, water My Garden plants, and visit My Pet!'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={undoStack.length === 0}
            onClick={handleUndo}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#27345C]/15 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Undo2 className="w-4 h-4" />
            <span>{language === 'ar' ? 'تراجع' : 'Undo'}</span>
          </button>
          <button
            type="button"
            onClick={handleResetRoom}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#27345C]/15 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{language === 'ar' ? 'إعادة ضبط الغرفة' : 'Reset Style'}</span>
          </button>
        </div>
      </div>

      {collisionNotice && (
        <div className="rounded-2xl bg-[#FFF3D1] border border-[#FFD84D] px-4 py-2.5 text-xs font-extrabold text-[#B45309]">
          {collisionNotice}
        </div>
      )}

      {/* 2.5D COZY ROOM STAGE */}
      <div
        ref={stageRef}
        onClick={(e) => handleStagePlaceOrMove(e.clientX, e.clientY)}
        style={{ backgroundColor: roomConfig.wallColor }}
        className={`relative h-[390px] sm:h-[440px] rounded-[2.2rem] border-4 border-white shadow-xl overflow-hidden select-none transition-colors duration-300 ${
          selectedInstanceId ? 'cursor-crosshair' : ''
        }`}
      >
        {/* Wallpaper Pattern Overlay */}
        {roomConfig.wallpaper === 'stars' && (
          <div className="pointer-events-none absolute inset-0 opacity-35 text-2xl flex flex-wrap gap-14 p-6">
            {'✦ ⭐ ✨ 🌟 ✦ ⭐ ✨ 🌟 ✦ ⭐ ✨ 🌟'.split(' ').map((s, i) => (
              <span key={i}>{s}</span>
            ))}
          </div>
        )}
        {roomConfig.wallpaper === 'clouds' && (
          <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-around opacity-40 text-5xl">
            <span>☁️</span>
            <span>☁️</span>
            <span>☁️</span>
          </div>
        )}
        {roomConfig.wallpaper === 'stripes' && (
          <div
            className="pointer-events-none absolute inset-0 opacity-15"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 36px, #27345C 36px, #27345C 38px)',
            }}
          />
        )}

        {/* Lighting Mood Dimmer */}
        {roomConfig.lighting === 'warm-lamp' && (
          <div className="pointer-events-none absolute inset-0 bg-[#FFD84D]/15" />
        )}
        {roomConfig.lighting === 'nightlight' && (
          <div className="pointer-events-none absolute inset-0 bg-[#141B38]/40" />
        )}

        {/* Window & Curtains */}
        <div className="absolute top-6 start-8 flex items-start gap-1">
          {roomConfig.curtains !== 'none' && (
            <div
              className="w-5 h-28 rounded-b-xl shadow"
              style={{
                backgroundColor:
                  roomConfig.curtains === 'mint'
                    ? '#55D98B'
                    : roomConfig.curtains === 'gold'
                      ? '#FFD84D'
                      : '#8054D9',
              }}
            />
          )}
          <div className="w-24 h-24 rounded-2xl bg-[#39BDF2]/35 border-4 border-white/90 flex items-center justify-center text-3xl shadow-inner">
            {isDarkWall ? '🌙' : '☀️'}
          </div>
          {roomConfig.curtains !== 'none' && (
            <div
              className="w-5 h-28 rounded-b-xl shadow"
              style={{
                backgroundColor:
                  roomConfig.curtains === 'mint'
                    ? '#55D98B'
                    : roomConfig.curtains === 'gold'
                      ? '#FFD84D'
                      : '#8054D9',
              }}
            />
          )}
        </div>

        {/* Wall Shelf Mini Preview of Badges */}
        <div className="absolute top-7 end-8 hidden sm:flex items-center gap-1.5 bg-white/85 px-3 py-1.5 rounded-2xl border border-[#27345C]/10 shadow-sm">
          <span className="text-xs font-extrabold text-[#27345C]">🏆</span>
          {activeChild.unlockedBadges.slice(0, 4).map((bId) => {
            const b = REWARD_BADGES.find((x) => x.id === bId);
            return b ? (
              <span key={bId} title={b.title[language]} className="text-lg">
                {b.emoji}
              </span>
            ) : null;
          })}
        </div>

        {/* 2.5D Perspective Floor */}
        <div
          className={`absolute inset-x-0 bottom-0 h-32 border-t-4 border-white/50 ${
            roomConfig.floorStyle === 'wood'
              ? 'bg-[#E6B88A]/85'
              : roomConfig.floorStyle === 'pastel-tile'
                ? 'bg-[#D8F3FF]/90'
                : 'bg-[#C4B5FD]/85'
          }`}
        />

        {/* Room Rug */}
        {roomConfig.rug !== 'none' && (
          <div
            className={`absolute bottom-5 start-1/2 -translate-x-1/2 w-64 h-16 rounded-full border-4 border-white/80 shadow-inner flex items-center justify-center text-2xl ${
              roomConfig.rug === 'rainbow'
                ? 'bg-gradient-to-r from-[#FF78B7]/60 via-[#FFD84D]/60 to-[#39BDF2]/60'
                : roomConfig.rug === 'star'
                  ? 'bg-[#8054D9]/35'
                  : 'bg-white/70'
            }`}
          >
            {roomConfig.rug === 'rainbow' ? '🌈' : roomConfig.rug === 'star' ? '⭐' : '☁️'}
          </div>
        )}

        {/* Nono Companion + Pet Corner */}
        <div className="absolute bottom-6 start-1/2 -translate-x-1/2 z-10 flex items-end gap-3">
          <NonoCharacter
            mood="dancing"
            scarfColor={activeChild.companionScarfColor}
            size="md"
            language={language}
          />
          {petState.adopted && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                soundEngine.playSuccess();
                void interactWithPet({ action: 'play' });
              }}
              className="mb-1 px-2.5 py-1.5 rounded-2xl bg-white/90 border-2 border-[#FFD84D] shadow flex items-center gap-1 cursor-pointer hover:scale-105 transition-transform"
              title={petName[language]}
            >
              <span className="text-3xl">{petSpecies.emoji}</span>
              <span className="text-[11px] font-extrabold text-[#27345C]">{petName[language]}</span>
            </button>
          )}
        </div>

        {/* Placed Draggable / Interactive Room Furniture & Toys */}
        {placedItems.map((placed) => {
          const item = ROOM_ITEMS.find((r) => r.id === placed.itemId);
          if (!item) return null;
          const isSelected = selectedInstanceId === placed.instanceId;
          const isBouncing = bouncingId === placed.instanceId;

          return (
            <motion.div
              key={placed.instanceId}
              style={{ left: `${placed.x}%`, top: `${placed.y}%` }}
              animate={isBouncing ? { y: [0, -18, 0], rotate: [-8, 8, 0] } : undefined}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.playSuccess();
                  setBouncingId(placed.instanceId);
                  setTimeout(() => setBouncingId(null), 650);
                  soundEngine.speak(t(item.name, language), language);
                }}
                className={`text-5xl sm:text-6xl drop-shadow-md cursor-pointer transition-transform hover:scale-110 rounded-2xl p-1 ${
                  isSelected ? 'ring-4 ring-[#8054D9] bg-white/50' : ''
                }`}
                title={t(item.name, language)}
              >
                {item.emoji}
              </button>

              <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex justify-center gap-1 mt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedInstanceId(isSelected ? null : placed.instanceId);
                  }}
                  className="px-2 py-1 rounded-lg bg-white/95 text-[#27345C] text-[10px] font-extrabold shadow cursor-pointer"
                >
                  {isSelected
                    ? language === 'ar'
                      ? 'اضغط مكاناً'
                      : 'Tap spot'
                    : language === 'ar'
                      ? 'تحريك'
                      : 'Move'}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveItem(placed.instanceId);
                  }}
                  aria-label="Remove item"
                  className="p-1 rounded-lg bg-white/95 text-[#FF4D6D] shadow cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          );
        })}

        {selectedInstanceId && (
          <div className="absolute top-4 end-4 z-30 px-4 py-2 rounded-2xl bg-[#8054D9] text-white text-xs font-extrabold shadow-lg">
            {language === 'ar'
              ? 'اضغط في مساحة فارغة بالغرفة لنقل العنصر!'
              : 'Tap any open spot in the room to move this item!'}
          </div>
        )}
      </div>

      {/* Sub-Hub Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'decorate' as const, ar: 'أثاث الغرفة', en: 'Furniture', icon: <Sparkles className="w-4 h-4" /> },
          { id: 'style' as const, ar: 'ألوان وإضاءة الغرفة', en: 'Walls & Lighting', icon: <Lamp className="w-4 h-4" /> },
          { id: 'toys' as const, ar: 'صندوق الألعاب والأليف', en: 'Toys & Pet Corner', icon: <Gamepad2 className="w-4 h-4" /> },
          { id: 'garden' as const, ar: 'حديقتي السحرية', en: 'My Garden', icon: <Sprout className="w-4 h-4" /> },
          { id: 'wall' as const, ar: 'حائط الإنجازات واللوحات', en: 'Awards & Wall Art', icon: <Award className="w-4 h-4" /> },
        ].map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => {
              soundEngine.playPop();
              setActiveTab(tb.id);
            }}
            className={`min-h-[44px] px-4 py-2 rounded-2xl border-2 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer ${
              activeTab === tb.id
                ? 'bg-[#8054D9] text-white border-[#8054D9]'
                : 'bg-white text-[#27345C] border-[#27345C]/12'
            }`}
          >
            {tb.icon}
            <span>{language === 'ar' ? tb.ar : tb.en}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: FURNITURE & ROOM TREASURES */}
      {activeTab === 'decorate' && (
        <div className="nono-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'عناصر وأثاث غرفتي' : 'My Room Treasures'}
            </h2>
            <button
              type="button"
              onClick={() => navigate('reward-shop')}
              className="text-xs font-extrabold text-[#8054D9] underline cursor-pointer"
            >
              {language === 'ar' ? 'زيارة متجر المكافآت بالنجوم ←' : 'Visit Star Reward Shop →'}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ROOM_ITEMS.map((item) => {
              const unlocked = activeChild.unlockedRoomItems.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => unlocked && handlePlaceNewItem(item.id)}
                  className={`p-3.5 rounded-2xl border-2 text-center transition-all ${
                    unlocked
                      ? 'bg-[#FFF8E9] border-[#27345C]/10 hover:border-[#8054D9] cursor-pointer'
                      : 'bg-slate-100 border-slate-200 opacity-65 cursor-not-allowed'
                  }`}
                >
                  <div className="text-3xl mb-1">{item.emoji}</div>
                  <p className="text-xs font-extrabold text-[#27345C]">{t(item.name, language)}</p>
                  <p className="text-[10px] font-semibold text-[#27345C]/65 mt-1">
                    {unlocked ? (
                      <span className="inline-flex items-center gap-0.5 text-[#1E7E48] font-extrabold">
                        <Plus className="w-3 h-3" /> {language === 'ar' ? 'أضف للغرفة' : 'Place'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5">
                        <Lock className="w-3 h-3" /> {t(item.unlockHint, language)}
                      </span>
                    )}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: WALLS, WALLPAPER, FLOOR, CURTAINS, RUG, LIGHTING */}
      {activeTab === 'style' && (
        <div className="nono-card rounded-3xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-extrabold mb-2">{language === 'ar' ? 'لون الحائط:' : 'Wall Color:'}</p>
              <div className="flex flex-wrap gap-2.5">
                {WALL_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => updateRoomConfig({ wallColor: hex })}
                    aria-label={hex}
                    className={`w-10 h-10 rounded-full border-4 cursor-pointer ${
                      roomConfig.wallColor === hex ? 'border-[#8054D9] scale-110' : 'border-white shadow'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-extrabold mb-2">{language === 'ar' ? 'ورق الحائط:' : 'Wallpaper Pattern:'}</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'solid', ar: 'سادة', en: 'Solid' },
                    { id: 'clouds', ar: 'غيوم ☁️', en: 'Clouds ☁️' },
                    { id: 'stars', ar: 'نجوم ⭐', en: 'Stars ⭐' },
                    { id: 'stripes', ar: 'خطوط', en: 'Stripes' },
                  ] as const
                ).map((wp) => (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => updateRoomConfig({ wallpaper: wp.id })}
                    className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-extrabold cursor-pointer ${
                      roomConfig.wallpaper === wp.id ? 'bg-[#8054D9] text-white border-[#8054D9]' : 'bg-white border-[#27345C]/15'
                    }`}
                  >
                    {language === 'ar' ? wp.ar : wp.en}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-extrabold mb-2">{language === 'ar' ? 'الإضاءة:' : 'Lighting Mood:'}</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'daylight', ar: 'ضوء النهار ☀️', en: 'Daylight ☀️' },
                    { id: 'warm-lamp', ar: 'إضاءة دافئة 🪔', en: 'Warm Lamp 🪔' },
                    { id: 'nightlight', ar: 'سكون الليل 🌙', en: 'Nightlight 🌙' },
                  ] as const
                ).map((lt) => (
                  <button
                    key={lt.id}
                    type="button"
                    onClick={() => updateRoomConfig({ lighting: lt.id })}
                    className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-extrabold cursor-pointer ${
                      roomConfig.lighting === lt.id ? 'bg-[#27345C] text-[#FFD84D]' : 'bg-white border-[#27345C]/15'
                    }`}
                  >
                    {language === 'ar' ? lt.ar : lt.en}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-extrabold mb-2">{language === 'ar' ? 'الأرضية:' : 'Floor Style:'}</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'wood', ar: 'خشب دافئ', en: 'Cozy Wood' },
                    { id: 'pastel-tile', ar: 'بلاط سماوي', en: 'Sky Tile' },
                    { id: 'star-carpet', ar: 'سجاد بنفسجي', en: 'Violet Carpet' },
                  ] as const
                ).map((fl) => (
                  <button
                    key={fl.id}
                    type="button"
                    onClick={() => updateRoomConfig({ floorStyle: fl.id })}
                    className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-extrabold cursor-pointer ${
                      roomConfig.floorStyle === fl.id ? 'bg-[#8054D9] text-white border-[#8054D9]' : 'bg-white border-[#27345C]/15'
                    }`}
                  >
                    {language === 'ar' ? fl.ar : fl.en}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-extrabold mb-2">{language === 'ar' ? 'الستائر:' : 'Curtains:'}</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'violet', ar: 'بنفسجي', en: 'Violet' },
                    { id: 'mint', ar: 'نعناعي', en: 'Mint' },
                    { id: 'gold', ar: 'ذهبي', en: 'Gold' },
                    { id: 'none', ar: 'بدون', en: 'None' },
                  ] as const
                ).map((ct) => (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => updateRoomConfig({ curtains: ct.id })}
                    className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-extrabold cursor-pointer ${
                      roomConfig.curtains === ct.id ? 'bg-[#55D98B] text-[#27345C]' : 'bg-white border-[#27345C]/15'
                    }`}
                  >
                    {language === 'ar' ? ct.ar : ct.en}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-extrabold mb-2">{language === 'ar' ? 'السجادة:' : 'Center Rug:'}</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'cloud', ar: 'غيمة ☁️', en: 'Cloud ☁️' },
                    { id: 'rainbow', ar: 'قوس قزح 🌈', en: 'Rainbow 🌈' },
                    { id: 'star', ar: 'نجمة ⭐', en: 'Star ⭐' },
                    { id: 'none', ar: 'بدون', en: 'None' },
                  ] as const
                ).map((rg) => (
                  <button
                    key={rg.id}
                    type="button"
                    onClick={() => updateRoomConfig({ rug: rg.id })}
                    className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-extrabold cursor-pointer ${
                      roomConfig.rug === rg.id ? 'bg-[#FF78B7] text-white' : 'bg-white border-[#27345C]/15'
                    }`}
                  >
                    {language === 'ar' ? rg.ar : rg.en}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INTERACTIVE TOY COLLECTION & PET CORNER */}
      {activeTab === 'toys' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-7 nono-card rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'صندوق الألعاب التفاعلي' : 'Interactive Toy Box'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'drum', emoji: '🥁', ar: 'طبلة مرحة', en: 'Happy Drum', note: 0 },
                { id: 'bell', emoji: '🔔', ar: 'جرس نجمي', en: 'Star Bell', note: 2 },
                { id: 'teddy', emoji: '🧸', ar: 'دبدوب لطيف', en: 'Cuddle Bear', note: 3 },
                { id: 'train', emoji: '🚂', ar: 'قطار سريع', en: 'Toy Train', note: 4 },
              ].map((toy) => (
                <button
                  key={toy.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playMusicNote(toy.note);
                    soundEngine.speak(language === 'ar' ? toy.ar : toy.en, language);
                  }}
                  className="nono-btn-tactile p-4 rounded-2xl bg-[#FFF8E9] border-2 border-[#FFD84D]/40 text-center cursor-pointer"
                >
                  <div className="text-4xl mb-1">{toy.emoji}</div>
                  <p className="text-xs font-extrabold text-[#27345C]">{language === 'ar' ? toy.ar : toy.en}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-5 nono-card rounded-3xl p-6 space-y-3 bg-gradient-to-br from-[#FFF8E9] to-[#E5F6FF]">
            <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
              <Heart className="w-5 h-5 text-[#FF78B7]" />
              <span>{language === 'ar' ? 'ركن صديقي الأليف' : 'My Pet Corner'}</span>
            </h2>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-3xl bg-white border-2 border-[#FFD84D] flex items-center justify-center text-5xl shadow">
                {petSpecies.emoji}
              </div>
              <div>
                <p className="font-extrabold text-lg text-[#27345C]">
                  {petState.adopted ? petName[language] : language === 'ar' ? 'لم تتبنّ أليفاً بعد' : 'No Pet Adopted Yet'}
                </p>
                <p className="text-xs text-[#27345C]/70">
                  {petState.adopted
                    ? `${petSpecies.name[language]} · ${language === 'ar' ? 'سعيد ومرتاح' : 'Cozy & Happy'}`
                    : language === 'ar'
                      ? 'اذهب لركن أليفي لتختار صديقك!'
                      : 'Visit My Pet Sanctuary to adopt your companion!'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('my-pet')}
              className="nono-btn-tactile min-h-[44px] w-full rounded-xl bg-[#FF78B7] text-white text-sm font-extrabold cursor-pointer"
            >
              {language === 'ar' ? 'زيارة ركن حيواني الأليف' : 'Open My Pet Sanctuary'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: MY GARDEN */}
      {activeTab === 'garden' && <LearningGardenPanel />}

      {/* TAB 5: ACHIEVEMENT WALL & CREATIVE STUDIO GALLERY */}
      {activeTab === 'wall' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 nono-card rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'حائط الأوسمة والشهادات' : 'My Achievement Wall'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {REWARD_BADGES.map((b) => {
                const earned = activeChild.unlockedBadges.includes(b.id);
                return (
                  <div
                    key={b.id}
                    className={`rounded-2xl p-3 text-center border-2 ${
                      earned ? 'bg-[#FFF8E9] border-[#FFD84D]' : 'bg-slate-100 border-slate-200 opacity-50'
                    }`}
                  >
                    <div className="text-3xl">{b.emoji}</div>
                    <p className="text-xs font-extrabold mt-1">{b.title[language]}</p>
                  </div>
                );
              })}
            </div>
            {activeChild.certificates.length > 0 && (
              <div className="rounded-2xl bg-[#E2F9EC] p-3 text-xs font-extrabold text-[#1E7E48]">
                📜 {language === 'ar' ? `لديك ${activeChild.certificates.length} شهادة موثّقة!` : `You hold ${activeChild.certificates.length} verified certificate(s)!`}
              </div>
            )}
          </div>

          <div className="lg:col-span-6 nono-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-[#27345C]">
                {language === 'ar' ? 'معرض لوحاتي الفنية' : 'My Wall Art Gallery'}
              </h2>
              <button
                type="button"
                onClick={() => navigate('creative-studio')}
                className="text-xs font-extrabold text-[#8054D9] hover:underline cursor-pointer"
              >
                {language === 'ar' ? '+ افتح استوديو الإبداع' : '+ Open Creative Studio'}
              </button>
            </div>

            {activeChild.savedDrawings.length === 0 ? (
              <div className="rounded-2xl bg-[#FFF8E9] p-6 text-center space-y-3">
                <p className="text-sm font-bold text-[#27345C]/70">
                  {language === 'ar'
                    ? 'لم ترسم لوحات بعد! ارسم في استوديو الإبداع لتظهر لوحاتك هنا.'
                    : 'No drawings saved yet! Paint inside Creative Studio to hang your art here.'}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('creative-studio')}
                  className="nono-btn-tactile px-4 py-2.5 rounded-xl bg-[#FF78B7] text-white text-xs font-bold cursor-pointer"
                >
                  {t(UI_COPY.games.playNow, language)}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {activeChild.savedDrawings.map((dr) => (
                  <div key={dr.id} className="rounded-2xl overflow-hidden border-2 border-[#FFD84D] bg-white shadow-sm">
                    <img src={dr.dataUrl} alt={dr.title} className="w-full h-24 object-cover" />
                    <p className="text-[11px] font-bold p-1.5 truncate text-center">{dr.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
