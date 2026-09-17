import type { TranslationKey } from '@/i18n/keys';

/**
 * Catalogue of resource categories the app can display.
 *
 * Adding a new Madrid dataset means adding a category here and a descriptor in
 * `src/data/datasets/`. Nothing in the UI needs to know about specific datasets.
 */
export const CATEGORY_IDS = [
  'defibrillator',
  'library',
  'sports',
  'market',
  'seniors',
  'bus',
  'metro',
  'picnic',
  'fountain',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export type CategoryMeta = {
  id: CategoryId;
  /** Key into the i18n `categories` namespace. */
  labelKey: TranslationKey;
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
  library: {
    id: 'library',
    labelKey: 'categories.library',
    color: '#8E4EC6',
    glyph: '📚',
    available: true,
  },
  sports: {
    id: 'sports',
    labelKey: 'categories.sports',
    color: '#46A758',
    glyph: '⚽',
    available: true,
  },
  market: {
    id: 'market',
    labelKey: 'categories.market',
    color: '#F76B15',
    glyph: '🛒',
    available: true,
  },
  seniors: {
    id: 'seniors',
    labelKey: 'categories.seniors',
    color: '#0D9488',
    glyph: '🧓',
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
    color: '#D6409F',
    glyph: 'Ⓜ',
    available: false,
  },
  picnic: {
    id: 'picnic',
    labelKey: 'categories.picnic',
    color: '#A18072',
    glyph: '⛱',
    available: false,
  },
  fountain: {
    id: 'fountain',
    labelKey: 'categories.fountain',
    color: '#00A2C7',
    glyph: '💧',
    available: true,
  },
};

export const AVAILABLE_CATEGORIES = CATEGORY_IDS.filter(
  (id) => CATEGORIES[id].available,
);
