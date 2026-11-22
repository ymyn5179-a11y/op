import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Brain, CheckCircle2, RotateCcw, Sparkles, Star } from 'lucide-react';
import { useNonoLand } from '../context/NonoLandContext';
import { Language, LocalizedText } from '../types/nonoland';
import { getInternalAgeBand } from '../utils/ageAdaptation';
import { soundEngine } from '../utils/soundEngine';

type BrainModeId =
  | 'memory'
  | 'differences'
  | 'shapes'
  | 'patterns'
  | 'sorting'
  | 'jigsaw'
  | 'maze'
  | 'observation'
  | 'sequence';

const BRAIN_MODES: Array<{
  id: BrainModeId;
  emoji: string;
  color: string;
  title: LocalizedText;
  desc: LocalizedText;
}> = [
  { id: 'memory', emoji: '🃏', color: '#8054D9', title: { ar: 'تحدي الذاكرة', en: 'Memory Match' }, desc: { ar: 'اقلب البطاقات وطابق الأزواج', en: 'Flip cards & match twins' } },
  { id: 'differences', emoji: '🔍', color: '#39BDF2', title: { ar: 'اكتشف المختلف', en: 'Spot Difference' }, desc: { ar: 'لاحظ الاختلاف بين الصورتين', en: 'Spot what changed in Scene B' } },
  { id: 'shapes', emoji: '🔷', color: '#FF78B7', title: { ar: 'تطابق الأشكال', en: 'Shape Match' }, desc: { ar: 'اربط كل شكل بظله الصحيح', en: 'Match shape silhouettes' } },
  { id: 'patterns', emoji: '🧩', color: '#F59E0B', title: { ar: 'إكمال النمط', en: 'Pattern Puzzle' }, desc: { ar: 'ما الرمز التالي في السلسلة؟', en: 'What comes next in sequence?' } },
  { id: 'sorting', emoji: '🗂️', color: '#10B981', title: { ar: 'الفرز والتصنيف', en: 'Sort & Classify' }, desc: { ar: 'صنّف العناصر حسب الفئة', en: 'Group items by category' } },
  { id: 'jigsaw', emoji: '🖼️', color: '#6366F1', title: { ar: 'ترتيب اللوحة', en: 'Picture Jigsaw' }, desc: { ar: 'بدّل القطع لإكمال المشهد', en: 'Swap tiles to complete art' } },
  { id: 'maze', emoji: '🗺️', color: '#EC4899', title: { ar: 'متاهة نونو الذكية', en: 'Logic Maze' }, desc: { ar: 'اختر الخطوات نحو الكنز', en: 'Navigate safely to the goal' } },
  { id: 'observation', emoji: '👀', color: '#06B6D4', title: { ar: 'بحث الملاحظة', en: 'Observation Hunt' }, desc: { ar: 'عدّ وحدّد العناصر المخفية', en: 'Find specific hidden icons' } },
  { id: 'sequence', emoji: '⏳', color: '#8B5CF6', title: { ar: 'التسلسل المنطقي', en: 'Logical Order' }, desc: { ar: 'رتّب الأحداث من البداية للنهاية', en: 'Order steps chronologically' } },
];

export const BrainGamesScreen: React.FC = () => {
  const { activeChild, language, recordGameAttempt } = useNonoLand();
  const [selectedId, setSelectedId] = useState<BrainModeId>('memory');
  const [wonMsg, setWonMsg] = useState<string>('');

  const isYoung = getInternalAgeBand(activeChild) !== '3-4';
  const curMode = BRAIN_MODES.find((m) => m.id === selectedId) || BRAIN_MODES[0];

  const handleWin = (mode: BrainModeId, score: number, maxScore: number) => {
    soundEngine.playCelebration();
    recordGameAttempt({
      activityId: `brain-${mode}`,
      worldId: 'intelligence-castle',
      skillId: mode === 'memory' || mode === 'observation' ? 'memory-focus' : 'logic-patterns',
      score,
      maxScore,
      durationSeconds: 35,
    });
    setWonMsg(
      language === 'ar'
        ? `ممتاز! أكملت لعبة "${curMode.title.ar}" بذكاء وتركيز رائع!`
        : `Brilliant focus! Completed "${curMode.title.en}" cleanly!`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#27345C] flex items-center gap-2">
            <Brain className="w-7 h-7 text-[#8054D9]" />
            <span>{language === 'ar' ? 'ألعاب الذكاء والمنطق (٩ ألعاب)' : 'Brain & Logic Games Hub (9 Challenges)'}</span>
          </h1>
          <p className="text-sm text-[#27345C]/75">
            {language === 'ar'
              ? 'ألعاب ذكاء تتكيّف مع عمرك وتنمّي الذاكرة، الملاحظة، الأنماط، والتفكير المنطقي!'
              : 'Age-tailored cognitive mini-games growing memory, observation, patterns, and logic!'}
          </p>
        </div>
      </div>

      {/* 9-Game Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {BRAIN_MODES.map((m) => {
          const active = selectedId === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                soundEngine.playPop();
                setSelectedId(m.id);
                setWonMsg('');
              }}
              className={`min-h-[68px] p-3 rounded-2xl border-2 text-start flex items-center gap-2.5 cursor-pointer transition-all ${
                active ? 'bg-[#FFF8E9] border-[#8054D9] shadow-sm' : 'bg-white border-[#27345C]/10 hover:border-[#8054D9]/45'
              }`}
            >
              <span className="text-2xl shrink-0">{m.emoji}</span>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-extrabold text-[#27345C] truncate">{m.title[language]}</p>
                <p className="text-[10px] font-bold text-[#27345C]/60 truncate">{m.desc[language]}</p>
              </div>
            </button>
          );
        })}
      </div>

      {wonMsg && (
        <div className="rounded-2xl bg-[#E2F9EC] border-2 border-[#55D98B] p-4 text-sm font-extrabold text-[#1E7E48] flex items-center gap-2">
          <Star className="w-5 h-5 fill-[#FFD84D] text-[#FF9360]" />
          <span>{wonMsg}</span>
        </div>
      )}

      {/* Active Mini-Game Arena */}
      <div className="nono-card rounded-[2rem] p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-3xl">{curMode.emoji}</span>
          <div>
            <h2 className="text-xl font-extrabold text-[#27345C]">{curMode.title[language]}</h2>
            <p className="text-xs font-bold text-[#27345C]/70">{curMode.desc[language]}</p>
          </div>
        </div>

        {selectedId === 'memory' && <MemoryMiniGame key={`mem-${isYoung}`} pairCount={isYoung ? 3 : 4} language={language} onWin={(s, m) => handleWin('memory', s, m)} />}
        {selectedId === 'differences' && <DifferencesMiniGame language={language} onWin={(s, m) => handleWin('differences', s, m)} />}
        {selectedId === 'shapes' && <ShapeMatchMiniGame language={language} onWin={(s, m) => handleWin('shapes', s, m)} />}
        {selectedId === 'patterns' && <PatternMiniGame isYoung={isYoung} language={language} onWin={(s, m) => handleWin('patterns', s, m)} />}
        {selectedId === 'sorting' && <SortingMiniGame language={language} onWin={(s, m) => handleWin('sorting', s, m)} />}
        {selectedId === 'jigsaw' && <TileSwapJigsaw language={language} onWin={(s, m) => handleWin('jigsaw', s, m)} />}
        {selectedId === 'maze' && <MazeMiniGame language={language} onWin={(s, m) => handleWin('maze', s, m)} />}
        {selectedId === 'observation' && <ObservationMiniGame language={language} onWin={(s, m) => handleWin('observation', s, m)} />}
        {selectedId === 'sequence' && <SequenceMiniGame language={language} onWin={(s, m) => handleWin('sequence', s, m)} />}
      </div>
    </div>
  );
};

// 1. MEMORY MATCH
const MemoryMiniGame: React.FC<{ pairCount: number; language: Language; onWin: (s: number, m: number) => void }> = ({ pairCount, language, onWin }) => {
  const icons = useMemo(() => ['🦊', '🌟', '🚀', '🎨'].slice(0, pairCount), [pairCount]);
  const [cards, setCards] = useState(() => {
    const deck = [...icons, ...icons].map((em, i) => ({ id: i, em }));
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = (i * 5 + 3) % (i + 1);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  });
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);

  const handleFlip = (idx: number) => {
    if (flipped.includes(idx) || matched.includes(idx) || flipped.length >= 2) return;
    soundEngine.playPop();
    const next = [...flipped, idx];
    setFlipped(next);
    if (next.length === 2) {
      const [a, b] = next;
      if (cards[a].em === cards[b].em) {
        soundEngine.playSuccess();
        const nm = [...matched, a, b];
        setMatched(nm);
        setFlipped([]);
        if (nm.length === cards.length) onWin(pairCount, pairCount);
      } else {
        setTimeout(() => setFlipped([]), 650);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
        {cards.map((c, idx) => {
          const open = flipped.includes(idx) || matched.includes(idx);
          return (
            <motion.button
              key={c.id}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => handleFlip(idx)}
              className={`h-24 rounded-2xl border-2 text-4xl font-extrabold flex items-center justify-center cursor-pointer ${
                matched.includes(idx)
                  ? 'bg-[#E2F9EC] border-[#55D98B]'
                  : open
                    ? 'bg-white border-[#8054D9]'
                    : 'bg-[#8054D9] text-white border-[#8054D9]'
              }`}
            >
              {open ? c.em : '❔'}
            </motion.button>
          );
        })}
      </div>
      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            setFlipped([]);
            setMatched([]);
            setCards((prev) => [...prev].reverse());
          }}
          className="text-xs font-extrabold text-[#8054D9] inline-flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{language === 'ar' ? 'إعادة خلط البطاقات' : 'Shuffle Again'}</span>
        </button>
      </div>
    </div>
  );
};

// 2. SPOT DIFFERENCES
const DifferencesMiniGame: React.FC<{ language: Language; onWin: (s: number, m: number) => void }> = ({ language, onWin }) => {
  const [found, setFound] = useState<string[]>([]);
  const pick = (id: string) => {
    if (found.includes(id)) return;
    soundEngine.playSuccess();
    const next = [...found, id];
    setFound(next);
    if (next.length === 2) onWin(2, 2);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm font-bold text-[#27345C]">
        {language === 'ar'
          ? 'اضغط على العنصرين المختلفين في المشهد الثاني (اليمين)!'
          : 'Tap the 2 things that changed inside Scene B!'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-3xl bg-[#E5F6FF] p-6 border-2 border-white grid grid-cols-3 gap-4 text-center text-4xl">
          <span>☀️</span><span>🌳</span><span>🦋</span>
          <span>🦊</span><span>🍎</span><span>🌼</span>
        </div>
        <div className="rounded-3xl bg-[#E5F6FF] p-6 border-2 border-[#39BDF2] grid grid-cols-3 gap-4 text-center text-4xl">
          <button type="button" onClick={() => pick('moon')} className={`rounded-xl p-1 cursor-pointer ${found.includes('moon') ? 'bg-[#55D98B]/40' : ''}`}>🌙</button>
          <span>🌳</span>
          <span>🦋</span>
          <span>🦊</span>
          <button type="button" onClick={() => pick('banana')} className={`rounded-xl p-1 cursor-pointer ${found.includes('banana') ? 'bg-[#55D98B]/40' : ''}`}>🍌</button>
          <span>🌼</span>
        </div>
      </div>
    </div>
  );
};

// 3. SHAPE MATCH
const ShapeMatchMiniGame: React.FC<{ language: Language; onWin: (s: number, m: number) => void }> = ({ language, onWin }) => {
  const shapes = [
    { id: 'circle', emoji: '🟠', label: { ar: 'دائرة', en: 'Circle' } },
    { id: 'triangle', emoji: '🔺', label: { ar: 'مثلث', en: 'Triangle' } },
    { id: 'square', emoji: '🟦', label: { ar: 'مربع', en: 'Square' } },
  ];
  const [targetIdx, setTargetIdx] = useState(0);
  const cur = shapes[targetIdx];

  return (
    <div className="space-y-4 text-center">
      <p className="text-lg font-extrabold text-[#27345C]">
        {language === 'ar' ? `ابحث عن الشكل: ${cur.label.ar}` : `Tap the matching shape: ${cur.label.en}`}
      </p>
      <div className="flex justify-center gap-4">
        {shapes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              if (s.id === cur.id) {
                soundEngine.playSuccess();
                if (targetIdx + 1 < shapes.length) setTargetIdx(targetIdx + 1);
                else onWin(3, 3);
              } else {
                soundEngine.playEncourage();
              }
            }}
            className="nono-btn-tactile w-24 h-24 rounded-3xl bg-white border-2 border-[#27345C]/15 text-5xl flex items-center justify-center cursor-pointer"
          >
            {s.emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

// 4. PATTERN PUZZLE
const PatternMiniGame: React.FC<{ isYoung: boolean; language: Language; onWin: (s: number, m: number) => void }> = ({ isYoung, language, onWin }) => {
  const seq = isYoung ? ['🍎', '🍌', '🍎', '🍌'] : ['🌟', '🌙', '☀️', '🌟', '🌙'];
  const answer = isYoung ? '🍎' : '☀️';
  const choices = isYoung ? ['🍎', '🍌', '🍇'] : ['🌙', '☀️', '🌟'];

  return (
    <div className="space-y-4 text-center">
      <div className="flex flex-wrap justify-center gap-2 text-4xl">
        {seq.map((s, i) => (
          <span key={i} className="w-14 h-14 rounded-2xl bg-[#FFF8E9] border flex items-center justify-center">{s}</span>
        ))}
        <span className="w-14 h-14 rounded-2xl bg-[#8054D9]/15 border-2 border-dashed border-[#8054D9] flex items-center justify-center font-extrabold">?</span>
      </div>
      <div className="flex justify-center gap-3">
        {choices.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              if (c === answer) onWin(1, 1);
              else soundEngine.playEncourage();
            }}
            className="nono-btn-tactile w-20 h-20 rounded-2xl bg-white border-2 border-[#8054D9]/30 text-4xl cursor-pointer"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
};

// 5. SORT & CLASSIFY
const SortingMiniGame: React.FC<{ language: Language; onWin: (s: number, m: number) => void }> = ({ language, onWin }) => {
  const items = [
    { id: 'apple', emoji: '🍎', bucket: 'fruit' },
    { id: 'car', emoji: '🚗', bucket: 'vehicle' },
    { id: 'banana', emoji: '🍌', bucket: 'fruit' },
    { id: 'bus', emoji: '🚌', bucket: 'vehicle' },
  ];
  const [idx, setIdx] = useState(0);
  const cur = items[idx];

  const classify = (bucket: 'fruit' | 'vehicle') => {
    if (!cur) return;
    if (cur.bucket === bucket) {
      soundEngine.playSuccess();
      if (idx + 1 < items.length) setIdx(idx + 1);
      else onWin(items.length, items.length);
    } else {
      soundEngine.playEncourage();
    }
  };

  return (
    <div className="space-y-4 text-center">
      {cur && <div className="text-6xl py-2">{cur.emoji}</div>}
      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
        <button type="button" onClick={() => classify('fruit')} className="nono-btn-tactile min-h-[64px] rounded-2xl bg-[#FFE9EF] border-2 border-[#FF78B7] font-extrabold cursor-pointer">
          🍓 {language === 'ar' ? 'فواكه' : 'Fruits'}
        </button>
        <button type="button" onClick={() => classify('vehicle')} className="nono-btn-tactile min-h-[64px] rounded-2xl bg-[#E5F6FF] border-2 border-[#39BDF2] font-extrabold cursor-pointer">
          🚗 {language === 'ar' ? 'مركبات' : 'Vehicles'}
        </button>
      </div>
    </div>
  );
};

// 6. PICTURE JIGSAW TILE SWAP
const TileSwapJigsaw: React.FC<{ language: Language; onWin: (s: number, m: number) => void }> = ({ language, onWin }) => {
  const target = ['🌱', '🌿', '🌷', '🌻'];
  const [tiles, setTiles] = useState(['🌻', '🌱', '🌷', '🌿']);
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);

  const handleTile = (idx: number) => {
    soundEngine.playPop();
    if (pickedIdx === null) {
      setPickedIdx(idx);
      return;
    }
    const next = [...tiles];
    [next[pickedIdx], next[idx]] = [next[idx], next[pickedIdx]];
    setTiles(next);
    setPickedIdx(null);
    if (next.every((v, i) => v === target[i])) onWin(4, 4);
  };

  return (
    <div className="space-y-3 text-center">
      <p className="text-xs font-extrabold text-[#27345C]/75">
        {language === 'ar' ? 'بدّل المربعات لتنمو النبتة بالترتيب: 🌱 ← 🌿 ← 🌷 ← 🌻' : 'Swap tiles in order: 🌱 → 🌿 → 🌷 → 🌻'}
      </p>
      <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
        {tiles.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleTile(i)}
            className={`h-20 rounded-2xl border-2 text-4xl cursor-pointer ${
              pickedIdx === i ? 'border-[#8054D9] bg-[#F3ECFF]' : 'border-[#27345C]/15 bg-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
};

// 7. INTERACTIVE MAZE
const MazeMiniGame: React.FC<{ language: Language; onWin: (s: number, m: number) => void }> = ({ language, onWin }) => {
  const [pos, setPos] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const walls = new Set(['0,1', '1,1', '2,0']);

  const move = (dr: number, dc: number) => {
    const nr = pos.r + dr;
    const nc = pos.c + dc;
    if (nr < 0 || nr > 2 || nc < 0 || nc > 2 || walls.has(`${nr},${nc}`)) {
      soundEngine.playEncourage();
      return;
    }
    soundEngine.playPop();
    setPos({ r: nr, c: nc });
    if (nr === 2 && nc === 2) onWin(3, 3);
  };

  return (
    <div className="space-y-4 flex flex-col items-center">
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => {
            const isNono = pos.r === r && pos.c === c;
            const isWall = walls.has(`${r},${c}`);
            const isGoal = r === 2 && c === 2;
            return (
              <div
                key={`${r}-${c}`}
                className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl border-2 ${
                  isWall ? 'bg-[#27345C] text-white' : isGoal ? 'bg-[#FFD84D]/40 border-[#FFD84D]' : 'bg-[#FFF8E9]'
                }`}
              >
                {isNono ? '🦊' : isWall ? '🧱' : isGoal ? '🏆' : ''}
              </div>
            );
          }),
        )}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => move(-1, 0)} className="min-h-[44px] px-4 rounded-xl bg-white border font-extrabold cursor-pointer">↑</button>
        <button type="button" onClick={() => move(1, 0)} className="min-h-[44px] px-4 rounded-xl bg-white border font-extrabold cursor-pointer">↓</button>
        <button type="button" onClick={() => move(0, -1)} className="min-h-[44px] px-4 rounded-xl bg-white border font-extrabold cursor-pointer">{language === 'ar' ? '→' : '←'}</button>
        <button type="button" onClick={() => move(0, 1)} className="min-h-[44px] px-4 rounded-xl bg-white border font-extrabold cursor-pointer">{language === 'ar' ? '←' : '→'}</button>
      </div>
    </div>
  );
};

// 8. OBSERVATION SEARCH
const ObservationMiniGame: React.FC<{ language: Language; onWin: (s: number, m: number) => void }> = ({ language, onWin }) => {
  const icons = ['🌳', '⭐', '🌸', '⭐', '🦋', '☁️', '⭐', '🍎'];
  const [foundIdx, setFoundIdx] = useState<number[]>([]);

  return (
    <div className="space-y-3 text-center">
      <p className="text-sm font-extrabold text-[#27345C]">
        {language === 'ar' ? `اضغط على النجوم الثلاثة المخفية ⭐ (${foundIdx.length}/3)` : `Find & tap all 3 hidden stars ⭐ (${foundIdx.length}/3)`}
      </p>
      <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
        {icons.map((ic, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              if (ic === '⭐' && !foundIdx.includes(i)) {
                soundEngine.playSuccess();
                const next = [...foundIdx, i];
                setFoundIdx(next);
                if (next.length === 3) onWin(3, 3);
              } else if (ic !== '⭐') {
                soundEngine.playPop();
              }
            }}
            className={`h-16 rounded-2xl border-2 text-3xl cursor-pointer ${
              foundIdx.includes(i) ? 'bg-[#FFF3D1] border-[#FFD84D]' : 'bg-white border-[#27345C]/12'
            }`}
          >
            {ic}
          </button>
        ))}
      </div>
    </div>
  );
};

// 9. LOGICAL SEQUENCING
const SequenceMiniGame: React.FC<{ language: Language; onWin: (s: number, m: number) => void }> = ({ language, onWin }) => {
  const steps = [
    { id: '1', emoji: '🥚', label: { ar: 'بيضة', en: 'Egg' } },
    { id: '2', emoji: '🐣', label: { ar: 'فقس الكتكوت', en: 'Hatching' } },
    { id: '3', emoji: '🐥', label: { ar: 'كتكوت سعيد', en: 'Little Chick' } },
  ];
  const shuffled = useMemo(() => [steps[2], steps[0], steps[1]], []);
  const [picked, setPicked] = useState<string[]>([]);

  const pick = (id: string) => {
    if (picked.includes(id)) return;
    const expected = steps[picked.length].id;
    if (id === expected) {
      soundEngine.playSuccess();
      const next = [...picked, id];
      setPicked(next);
      if (next.length === steps.length) onWin(3, 3);
    } else {
      soundEngine.playEncourage();
    }
  };

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm font-extrabold text-[#27345C]">
        {language === 'ar' ? 'اضغط مراحل القصة بالترتيب الصحيح من البداية للنهاية:' : 'Tap the story stages from first to last:'}
      </p>
      <div className="flex justify-center gap-3">
        {shuffled.map((st) => {
          const done = picked.includes(st.id);
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => pick(st.id)}
              className={`min-h-[92px] px-5 py-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                done ? 'bg-[#E2F9EC] border-[#55D98B]' : 'bg-white border-[#27345C]/15'
              }`}
            >
              <span className="text-4xl">{st.emoji}</span>
              <span className="text-xs font-extrabold">{st.label[language]}</span>
              {done && <CheckCircle2 className="w-4 h-4 text-[#1E7E48]" />}
            </button>
          );
        })}
      </div>
      <div className="flex justify-center gap-2 text-xs text-[#8054D9] font-extrabold">
        <Sparkles className="w-4 h-4" />
        <span>{language === 'ar' ? 'تسلسل منطقي ذكي!' : 'Smart logical ordering!'}</span>
      </div>
    </div>
  );
};
