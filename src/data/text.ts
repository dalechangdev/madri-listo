/**
 * Text normalisation shared by dataset descriptors.
 *
 * Madrid's open data is entered by many hands over many years: expect caps
 * lock, doubled spaces, and street names glued into URL slugs.
 */

/** Trims, collapses runs of whitespace, and maps empty strings to null. */
export function clean(value: string | undefined | null): string | null {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed : null;
}

/** "CALLE" -> "Calle". Leaves the rest of the string alone. */
export function titleCaseWord(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/**
 * Spanish particles that stay lowercase inside a name — but never as the
 * first word, where they are still capitalised ("Las Águilas").
 */
const PARTICLES = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'en', 'a', 'al', 'con',
]);

/**
 * Converts SHOUTED names to title case with Spanish capitalisation rules:
 * "AVENIDA DE LA ALBUFERA 33" -> "Avenida de la Albufera 33".
 *
 * Tokens that aren't plain words (house numbers, "C/", roman numerals) are
 * passed through untouched.
 */
export function titleCaseSpanish(value: string): string {
  return value
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (!/[a-záéíóúüñ]/.test(word)) return word;
      if (index > 0 && PARTICLES.has(word)) return word;
      // Capitalise after a hyphen too: "fuencarral-el pardo".
      return word.replace(/(^|-)([a-záéíóúüñ])/g, (_, sep: string, ch: string) =>
        sep + ch.toUpperCase(),
      );
    })
    .join(' ');
}

/**
 * Much of the DEA register is typed in caps lock ("PLANTA BAJA - RECEPCIÓN").
 * Shouting at the user is worse than losing the original casing, so fold
 * all-caps values down to sentence case. Mixed-case values are left alone.
 */
export function softenCaps(value: string): string {
  const hasLowercase = value !== value.toUpperCase();
  if (hasLowercase) return value;
  const lowered = value.toLowerCase();
  return lowered.charAt(0).toUpperCase() + lowered.slice(1);
}

/**
 * Turns the trailing segment of a datos.madrid.es taxonomy URI into a label:
 * ".../Distrito/PuenteDeVallecas" -> "Puente de Vallecas".
 */
export function humanizeSlug(slug: string): string {
  const spaced = slug
    // CamelCase -> spaced words, including across accented characters.
    .replace(/([a-záéíóúüñ0-9])([A-ZÁÉÍÓÚÜÑ])/g, '$1 $2');
  return titleCaseSpanish(spaced);
}
