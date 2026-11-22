import React, { useEffect, useRef, useState } from 'react';
import { Brush, CheckCircle2, Eraser, Palette, Save, Sparkles, Shapes, Sticker, Trash2 } from 'lucide-react';
import { CharacterActor } from '../components/CharacterCast';
import { NonoLandLogo } from '../components/NonoLandLogo';
import { useNonoLand } from '../context/NonoLandContext';
import { CreativeProjectKind, OfficialCharacterId } from '../types/nonoland';
import { soundEngine } from '../utils/soundEngine';

const BRUSH_COLORS = ['#27345C', '#8054D9', '#FF78B7', '#39BDF2', '#55D98B', '#FF9360', '#FACC15', '#EF4444'];

const MODES: Array<{ id: CreativeProjectKind; ar: string; en: string; emoji: string }> = [
  { id: 'drawing', ar: 'رسم حر', en: 'Free Draw', emoji: '🖌️' },
  { id: 'coloring', ar: 'صفحات تلوين', en: 'Coloring', emoji: '🖍️' },
  { id: 'shapes', ar: 'تركيب الأشكال', en: 'Shapes', emoji: '🔷' },
  { id: 'stickers', ar: 'لوحة الملصقات', en: 'Stickers', emoji: '✨' },
  { id: 'character-decor', ar: 'تزيين شخصية', en: 'Decorate Hero', emoji: '🦊' },
  { id: 'picture-story', ar: 'قصة مصورة', en: 'Picture Story', emoji: '📖' },
];

export const CreativeStudioScreen: React.FC = () => {
  const { activeChild, language, saveCreativeProject, deleteCreativeProject } = useNonoLand();
  const [mode, setMode] = useState<CreativeProjectKind>('drawing');
  const [title, setTitle] = useState('');
  const [brushColor, setBrushColor] = useState('#8054D9');
  const [brushSize, setBrushSize] = useState(7);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');

  // Free draw canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  // Coloring SVG regions state
  const [coloringFills, setColoringFills] = useState({ sun: '#FFD84D', roof: '#FF78B7', wall: '#FFF3D1', tree: '#55D98B' });
  // Shapes state
  const [placedShapes, setPlacedShapes] = useState<Array<{ id: string; shape: string; color: string; x: number; y: number }>>([]);
  // Stickers state
  const [placedStickers, setPlacedStickers] = useState<Array<{ id: string; emoji: string; x: number; y: number }>>([]);
  // Character decor state
  const [decorChar, setDecorChar] = useState<OfficialCharacterId>('nono');
  const [decorBg, setDecorBg] = useState('#F3ECFF');
  // Picture story caption
  const [storyCaption, setStoryCaption] = useState('');

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cvs.width, cvs.height);
    }
  }, [mode]);

  if (!activeChild) return null;

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cvs = canvasRef.current!;
    const rect = cvs.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * cvs.width,
      y: ((e.clientY - rect.top) / rect.height) * cvs.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cvs = canvasRef.current;
    const ctx = cvs?.getContext('2d');
    if (!cvs || !ctx) return;
    drawingRef.current = true;
    const pt = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
  };

  const clearCanvas = () => {
    const cvs = canvasRef.current;
    const ctx = cvs?.getContext('2d');
    if (!cvs || !ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    soundEngine.playPop();
  };

  const handleSaveProject = async () => {
    setSaving(true);
    setSavedNotice('');
    try {
      const cleanTitle = title.trim() || `${MODES.find((m) => m.id === mode)?.[language]} #${(activeChild.creativeProjects?.length || 0) + 1}`;
      let dataUrl: string | undefined;
      let sceneJson: Record<string, unknown> | undefined;

      if (mode === 'drawing' && canvasRef.current) {
        dataUrl = canvasRef.current.toDataURL('image/png');
      } else if (mode === 'coloring') {
        sceneJson = { coloringFills };
      } else if (mode === 'shapes') {
        sceneJson = { placedShapes };
      } else if (mode === 'stickers') {
        sceneJson = { placedStickers };
      } else if (mode === 'character-decor') {
        sceneJson = { decorChar, decorBg };
      } else if (mode === 'picture-story') {
        sceneJson = { decorChar, storyCaption, placedStickers };
      }

      await saveCreativeProject({ kind: mode, title: cleanTitle, dataUrl, sceneJson });
      soundEngine.playCelebration();
      setTitle('');
      setSavedNotice(
        language === 'ar'
          ? 'تم حفظ إبداعك الخاص بأمان في معرضك! ✨'
          : 'Saved privately to your gallery! ✨',
      );
    } finally {
      setSaving(false);
    }
  };

  const projects = activeChild.creativeProjects || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <NonoLandLogo variant="compact" size="md" showWordmark={false} language={language} />
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#27345C] flex items-center gap-2">
              <Palette className="w-7 h-7 text-[#FF78B7]" />
              <span>{language === 'ar' ? `استوديو الإبداع الخاص بـ ${activeChild.displayName}` : `${activeChild.displayName}'s Creative Studio`}</span>
            </h1>
            <p className="text-sm text-[#27345C]/75">
              {language === 'ar'
                ? '٦ أنشطة فنية وإبداعية ممتعة: ارسم، لوّن، ركّب أشكالاً، وألّف مشاهدك الخاصة بأمان تام!'
                : '6 playful creative modes: Free Draw, Coloring, Tangram Shapes, Stickers, Hero Decor & Picture Stories!'}
            </p>
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              soundEngine.playPop();
              setMode(m.id);
              setSavedNotice('');
            }}
            className={`min-h-[44px] px-4 py-2 rounded-2xl border-2 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer ${
              mode === m.id ? 'bg-[#FF78B7] text-white border-[#FF78B7]' : 'bg-white border-[#27345C]/12'
            }`}
          >
            <span>{m.emoji}</span>
            <span>{language === 'ar' ? m.ar : m.en}</span>
          </button>
        ))}
      </div>

      {savedNotice && (
        <div className="rounded-2xl bg-[#E2F9EC] border-2 border-[#55D98B] px-4 py-3 text-sm font-extrabold text-[#1E7E48] flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Workspace + Palette Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 nono-card rounded-[2rem] p-5 sm:p-6 space-y-4">
          {/* Color Swatches */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {BRUSH_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setBrushColor(col)}
                  aria-label={col}
                  className={`w-9 h-9 rounded-full border-4 cursor-pointer ${
                    brushColor === col ? 'border-[#27345C] scale-110' : 'border-white shadow'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>

            {mode === 'drawing' && (
              <div className="flex items-center gap-2">
                <Brush className="w-4 h-4 text-[#8054D9]" />
                {[4, 8, 14].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setBrushSize(sz)}
                    className={`min-h-[36px] px-2.5 rounded-lg text-xs font-extrabold border cursor-pointer ${
                      brushSize === sz ? 'bg-[#8054D9] text-white' : 'bg-white'
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="min-h-[36px] px-3 rounded-lg bg-[#FFF8E9] border text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'مسح' : 'Clear'}</span>
                </button>
              </div>
            )}
          </div>

          {/* 1. FREE DRAWING */}
          {mode === 'drawing' && (
            <canvas
              ref={canvasRef}
              width={640}
              height={340}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="w-full h-64 sm:h-80 rounded-2xl border-2 border-[#27345C]/15 bg-white touch-none cursor-crosshair shadow-inner"
            />
          )}

          {/* 2. SVG COLORING PAGE */}
          {mode === 'coloring' && (
            <div className="rounded-2xl bg-[#F0F9FF] p-4 border-2 border-[#27345C]/12 flex flex-col items-center">
              <p className="text-xs font-bold text-[#27345C]/70 mb-2">
                {language === 'ar' ? 'اختر لوناً ثم اضغط على أي جزء لتلوينه!' : 'Pick a color above, then tap any house part!'}
              </p>
              <svg viewBox="0 0 360 220" className="w-full max-w-md h-56 cursor-pointer">
                <circle cx="300" cy="48" r="26" fill={coloringFills.sun} stroke="#27345C" strokeWidth="3" onClick={() => setColoringFills((f) => ({ ...f, sun: brushColor }))} />
                <polygon points="90,100 180,35 270,100" fill={coloringFills.roof} stroke="#27345C" strokeWidth="4" onClick={() => setColoringFills((f) => ({ ...f, roof: brushColor }))} />
                <rect x="105" y="100" width="150" height="95" rx="8" fill={coloringFills.wall} stroke="#27345C" strokeWidth="4" onClick={() => setColoringFills((f) => ({ ...f, wall: brushColor }))} />
                <rect x="160" y="135" width="40" height="60" rx="6" fill="#8B5A2B" />
                <circle cx="52" cy="130" r="32" fill={coloringFills.tree} stroke="#27345C" strokeWidth="4" onClick={() => setColoringFills((f) => ({ ...f, tree: brushColor }))} />
                <rect x="46" y="160" width="12" height="35" fill="#8B5A2B" />
              </svg>
            </div>
          )}

          {/* 3. SHAPES CONSTRUCTION */}
          {mode === 'shapes' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {['●', '▲', '■', '★'].map((sh) => (
                  <button
                    key={sh}
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      setPlacedShapes((prev) => [
                        ...prev,
                        {
                          id: `sh-${Date.now()}-${prev.length}`,
                          shape: sh,
                          color: brushColor,
                          x: 16 + ((prev.length * 19) % 70),
                          y: 24 + ((prev.length * 23) % 55),
                        },
                      ]);
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-[#FFF8E9] border-2 border-[#8054D9]/25 text-xl font-extrabold cursor-pointer flex items-center gap-1"
                  >
                    <Shapes className="w-4 h-4 text-[#8054D9]" />
                    <span style={{ color: brushColor }}>{sh}</span>
                  </button>
                ))}
              </div>
              <div className="relative h-60 rounded-2xl bg-white border-2 border-dashed border-[#8054D9]/30 overflow-hidden">
                {placedShapes.map((p) => (
                  <span key={p.id} style={{ left: `${p.x}%`, top: `${p.y}%`, color: p.color }} className="absolute text-5xl -translate-x-1/2 -translate-y-1/2 select-none">
                    {p.shape}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 4. STICKERS SCENE */}
          {mode === 'stickers' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {['🌈', '🦋', '🌸', '🚀', '🌟', '🎈', '🦊', '🎂'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      setPlacedStickers((prev) => [
                        ...prev,
                        {
                          id: `st-${Date.now()}-${prev.length}`,
                          emoji: st,
                          x: 15 + ((prev.length * 17) % 72),
                          y: 22 + ((prev.length * 21) % 60),
                        },
                      ]);
                    }}
                    className="min-h-[44px] px-3 rounded-xl bg-white border text-2xl cursor-pointer flex items-center gap-1"
                  >
                    <Sticker className="w-3.5 h-3.5 text-[#FF78B7]" />
                    <span>{st}</span>
                  </button>
                ))}
              </div>
              <div className="relative h-60 rounded-2xl bg-gradient-to-b from-[#E5F6FF] to-[#E2F9EC] border-2 border-white overflow-hidden">
                {placedStickers.map((p) => (
                  <span key={p.id} style={{ left: `${p.x}%`, top: `${p.y}%` }} className="absolute text-5xl -translate-x-1/2 -translate-y-1/2 select-none">
                    {p.emoji}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 5. CHARACTER DECORATION & 6. PICTURE STORY */}
          {(mode === 'character-decor' || mode === 'picture-story') && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(['nono', 'lolo', 'leo', 'bobo', 'ellie', 'titi'] as OfficialCharacterId[]).map((cid) => (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => setDecorChar(cid)}
                    className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-extrabold uppercase cursor-pointer ${
                      decorChar === cid ? 'bg-[#8054D9] text-white' : 'bg-white'
                    }`}
                  >
                    {cid}
                  </button>
                ))}
                {['#F3ECFF', '#FFF3D1', '#E5F6FF', '#FFEAF3'].map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setDecorBg(bg)}
                    aria-label={bg}
                    className="w-10 h-10 rounded-xl border-2 border-white shadow cursor-pointer"
                    style={{ backgroundColor: bg }}
                  />
                ))}
              </div>

              <div className="rounded-3xl p-6 flex flex-col items-center gap-3 border-2 border-white shadow-inner" style={{ backgroundColor: decorBg }}>
                <CharacterActor characterId={decorChar} mood="celebrating" size="md" language={language} />
                {mode === 'picture-story' && (
                  <input
                    type="text"
                    maxLength={120}
                    value={storyCaption}
                    onChange={(e) => setStoryCaption(e.target.value)}
                    placeholder={language === 'ar' ? 'اكتب جملة قصيرة تصف هذا المشهد...' : 'Write a joyful caption for your picture story...'}
                    className="w-full max-w-md h-11 px-4 rounded-xl bg-white border border-[#27345C]/15 font-bold text-sm text-center"
                  />
                )}
              </div>
            </div>
          )}

          {/* Save Controls */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#27345C]/10">
            <input
              type="text"
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={language === 'ar' ? 'اسم اللوحة أو المشروع...' : 'Name your artwork...'}
              className="flex-1 min-w-[180px] h-12 px-4 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 font-bold text-sm"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveProject()}
              className="nono-btn-tactile min-h-[48px] px-6 rounded-xl bg-[#8054D9] text-white font-extrabold text-sm flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'احفظ في معرضي!' : 'Save Artwork!')}</span>
            </button>
          </div>
        </div>

        {/* Private Child Creative Gallery */}
        <div className="lg:col-span-4 nono-card rounded-[2rem] p-5 space-y-3">
          <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FFD84D]" />
            <span>{language === 'ar' ? `معرض إبداعات ${activeChild.displayName}` : 'My Private Gallery'}</span>
          </h2>
          {projects.length === 0 && activeChild.savedDrawings.length === 0 ? (
            <p className="text-xs text-[#27345C]/65 bg-[#FFF8E9] rounded-2xl p-4">
              {language === 'ar'
                ? 'كل لوحة تحفظها هنا تبقى خاصة بك وبأسرتك بأمان وتظهر أيضاً في غرفتك!'
                : 'Artworks you save here stay private to your family and can appear inside My Room!'}
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pe-1">
              {projects.map((pr) => (
                <div key={pr.id} className="rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 p-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {pr.dataUrl ? (
                      <img src={pr.dataUrl} alt={pr.title} className="w-12 h-12 rounded-xl object-cover border" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-xl border">
                        {MODES.find((m) => m.id === pr.kind)?.emoji || '🎨'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold truncate text-[#27345C]">{pr.title}</p>
                      <p className="text-[10px] font-bold text-[#8054D9]">{pr.kind}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteCreativeProject(pr.id)}
                    aria-label="Delete creative project"
                    className="p-2 text-[#FF4D6D] hover:bg-white rounded-xl cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
