import { getLocales } from 'expo-localization';
import { I18n, type TranslateOptions } from 'i18n-js';
import { AppState } from 'react-native';

import {
  DEFAULT_LANGUAGE,
  resolveLanguage,
  type Language,
  type LanguagePreference,
} from '@/i18n/language';
import type { TranslationKey } from '@/i18n/keys';
import { en } from '@/i18n/locales/en';
import { es } from '@/i18n/locales/es';

const i18n = new I18n({ es, en });

i18n.defaultLocale = DEFAULT_LANGUAGE;
i18n.enableFallback = true;

// Plural strings are `{ one, other }` objects. The default pluralizer (English
// CLDR rules, plus an optional `zero`) is also right for Spanish here: 1 takes
// `one`, everything else — including 0 — takes `other`.

const numberFormats = new Map<string, Intl.NumberFormat>();

/** `Intl.NumberFormat` is costly to build and markers format constantly, so cache. */
function numberFormat(locale: string, fractionDigits = 0): Intl.NumberFormat {
  const key = `${locale}:${fractionDigits}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    numberFormats.set(key, format);
  }
  return format;
}

// `{{count}}` is shown with the language's digit grouping ("12.296" in Spanish,
// "12,296" in English). Plural selection has already used the raw number by
// the time interpolation runs.
const baseInterpolate = i18n.interpolate;
i18n.interpolate = (instance, message, options) => {
  if (typeof options.count !== 'number') {
    return baseInterpolate(instance, message, options);
  }
  const count = numberFormat(options.locale ?? instance.locale).format(
    options.count,
  );
  // `TranslateOptions` types `count` as a number, but interpolation only ever
  // stringifies it, so a pre-formatted string is safe here.
  return baseInterpolate(instance, message, {
    ...options,
    count,
  } as unknown as TranslateOptions);
};

export type Translator = {
  language: Language;
  /** Translate a key, e.g. `t('map.title')`. */
  t: (key: TranslationKey, options?: Record<string, unknown>) => string;
  /** Formats a distance for display, switching to km past 1000 m. */
  formatDistance: (meters: number) => string;
  formatDate: (timestamp: number) => string;
  /** Formats a number with the language's separators, e.g. 1.5 -> "1,5" in Spanish. */
  formatNumber: (value: number, fractionDigits?: number) => string;
};

function createTranslator(language: Language): Translator {
  // The locale is passed on every call rather than read from `i18n.locale`, so
  // a translator can never render in a language other than the one it names.
  const t: Translator['t'] = (key, options) =>
    i18n.t(key, { ...options, locale: language });

  const formatNumber: Translator['formatNumber'] = (value, fractionDigits) =>
    numberFormat(language, fractionDigits).format(value);

  return {
    language,
    t,
    formatNumber,
    formatDistance: (meters) => {
      // Round before choosing the unit, so 999.6 m reads "1.0 km", not "1000 m".
      const rounded = Math.round(meters);
      if (rounded < 1000) {
        return t('nearby.distanceMeters', { value: formatNumber(rounded) });
      }
      return t('nearby.distanceKilometers', {
        // One decimal below 10 km; 9,950 m and up would already round to "10.0".
        value: formatNumber(meters / 1000, rounded < 9950 ? 1 : 0),
      });
    },
    formatDate: (timestamp) =>
      new Date(timestamp).toLocaleDateString(language, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
  };
}

// One translator per language, built once, so its identity changes exactly
// when the language does. Components and the React Compiler rely on that to
// know when translated text needs re-rendering.
const translators: Record<Language, Translator> = {
  es: createTranslator('es'),
  en: createTranslator('en'),
};

function deviceLanguageCode(): string | null {
  return getLocales()[0]?.languageCode ?? null;
}

/**
 * The UI language is app-wide state, so it lives in a module store behind
 * `useSyncExternalStore`, like the sync state. It is resolved synchronously at
 * import time so the very first render is already in the right language.
 */
// Always 'system' until the About tab language setting lands.
const preference: LanguagePreference = 'system';
let snapshot: Translator =
  translators[resolveLanguage(preference, deviceLanguageCode())];
i18n.locale = snapshot.language;

const listeners = new Set<() => void>();

function update(): void {
  const next = translators[resolveLanguage(preference, deviceLanguageCode())];
  if (next === snapshot) return;
  snapshot = next;
  i18n.locale = next.language;
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): Translator {
  return snapshot;
}

/**
 * Re-reads the device language whenever the app returns to the foreground.
 * Android lets people change language without restarting the app; iOS
 * restarts it, so there this is a no-op. Returns an unsubscribe function.
 */
export function watchDeviceLanguage(): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') update();
  });
  return () => subscription.remove();
}
