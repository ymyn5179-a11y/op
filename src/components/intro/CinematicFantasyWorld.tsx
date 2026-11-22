import React from 'react';
import { motion } from 'motion/react';

interface CinematicFantasyWorldProps {
  scene: 1 | 2 | 3 | 4 | 5 | 6;
  reduced: boolean;
  parallax: { x: number; y: number };
}

/**
 * Multi-plane 3D parallax fantasy world featuring:
 * - Twilight-to-magical-aurora sky & luminous rainbow arc
 * - Floating islands with glowing colorful trees & animated waterfalls
 * - Grand illuminated castle with gently shimmering golden windows
 * - Drifting layered clouds & Scene 3 concentric expanding energy portal
 */
export const CinematicFantasyWorld: React.FC<CinematicFantasyWorldProps> = ({
  scene,
  reduced,
  parallax,
}) => {
  const showWorld = scene >= 3;
  const isPortalActive = scene === 3;
  const brighterRainbow = scene >= 5;

  // Directed camera dolly / pan choreography across scenes
  const cameraTransform =
    scene === 1
      ? { scale: 0.92, x: 0, y: 0 }
      : scene === 2
        ? { scale: 1.06, x: 0, y: 12 }
        : scene === 3
          ? { scale: 1.18, x: 0, y: -6 }
          : scene === 4
            ? { scale: 1.09, x: -16, y: -4 }
            : { scale: 1, x: parallax.x * 12, y: parallax.y * 8 };

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ perspective: '1200px' }}
      aria-hidden="true"
    >
      {/* Base Celestial Background (always rich, never empty black) */}
      <div
        className="absolute inset-0 transition-colors duration-1000"
        style={{
          background:
            scene <= 2
              ? 'radial-gradient(circle at 50% 42%, #2B1F68 0%, #141944 52%, #090D28 100%)'
              : 'linear-gradient(155deg, #0D1742 0%, #1F2E7A 42%, #472C94 78%, #6334A8 100%)',
        }}
      />

      {/* Camera Layer */}
      <motion.div
        animate={reduced ? { scale: 1, x: 0, y: 0 } : cameraTransform}
        transition={{ duration: scene >= 5 ? 0.5 : 1.15, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0"
      >
        {/* Subtle Depth-of-Field Horizon Panorama Artwork (Lazy & Softly Blended from Scene 3+) */}
        <motion.img
          src="/src/assets/images/adventure_map_panorama_1794739848578.jpg"
          alt=""
          loading="lazy"
          decoding="async"
          initial={{ opacity: 0 }}
          animate={{ opacity: showWorld ? (scene >= 5 ? 0.16 : 0.24) : 0 }}
          transition={{ duration: 1.1 }}
          className="absolute inset-0 w-full h-full object-cover mix-blend-screen blur-[1px]"
        />

        {/* Scene 3: Concentric Expanding Portal Rings (Purple, Royal Blue, Turquoise & Gold) */}
        {isPortalActive && !reduced && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            {[
              { size: 'w-56 h-56 sm:w-80 sm:h-80', border: 'border-[#FFD84D]/85', delay: 0 },
              { size: 'w-72 h-72 sm:w-[26rem] sm:h-[26rem]', border: 'border-[#39BDF2]/75', delay: 0.12 },
              { size: 'w-96 h-96 sm:w-[34rem] sm:h-[34rem]', border: 'border-[#8054D9]/80', delay: 0.24 },
              { size: 'w-[28rem] h-[28rem] sm:w-[44rem] sm:h-[44rem]', border: 'border-[#FF78B7]/65', delay: 0.36 },
            ].map((ring, idx) => (
              <motion.div
                key={idx}
                initial={{ scale: 0.25, opacity: 0.95 }}
                animate={{ scale: 2.35, opacity: 0 }}
                transition={{ duration: 1.5, delay: ring.delay, ease: [0.16, 1, 0.3, 1] }}
                className={`absolute rounded-full border-4 ${ring.size} ${ring.border} shadow-[0_0_40px_rgba(255,216,77,0.45)]`}
              />
            ))}
          </div>
        )}

        {/* Fantasy Environment SVG: Rainbow, Castle with Glowing Windows, Floating Islands, Waterfalls & Glowing Trees */}
        <motion.div
          initial={false}
          animate={{ opacity: showWorld ? 1 : 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="absolute inset-0 flex items-end justify-center"
          style={{
            transform: `translate3d(${parallax.x * 8}px, ${parallax.y * 5}px, 0)`,
          }}
        >
          <svg
            viewBox="0 0 1440 780"
            preserveAspectRatio="xMidYMax slice"
            className="w-full h-full opacity-95"
          >
            <defs>
              <linearGradient id="rainbowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FF78B7" />
                <stop offset="25%" stopColor="#FFD84D" />
                <stop offset="50%" stopColor="#55D98B" />
                <stop offset="75%" stopColor="#39BDF2" />
                <stop offset="100%" stopColor="#8054D9" />
              </linearGradient>
              <linearGradient id="waterfallGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7DE2FF" stopOpacity="0.92" />
                <stop offset="65%" stopColor="#39BDF2" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="castleWallGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFE5C2" />
                <stop offset="100%" stopColor="#E6B89C" />
              </linearGradient>
              <radialGradient id="castleWindowGlow" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#FFF6B3" />
                <stop offset="100%" stopColor="#FFA800" />
              </radialGradient>
            </defs>

            {/* Brightening Rainbow Arc Across Sky */}
            <path
              d="M240 490 Q720 40 1200 490"
              fill="none"
              stroke="url(#rainbowGrad)"
              strokeWidth={brighterRainbow ? 26 : 18}
              strokeLinecap="round"
              opacity={brighterRainbow ? 0.42 : 0.24}
            />
            <path
              d="M268 500 Q720 74 1172 500"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="6"
              strokeLinecap="round"
              opacity={brighterRainbow ? 0.22 : 0.12}
            />

            {/* Left Floating Island + Glowing Trees + Waterfall */}
            <g opacity="0.88">
              {/* Waterfall Stream */}
              <rect x="202" y="458" width="24" height="190" rx="12" fill="url(#waterfallGrad)" />
              <ellipse cx="214" cy="648" rx="46" ry="12" fill="rgba(255,255,255,0.35)" />
              {/* Island Rock Base */}
              <polygon points="105,430 330,430 265,525 160,515" fill="#4F3585" />
              <ellipse cx="218" cy="430" rx="122" ry="26" fill="#46C983" />
              {/* Colorful Glowing Trees */}
              <rect x="148" y="388" width="12" height="40" fill="#7D4E34" />
              <circle cx="154" cy="368" r="30" fill="#55D98B" />
              <circle cx="144" cy="360" r="8" fill="#FFD84D" opacity="0.7" />
              <rect x="275" y="392" width="10" height="36" fill="#7D4E34" />
              <circle cx="280" cy="374" r="24" fill="#39BDF2" />
              <circle cx="288" cy="366" r="7" fill="#FFF8E9" opacity="0.7" />
            </g>

            {/* Right Floating Island + Grand Castle + Waterfalls */}
            <g opacity="0.92">
              {/* Right Island Waterfalls */}
              <rect x="1152" y="468" width="18" height="165" rx="9" fill="url(#waterfallGrad)" />
              <polygon points="940,440 1315,440 1245,565 1020,555" fill="#472E7A" />
              <ellipse cx="1128" cy="440" rx="196" ry="34" fill="#49CC86" />

              {/* Castle Main Keep */}
              <rect x="1032" y="292" width="190" height="145" rx="10" fill="url(#castleWallGrad)" />
              {/* Left & Right Flanking Turrets */}
              <rect x="1002" y="328" width="44" height="110" rx="8" fill="#FCD6B4" />
              <polygon points="996,330 1024,264 1052,330" fill="#7842D9" />
              <rect x="1208" y="328" width="44" height="110" rx="8" fill="#FCD6B4" />
              <polygon points="1202,330 1230,264 1258,330" fill="#7842D9" />
              {/* Central High Spire */}
              <rect x="1096" y="218" width="62" height="110" rx="8" fill="#FFE8CB" />
              <polygon points="1088,220 1127,138 1166,220" fill="#6832C9" />
              <line x1="1127" y1="138" x2="1127" y2="112" stroke="#FFD84D" strokeWidth="4" />
              <polygon points="1127,112 1154,121 1127,130" fill="#FF78B7" />

              {/* Illuminated Castle Arch Gate & Shimmering Windows */}
              <path d="M1104 437 L1104 388 Q1127 362 1150 388 L1150 437 Z" fill="url(#castleWindowGlow)" />
              <rect x="1054" y="335" width="18" height="28" rx="9" fill="url(#castleWindowGlow)" className="animate-twinkle" />
              <rect x="1182" y="335" width="18" height="28" rx="9" fill="url(#castleWindowGlow)" className="animate-twinkle" />
              <rect x="1118" y="256" width="18" height="30" rx="9" fill="url(#castleWindowGlow)" className="animate-twinkle" />
              <rect x="1016" y="360" width="14" height="22" rx="7" fill="url(#castleWindowGlow)" className="animate-twinkle" />
              <rect x="1223" y="360" width="14" height="22" rx="7" fill="url(#castleWindowGlow)" className="animate-twinkle" />

              {/* Glowing Tree Beside Castle */}
              <rect x="970" y="395" width="11" height="40" fill="#7D4E34" />
              <circle cx="975" cy="376" r="26" fill="#FF78B7" />
              <circle cx="966" cy="368" r="8" fill="#FFD84D" opacity="0.7" />
            </g>

            {/* Drifting Foreground & Midground Clouds */}
            <g className="animate-drift-cloud" opacity="0.34">
              <ellipse cx="280" cy="610" rx="165" ry="38" fill="#FFFFFF" />
              <ellipse cx="380" cy="595" rx="110" ry="32" fill="#FFFFFF" />
            </g>
            <g className="animate-drift-cloud" style={{ animationDelay: '-6s' }} opacity="0.28">
              <ellipse cx="1090" cy="600" rx="185" ry="42" fill="#FFFFFF" />
              <ellipse cx="975" cy="590" rx="115" ry="30" fill="#FFFFFF" />
            </g>
          </svg>
        </motion.div>
      </motion.div>
    </div>
  );
};
