/**
 * Resource resolution for the datos.madrid.es CKAN catalogue.
 *
 * Some datasets publish their *current* extract under a timestamped filename
 * (`300051_20260831_055308.json`) that changes every time the city republishes,
 * while the stable-looking resource names hold year-end archives. Hardcoding a
 * URL for those datasets is therefore wrong two ways: it either breaks on the
 * next publish, or it silently pins the app to last year's data.
 */
const CKAN_API = 'https://datos.madrid.es/api/3/action';

type CkanResource = {
  url?: string;
  format?: string;
  created?: string;
  last_modified?: string | null;
};

/** Newest-first ordering key; missing timestamps sort last. */
function publishedAt(resource: CkanResource): number {
  const stamp = resource.last_modified ?? resource.created;
  const parsed = stamp ? Date.parse(stamp) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Returns a resolver that asks the catalogue for the most recently published
 * resource of `format` in a package.
 *
 * Callers should treat a rejection as non-fatal and fall back to the
 * descriptor's `downloadUrl`: the portal rate-limits aggressively, and a stale
 * URL that still works beats no data at all.
 */
export function resolveLatestCkanResource(
  packageId: string,
  format = 'JSON',
): () => Promise<string> {
  return async () => {
    const response = await fetch(
      `${CKAN_API}/package_show?id=${encodeURIComponent(packageId)}`,
    );
    if (!response.ok) {
      throw new Error(`CKAN package_show ${response.status} for ${packageId}`);
    }
    const body = (await response.json()) as {
      result?: { resources?: CkanResource[] };
    };
    const candidates = (body.result?.resources ?? []).filter(
      (resource) =>
        typeof resource.url === 'string' &&
        (resource.format ?? '').toUpperCase() === format.toUpperCase(),
    );
    if (candidates.length === 0) {
      throw new Error(`No ${format} resource in CKAN package ${packageId}`);
    }
    candidates.sort((a, b) => publishedAt(b) - publishedAt(a));
    return candidates[0].url as string;
  };
}
