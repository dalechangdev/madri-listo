import type { CategoryId } from '@/constants/categories';
import { isWithinMadrid } from '@/constants/geo';
import { clean, titleCaseSpanish } from '@/data/text';
import type { DatasetDescriptor, ResourceRecord } from '@/data/types';
import { utmToLatLon } from '@/data/utm';

/**
 * The "mobiliario urbano" family of city feeds — drinking fountains, pet
 * fountains, children's play areas, outdoor gyms — all share one flat schema.
 * As with the JSON-LD facility catalogues, one factory covers the family.
 */
type FurnitureRow = {
  ID?: string;
  DESC_CLASIFICACION?: string;
  BARRIO?: string;
  DISTRITO?: string;
  /** OPERATIVO | FUERA_DE_SERVICIO | CERRADA_TEMPORALMENT | NO_PREPARADO */
  ESTADO?: string;
  COORD_GIS_X?: string;
  COORD_GIS_Y?: string;
  SISTEMA_COORD?: string;
  LATITUD?: number | null;
  LONGITUD?: number | null;
  TIPO_VIA?: string | null;
  NOM_VIA?: string | null;
  NUM_VIA?: string | null;
  COD_POSTAL?: string | null;
  DIRECCION_AUX?: string | null;
  /** ZV = zona verde (park), VP = vía pública (street). */
  UBICACION?: string | null;
  /** PERSONAS | PERSONAS_Y_MASCOTAS | MASCOTAS */
  USO?: string | null;
  MODELO?: string | null;
};

export type UrbanFurnitureConfig = {
  id: string;
  category: CategoryId;
  labelKey: string;
  typeLabelKey: string;
  downloadUrl: string;
  resolveDownloadUrl?: () => Promise<string>;
  datasetTitle: string;
  sourceUrl: string;
  /**
   * Permitted `USO` values. The drinking-water feed also carries pet-only
   * bowls, which must not be presented as drinking water for people.
   */
  allowedUso?: readonly string[];
  /**
   * Drop anything not `OPERATIVO`. Directing someone across town to a fountain
   * that is switched off is worse than not listing it at all.
   */
  operationalOnly?: boolean;
};

/** Models whose name states, unambiguously, that the unit is accessible. */
const ACCESSIBLE_MODEL = 'FUENTE_ACCESIBLE';

/**
 * Feature labels are stored in Spanish, matching the rest of the record
 * content (schedules, service lists and titles all come through untranslated).
 * Only the UI chrome around them is localised.
 */
const FEATURE_GREEN_SPACE = 'Zona verde';
const FEATURE_PUBLIC_WAY = 'Vía pública';
const FEATURE_ACCESSIBLE = 'Modelo accesible';
const FEATURE_PETS = 'Apta para mascotas';

/**
 * Resolves a usable position, falling back to the UTM columns when the
 * geographic ones are null — which they are for ~12% of the fountain feed.
 */
function resolveCoordinates(row: FurnitureRow) {
  if (typeof row.LATITUD === 'number' && typeof row.LONGITUD === 'number') {
    return { latitude: row.LATITUD, longitude: row.LONGITUD };
  }
  // Every row in these feeds declares ETRS89; refuse anything else rather than
  // silently misprojecting it.
  if (clean(row.SISTEMA_COORD) !== 'ETRS89') return null;
  const easting = Number(row.COORD_GIS_X);
  const northing = Number(row.COORD_GIS_Y);
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;
  return utmToLatLon(easting, northing);
}

/** "CALLE" + "MUELA DE SAN JUAN" + "5" -> "Calle Muela de San Juan, 5". */
function buildStreetLine(row: FurnitureRow): string | null {
  const viaName = clean(row.NOM_VIA);
  if (!viaName) return null;
  const viaType = clean(row.TIPO_VIA);
  // Casing is inconsistent across rows ("CALLE" and "Avenida" both occur), and
  // the type is sometimes already repeated inside the name.
  const prefix =
    viaType && !viaName.toLowerCase().startsWith(viaType.toLowerCase())
      ? `${viaType} `
      : '';
  // Title-case only the street name; the number is left alone so that "SN"
  // (sin número) doesn't come out as "Sn".
  const street = titleCaseSpanish(`${prefix}${viaName}`.trim());
  const number = clean(row.NUM_VIA);
  if (!number) return street;
  const printed = /^s\/?n$/i.test(number) ? 's/n' : number;
  return `${street}, ${printed}`;
}

function buildFeatures(row: FurnitureRow): string | null {
  const features: string[] = [];
  const placement = clean(row.UBICACION);
  if (placement === 'ZV') features.push(FEATURE_GREEN_SPACE);
  else if (placement === 'VP') features.push(FEATURE_PUBLIC_WAY);
  if (clean(row.MODELO) === ACCESSIBLE_MODEL) features.push(FEATURE_ACCESSIBLE);
  if (clean(row.USO) === 'PERSONAS_Y_MASCOTAS') features.push(FEATURE_PETS);
  return features.length ? features.join(' · ') : null;
}

export function createUrbanFurnitureDataset(
  config: UrbanFurnitureConfig,
): DatasetDescriptor<FurnitureRow> {
  return {
    id: config.id,
    category: config.category,
    labelKey: config.labelKey,
    typeLabelKey: config.typeLabelKey,
    detailLabelKey: 'detail.features',
    downloadUrl: config.downloadUrl,
    resolveDownloadUrl: config.resolveDownloadUrl,
    attribution: {
      publisher: 'Ayuntamiento de Madrid',
      datasetTitle: config.datasetTitle,
      sourceUrl: config.sourceUrl,
      license: 'CC BY 4.0',
    },

    extract(payload) {
      if (Array.isArray(payload)) return payload as FurnitureRow[];
      const data = (payload as { data?: unknown } | null)?.data;
      if (Array.isArray(data)) return data as FurnitureRow[];
      // The wrapper key is not consistent across this family of feeds, so fall
      // back to the first array-valued property.
      const values = Object.values((payload as object | null) ?? {});
      const first = values.find(Array.isArray);
      return (first as FurnitureRow[]) ?? [];
    },

    normalize(row, seenKeys) {
      if (config.operationalOnly && clean(row.ESTADO) !== 'OPERATIVO') {
        return null;
      }
      if (config.allowedUso && !config.allowedUso.includes(clean(row.USO) ?? '')) {
        return null;
      }

      const coords = resolveCoordinates(row);
      if (!coords || !isWithinMadrid(coords.latitude, coords.longitude)) {
        return null;
      }

      const baseKey =
        clean(row.ID) ?? `${coords.latitude},${coords.longitude}`;
      let key = baseKey;
      for (let dup = 2; seenKeys.has(key); dup += 1) key = `${baseKey}#${dup}`;
      seenKeys.add(key);

      const district = clean(row.DISTRITO);
      const record: ResourceRecord = {
        id: `${config.id}:${key}`,
        datasetId: config.id,
        category: config.category,
        // These feeds carry no per-item name — every row's classification is
        // the same Spanish label — so the street line is what actually
        // identifies one. Without it the UI falls back to the translated type.
        name: buildStreetLine(row),
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: [clean(row.COD_POSTAL), district ? titleCaseSpanish(district) : null]
          .filter(Boolean)
          .join(' ') || null,
        detail: buildFeatures(row),
        schedule: null,
        postalCode: clean(row.COD_POSTAL),
        subtype: null,
        url: null,
      };
      return record;
    },
  };
}
