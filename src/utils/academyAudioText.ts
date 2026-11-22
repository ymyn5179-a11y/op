export type AcademyAudioLang = 'ar' | 'en';

export function normalizeAcademyAudioText(raw: string): string {
  return String(raw || '')
    .replace(/[\uFE0E\uFE0F\u200D\u20E3]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getAcademyAudioCacheKeyClientFallback(text: string, lang: AcademyAudioLang): string {
  return `${lang}|${normalizeAcademyAudioText(text)}`;
}

export function getAcademyAudioUrlFromAssetId(assetId: string, lang: AcademyAudioLang): string {
  return `/assets/audio/academy/${lang}/${assetId}.mp3`;
}

export function resolveLevel1VocabSpokenText(
  subject: 'arabic' | 'english' | 'numbers' | 'colors',
  vocab: { text: string; secondaryText?: string },
  cueLang: AcademyAudioLang,
  numberValue?: number,
  secondarySymbol?: string,
): string {
  if (subject === 'numbers') {
    if (cueLang === 'ar') {
      return normalizeAcademyAudioText(secondarySymbol || String(numberValue ?? vocab.text));
    }
    const cleanEn = (vocab.secondaryText || String(numberValue ?? vocab.text))
      .replace(/\s*\(\d+\)\s*$/, '')
      .trim();
    return normalizeAcademyAudioText(cleanEn);
  }
  if (subject === 'colors') {
    if (cueLang === 'en') {
      return normalizeAcademyAudioText(vocab.secondaryText || vocab.text);
    }
    return normalizeAcademyAudioText(vocab.text);
  }
  return normalizeAcademyAudioText(vocab.text);
}
