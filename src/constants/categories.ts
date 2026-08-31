/**
 * Catalogue of resource categories the app can display.
 *
 * Adding a new Madrid dataset means adding a category here and a descriptor in
 * `src/data/datasets/`. Nothing in the UI needs to know about specific datasets.
 */
export const CATEGORY_IDS = [
  'defibrillator',
  'bus',
  'metro',
  'picnic',
  'fountain',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export type CategoryMeta = {
  id: CategoryId;
  /** Key into the i18n `categories` namespace. */
  labelKey: string;
  /** Marker tint, used for both pins and cluster bubbles. */
  color: string;
  /** Short glyph drawn inside the marker. Keeps us free of an icon font. */
  glyph: string;
  /** False until a dataset descriptor is registered for it. */
  available: boolean;
};

export const CATEGORIES: Record<CategoryId, CategoryMeta> = {
  defibrillator: {
    id: 'defibrillator',
    labelKey: 'categories.defibrillator',
    color: '#E5484D',
    glyph: '♥',
    available: true,
  },
  bus: {
    id: 'bus',
    labelKey: 'categories.bus',
    color: '#0090FF',
    glyph: '🚌',
    available: false,
  },
  metro: {
    id: 'metro',
    labelKey: 'categories.metro',
    color: '#8E4EC6',
    glyph: 'Ⓜ',
    available: false,
  },
  picnic: {
    id: 'picnic',
    labelKey: 'categories.picnic',
    color: '#46A758',
    glyph: '⛱',
    available: false,
  },
  fountain: {
    id: 'fountain',
    labelKey: 'categories.fountain',
    color: '#00A2C7',
    glyph: '💧',
    available: false,
  },
};

export const AVAILABLE_CATEGORIES = CATEGORY_IDS.filter(
  (id) => CATEGORIES[id].available,
);
