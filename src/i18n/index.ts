import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import { AppState } from 'react-native';

import {
  DEFAULT_LANGUAGE,
  resolveLanguage,
  type Language,
  type LanguagePreference,
} from '@/i18n/language';
import { en } from '@/i18n/locales/en';
import { es } from '@/i18n/locales/es';

const i18n = new I18n({ es, en });

i18n.defaultLocale = DEFAULT_LANGUAGE;
i18n.enableFallback = true;

export type Translator = {
  language: Language;
  /** Translate a key, e.g. `t('map.title')`. */
  t: (key: string, options?: Record<string, unknown>) => string;
  /** Formats a distance for display, switching to km past 1000 m. */
  formatDistance: (meters: number) => string;
  formatDate: (timestamp: number) => string;
};

function createTranslator(language: Language): Translator {
  // The locale is passed on every call rather than read from `i18n.locale`, so
  // a translator can never render in a language other than the one it names.
  const t: Translator['t'] = (key, options) =>
    i18n.t(key, { ...options, locale: language });

  return {
    language,
    t,
    formatDistance: (meters) => {
      if (meters < 1000) {
        return t('nearby.distanceMeters', { value: Math.round(meters) });
      }
      return t('nearby.distanceKilometers', {
        value: (meters / 1000).toFixed(meters < 10000 ? 1 : 0),
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
