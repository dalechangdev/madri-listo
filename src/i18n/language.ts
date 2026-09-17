/**
 * Which UI language to show. Kept free of React Native imports so the rule can
 * be unit-tested outside a simulator.
 */
export const LANGUAGES = ['es', 'en'] as const;

export type Language = (typeof LANGUAGES)[number];

/** `'system'` follows the device; anything else is an explicit user choice. */
export type LanguagePreference = 'system' | Language;

/**
 * Spanish is the default: the source datasets are Spanish, so keeping the UI in
 * Spanish avoids labels that half-translate the data. Any device language we
 * don't ship (French, Catalan…) therefore gets Spanish rather than English.
 */
export const DEFAULT_LANGUAGE: Language = 'es';

function isLanguage(value: unknown): value is Language {
  return (LANGUAGES as readonly unknown[]).includes(value);
}

/** An explicit choice wins; otherwise the device language, if we support it. */
export function resolveLanguage(
  preference: LanguagePreference,
  deviceLanguageCode: string | null | undefined,
): Language {
  if (isLanguage(preference)) return preference;
  const device = deviceLanguageCode?.toLowerCase();
  return isLanguage(device) ? device : DEFAULT_LANGUAGE;
}
