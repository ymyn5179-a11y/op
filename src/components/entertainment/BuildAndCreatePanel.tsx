import React, { useState } from 'react';
import { Blocks, Save, Trash2 } from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { BuildBlockItem, BuildConstruction } from '../../types/nonoland';
import { soundEngine } from '../../utils/soundEngine';

const SHAPES: Array<{ id: BuildBlockItem['shape']; ar: string; en: string; emoji: string }> = [
  { id: 'square', ar: 'مكعب', en: 'Block', emoji: '🧱' },
  { id: 'triangle', ar: 'سقف', en: 'Roof', emoji: '🔺' },
  { id: 'arch', ar: 'قوس', en: 'Arch', emoji: '🏛️' },
  { id: 'pillar', ar: 'عمود', en: 'Pillar', emoji: '🗼' },
  { id: 'window', ar: 'نافذة', en: 'Window', emoji: '🪟' },
  { id: 'bridge', ar: 'جسر', en: 'Bridge', emoji: '🌉' },
  { id: 'tree', ar: 'شجرة', en: 'Tree', emoji: '🌳' },
];

const BLOCK_COLORS = ['#39BDF2', '#FF78B7', '#FFD84D', '#55D98B', '#8054D9', '#FF9360'];

export const BuildAndCreatePanel: React.FC = () => {
  const { activeChild, language, saveEntertainmentCreation } = useNonoLand();
  const [templateId, setTemplateId] = useState<BuildConstruction['templateId']>('house');
  const [activeShape, setActiveShape] = useState<BuildBlockItem['shape']>('square');
  const [activeColor, setActiveColor] = useState('#39BDF2');
  const [blocks, setBlocks] = useState<BuildBlockItem[]>([
    { id: 'init-1', shape: 'square', color: '#FFD84D', x: 3, y: 4 },
    { id: 'init-2', shape: 'square', color: '#FFD84D', x: 4, y: 4 },
    { id: 'init-3', shape: 'triangle', color: '#FF78B7', x: 3, y: 3 },
  ]);
  const [title, setTitle] = useState('');
  const [notice, setNotice] = useState('');

  if (!activeChild) return null;

  const handleCellClick = (x: number, y: number) => {
    soundEngine.playPop();
    const existingIdx = blocks.findIndex((b) => b.x === x && b.y === y);
    if (existingIdx >= 0) {
      setBlocks((prev) => prev.filter((_, idx) => idx !== existingIdx));
    } else {
      setBlocks((prev) => [
        ...prev,
        { id: `blk-${Date.now()}-${x}-${y}`, shape: activeShape, color: activeColor, x, y },
      ]);
    }
  };

  const loadPreset = (preset: BuildConstruction['templateId']) => {
    soundEngine.playPop();
    setTemplateId(preset);
    if (preset === 'house') {
      setBlocks([
        { id: 'h1', shape: 'square', color: '#FFD84D', x: 3, y: 4 },
        { id: 'h2', shape: 'window', color: '#39BDF2', x: 4, y: 4 },
        { id: 'h3', shape: 'triangle', color: '#FF78B7', x: 3, y: 3 },
        { id: 'h4', shape: 'triangle', color: '#FF78B7', x: 4, y: 3 },
        { id: 'h5', shape: 'tree', color: '#55D98B', x: 6, y: 4 },
      ]);
    } else if (preset === 'bridge') {
      setBlocks([
        { id: 'b1', shape: 'pillar', color: '#8054D9', x: 2, y: 4 },
        { id: 'b2', shape: 'bridge', color: '#39BDF2', x: 3, y: 4 },
        { id: 'b3', shape: 'bridge', color: '#39BDF2', x: 4, y: 4 },
        { id: 'b4', shape: 'pillar', color: '#8054D9', x: 5, y: 4 },
      ]);
    } else if (preset === 'tower') {
      setBlocks([
        { id: 't1', shape: 'square', color: '#FF9360', x: 4, y: 4 },
        { id: 't2', shape: 'square', color: '#FFD84D', x: 4, y: 3 },
        { id: 't3', shape: 'window', color: '#39BDF2', x: 4, y: 2 },
        { id: 't4', shape: 'triangle', color: '#8054D9', x: 4, y: 1 },
      ]);
    } else {
      setBlocks([]);
    }
  };

  const handleSaveBuild = async () => {
    if (blocks.length === 0) return;
    const cleanTitle = title.trim() || (language === 'ar' ? `بنائي #${(activeChild.buildConstructions?.length || 0) + 1}` : `My Build #${(activeChild.buildConstructions?.length || 0) + 1}`);
    const res = await saveEntertainmentCreation({
      kind: 'build',
      payload: { title: cleanTitle, templateId, blocks },
    });
    setTitle('');
    setNotice(
      language === 'ar'
        ? `تم حفظ مجسّمك الهندسي (+${res.starsAdded} نجوم) 🏗️✨`
        : `Construction saved privately (+${res.starsAdded} stars) 🏗️✨`,
    );
  };

  return (
    <div className="nono-card p-5 bg-white space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
            <Blocks className="w-6 h-6 text-[#39BDF2]" />
            <span>{language === 'ar' ? 'مهندس نونو: ابنِ وأبدع' : 'Build & Create Architecture'}</span>
          </h2>
          <p className="text-xs font-bold text-[#27345C]/70">
            {language === 'ar' ? 'اضغط على الشبكة لوضع القطع الهندسية وبناء بيت أو جسر أو برج!' : 'Tap grid cells to place shapes and build houses, bridges, or towers!'}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'house' as const, ar: 'بيت 🏠', en: 'House 🏠' },
            { id: 'bridge' as const, ar: 'جسر 🌉', en: 'Bridge 🌉' },
            { id: 'tower' as const, ar: 'برج 🗼', en: 'Tower 🗼' },
            { id: 'free' as const, ar: 'حر ✨', en: 'Free ✨' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => loadPreset(t.id)}
              className={`min-h-[38px] px-3 rounded-xl text-xs font-extrabold cursor-pointer ${
                templateId === t.id ? 'bg-[#39BDF2] text-white' : 'bg-slate-100 text-[#27345C]'
              }`}
            >
              {t[language]}
            </button>
          ))}
        </div>
      </div>

      {/* Shape + Color Palette */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#F8FAFC]">
        <div className="flex flex-wrap gap-1.5">
          {SHAPES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                soundEngine.playPop();
                setActiveShape(s.id);
              }}
              className={`min-h-[40px] px-3 rounded-xl border-2 text-xs font-extrabold flex items-center gap-1 cursor-pointer ${
                activeShape === s.id ? 'bg-[#8054D9] text-white border-[#8054D9]' : 'bg-white border-[#27345C]/12 text-[#27345C]'
              }`}
            >
              <span>{s.emoji}</span>
              <span>{s[language]}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {BLOCK_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => setActiveColor(hex)}
              style={{ backgroundColor: hex }}
              className={`w-7 h-7 rounded-full border-2 cursor-pointer ${
                activeColor === hex ? 'border-[#27345C] scale-110' : 'border-white'
              }`}
              aria-label={hex}
            />
          ))}
        </div>
      </div>

      {/* 8x5 Snap Grid */}
      <div className="grid grid-cols-8 gap-1.5 p-4 rounded-3xl bg-gradient-to-b from-[#E0F2FE] to-[#DCFCE7] border-2 border-[#39BDF2]/30">
        {Array.from({ length: 5 }).map((_, y) =>
          Array.from({ length: 8 }).map((__, x) => {
            const placed = blocks.find((b) => b.x === x && b.y === y);
            const shapeMeta = placed ? SHAPES.find((s) => s.id === placed.shape) : null;
            return (
              <button
                key={`${x}-${y}`}
                type="button"
                onClick={() => handleCellClick(x, y)}
                style={placed ? { backgroundColor: placed.color } : undefined}
                className={`h-12 sm:h-14 rounded-xl border flex items-center justify-center text-xl cursor-pointer transition-all ${
                  placed ? 'border-[#27345C]/25 shadow-sm' : 'bg-white/55 hover:bg-white border-white/70'
                }`}
              >
                {shapeMeta ? shapeMeta.emoji : ''}
              </button>
            );
          }),
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={language === 'ar' ? 'سمّ بناءك الهندسي...' : 'Name your construction...'}
          className="flex-1 min-w-[180px] min-h-[42px] px-3 rounded-xl border border-[#27345C]/20 text-xs font-bold"
        />
        <button
          type="button"
          onClick={() => setBlocks([])}
          className="min-h-[42px] px-4 rounded-xl bg-slate-100 text-xs font-extrabold text-[#27345C] flex items-center gap-1 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>{language === 'ar' ? 'تفريغ' : 'Clear'}</span>
        </button>
        <button
          type="button"
          disabled={blocks.length === 0}
          onClick={() => void handleSaveBuild()}
          className="min-h-[42px] px-5 rounded-xl bg-[#55D98B] text-[#27345C] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{language === 'ar' ? 'حفظ البناء' : 'Save Build'}</span>
        </button>
      </div>
      {notice && <p className="text-xs font-extrabold text-[#16A34A]">{notice}</p>}

      {(activeChild.buildConstructions?.length || 0) > 0 && (
        <div className="pt-2 border-t border-[#27345C]/10 flex flex-wrap gap-2">
          {activeChild.buildConstructions!.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setBlocks(b.blocks);
                setTemplateId(b.templateId);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#FFF8E9] border border-[#27345C]/12 text-xs font-extrabold text-[#27345C] cursor-pointer"
            >
              🏗️ {b.title} ({b.blocks.length})
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
