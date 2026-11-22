import React from 'react';
import { t, UI_COPY } from '../i18n/translations';
import { Language } from '../types/nonoland';

export const NONOLAND_LOGO_SRC = '/assets/aistudio/NonoLand_Magical_Learning_World_c827ccb2.png';
export const NONOLAND_SQUARE_ICON_SRC = '/favicon-192x192.png';

export type NonoLandLogoVariant = 'main' | 'compact' | 'icon' | 'badge';
export type NonoLandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface NonoLandLogoProps {
  variant?: NonoLandLogoVariant;
  size?: NonoLandLogoSize;
  language?: Language;
  showWordmark?: boolean;
  tone?: 'light' | 'dark';
  className?: string;
  wordmarkClassName?: string;
  alt?: string;
}

const MAIN_SIZE_MAP: Record<NonoLandLogoSize, string> = {
  xs: 'w-28 sm:w-32',
  sm: 'w-36 sm:w-44',
  md: 'w-48 sm:w-56',
  lg: 'w-56 sm:w-64 md:w-72',
  xl: 'w-64 sm:w-80',
};

const COMPACT_SIZE_MAP: Record<NonoLandLogoSize, string> = {
  xs: 'h-7 w-auto',
  sm: 'h-8 sm:h-9 w-auto',
  md: 'h-9 sm:h-11 w-auto',
  lg: 'h-11 sm:h-12 w-auto',
  xl: 'h-12 sm:h-14 w-auto',
};

const ICON_SIZE_MAP: Record<NonoLandLogoSize, string> = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-10 h-10 sm:w-11 sm:h-11',
  lg: 'w-14 h-14',
  xl: 'w-16 h-16 sm:w-20 sm:h-20',
};

export const NonoLandLogo: React.FC<NonoLandLogoProps> = ({
  variant = 'compact',
  size,
  language = 'ar',
  showWordmark,
  tone = 'light',
  className = '',
  wordmarkClassName = '',
  alt = 'NonoLand — Magical Learning World',
}) => {
  const resolvedSize: NonoLandLogoSize =
    size || (variant === 'main' ? 'md' : variant === 'icon' ? 'sm' : 'md');

  const shouldShowWordmark =
    typeof showWordmark === 'boolean'
      ? showWordmark
      : variant === 'compact' || variant === 'badge';

  if (variant === 'icon') {
    return (
      <span className={`inline-flex items-center gap-2 shrink-0 ${className}`}>
        <img
          src={NONOLAND_SQUARE_ICON_SRC}
          alt={alt}
          decoding="async"
          className={`${ICON_SIZE_MAP[resolvedSize]} aspect-square rounded-xl object-contain shadow-sm ring-1 ring-white/25 shrink-0`}
        />
        {shouldShowWordmark && (
          <span
            className={`font-extrabold tracking-tight whitespace-nowrap ${
              tone === 'dark' ? 'text-white' : 'text-[#27345C]'
            } ${wordmarkClassName}`}
          >
            {t(UI_COPY.appName, language)}
          </span>
        )}
      </span>
    );
  }

  if (variant === 'main') {
    return (
      <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
        <div
          className={`${MAIN_SIZE_MAP[resolvedSize]} aspect-[3/2] rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg ring-2 ${
            tone === 'dark' ? 'ring-[#FFD84D]/70 bg-[#002EBA]' : 'ring-[#27345C]/12 bg-[#002EBA]'
          }`}
        >
          <img
            src={NONOLAND_LOGO_SRC}
            alt={alt}
            decoding="async"
            className="w-full h-full object-contain"
          />
        </div>
        {shouldShowWordmark && (
          <span
            className={`text-lg sm:text-xl font-extrabold tracking-tight ${
              tone === 'dark' ? 'text-white' : 'text-[#27345C]'
            } ${wordmarkClassName}`}
          >
            {t(UI_COPY.appName, language)}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-2xl px-2.5 py-1.5 shrink-0 ${
          tone === 'dark'
            ? 'bg-white/15 border border-white/25 text-white backdrop-blur-sm'
            : 'bg-white/90 border border-[#27345C]/12 text-[#27345C] shadow-xs'
        } ${className}`}
      >
        <img
          src={NONOLAND_LOGO_SRC}
          alt={alt}
          decoding="async"
          className={`${COMPACT_SIZE_MAP[resolvedSize]} aspect-[3/2] rounded-lg object-contain shrink-0`}
        />
        {shouldShowWordmark && (
          <span className={`text-xs sm:text-sm font-extrabold tracking-tight whitespace-nowrap ${wordmarkClassName}`}>
            {t(UI_COPY.appName, language)}
          </span>
        )}
      </span>
    );
  }

  // Default: 'compact' for headers and navigation bars
  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
      <img
        src={NONOLAND_LOGO_SRC}
        alt={alt}
        decoding="async"
        className={`${COMPACT_SIZE_MAP[resolvedSize]} aspect-[3/2] rounded-xl object-contain shadow-sm ring-1 ${
          tone === 'dark' ? 'ring-white/30' : 'ring-[#27345C]/15'
        } shrink-0`}
      />
      {shouldShowWordmark && (
        <span
          className={`text-lg sm:text-xl font-extrabold tracking-tight ${
            tone === 'dark' ? 'text-white' : 'text-[#27345C]'
          } ${wordmarkClassName}`}
        >
          {t(UI_COPY.appName, language)}
        </span>
      )}
    </span>
  );
};
