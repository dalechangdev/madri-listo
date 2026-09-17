import { CATEGORIES, type CategoryId } from '@/constants/categories';
import { getDataset } from '@/data/datasets';
import type { Translator } from '@/i18n';

type Titled = { name: string | null; datasetId: string; category: CategoryId };

/**
 * The headline for a resource. Records the source left unnamed fall back to
 * their dataset's type label ("Drinking fountain"), which, unlike anything
 * stored at sync time, follows the current UI language.
 */
export function resourceTitle(resource: Titled, t: Translator['t']): string {
  if (resource.name) return resource.name;
  const typeLabelKey = getDataset(resource.datasetId)?.typeLabelKey;
  return t(typeLabelKey ?? CATEGORIES[resource.category].labelKey);
}
