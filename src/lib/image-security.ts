/** Unsplash download tracking is the only allowed server-side image fetch. */
export function unsplashDownloadUrl(value: unknown): URL | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'api.unsplash.com' || url.port || url.username || url.password || url.hash || !/^\/photos\/[A-Za-z0-9_-]+\/download$/.test(url.pathname)) return null;
    const entries = [...url.searchParams.entries()];
    if (entries.length > 1 || entries.some(([key, value]) => key !== 'ixid' || !/^[A-Za-z0-9_+/=-]{1,2048}$/.test(value))) return null;
    return url;
  } catch { return null; }
}

export function validImageUrl(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}
