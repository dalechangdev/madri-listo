# Internationalization plan

Goal: serve Spanish and English speakers equally well.

Status: proposed (2026-09-17). Language-selection approach decided.

## What already works

- `src/i18n/index.ts` sets up `i18n-js`, reads the device language once at
  startup, defaults to Spanish and falls back to Spanish when a string is
  missing.
- `src/i18n/locales/en.ts` and `es.ts` have the same keys. Tab labels,
  accessibility labels and the detail sheet all go through `t()`.

## What's missing

1. **Spanish-only system text.** The location permission prompt in `app.json`
   is hard-coded in Spanish, so English users see a Spanish system dialog. iOS
   is also not told that the app supports two languages.
2. **Wrong plurals.** `sync.recordCount` and `map.resultsInView` use one string
   for every count ("1 registros guardados").
3. **English number formats for Spanish users.** `formatDistance` and the
   cluster count in `resource-marker.tsx` use `toFixed`, so Spanish users see
   "1.5 km" instead of "1,5 km".
4. **Language doesn't update while the app runs.** The language is read once
   and `t()` is a plain function, so nothing re-renders when it changes. That's
   fine on iOS, which restarts the app when the device language changes, but
   Android keeps the app running with the old language.
5. **No check on translation keys.** `t(key: string)` accepts any string, so a
   typo only shows up at runtime.
6. **Nothing checks that the two locale files match.** They match today only
   because both were written by hand.
7. **Unused keys:** `common.loading`, `common.error`, `common.dismiss`,
   `sync.offlineNotice`.
8. **Feed data stays in Spanish.** Opening hours, services, facility types and
   street names come straight from the source datasets.

## Plan

### Phase 1: system text (config only)

- Add to `app.json`:
  `"locales": { "es": "./locales/es.json", "en": "./locales/en.json" }`.
  Each file sets the location permission text
  (`NSLocationWhenInUseUsageDescription`,
  `NSLocationAlwaysAndWhenInUseUsageDescription`) and the app name
  (`ios.CFBundleDisplayName`, `android.app_name`).
- Set `ios.infoPlist.CFBundleAllowMixedLocalizations: true`.
- Configure the `expo-localization` plugin with
  `supportedLocales: { ios: ["es", "en"], android: ["es", "en"] }` and
  `supportsRTL: false`. This also adds a per-app language setting in the
  phone's system settings on both platforms.
- `ios/` and `android/` are git-ignored, so `app.json` is the source of truth.
  Verify with `npx expo prebuild --clean`.

Reference: https://docs.expo.dev/guides/localization/

### Phase 2: make language changes update the screens

- Keep the current language in a small store in `src/i18n`, built like
  `src/data/sync-store.ts` (`useSyncExternalStore`), and add a
  `useTranslation()` hook that returns `t` and the current locale.
- On Android, update the language when the app returns to the foreground
  (`AppState` + `getLocales()`, as the Expo docs recommend). Keep the
  "anything except `en` becomes `es`" rule in one function.
- Move components from the imported `t` to the hook so they re-render.
  Non-component code, such as dataset descriptors, keeps passing translation
  keys rather than translated text, as it already does.
- The store resolves the active language as: saved override if set, otherwise
  the device language (see "Language setting" below).

### Language setting on the About tab

Decision: the app follows the device language by default, and the About tab
offers an override.

- **Choice:** a three-way control on the About tab: *Sistema / System*,
  *Español*, *English*. Each language name is always written in its own
  language so users can find theirs whatever the current UI language is. The
  *System* option shows which language it currently resolves to, e.g.
  "System (English)".
- **Storage:** save the choice under one key (`preferredLanguage`: `'system'`,
  `'es'` or `'en'`) with `expo-sqlite/kv-store`, which the app already depends
  on. No new package is needed. Read it with `getItemSync` when the i18n
  store starts so the first render is already in the right language, with no
  flash of the wrong one. A missing or unknown value means `'system'`.
- **Applying it:** selecting an option saves it and updates the store, so all
  screens re-render at once with no restart. Tab labels, which are read inside
  `app-tabs.tsx`, must use the hook too.
- **Device changes:** the foreground listener from Phase 2 only affects the
  result when the choice is `'system'`. An explicit choice always wins.
- **Dates and numbers** follow the active app language, not the device's, so
  the screen never mixes "1,5 km" with English text.
- **Known limitation:** system dialogs such as the location permission prompt
  and the app name on the home screen come from the OS, so they follow the
  device language (or the per-app language in system settings from Phase 1),
  not the in-app override. Accept this; the in-app setting only changes text
  the app draws itself.
- **New strings:** `about.language`, `about.languageSystem`
  (`'System ({{language}})'` / `'Sistema ({{language}})'`). The names
  "Español" and "English" are fixed values, not translated.
- **Accessibility:** use a radio-group style control with
  `accessibilityRole="radio"` and `accessibilityState={{ checked }}`, and set
  `accessibilityLanguage` on each language name so screen readers pronounce it
  correctly.
- **Tests:** unit-test the resolver (saved choice × device language → active
  language), including an unknown saved value and an unsupported device
  language such as French, which should resolve to Spanish.

### Phase 3: correct wording

- Change count strings to plural forms, e.g.
  `recordCount: { one: '{{count}} registro guardado', other: '{{count}} registros guardados' }`.
  `i18n-js` v4 picks the form from `count`.
- Replace `toFixed` in `formatDistance` and `resource-marker.tsx` with
  `Intl.NumberFormat(locale)`, and format large counts with thousands
  separators.
- Replace the hard-coded `'DEA'` fallback name in `defibrillators.ts` with a
  key, since English readers say AED.

### Phase 4: catch translation mistakes before runtime

- Treat `es.ts` as the reference and require `en.ts` to have exactly the same
  keys (`satisfies Translations`), so a missing or extra key fails
  `npm run typecheck`.
- Restrict `t()` to real translation keys so a typo is a compile error. The
  dynamic key `` `sync.${phase}` `` in `about.tsx` then needs a typed lookup
  table.
- Use or delete the unused keys. `sync.offlineNotice` probably belongs on the
  map screen when a sync fails.

### Phase 5: feed data (scope decision)

Free text from the feeds (opening hours, services, addresses) stays in
Spanish; machine-translating opening hours is risky. Options:

- **(a)** Show "Información en español" on the detail sheet when the app is in
  English. Cheap and honest.
- **(b)** Also translate short, fixed value lists such as the defibrillator
  venue types (`tipo_establecimiento`). This needs a value table per dataset,
  kept inside the dataset descriptor so the UI never special-cases a dataset.

Recommendation: (a) now, (b) later.

### Phase 6: tests and docs

- Add a plain unit test for plural forms and number formatting in both
  languages, with no React Native imports.
- Add an "Adding a string / adding a language" section to the README.

## Order

Phases 1 and 3 are small and fix problems users see today, so do them first.
Phase 4 prevents future mistakes and makes Phase 2 safer. The About tab
setting comes after Phase 2, since it depends on the re-rendering store.

## Decisions

- 2026-09-17: the language follows the device, with an override on the About
  tab (see "Language setting on the About tab").
