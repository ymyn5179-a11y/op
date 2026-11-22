import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Volume2 } from 'lucide-react';
import {
  ChildAvatarConfig,
  Language,
  NonoMood,
  OfficialCharacterId,
} from '../types/nonoland';
import { soundEngine } from '../utils/soundEngine';

export interface CharacterActorProps {
  characterId: OfficialCharacterId;
  mood?: NonoMood;
  accentColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  hat?: string;
  accessory?: string;
  speechBubble?: string;
  language?: Language;
  onTap?: () => void;
  interactive?: boolean;
  label?: string;
}

const CHARACTER_PALETTES: Record<
  OfficialCharacterId,
  { body: string; belly: string; detail: string; cheek: string; aura: string; nameAr: string; nameEn: string }
> = {
  nono: {
    body: '#FF9360',
    belly: '#FFF8E9',
    detail: '#8054D9',
    cheek: '#FF78B7',
    aura: '#8054D9',
    nameAr: 'نونو',
    nameEn: 'Nono',
  },
  lolo: {
    body: '#FFE4F1',
    belly: '#FFFFFF',
    detail: '#FF78B7',
    cheek: '#FF78B7',
    aura: '#FF78B7',
    nameAr: 'لولو',
    nameEn: 'Lolo',
  },
  leo: {
    body: '#FFD84D',
    belly: '#FFF8E9',
    detail: '#FF9360',
    cheek: '#FF9360',
    aura: '#FFD84D',
    nameAr: 'ليو',
    nameEn: 'Leo',
  },
  bobo: {
    body: '#D98B5F',
    belly: '#FFEAD5',
    detail: '#39BDF2',
    cheek: '#FF78B7',
    aura: '#FF9360',
    nameAr: 'بوبو',
    nameEn: 'Bobo',
  },
  ellie: {
    body: '#90D7F7',
    belly: '#E5F6FF',
    detail: '#8054D9',
    cheek: '#FF78B7',
    aura: '#39BDF2',
    nameAr: 'إيلي',
    nameEn: 'Ellie',
  },
  titi: {
    body: '#7AE5A6',
    belly: '#E8FFF1',
    detail: '#55D98B',
    cheek: '#FF9360',
    aura: '#55D98B',
    nameAr: 'تيتي',
    nameEn: 'Titi',
  },
};

export const CharacterActor: React.FC<CharacterActorProps> = ({
  characterId,
  mood = 'idle',
  accentColor,
  size = 'md',
  hat = 'none',
  accessory = 'none',
  speechBubble,
  language = 'ar',
  onTap,
  interactive = true,
  label,
}) => {
  const [tapBurst, setTapBurst] = useState(false);
  const palette = CHARACTER_PALETTES[characterId] || CHARACTER_PALETTES.nono;
  const scarf = accentColor || palette.detail;

  const dims =
    size === 'xs'
      ? 'w-14 h-14'
      : size === 'sm'
        ? 'w-20 h-20'
        : size === 'lg'
          ? 'w-36 h-36 sm:w-44 sm:h-44'
          : size === 'xl'
            ? 'w-44 h-44 sm:w-52 sm:h-52'
            : 'w-28 h-28';

  const handleInteract = () => {
    if (!interactive) return;
    soundEngine.playPop();
    setTapBurst(true);
    setTimeout(() => setTapBurst(false), 620);
    if (speechBubble) {
      soundEngine.speak(speechBubble, language);
    }
    onTap?.();
  };

  const animateProps =
    mood === 'jumping' || mood === 'celebrating' || tapBurst
      ? { y: [0, -14, 0, -8, 0], rotate: [0, -4, 4, 0] }
      : mood === 'walking'
        ? { x: [-4, 4, -4], y: [0, -5, 0], rotate: [-2, 2, -2] }
        : mood === 'dancing' || mood === 'laughing'
          ? { rotate: [-5, 5, -5], y: [0, -7, 0] }
          : mood === 'sleeping'
            ? { scale: [1, 1.02, 1] }
            : { y: [0, -4, 0] };

  const renderEyes = () => {
    if (mood === 'sleeping') {
      return (
        <>
          <path d="M55 66 Q63 72 71 66" fill="none" stroke="#27345C" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M89 66 Q97 72 105 66" fill="none" stroke="#27345C" strokeWidth="3.2" strokeLinecap="round" />
        </>
      );
    }
    if (mood === 'celebrating' || mood === 'excited' || mood === 'laughing') {
      return (
        <>
          <path d="M55 68 Q63 58 71 68" fill="none" stroke="#27345C" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M89 68 Q97 58 105 68" fill="none" stroke="#27345C" strokeWidth="3.5" strokeLinecap="round" />
        </>
      );
    }
    return (
      <>
        <circle cx="62" cy="66" r="7" fill="#27345C" />
        <circle cx="64.5" cy="63.5" r="2.5" fill="#FFFFFF" />
        <circle cx="98" cy="66" r="7" fill="#27345C" />
        <circle cx="100.5" cy="63.5" r="2.5" fill="#FFFFFF" />
      </>
    );
  };

  const renderMouth = () => {
    if (mood === 'thinking') {
      return <path d="M74 87 Q80 85 86 88" fill="none" stroke="#27345C" strokeWidth="2.8" strokeLinecap="round" />;
    }
    if (mood === 'surprised') {
      return <circle cx="80" cy="87" r="4.5" fill="#27345C" />;
    }
    if (mood === 'laughing' || mood === 'celebrating') {
      return (
        <path
          d="M69 83 Q80 96 91 83 Z"
          fill="#FF4D6D"
          stroke="#27345C"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      );
    }
    return <path d="M71 84 Q80 93 89 84" fill="none" stroke="#27345C" strokeWidth="2.8" strokeLinecap="round" />;
  };

  return (
    <div className="inline-flex flex-col items-center gap-1.5 select-none">
      {speechBubble && (
        <motion.button
          type="button"
          onClick={handleInteract}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xs sm:max-w-sm bg-white/95 text-[#27345C] px-4 py-2 rounded-2xl border-2 border-[#8054D9]/20 shadow-md text-xs sm:text-sm font-bold flex items-center gap-2 text-start hover:border-[#8054D9] transition-colors cursor-pointer"
        >
          <Volume2 className="w-4 h-4 shrink-0 text-[#8054D9]" />
          <span>{speechBubble}</span>
        </motion.button>
      )}

      <motion.button
        type="button"
        onClick={handleInteract}
        aria-label={language === 'ar' ? palette.nameAr : palette.nameEn}
        animate={animateProps}
        transition={{
          duration: mood === 'celebrating' || tapBurst ? 0.6 : mood === 'walking' ? 0.9 : 3,
          repeat: mood === 'celebrating' || tapBurst ? 1 : Infinity,
          ease: 'easeInOut',
        }}
        whileHover={interactive ? { scale: 1.06 } : undefined}
        whileTap={interactive ? { scale: 0.94 } : undefined}
        className={`relative ${dims} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FFD84D] rounded-full ${
          interactive ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <div
          className="absolute inset-1 rounded-full opacity-30 blur-md"
          style={{ backgroundColor: palette.aura }}
        />

        <svg viewBox="0 0 160 160" className="relative w-full h-full drop-shadow-md">
          {/* SPECIES-SPECIFIC SILHOUETTES BEHIND HEAD/BODY */}
          {characterId === 'nono' && (
            <>
              <motion.path
                d="M114 118 C144 118, 152 86, 134 74 C122 66, 114 90, 108 106 Z"
                fill={palette.body}
                stroke="#27345C"
                strokeWidth="3"
                animate={{ rotate: mood === 'excited' || mood === 'celebrating' ? [-6, 8, -6] : [-2, 3, -2] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                style={{ transformOrigin: '110px 110px' }}
              />
              <path d="M134 74 C144 82, 142 96, 132 100 C128 92, 128 80, 134 74 Z" fill="#FFF8E9" />
              <path d="M36 58 L28 18 L62 38 Z" fill={palette.body} stroke="#27345C" strokeWidth="3.2" strokeLinejoin="round" />
              <path d="M38 50 L34 26 L54 40 Z" fill="#FFD84D" opacity="0.7" />
              <path d="M124 58 L132 18 L98 38 Z" fill={palette.body} stroke="#27345C" strokeWidth="3.2" strokeLinejoin="round" />
              <path d="M122 50 L126 26 L106 40 Z" fill="#FFD84D" opacity="0.7" />
            </>
          )}

          {characterId === 'lolo' && (
            <>
              {/* Tall Bunny Ears */}
              <motion.ellipse
                cx="56"
                cy="27"
                rx="11"
                ry="26"
                transform="rotate(-10 56 27)"
                fill={palette.body}
                stroke="#27345C"
                strokeWidth="3"
                animate={{ rotate: [-12, -6, -12] }}
                transition={{ duration: 2.4, repeat: Infinity }}
              />
              <ellipse cx="56" cy="28" rx="6" ry="17" transform="rotate(-10 56 28)" fill="#FF78B7" opacity="0.55" />
              <motion.ellipse
                cx="104"
                cy="27"
                rx="11"
                ry="26"
                transform="rotate(10 104 27)"
                fill={palette.body}
                stroke="#27345C"
                strokeWidth="3"
                animate={{ rotate: [12, 6, 12] }}
                transition={{ duration: 2.4, repeat: Infinity }}
              />
              <ellipse cx="104" cy="28" rx="6" ry="17" transform="rotate(10 104 28)" fill="#FF78B7" opacity="0.55" />
              <circle cx="118" cy="126" r="10" fill="#FFFFFF" stroke="#27345C" strokeWidth="2.8" />
            </>
          )}

          {characterId === 'leo' && (
            <>
              {/* Golden Lion Mane */}
              <circle cx="80" cy="68" r="50" fill="#FF9360" stroke="#27345C" strokeWidth="3.2" strokeDasharray="16 5" />
              <circle cx="44" cy="36" r="10" fill="#FFD84D" stroke="#27345C" strokeWidth="2.8" />
              <circle cx="116" cy="36" r="10" fill="#FFD84D" stroke="#27345C" strokeWidth="2.8" />
              <path d="M112 122 Q142 114 140 90" fill="none" stroke="#27345C" strokeWidth="3" strokeLinecap="round" />
              <circle cx="140" cy="88" r="7" fill="#FF9360" stroke="#27345C" strokeWidth="2.4" />
            </>
          )}

          {characterId === 'bobo' && (
            <>
              <circle cx="43" cy="38" r="13" fill={palette.body} stroke="#27345C" strokeWidth="3" />
              <circle cx="43" cy="38" r="7" fill="#FFEAD5" />
              <circle cx="117" cy="38" r="13" fill={palette.body} stroke="#27345C" strokeWidth="3" />
              <circle cx="117" cy="38" r="7" fill="#FFEAD5" />
            </>
          )}

          {characterId === 'ellie' && (
            <>
              {/* Big Floppy Elephant Ears */}
              <ellipse cx="30" cy="68" rx="22" ry="30" fill={palette.body} stroke="#27345C" strokeWidth="3" />
              <ellipse cx="32" cy="68" rx="13" ry="20" fill="#FFD6E8" opacity="0.7" />
              <ellipse cx="130" cy="68" rx="22" ry="30" fill={palette.body} stroke="#27345C" strokeWidth="3" />
              <ellipse cx="128" cy="68" rx="13" ry="20" fill="#FFD6E8" opacity="0.7" />
            </>
          )}

          {characterId === 'titi' && (
            <>
              {/* Cozy Turtle Shell */}
              <ellipse cx="80" cy="116" rx="44" ry="30" fill="#2A9D8F" stroke="#27345C" strokeWidth="3.2" />
              <polygon points="80,94 94,106 88,122 72,122 66,106" fill="#FFD84D" opacity="0.75" stroke="#27345C" strokeWidth="2" />
            </>
          )}

          {/* BODY */}
          {characterId !== 'titi' && (
            <>
              <ellipse cx="80" cy="116" rx="34" ry="28" fill={palette.body} stroke="#27345C" strokeWidth="3.2" />
              <ellipse cx="80" cy="119" rx="20" ry="20" fill={palette.belly} />
            </>
          )}

          {/* HEAD */}
          <ellipse cx="80" cy="68" rx="42" ry="36" fill={palette.body} stroke="#27345C" strokeWidth="3.2" />

          {/* Face Mask / Muzzle */}
          {characterId === 'nono' ? (
            <>
              <path
                d="M40 72 C46 58, 66 64, 80 78 C94 64, 114 58, 120 72 C122 92, 102 104, 80 104 C58 104, 38 92, 40 72 Z"
                fill="#FFF8E9"
              />
              <polygon points="80,38 83,44 89,45 84,49 86,55 80,52 74,55 76,49 71,45 77,44" fill="#FFD84D" />
            </>
          ) : (
            <ellipse cx="80" cy="83" rx="22" ry="15" fill={palette.belly} />
          )}

          {/* Eyes */}
          {renderEyes()}

          {/* Rosy Cheeks */}
          <ellipse cx="49" cy="78" rx="6" ry="3.5" fill={palette.cheek} opacity="0.55" />
          <ellipse cx="111" cy="78" rx="6" ry="3.5" fill={palette.cheek} opacity="0.55" />

          {/* Nose / Elephant Trunk / Mouth */}
          {characterId === 'ellie' ? (
            <path
              d="M75 74 Q80 95 92 92 Q97 90 95 84"
              fill="none"
              stroke="#27345C"
              strokeWidth="5"
              strokeLinecap="round"
            />
          ) : (
            <>
              <ellipse cx="80" cy="77" rx="5" ry="3.6" fill="#27345C" />
              {renderMouth()}
            </>
          )}

          {/* Scarf / Collar Accent */}
          <path
            d="M49 96 Q80 111 111 96 L106 110 Q80 122 54 110 Z"
            fill={scarf}
            stroke="#27345C"
            strokeWidth="2.8"
          />
          <circle cx="80" cy="107" r="6.5" fill="#FFD84D" stroke="#27345C" strokeWidth="2.2" />

          {/* Optional Accessory / Glasses */}
          {accessory === 'glasses' && (
            <g stroke="#27345C" strokeWidth="2.6" fill="rgba(57,189,242,0.22)">
              <circle cx="62" cy="66" r="11" />
              <circle cx="98" cy="66" r="11" />
              <line x1="73" y1="66" x2="87" y2="66" />
            </g>
          )}

          {/* Optional Hat */}
          {hat === 'crown' && (
            <polygon
              points="58,34 64,14 80,26 96,14 102,34"
              fill="#FFD84D"
              stroke="#27345C"
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
          )}
          {hat === 'wizard' && (
            <>
              <polygon points="55,36 80,4 105,36" fill="#8054D9" stroke="#27345C" strokeWidth="2.8" />
              <ellipse cx="80" cy="36" rx="32" ry="6" fill="#8054D9" stroke="#27345C" strokeWidth="2.5" />
            </>
          )}
          {hat === 'flower' && (
            <text x="98" y="34" fontSize="22">
              🌸
            </text>
          )}
          {hat === 'cap' && (
            <>
              <path d="M52 38 Q80 14 108 38 Z" fill="#39BDF2" stroke="#27345C" strokeWidth="2.6" />
              <path d="M50 38 H118" stroke="#27345C" strokeWidth="4" strokeLinecap="round" />
            </>
          )}

          {/* Waving Paw */}
          <motion.g
            animate={
              mood === 'waving' || mood === 'celebrating' || tapBurst
                ? { rotate: [-14, 18, -14] }
                : { rotate: [-2, 4, -2] }
            }
            transition={{ duration: mood === 'waving' ? 0.6 : 2.4, repeat: Infinity }}
            style={{ transformOrigin: '48px 110px' }}
          >
            <ellipse cx="36" cy="100" rx="11" ry="8" fill={palette.body} stroke="#27345C" strokeWidth="2.8" />
          </motion.g>
          <ellipse cx="114" cy="116" rx="10" ry="8" fill={palette.body} stroke="#27345C" strokeWidth="2.8" />
        </svg>
      </motion.button>

      {label && (
        <span className="text-xs font-extrabold text-[#27345C]">{label}</span>
      )}
    </div>
  );
};

export const ChildAvatarPreview: React.FC<{
  avatar: ChildAvatarConfig;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}> = ({ avatar, size = 'md', animated = true }) => {
  const dims =
    size === 'sm' ? 'w-16 h-16' : size === 'lg' ? 'w-44 h-44 sm:w-52 sm:h-52' : 'w-28 h-28';

  return (
    <motion.div
      animate={animated ? { y: [0, -5, 0] } : undefined}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      className={`relative ${dims} mx-auto select-none`}
    >
      <div
        className="absolute inset-2 rounded-full opacity-35 blur-md"
        style={{ backgroundColor: avatar.outfitColor }}
      />
      <svg viewBox="0 0 160 160" className="relative w-full h-full drop-shadow-md">
        {/* Cape behind if equipped */}
        {(avatar.accessory === 'cape' || avatar.outfit === 'royal') && (
          <path d="M40 94 L25 148 L135 148 L120 94 Z" fill="#FF78B7" stroke="#27345C" strokeWidth="3" />
        )}

        {/* Torso / Outfit */}
        <path
          d="M44 102 Q80 88 116 102 L124 148 L36 148 Z"
          fill={avatar.outfit === 'scientist' ? '#FFFFFF' : avatar.outfitColor}
          stroke="#27345C"
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
        {avatar.outfit === 'astronaut' && (
          <>
            <rect x="64" y="112" width="32" height="18" rx="6" fill="#E5F6FF" stroke="#27345C" strokeWidth="2" />
            <circle cx="73" cy="121" r="3" fill="#FF4D6D" />
            <circle cx="87" cy="121" r="3" fill="#55D98B" />
          </>
        )}
        {avatar.outfit === 'artist' && (
          <circle cx="80" cy="124" r="10" fill="#FFD84D" stroke="#27345C" strokeWidth="2" />
        )}
        {avatar.outfit === 'scientist' && (
          <path d="M70 98 L80 130 L90 98" fill="none" stroke="#39BDF2" strokeWidth="3" />
        )}
        {avatar.outfit === 'royal' && (
          <polygon points="80,108 86,120 80,132 74,120" fill="#FFD84D" stroke="#27345C" strokeWidth="2" />
        )}

        {/* Back Hair for Braids/Bob */}
        {(avatar.hairStyle === 'braids' || avatar.hairStyle === 'bob') && (
          <>
            <circle cx="44" cy="76" r="15" fill={avatar.hairColor} stroke="#27345C" strokeWidth="2.8" />
            <circle cx="116" cy="76" r="15" fill={avatar.hairColor} stroke="#27345C" strokeWidth="2.8" />
          </>
        )}

        {/* Head */}
        <circle cx="80" cy="64" r="34" fill={avatar.skinTone} stroke="#27345C" strokeWidth="3.2" />

        {/* Hair Styles */}
        {avatar.hairStyle === 'curly' && (
          <g fill={avatar.hairColor} stroke="#27345C" strokeWidth="2.5">
            <circle cx="56" cy="40" r="13" />
            <circle cx="72" cy="33" r="14" />
            <circle cx="90" cy="33" r="14" />
            <circle cx="105" cy="41" r="12" />
          </g>
        )}
        {avatar.hairStyle === 'spiky' && (
          <path
            d="M46 56 L52 24 L68 38 L80 18 L94 38 L108 24 L114 56 Z"
            fill={avatar.hairColor}
            stroke="#27345C"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
        )}
        {(avatar.hairStyle === 'classic' || avatar.hairStyle === 'bob' || avatar.hairStyle === 'braids') && (
          <path
            d="M46 60 Q46 28 80 28 Q114 28 114 60 Q98 44 80 48 Q62 44 46 60 Z"
            fill={avatar.hairColor}
            stroke="#27345C"
            strokeWidth="2.8"
          />
        )}
        {avatar.hairStyle === 'cap-hair' && (
          <>
            <path d="M46 52 Q80 20 114 52 Z" fill="#39BDF2" stroke="#27345C" strokeWidth="3" />
            <path d="M44 52 H122" stroke="#27345C" strokeWidth="4.5" strokeLinecap="round" />
          </>
        )}

        {/* Facial Expressions */}
        {avatar.expression === 'silly' ? (
          <>
            <path d="M60 62 Q66 55 72 62" fill="none" stroke="#27345C" strokeWidth="3" strokeLinecap="round" />
            <circle cx="94" cy="62" r="5" fill="#27345C" />
            <path d="M68 78 Q80 90 92 78" fill="none" stroke="#27345C" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="83" cy="85" rx="4.5" ry="5" fill="#FF78B7" />
          </>
        ) : (
          <>
            <circle cx="66" cy="63" r="5.5" fill="#27345C" />
            <circle cx="68" cy="61" r="2" fill="#FFFFFF" />
            <circle cx="94" cy="63" r="5.5" fill="#27345C" />
            <circle cx="96" cy="61" r="2" fill="#FFFFFF" />
            {avatar.expression === 'curious' ? (
              <circle cx="80" cy="80" r="4" fill="#27345C" />
            ) : (
              <path d="M68 77 Q80 88 92 77" fill="none" stroke="#27345C" strokeWidth="3" strokeLinecap="round" />
            )}
          </>
        )}

        {/* Cheeks */}
        <ellipse cx="56" cy="72" rx="5" ry="3" fill="#FF78B7" opacity="0.55" />
        <ellipse cx="104" cy="72" rx="5" ry="3" fill="#FF78B7" opacity="0.55" />

        {/* Accessories */}
        {avatar.accessory === 'glasses' && (
          <g stroke="#27345C" strokeWidth="2.5" fill="rgba(57,189,242,0.2)">
            <circle cx="66" cy="63" r="9.5" />
            <circle cx="94" cy="63" r="9.5" />
            <line x1="75.5" y1="63" x2="84.5" y2="63" />
          </g>
        )}
        {avatar.accessory === 'headband' && (
          <path d="M50 48 Q80 34 110 48" fill="none" stroke="#FFD84D" strokeWidth="5" strokeLinecap="round" />
        )}
        {avatar.accessory === 'star-pin' && (
          <polygon points="100,108 103,115 110,115 105,120 107,127 100,123 93,127 95,120 90,115 97,115" fill="#FFD84D" stroke="#27345C" strokeWidth="1.5" />
        )}
      </svg>
    </motion.div>
  );
};
