import type { Translations } from '@/i18n/keys';

export const en = {
  tabs: { map: 'Map', nearby: 'Nearby', about: 'About' },
  categories: {
    defibrillator: 'Defibrillators',
    library: 'Libraries',
    sports: 'Sport',
    market: 'Markets',
    seniors: 'Senior centres',
    bus: 'Buses',
    metro: 'Metro',
    picnic: 'Picnic tables',
    fountain: 'Fountains',
  },
  datasets: {
    dea: 'Defibrillators (AED)',
    libraries: 'Madrid public libraries',
    sports: 'Basic municipal sports facilities',
    markets: 'Municipal markets',
    seniors: 'Municipal senior centres',
    fountains: 'Drinking water fountains',
  },
  types: {
    dea: 'Defibrillator',
    library: 'Public library',
    sports: 'Basic sports facility',
    market: 'Municipal market',
    seniors: 'Municipal senior centre',
    fountain: 'Drinking fountain',
  },
  map: {
    title: 'Madrid resources',
    locate: 'My location',
    resultsInView: '{{count}} in view',
    /** Screen-reader label for a cluster bubble, e.g. "Libraries: 12". */
    clusterLabel: '{{category}}: {{count}}',
    zoomToExpand: 'Zoom in to see individual points',
  },
  nearby: {
    title: 'Near you',
    empty: 'No resources nearby yet.',
    needsLocation: 'Turn on location to see the closest resources.',
    enableLocation: 'Allow location',
    distanceMeters: '{{value}} m',
    distanceKilometers: '{{value}} km',
  },
  detail: {
    schedule: 'Opening hours',
    placement: 'Exact location',
    features: 'Features',
    services: 'Services',
    type: 'Type',
    moreInfo: 'More information on madrid.es',
    directions: 'Directions',
    close: 'Close',
    source: 'Source',
  },
  sync: {
    downloading: 'Downloading open data…',
    parsing: 'Processing records…',
    storing: 'Saving to your device…',
    inProgress: 'Updating data…',
    failed: 'Could not update the data',
    retry: 'Retry',
    showingSaved: "Some data couldn't be updated. Showing saved data.",
    lastUpdated: 'Updated {{date}}',
    refresh: 'Refresh data',
    recordCount: {
      one: '{{count}} record stored',
      other: '{{count}} records stored',
    },
  },
  about: {
    title: 'About',
    intro:
      'MadriListo brings together open data from the Madrid city council and region to help you find public resources near you.',
    sources: 'Data sources',
    disclaimer:
      'In an emergency call 112. The availability of a defibrillator is not guaranteed.',
  },
} as const satisfies Translations;
