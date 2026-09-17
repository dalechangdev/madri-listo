import { defibrillatorsDataset } from '@/data/datasets/defibrillators';
import { createGraphDataset } from '@/data/datasets/madrid-graph';
import { resolveLatestCkanResource } from '@/data/datasets/ckan';
import { createUrbanFurnitureDataset } from '@/data/datasets/madrid-urban-furniture';
import type { DatasetDescriptor } from '@/data/types';

const CITY_DATASET = 'https://datos.madrid.es/dataset';

/**
 * Facility catalogues published by the Ayuntamiento in a shared JSON-LD
 * schema. Adding another (day centres, municipal car parks, health centres…)
 * needs only a new entry here.
 */
const librariesDataset = createGraphDataset({
  id: 'libraries',
  category: 'library',
  labelKey: 'datasets.libraries',
  typeLabelKey: 'types.library',
  downloadUrl: `${CITY_DATASET}/201747-0-bibliobuses-bibliotecas/resource/201747-2-bibliobuses-bibliotecas-json/download/201747-0-bibliobuses-bibliotecas.json`,
  datasetTitle: 'Bibliotecas de Madrid',
  sourceUrl: `${CITY_DATASET}/201747-0-bibliobuses-bibliotecas`,
});

const sportsDataset = createGraphDataset({
  id: 'sports',
  category: 'sports',
  labelKey: 'datasets.sports',
  typeLabelKey: 'types.sports',
  downloadUrl: `${CITY_DATASET}/200215-0-instalaciones-deportivas/resource/200215-1-instalaciones-deportivas-json/download/200215-0-instalaciones-deportivas.json`,
  datasetTitle: 'Deportes. Instalaciones deportivas básicas municipales',
  sourceUrl: `${CITY_DATASET}/200215-0-instalaciones-deportivas`,
});

const marketsDataset = createGraphDataset({
  id: 'markets',
  category: 'market',
  labelKey: 'datasets.markets',
  typeLabelKey: 'types.market',
  downloadUrl: `${CITY_DATASET}/200967-0-mercados/resource/200967-0-mercados-json/download/200967-0-mercados.json`,
  datasetTitle: 'Mercados municipales',
  sourceUrl: `${CITY_DATASET}/200967-0-mercados`,
});

const seniorCentresDataset = createGraphDataset({
  id: 'seniors',
  category: 'seniors',
  labelKey: 'datasets.seniors',
  typeLabelKey: 'types.seniors',
  downloadUrl: `${CITY_DATASET}/200337-0-centros-mayores/resource/200337-1-centros-mayores-json/download/200337-0-centros-mayores.json`,
  datasetTitle: 'Centros municipales de mayores',
  sourceUrl: `${CITY_DATASET}/200337-0-centros-mayores`,
});

/**
 * "Mobiliario urbano" feeds: flat rows with UTM fallbacks and a status column.
 */
const fountainsDataset = createUrbanFurnitureDataset({
  id: 'fountains',
  category: 'fountain',
  labelKey: 'datasets.fountains',
  typeLabelKey: 'types.fountain',
  // The current extract carries a publish timestamp in its filename, so the
  // real URL is resolved from the catalogue at sync time; this is only the
  // fallback. The stable-looking resource names hold year-end archives.
  downloadUrl: `${CITY_DATASET}/300051-0-fuentes/resource/300051-0-fuentes/download/300051_20260831_055308.json`,
  resolveDownloadUrl: resolveLatestCkanResource('300051-0-fuentes'),
  datasetTitle: 'Fuentes de agua para beber',
  sourceUrl: `${CITY_DATASET}/300051-0-fuentes`,
  // Pet-only bowls live in this feed too and must not be offered as drinking
  // water for people.
  allowedUso: ['PERSONAS', 'PERSONAS_Y_MASCOTAS'],
  operationalOnly: true,
});

/**
 * Every dataset the app knows how to ingest. Register new Madrid feeds here —
 * the sync engine, storage layer and UI all read from this list.
 */
export const DATASETS: DatasetDescriptor<any>[] = [
  defibrillatorsDataset,
  librariesDataset,
  sportsDataset,
  marketsDataset,
  seniorCentresDataset,
  fountainsDataset,
];

export function getDataset(id: string): DatasetDescriptor<any> | undefined {
  return DATASETS.find((dataset) => dataset.id === id);
}
