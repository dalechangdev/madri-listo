# MadriListo

A cross-platform (iOS + Android) app that surfaces public resources across
Madrid — defibrillators today, with buses, metro stations, picnic tables and
fountains sketched into the same pipeline — from the city's and region's open
data portals.

## Current state

**Six categories are live**: defibrillators, drinking fountains, libraries,
basic sports facilities, municipal markets and senior centres. The app downloads each feed,
normalises it, caches it in on-device SQLite, and renders it as a filterable,
clustered map with a detail sheet and a distance-sorted "near you" list.
Everything works offline after the first sync.

The map opens at walking scale (~1.7 km across) and recentres on your position
once located, rather than framing the whole city.

Buses, metro and picnic tables are declared in
`src/constants/categories.ts` but marked `available: false` — they need a
dataset descriptor before they appear.

## Running it

`react-native-maps` and `expo-sqlite` contain native code, so this needs a
**development build** — it will not run in Expo Go.

```bash
npm install
npx expo run:ios       # or: npx expo run:android
```

For Android you must supply a Google Maps key in `app.json` at
`expo.android.config.googleMaps.apiKey` — Android has no non-Google map
provider. iOS uses Apple Maps via `PROVIDER_DEFAULT` and needs no key.

```bash
npm run typecheck      # tsc --noEmit
npm run lint
```

## Architecture

```
src/
  app/                     expo-router routes (file = screen)
    _layout.tsx            theme + i18n bootstrap, native tab bar
    index.tsx              map (primary screen)
    nearby.tsx             distance-sorted list
    about.tsx              attribution + manual refresh
  data/
    types.ts               ResourceRecord, DatasetDescriptor contracts
    datasets/              one file per Madrid feed
      defibrillators.ts    DEA register: fetch shape -> ResourceRecord
      madrid-graph.ts      factory for the shared city JSON-LD schema
      madrid-urban-furniture.ts  factory for the flat "mobiliario urbano" schema
      ckan.ts              resolves rotating download URLs from the catalogue
    text.ts                caps/slug/title-case normalisation helpers
    utm.ts                 ETRS89 / UTM 30N -> WGS84, for rows missing lat/lon
    db.ts                  SQLite schema, migrations, transactional writes
    repository.ts          viewport, clustering and nearest-neighbour queries
    sync.ts                download -> normalise -> store orchestration
    sync-store.ts          app-wide sync state (useSyncExternalStore)
  constants/geo.ts         Madrid bounding box + coordinate sanity check
  hooks/                   use-sync, use-location, use-map-markers
  components/map/          filter bar, markers, detail sheet
  i18n/                    es (default) + en
```

### The data layer

Every feed is described by a `DatasetDescriptor` — a `downloadUrl`, an
`extract` that unwraps the response envelope, and a pure `normalize` that maps
one source row to a `ResourceRecord`. The sync engine, storage and UI know
nothing about individual datasets, so **adding a feed means adding one file**
and registering it in `src/data/datasets/index.ts`.

Normalisation is deliberately pure and side-effect free so it can be run
against a captured fixture without a simulator.

Some sharp edges in the real data that the DEA descriptor already handles:

- Coordinates use Spanish decimal commas (`"-3,677"`), which `Number()` rejects.
- `codigo_dea` is *almost* unique — the live feed currently has one collision,
  so repeated keys are suffixed rather than silently dropped.
- Much of the register is typed in caps lock, folded down to sentence case.
- The floor/door columns often repeat the free-text placement, and are only
  appended when they add something.
- The register is *regional*, so it includes municipalities outside the city
  boundary. These are kept: a defibrillator two streets past the city line is
  still the nearest one to someone standing there.

And in the city JSON-LD feeds:

- District and neighbourhood arrive as CamelCase URI slugs
  (`.../Distrito/PuenteDeVallecas`), some truncated to a bare `Distrito`.
- Street addresses are in caps lock, so they are title-cased with Spanish
  particle rules ("AVENIDA DE LA ALBUFERA" -> "Avenida de la Albufera").
- One sports facility has a **positive** longitude (`3.641` rather than
  `-3.641`), which would plot it in Iraq. The Madrid bounding-box check in
  `src/constants/geo.ts` rejects it. This is a source error worth reporting
  upstream; it is dropped rather than silently sign-flipped.
- `accesibility` is an undocumented numeric code (`"0"`, `"1"`, `"1,5,6"`).
  It is deliberately **not** surfaced: guessing at accessibility semantics and
  getting them wrong would mislead exactly the people who depend on them.

And in the drinking-fountain feed:

- 271 rows publish `LATITUD: null` while still carrying ETRS89 UTM 30N
  easting/northing. `src/data/utm.ts` recovers 270 of them — **13% more
  coverage**. The inverse projection was validated against the 2,038 rows that
  publish both representations: maximum disagreement 0.015 m.
- 43 fountains are `FUERA_DE_SERVICIO` or `CERRADA_TEMPORALMENT` and are
  dropped. Sending someone across town in 40 °C heat to a fountain that is
  switched off is worse than not listing it.
- The "drinking water" feed also contains 15 pet-only bowls (`USO: MASCOTAS`)
  and 11 rows with no `USO` at all. These are filtered out — a dog bowl is not
  drinking water for a person.
- There is **no seasonal signal in the data**. Madrid shuts many fountains over
  winter and `ESTADO` tracks maintenance, not season, so between roughly
  November and April the map will show fountains that are dry. This cannot be
  fixed from this source.
- Rows carry no name — every row's classification is the literal string
  "Fuentes de beber" — so the street line identifies them instead.
- **Its download URL rotates.** The current extract is published under a
  timestamped filename (`300051_20260831_055308.json`) that changes on every
  republish, while the stable-looking resource names hold *year-end archives*
  (2,138 rows for 2023, 2,223 for 2024, 2,309 today). Hardcoding either is
  wrong, so `src/data/datasets/ckan.ts` resolves the newest JSON resource from
  the catalogue at sync time. Resolution is best-effort: on failure the sync
  falls back to the last known URL, since the portal rate-limits aggressively.

### Why SQLite rather than in-memory state

The DEA feed alone is ~10 MB and 12,296 rows. Caching it in SQLite gives
offline use, indexed viewport queries, and — importantly — lets clustering
happen *in SQL*:

- Above ~10 km of viewport width (`MAX_MARKER_LON_DELTA`), nothing is drawn and
  the map prompts you to zoom in. At that scale the grid blankets the city,
  hiding your own position behind thousands of points you can't act on.
- Under 250 points in view (`MAX_INDIVIDUAL_MARKERS`), individual pins.
- Between the two, points are aggregated into a per-category grid whose cell
  size tracks the zoom level (`CLUSTER_COLUMNS`, currently 6 — about 80 bubbles
  on a phone).

Note that because the grid is sized *relative to the viewport*, it refills at
every zoom level: bubble count stays roughly constant as you zoom, rather than
thinning out. `CLUSTER_COLUMNS` is therefore the single knob that decides how
busy the map looks. Switching to distance-based clustering (supercluster) would
make bubbles reflect real density instead, at the cost of loading points into
memory rather than aggregating them in SQL.

Latitude/longitude are stored offset into positive space (`+90` / `+180`)
because SQLite's `CAST(... AS INTEGER)` truncates toward zero instead of
flooring, which would make cell boundaries inconsistent across the meridian.

Refreshes replace a dataset inside a single transaction, and a response that
yields zero usable records is rejected — a reshaped or empty upstream response
can never wipe a good cache.

Sync state lives in a module-level store (`src/data/sync-store.ts`) read through
`useSyncExternalStore`, not in per-screen state. Both the map and the About tab
observe it, concurrent callers share one in-flight run, and the startup sync is
triggered once from the root layout — so switching tabs never re-downloads
anything.

## Data sources

| Dataset | Records | Publisher | Licence |
| --- | --- | --- | --- |
| Desfibriladores externos fuera del ámbito sanitario | 12,296 | Comunidad de Madrid | CC BY 4.0 |
| Bibliotecas de Madrid | 52 | Ayuntamiento de Madrid | CC BY 4.0 |
| Instalaciones deportivas básicas municipales | 606 | Ayuntamiento de Madrid | CC BY 4.0 |
| Mercados municipales | 45 | Ayuntamiento de Madrid | CC BY 4.0 |
| Centros municipales de mayores | 94 | Ayuntamiento de Madrid | CC BY 4.0 |
| Fuentes de agua para beber | 2,239 | Ayuntamiento de Madrid | CC BY 4.0 |

Note the mixed geographic scope: the AED register is **regional** (all of the
Comunidad de Madrid), while the four facility catalogues are **city only**.
Someone in Alcobendas sees defibrillators but no libraries.

Attribution is also shown in-app on the About tab and in each detail sheet.

> In an emergency call **112**. Availability of any listed defibrillator is not
> guaranteed.

## Adding a dataset

Most Ayuntamiento facility catalogues (day centres, municipal car parks, health
centres…) share one JSON-LD schema, so they need no new parsing code at all —
just another `createGraphDataset({ ... })` entry in
`src/data/datasets/index.ts` with its URL and category.

For a feed with its own shape:

1. Create `src/data/datasets/<name>.ts` exporting a `DatasetDescriptor`.
2. Register it in `src/data/datasets/index.ts`.
3. Flip the category to `available: true` in `src/constants/categories.ts`,
   adding a new one if needed.
4. Add `categories.<id>` and `datasets.<id>` strings to both locale files.

No changes to the map, list, sync engine or storage layer are required.
