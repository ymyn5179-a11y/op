import React from 'react';
import { motion } from 'motion/react';

interface CinematicBook3DProps {
  scene: 1 | 2 | 3 | 4 | 5 | 6;
  reduced: boolean;
  onBookTap?: () => void;
}

const FLIPPING_PAGES = [
  { delay: 0.05, symbol: 'أ', accent: '#8054D9', subSymbol: '✨' },
  { delay: 0.24, symbol: 'A', accent: '#39BDF2', subSymbol: '★' },
  { delay: 0.43, symbol: '١', accent: '#FF78B7', subSymbol: '♪' },
  { delay: 0.62, symbol: '★', accent: '#FF9360', subSymbol: '✦' },
];

const EMITTED_SPARKS = [
  { x: -75, y: -90, delay: 0.1, glyph: '✨', color: '#FFD84D' },
  { x: -32, y: -120, delay: 0.25, glyph: 'أ', color: '#FF78B7' },
  { x: 18, y: -130, delay: 0.18, glyph: '★', color: '#39BDF2' },
  { x: 64, y: -96, delay: 0.35, glyph: 'A', color: '#55D98B' },
  { x: -50, y: -64, delay: 0.45, glyph: '١', color: '#FFD84D' },
  { x: 48, y: -74, delay: 0.52, glyph: '♪', color: '#FF9360' },
];

export const CinematicBook3D: React.FC<CinematicBook3DProps> = ({ scene, reduced, onBookTap }) => {
  const isAwake = scene >= 2;
  const isTurning = scene === 2 && !reduced;
  const isBursting = scene === 2 || scene === 3;

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ perspective: '1300px' }}
    >
      {/* Volumetric radial bloom beneath & behind the book */}
      <motion.div
        aria-hidden="true"
        animate={
          reduced
            ? { opacity: 0.72, scale: 1 }
            : isBursting
              ? { opacity: [0.65, 1, 0.85], scale: [0.95, 1.25, 1.1] }
              : isAwake
                ? { opacity: [0.55, 0.82, 0.55], scale: [1, 1.07, 1] }
                : { opacity: 0.28, scale: 0.88 }
        }
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -inset-6 sm:-inset-10 rounded-full bg-gradient-to-tr from-[#39BDF2]/45 via-[#FFD84D]/55 to-[#FF78B7]/40 blur-2xl"
      />

      {/* Upward Light Cone emerging from open center */}
      {isAwake && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0, scaleY: 0.4 }}
          animate={{
            opacity: scene === 3 ? 0.92 : scene === 2 ? 0.75 : 0.42,
            scaleY: scene === 3 ? 1.35 : 1,
          }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute bottom-1/2 w-56 sm:w-72 h-44 sm:h-56 origin-bottom"
          style={{
            background:
              'conic-gradient(from 150deg at 50% 100%, transparent 0deg, rgba(255,216,77,0.42) 22deg, rgba(57,189,242,0.34) 40deg, transparent 62deg)',
            filter: 'blur(8px)',
          }}
        />
      )}

      {/* Emitted Colorful Symbols & Stars Rising From Pages */}
      {isBursting && !reduced && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20" aria-hidden="true">
          {EMITTED_SPARKS.map((sp, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
              animate={{
                opacity: [0, 1, 1, 0],
                x: sp.x,
                y: sp.y,
                scale: [0.4, 1.25, 0.9],
                rotate: [0, i % 2 === 0 ? 18 : -18],
              }}
              transition={{
                duration: 1.45,
                delay: sp.delay,
                repeat: scene === 2 ? Infinity : 0,
                ease: 'easeOut',
              }}
              className="absolute text-lg sm:text-2xl font-extrabold drop-shadow-[0_0_10px_rgba(255,216,77,0.85)]"
              style={{ color: sp.color }}
            >
              {sp.glyph}
            </motion.span>
          ))}
        </div>
      )}

      {/* 3D Tilted Open Magical Book */}
      <motion.button
        type="button"
        onClick={onBookTap}
        aria-label="NonoLand 3D Magical Book"
        animate={
          reduced
            ? { rotateX: 20, scale: 1 }
            : scene === 1
              ? { rotateX: 26, rotateY: [-6, 4, 0], y: [0, -6, 0], scale: 0.92 }
              : scene === 2
                ? { rotateX: 18, rotateY: 0, y: -4, scale: 1.12 }
                : { rotateX: 22, rotateY: 0, y: [0, -6, 0], scale: 1 }
        }
        transition={{
          duration: scene === 2 ? 0.7 : 3.8,
          repeat: scene === 2 ? 0 : Infinity,
          ease: 'easeInOut',
        }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        className="relative w-64 sm:w-80 md:w-96 h-32 sm:h-40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84D] rounded-2xl"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Soft Shadow Floor Reflection */}
        <div
          aria-hidden="true"
          className="absolute -bottom-4 inset-x-6 h-7 rounded-full bg-[#090F2C]/65 blur-lg"
        />

        {/* Hardcover Spine & Outer Royal Purple Cover */}
        <div className="relative w-full h-full rounded-2xl bg-gradient-to-b from-[#693EC7] via-[#4C2A9B] to-[#311A69] border-2 border-[#FFD84D]/80 shadow-[0_18px_40px_rgba(0,0,0,0.55)] p-2 sm:p-2.5 flex gap-1">
          {/* Golden Cover Corner Embellishments */}
          <div className="pointer-events-none absolute top-1.5 start-1.5 w-3.5 h-3.5 border-t-2 border-s-2 border-[#FFD84D] rounded-tl" />
          <div className="pointer-events-none absolute top-1.5 end-1.5 w-3.5 h-3.5 border-t-2 border-e-2 border-[#FFD84D] rounded-tr" />
          <div className="pointer-events-none absolute bottom-1.5 start-1.5 w-3.5 h-3.5 border-b-2 border-s-2 border-[#FFD84D] rounded-bl" />
          <div className="pointer-events-none absolute bottom-1.5 end-1.5 w-3.5 h-3.5 border-b-2 border-e-2 border-[#FFD84D] rounded-br" />

          {/* Left Page Stack */}
          <div className="relative flex-1 rounded-s-xl bg-gradient-to-r from-[#FCEFC7] via-[#FFF9E8] to-[#F3E2AE] border border-[#D8B45A]/60 shadow-inner overflow-hidden flex flex-col justify-center p-3 text-[#27345C]/70">
            <div className="space-y-2">
              <div className="h-1.5 w-3/4 rounded-full bg-[#8054D9]/25" />
              <div className="h-1.5 w-full rounded-full bg-[#FF78B7]/25" />
              <div className="h-1.5 w-2/3 rounded-full bg-[#39BDF2]/30" />
              <div className="h-1.5 w-5/6 rounded-full bg-[#8054D9]/20" />
            </div>
            {isAwake && (
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent to-[#FFD84D]/25" />
            )}
          </div>

          {/* Glowing Center Seam */}
          <div
            className={`w-2 rounded-full transition-all duration-500 ${
              isAwake
                ? 'bg-gradient-to-b from-[#FFD84D] via-[#FFF6B3] to-[#39BDF2] shadow-[0_0_16px_#FFD84D]'
                : 'bg-[#271852]'
            }`}
          />

          {/* Right Page Stack */}
          <div className="relative flex-1 rounded-e-xl bg-gradient-to-l from-[#FCEFC7] via-[#FFF9E8] to-[#F3E2AE] border border-[#D8B45A]/60 shadow-inner overflow-hidden flex flex-col justify-center p-3 text-[#27345C]/70">
            <div className="space-y-2">
              <div className="h-1.5 w-5/6 rounded-full bg-[#39BDF2]/30 ms-auto" />
              <div className="h-1.5 w-2/3 rounded-full bg-[#FFD84D]/45 ms-auto" />
              <div className="h-1.5 w-full rounded-full bg-[#8054D9]/25 ms-auto" />
              <div className="h-1.5 w-3/4 rounded-full bg-[#55D98B]/35 ms-auto" />
            </div>
            {isAwake && (
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent to-[#39BDF2]/20" />
            )}
          </div>

          {/* 3D Turning Pages During Scene 2 ("The Book Comes Alive") */}
          {isTurning &&
            FLIPPING_PAGES.map((pg, idx) => (
              <motion.div
                key={idx}
                initial={{ rotateY: 0, opacity: 0.96 }}
                animate={{ rotateY: -180, opacity: [0.96, 1, 0.88] }}
                transition={{
                  duration: 0.62,
                  delay: pg.delay,
                  repeat: Infinity,
                  repeatDelay: 0.55,
                  ease: [0.42, 0, 0.2, 1],
                }}
                style={{
                  transformOrigin: 'left center',
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                }}
                className="pointer-events-none absolute top-2.5 bottom-2.5 right-2.5 w-[calc(50%-0.85rem)] rounded-e-xl bg-gradient-to-l from-[#FFFDF7] to-[#FFEFC2] border border-[#FFD84D] shadow-md flex items-center justify-center gap-2"
              >
                <span className="text-xl sm:text-2xl font-extrabold" style={{ color: pg.accent }}>
                  {pg.symbol}
                </span>
                <span className="text-sm font-bold text-[#FFD84D]">{pg.subSymbol}</span>
              </motion.div>
            ))}
        </div>
      </motion.button>
    </div>
  );
};
