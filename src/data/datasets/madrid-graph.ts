import type { CategoryId } from '@/constants/categories';
import { isWithinMadrid } from '@/constants/geo';
import { clean, humanizeSlug, titleCaseSpanish } from '@/data/text';
import type { DatasetDescriptor, ResourceRecord } from '@/data/types';

/**
 * The Ayuntamiento de Madrid publishes most of its facility catalogues —
 * libraries, sports centres, markets, senior centres, day centres, car parks —
 * as JSON-LD with a byte-identical schema. One descriptor factory therefore
 * covers all of them; adding another is a matter of supplying a URL and a
 * category.
 */
type GraphEntity = {
  '@id'?: string;
  id?: string;
  title?: string;
  /** Canonical madrid.es page for the facility. */
  relation?: string;
  address?: {
    district?: { '@id'?: string };
    area?: { '@id'?: string };
    locality?: string;
    'postal-code'?: string;
    'street-address'?: string;
  };
  location?: { latitude?: number; longitude?: number };
  organization?: {
    'organization-desc'?: string;
    /**
     * An undocumented numeric code ("0", "1", "2", "1,5,6"). Deliberately not
     * surfaced: guessing at accessibility semantics and getting them wrong
     * would mislead exactly the people who most depend on them being right.
     */
    accesibility?: string;
    schedule?: string;
    services?: string;
    'organization-name'?: string;
  };
};

export type GraphDatasetConfig = {
  id: string;
  category: CategoryId;
  /** i18n key for the dataset's plural name. */
  labelKey: string;
  /** i18n key for the singular "type" chip in the detail sheet. */
  typeLabelKey: string;
  downloadUrl: string;
  datasetTitle: string;
  sourceUrl: string;
};

/** Pulls the label out of a taxonomy URI: ".../Distrito/Latina" -> "Latina". */
function labelFromTaxonomyUri(uri: string | undefined): string | null {
  const slug = clean(uri)?.split('/').filter(Boolean).pop();
  if (!slug) return null;
  // Some records have a truncated URI ending at the taxonomy name itself,
  // which carries no district information.
  if (slug === 'Distrito' || slug === 'Barrio') return null;
  return humanizeSlug(slug);
}

export function createGraphDataset(
  config: GraphDatasetConfig,
): DatasetDescriptor<GraphEntity> {
  return {
    id: config.id,
    category: config.category,
    labelKey: config.labelKey,
    typeLabelKey: config.typeLabelKey,
    // The free-text field on these feeds lists what the facility offers,
    // rather than where inside a building it sits.
    detailLabelKey: 'detail.services',
    downloadUrl: config.downloadUrl,
    attribution: {
      publisher: 'Ayuntamiento de Madrid',
      datasetTitle: config.datasetTitle,
      sourceUrl: config.sourceUrl,
      license: 'CC BY 4.0',
    },

    extract(payload) {
      if (Array.isArray(payload)) return payload as GraphEntity[];
      const graph = (payload as { '@graph'?: unknown } | null)?.['@graph'];
      return Array.isArray(graph) ? (graph as GraphEntity[]) : [];
    },

    normalize(row, seenKeys) {
      const latitude = row.location?.latitude;
      const longitude = row.location?.longitude;
      if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        !isWithinMadrid(latitude, longitude)
      ) {
        return null;
      }

      const name = clean(row.title) ?? clean(row.organization?.['organization-name']);
      if (!name) return null;

      const baseKey =
        clean(row.id) ??
        clean(row['@id'])?.split('/').pop() ??
        `${latitude},${longitude}`;
      let key = baseKey;
      for (let dup = 2; seenKeys.has(key); dup += 1) key = `${baseKey}#${dup}`;
      seenKeys.add(key);

      const address = row.address ?? {};
      const street = clean(address['street-address']);
      const district = labelFromTaxonomyUri(address.district?.['@id']);
      const locationLine = [
        street ? titleCaseSpanish(street) : null,
        district,
      ].filter(Boolean).join(', ');

      const record: ResourceRecord = {
        id: `${config.id}:${key}`,
        datasetId: config.id,
        category: config.category,
        name,
        latitude,
        longitude,
        address: locationLine || null,
        // Services are the more useful of the two free-text fields; the
        // description is a reasonable fallback (it often carries transit hints).
        detail:
          clean(row.organization?.services) ??
          clean(row.organization?.['organization-desc']),
        schedule: clean(row.organization?.schedule),
        postalCode: clean(address['postal-code']),
        // Every row in one of these feeds is the same kind of thing, so the
        // type is a property of the dataset, not of the record.
        subtype: null,
        url: clean(row.relation),
      };
      return record;
    },
  };
}
