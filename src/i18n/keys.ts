import type { es } from '@/i18n/locales/es';

/**
 * Types derived from the Spanish strings, which are the reference locale. Kept
 * free of runtime imports so the data layer can name translation keys without
 * pulling in React Native.
 */

/** A plural entry: `{ one, other }`, selected by the `count` option. */
type PluralForms = { readonly one?: string; readonly other: string };

type Widen<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : Widen<T[K]>;
};

/**
 * The shape every locale must match exactly: same namespaces, same keys, same
 * plural entries. Use as `export const en = { ... } as const satisfies Translations`.
 */
export type Translations = Widen<typeof es>;

type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string | PluralForms
    ? K
    : `${K}.${Leaves<T[K]>}`;
}[keyof T & string];

/** Every translatable key, e.g. `'map.title'` or `'sync.recordCount'`. */
export type TranslationKey = Leaves<Translations>;
