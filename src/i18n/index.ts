import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import { en } from '@/i18n/locales/en';
import { es } from '@/i18n/locales/es';

/**
 * Spanish is the default: the source datasets are Spanish, so keeping the UI in
 * Spanish avoids labels that half-translate the data. English is the fallback
 * for visitors.
 */
export const i18n = new I18n({ es, en });

i18n.defaultLocale = 'es';
i18n.enableFallback = true;

const deviceLanguage = getLocales()[0]?.languageCode ?? 'es';
i18n.locale = deviceLanguage === 'en' ? 'en' : 'es';

/** Translate a key, e.g. `t('map.title')`. */
export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}

/** Formats a distance for display, switching to km past 1000 m. */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return t('nearby.distanceMeters', { value: Math.round(meters) });
  }
  return t('nearby.distanceKilometers', {
    value: (meters / 1000).toFixed(meters < 10000 ? 1 : 0),
  });
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(i18n.locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
