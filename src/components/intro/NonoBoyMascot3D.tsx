import React from 'react';
import { motion } from 'motion/react';

interface NonoBoyMascot3DProps {
  mood?: 'entering' | 'waving' | 'celebrating';
  reduced?: boolean;
  onTap?: () => void;
  className?: string;
}

/**
 * Animated character rig faithfully matching the official NonoLand Boy Mascot
 * (brown tousled hair, large warm eyes with natural blink, blue hoodie with gold chest star,
 * orange backpack straps, playful wave & joyful greeting) without any animals.
 */
export const NonoBoyMascot3D: React.FC<NonoBoyMascot3DProps> = ({
  mood = 'waving',
  reduced = false,
  onTap,
  className = '',
}) => {
  return (
    <motion.button
      type="button"
      onClick={onTap}
      aria-label="Nono Mascot"
      initial={reduced ? false : { y: 46, scale: 0.72, opacity: 0 }}
      animate={
        reduced
          ? { y: 0, scale: 1, opacity: 1 }
          : mood === 'entering'
            ? { y: [46, -16, 0], scale: [0.72, 1.05, 1], opacity: 1 }
            : { y: [0, -7, 0], scale: 1, opacity: 1 }
      }
      transition={
        mood === 'entering'
          ? { duration: 0.9, ease: [0.16, 1, 0.3, 1] }
          : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }
      }
      whileHover={reduced ? undefined : { scale: 1.04 }}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      className={`relative cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84D] rounded-3xl ${className}`}
    >
      {/* Warm Character Rim Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-3 rounded-full bg-gradient-to-tr from-[#39BDF2]/40 via-[#FFD84D]/35 to-[#FF78B7]/35 blur-xl"
      />

      <svg
        viewBox="0 0 240 250"
        className="relative w-44 sm:w-56 md:w-64 h-auto drop-shadow-[0_18px_32px_rgba(10,16,52,0.5)]"
      >
        <defs>
          <linearGradient id="nonoHoodie" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D9BF0" />
            <stop offset="100%" stopColor="#0D5FD6" />
          </linearGradient>
          <radialGradient id="nonoSkin" cx="45%" cy="38%" r="60%">
            <stop offset="0%" stopColor="#FFE1C8" />
            <stop offset="100%" stopColor="#F8B991" />
          </radialGradient>
          <linearGradient id="nonoHair" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#A25B34" />
            <stop offset="60%" stopColor="#7A3E1D" />
            <stop offset="100%" stopColor="#4F260F" />
          </linearGradient>
          <linearGradient id="nonoStarGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF18A" />
            <stop offset="100%" stopColor="#FFA800" />
          </linearGradient>
        </defs>

        {/* Ground Soft Contact Shadow */}
        <ellipse cx="120" cy="236" rx="54" ry="10" fill="rgba(8,14,44,0.38)" />

        {/* Waving Right Arm & Open Welcoming Hand (with Shoulder Follow-Through) */}
        <motion.g
          animate={reduced ? undefined : { rotate: [-6, 12, -4, 10, -6] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '78px 168px' }}
        >
          <path
            d="M80 165 C55 154, 42 135, 38 118"
            fill="none"
            stroke="url(#nonoHoodie)"
            strokeWidth="22"
            strokeLinecap="round"
          />
          {/* Hoodie Cuff */}
          <ellipse cx="38" cy="119" rx="13" ry="7" transform="rotate(-18 38 119)" fill="#0F6BE0" />
          {/* Friendly Waving Hand */}
          <circle cx="34" cy="107" r="11" fill="url(#nonoSkin)" />
          <path d="M25 103 L21 94 M30 98 L29 88 M36 98 L38 89 M42 103 L47 95" stroke="#F6B289" strokeWidth="4.2" strokeLinecap="round" />
        </motion.g>

        {/* Left Arm Resting Cheerfully */}
        <motion.g
          animate={reduced ? undefined : { rotate: [2, -5, 2] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '162px 168px' }}
        >
          <path
            d="M160 166 C178 176, 186 194, 182 208"
            fill="none"
            stroke="url(#nonoHoodie)"
            strokeWidth="21"
            strokeLinecap="round"
          />
          <circle cx="182" cy="212" r="10" fill="url(#nonoSkin)" />
        </motion.g>

        {/* Blue Hoodie Torso + Orange Backpack Straps */}
        <path
          d="M74 156 Q120 140 166 156 L174 224 Q120 236 66 224 Z"
          fill="url(#nonoHoodie)"
          stroke="#0A3F9E"
          strokeWidth="2.5"
        />
        {/* Backpack Straps */}
        <path d="M84 152 L78 224" stroke="#FF9B26" strokeWidth="10" strokeLinecap="round" />
        <path d="M156 152 L162 224" stroke="#FF9B26" strokeWidth="10" strokeLinecap="round" />

        {/* Hoodie Collar */}
        <motion.path
          d="M84 148 Q120 168 156 148 Q144 134 120 138 Q96 134 84 148 Z"
          fill="#228BFA"
          stroke="#0A4AB8"
          strokeWidth="2"
          animate={reduced ? undefined : { scaleY: [1, 1.04, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
          style={{ transformOrigin: '120px 150px' }}
        />

        {/* Golden Chest Star Emblem */}
        <motion.path
          d="M120 173 L125.5 184 L137.5 185.8 L128.8 194.2 L130.8 206 L120 200.4 L109.2 206 L111.2 194.2 L102.5 185.8 L114.5 184 Z"
          fill="url(#nonoStarGold)"
          stroke="#D67B00"
          strokeWidth="2"
          strokeLinejoin="round"
          animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
          transition={{ duration: 2.2, repeat: Infinity }}
          style={{ transformOrigin: '120px 191px' }}
        />

        {/* Ears */}
        <circle cx="67" cy="96" r="10.5" fill="url(#nonoSkin)" />
        <circle cx="67" cy="96" r="5.2" fill="#EEA379" />
        <circle cx="173" cy="96" r="10.5" fill="url(#nonoSkin)" />
        <circle cx="173" cy="96" r="5.2" fill="#EEA379" />

        {/* Face Base */}
        <ellipse cx="120" cy="94" rx="51" ry="49" fill="url(#nonoSkin)" />

        {/* Rosy Cheeks */}
        <ellipse cx="86" cy="108" rx="9" ry="5.5" fill="#FF7B9C" opacity="0.48" />
        <ellipse cx="154" cy="108" rx="9" ry="5.5" fill="#FF7B9C" opacity="0.48" />

        {/* Expressive Animated Eyes with Natural Blink */}
        <motion.g
          animate={
            reduced
              ? undefined
              : { scaleY: [1, 1, 1, 0.08, 1, 1, 1] }
          }
          transition={{
            duration: 3.6,
            times: [0, 0.45, 0.47, 0.5, 0.53, 0.9, 1],
            repeat: Infinity,
          }}
          style={{ transformOrigin: '120px 92px' }}
        >
          {/* Left Eye */}
          <ellipse cx="97" cy="91" rx="12" ry="13.5" fill="#FFFFFF" />
          <circle cx="98.5" cy="92" r="8.8" fill="#4B2810" />
          <circle cx="98.5" cy="92" r="5.2" fill="#1F1209" />
          <circle cx="101.5" cy="87.5" r="3.4" fill="#FFFFFF" />
          <circle cx="95" cy="96" r="1.4" fill="#FFFFFF" />

          {/* Right Eye */}
          <ellipse cx="143" cy="91" rx="12" ry="13.5" fill="#FFFFFF" />
          <circle cx="141.5" cy="92" r="8.8" fill="#4B2810" />
          <circle cx="141.5" cy="92" r="5.2" fill="#1F1209" />
          <circle cx="144.5" cy="87.5" r="3.4" fill="#FFFFFF" />
          <circle cx="138" cy="96" r="1.4" fill="#FFFFFF" />
        </motion.g>

        {/* Expressive Eyebrows */}
        <path d="M84 74 Q97 67 109 73" fill="none" stroke="#5E2D12" strokeWidth="4.2" strokeLinecap="round" />
        <path d="M131 73 Q143 67 156 74" fill="none" stroke="#5E2D12" strokeWidth="4.2" strokeLinecap="round" />

        {/* Cute Button Nose & Joyful Open Smile */}
        <ellipse cx="120" cy="103" rx="4.2" ry="3" fill="#E6966C" />
        <path
          d="M104 114 Q120 131 136 114 Q120 119 104 114 Z"
          fill="#C9364C"
          stroke="#6A1B27"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M110 115 Q120 119 130 115" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />

        {/* Tousled Chestnut Hair with Natural Bounce */}
        <motion.g
          animate={reduced ? undefined : { rotate: [-1.2, 1.4, -1.2], y: [0, -1.5, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '120px 52px' }}
        >
          <path
            d="M66 86 C60 55, 82 32, 108 32 C104 18, 128 14, 140 28 C158 24, 178 44, 174 86 C166 64, 152 54, 138 56 C128 66, 110 64, 100 54 C86 58, 74 68, 66 86 Z"
            fill="url(#nonoHair)"
          />
          {/* Front Swept Hair Curls */}
          <path d="M98 48 C110 34, 134 34, 146 50 C134 54, 118 54, 98 48 Z" fill="#9E5730" />
          <path d="M74 68 C78 48, 96 42, 108 50" fill="none" stroke="#B66B41" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M126 36 C140 30, 156 38, 162 54" fill="none" stroke="#B66B41" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
      </svg>
    </motion.button>
  );
};
