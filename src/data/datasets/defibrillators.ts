import { isWithinMadrid } from '@/constants/geo';
import { clean, softenCaps, titleCaseWord } from '@/data/text';
import type { DatasetDescriptor, ResourceRecord } from '@/data/types';

/**
 * "Desfibriladores externos fuera del ámbito sanitario" — the register of
 * public-access AEDs published by the Comunidad de Madrid.
 *
 * Note the scope: this is a *regional* register, so it covers Madrid city plus
 * the surrounding municipalities. We keep every row with usable coordinates
 * rather than clipping to the city boundary, since a defibrillator two streets
 * outside the city line is still the nearest one to a user standing there.
 */
const DOWNLOAD_URL =
  'https://datos.comunidad.madrid/dataset/d2478503-a4ae-4753-9540-9200071803c4/resource/42d08814-3361-4c2a-93fe-36664abc7953/download/desfibriladores_externos_fuera_ambito_sanitario.json';

type DeaRow = {
  tipo_establecimiento?: string;
  tipo_titularidad?: string;
  municipio_nombre?: string;
  direccion_via_codigo?: string;
  direccion_via_nombre?: string;
  direccion_portal_numero?: string;
  direccion_piso?: string;
  direccion_puerta?: string;
  direccion_codigo_postal?: string;
  direccion_ubicacion?: string;
  direccion_longitud?: string;
  direccion_latitud?: string;
  horario_acceso?: string;
  codigo_dea?: string;
};

/**
 * The feed writes decimals in the Spanish convention ("40,4468"), which
 * `Number()` rejects. Returns null for blank or unparseable values.
 */
export function parseSpanishFloat(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildStreetLine(row: DeaRow): string | null {
  const viaType = clean(row.direccion_via_codigo);
  const viaName = clean(row.direccion_via_nombre);
  if (!viaName) return null;
  const prefix = viaType ? `${titleCaseWord(viaType)} ` : '';
  const number = clean(row.direccion_portal_numero);
  return `${prefix}${viaName}${number ? `, ${number}` : ''}`;
}

function buildPlacementDetail(row: DeaRow): string | null {
  const placement = clean(row.direccion_ubicacion);
  const parts: string[] = [];
  if (placement) parts.push(softenCaps(placement));

  // The floor/door columns frequently repeat what the free-text placement
  // already says ("PLANTA BAJA" + piso "baja"), so only add them when they
  // contribute something new.
  const haystack = (placement ?? '').toLowerCase();
  const floor = clean(row.direccion_piso);
  if (floor && !haystack.includes(floor.toLowerCase())) {
    parts.push(`planta ${floor.toLowerCase()}`);
  }
  const door = clean(row.direccion_puerta);
  if (door && !haystack.includes(door.toLowerCase())) {
    parts.push(`puerta ${door.toLowerCase()}`);
  }

  return parts.length ? parts.join(' · ') : null;
}

export const defibrillatorsDataset: DatasetDescriptor<DeaRow> = {
  id: 'dea',
  category: 'defibrillator',
  labelKey: 'datasets.dea',
  typeLabelKey: 'types.dea',
  sourceLanguage: 'es',
  downloadUrl: DOWNLOAD_URL,
  attribution: {
    publisher: 'Comunidad de Madrid',
    datasetTitle: 'Desfibriladores externos fuera del ámbito sanitario',
    sourceUrl:
      'https://datos.comunidad.madrid/dataset/d2478503-a4ae-4753-9540-9200071803c4',
    license: 'CC BY 4.0',
  },

  extract(payload) {
    // The endpoint wraps rows in `{ "data": [...] }`, but tolerate a bare array
    // in case the publisher ever flattens it.
    if (Array.isArray(payload)) return payload as DeaRow[];
    const data = (payload as { data?: unknown } | null)?.data;
    return Array.isArray(data) ? (data as DeaRow[]) : [];
  },

  normalize(row, seenKeys) {
    const latitude = parseSpanishFloat(row.direccion_latitud);
    const longitude = parseSpanishFloat(row.direccion_longitud);
    if (latitude === null || longitude === null) return null;
    if (!isWithinMadrid(latitude, longitude)) return null;

    // `codigo_dea` is *almost* unique — the live feed currently has one
    // collision — so suffix repeats instead of silently dropping a device.
    const baseKey = clean(row.codigo_dea) ?? `${latitude},${longitude}`;
    let key = baseKey;
    for (let dup = 2; seenKeys.has(key); dup += 1) key = `${baseKey}#${dup}`;
    seenKeys.add(key);

    const streetLine = buildStreetLine(row);
    const municipality = clean(row.municipio_nombre);
    const postalCode = clean(row.direccion_codigo_postal);
    const locality = [postalCode, municipality].filter(Boolean).join(' ');

    const record: ResourceRecord = {
      id: `dea:${key}`,
      datasetId: 'dea',
      category: 'defibrillator',
      name: streetLine ?? clean(row.tipo_establecimiento),
      latitude,
      longitude,
      address: locality || null,
      detail: buildPlacementDetail(row),
      schedule: clean(row.horario_acceso),
      postalCode,
      subtype: clean(row.tipo_establecimiento),
      url: null,
    };
    return record;
  },
};
