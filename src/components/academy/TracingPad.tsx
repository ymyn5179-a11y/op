import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eraser, Sparkles } from 'lucide-react';
import { Language } from '../../types/nonoland';
import { soundEngine } from '../../utils/soundEngine';

interface TracingPadProps {
  guideChar: string;
  language: Language;
  strokeColor?: string;
  hintText?: string;
  onCompleteTrace?: () => void;
}

export const TracingPad: React.FC<TracingPadProps> = ({
  guideChar,
  language,
  strokeColor = '#8054D9',
  hintText,
  onCompleteTrace,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokePoints, setStrokePoints] = useState(0);
  const [completed, setCompleted] = useState(false);

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw subtle baseline
    ctx.save();
    ctx.strokeStyle = 'rgba(39, 52, 92, 0.14)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, canvas.height * 0.72);
    ctx.lineTo(canvas.width - 24, canvas.height * 0.72);
    ctx.stroke();
    ctx.restore();

    // Faint tracing guide glyph
    ctx.save();
    ctx.fillStyle = 'rgba(128, 84, 217, 0.16)';
    ctx.font = `800 160px "Cairo", "Outfit", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(guideChar, canvas.width / 2, canvas.height / 2 + 4);
    ctx.restore();

    setStrokePoints(0);
    setCompleted(false);
  };

  useEffect(() => {
    resetCanvas();
  }, [guideChar]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setStrokePoints((p) => p + 1);
  };

  const handleUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (strokePoints > 12 && !completed) {
      setCompleted(true);
      soundEngine.playSuccess();
      onCompleteTrace?.();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-[#27345C]/75">
          {hintText || (language === 'ar' ? 'تتبع الشكل بإصبعك أو الماوس' : 'Trace the guide with your finger or mouse')}
        </span>
        <button
          type="button"
          onClick={() => {
            soundEngine.playPop();
            resetCanvas();
          }}
          className="px-3 py-1.5 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold flex items-center gap-1 cursor-pointer"
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>{language === 'ar' ? 'مسح وإعادة' : 'Clear'}</span>
        </button>
      </div>

      <div className="relative rounded-3xl overflow-hidden border-2 border-dashed border-[#8054D9]/40 bg-white">
        <canvas
          ref={canvasRef}
          width={420}
          height={230}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerLeave={handleUp}
          className="w-full h-[200px] sm:h-[220px] touch-none cursor-crosshair block"
        />
        {completed && (
          <div className="absolute bottom-3 end-3 px-3 py-1.5 rounded-xl bg-[#55D98B] text-[#27345C] text-xs font-extrabold flex items-center gap-1.5 shadow">
            <CheckCircle2 className="w-4 h-4" />
            <span>{language === 'ar' ? 'تتبع رائع!' : 'Great tracing!'}</span>
          </div>
        )}
      </div>

      {!completed && strokePoints > 0 && (
        <button
          type="button"
          onClick={() => {
            setCompleted(true);
            soundEngine.playSuccess();
            onCompleteTrace?.();
          }}
          className="w-full py-2 rounded-xl bg-[#8054D9]/12 text-[#8054D9] text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{language === 'ar' ? 'أكملت التتبع!' : 'I Finished Tracing!'}</span>
        </button>
      )}
    </div>
  );
};
