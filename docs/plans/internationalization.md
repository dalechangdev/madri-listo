# Internationalization plan

Goal: serve Spanish and English speakers equally well.

Status: Phases 1–3 done (2026-09-17). Language-selection approach decided.

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

### Phase 1: system text (config only) — done

- Add to `app.json`:
  `"locales": { "es": "./assets/native-locales/es.json", "en": "./assets/native-locales/en.json" }`
  (kept apart from the app's own strings in `src/i18n/locales/`). Each file
  sets the location permission text under `ios`
  (`NSLocationWhenInUseUsageDescription`,
  `NSLocationAlwaysAndWhenInUseUsageDescription`). The app name is
  "MadriListo" in both languages, so `expo.name` covers it and no per-language
  name is needed.
- Set `ios.infoPlist.CFBundleAllowMixedLocalizations: true`.
- Configure the `expo-localization` plugin with
  `supportedLocales: { ios: ["es", "en"], android: ["es", "en"] }` and
  `supportsRTL: false`. This also adds a per-app language setting in the
  phone's system settings on both platforms.
- `ios/` and `android/` are git-ignored, so `app.json` is the source of truth.
  Verify with `npx expo prebuild --clean`.
- Outcome: verified with a prebuild of a scratch copy. iOS gets
  `es.lproj`/`en.lproj` `InfoPlist.strings` and `CFBundleLocalizations`;
  Android gets `locales_config.xml` wired into the manifest. The
  `expo-location` defaults for "Always" and motion permissions stay in English,
  but the app only requests foreground location, so they are never shown.

Reference: https://docs.expo.dev/guides/localization/

### Phase 2: make language changes update the screens — done

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
- Outcome:
  - `src/i18n/language.ts` holds the pure rule (`resolveLanguage`), with no
    React Native imports. `src/i18n/index.ts` holds the store and
    `watchDeviceLanguage()`, which the root layout starts.
    `src/hooks/use-translation.ts` returns `{ language, t, formatDistance,
    formatDate }`.
  - The global `t`, `formatDistance` and `formatDate` exports are gone, so
    nothing can bypass the hook.
  - There is one translator object per language, and each passes its locale
    on every `i18n.t` call. Its identity changes only when the language
    changes. React Compiler (enabled in `app.json`) relies on this: with a
    plain imported `t`, it could keep showing text in the old language.
  - The nearby list passes `extraData={language}` so its rows re-render.
  - The preference is fixed to `'system'` until the About tab setting adds a
    setter and storage.

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

### Phase 3: correct wording — done

- Change count strings to plural forms, e.g.
  `recordCount: { one: '{{count}} registro guardado', other: '{{count}} registros guardados' }`.
  `i18n-js` v4 picks the form from `count`.
- Replace `toFixed` in `formatDistance` and `resource-marker.tsx` with
  `Intl.NumberFormat(locale)`, and format large counts with thousands
  separators.
- Replace the hard-coded `'DEA'` fallback name in `defibrillators.ts` with a
  key, since English readers say AED.
- Outcome:
  - `sync.recordCount` has `one`/`other` forms. `map.resultsInView` stayed a
    single string: "12 in view" / "12 en pantalla" has no noun to inflect.
    The default `i18n-js` pluralizer is correct for Spanish here too.
  - Every `{{count}}` is shown with the language's digit grouping, via one
    `i18n.interpolate` override ("12.296" / "12,296"). Plural selection still
    uses the raw number.
  - The translator gains `formatNumber`. Distances and cluster bubbles use it
    ("1,5 km", "1,2k"). Distances round before choosing m vs km, and keep one
    decimal only below 9,950 m.
  - Placeholder names are no longer stored. The DEA feed's `'DEA'` and the
    fountain feed's `'Fuente'` / `DESC_CLASIFICACION` fallbacks became `null`,
    so `ResourceRecord.name` is nullable. `src/data/display.ts`
    (`resourceTitle`) shows the dataset's translated type label instead, for
    the marker, nearby row, detail sheet and directions label. Point markers
    now carry `datasetId` for this.
  - Schema v3 rebuilds `resources` with a nullable `name`, keeps the rows, and
    clears the sync timestamps so old placeholders get replaced. The
    migration SQL was checked against a v2 sample database.
  - Cluster bubbles have a spoken label (`map.clusterLabel`, e.g.
    "Libraries: 1,240") instead of a bare number.

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

- 2026-09-17: the app is renamed from MadridDex to MadriListo everywhere:
  display name, slug and URL scheme (`madrilisto`), bundle ID and Android
  package (`dev.dalechang.madrilisto`), npm package name and database file
  (`madrilisto.db`). It had not shipped to any store or device, so nothing
  needed migrating.
- 2026-09-17: the language follows the device, with an override on the About
  tab (see "Language setting on the About tab").
