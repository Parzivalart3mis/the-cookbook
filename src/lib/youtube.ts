/**
 * Real YouTube videos via the YouTube Data API v3. Links are never written by
 * the AI, since language models make up URLs.
 *
 * Quota: search.list costs 100 units and videos.list 1 unit, against a free
 * 10,000 units/day. Responses are cached (fetch Data Cache) for a few hours so
 * repeat views and refreshes of the same dish don't spend quota again.
 */
export type YouTubeVideo = {
  id: string;
  title: string;
  channel: string;
  url: string;
  thumbnail: string;
  views: number;
  publishedAt: string;
  durationSeconds: number | null;
};

const API = 'https://www.googleapis.com/youtube/v3';
const CACHE_SECONDS = 6 * 60 * 60;

export function youtubeConfigured(): boolean {
  return !!process.env.YOUTUBE_API_KEY?.trim();
}

/** Free fallback when there is no API key (or quota is spent). */
export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

async function call<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return null;
  const qs = new URLSearchParams({ ...params, key });
  try {
    const res = await fetch(`${API}/${path}?${qs}`, {
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      // 403 is usually "quotaExceeded"; callers fall back to a search link.
      console.error(`[youtube] ${path} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[youtube] ${path} failed`, err);
    return null;
  }
}

type SearchResponse = { items?: { id?: { videoId?: string } }[] };
type VideosResponse = {
  items?: {
    id: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: Record<string, { url: string }>;
    };
    statistics?: { viewCount?: string };
    contentDetails?: { duration?: string };
  }[];
};

/** ISO-8601 duration (PT1H2M3S) → seconds. */
function parseDuration(iso: string | undefined): number | null {
  const m = iso ? /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso) : null;
  if (!m) return null;
  const [, d, h, min, s] = m.map(v => Number(v ?? 0));
  return (d ?? 0) * 86400 + (h ?? 0) * 3600 + (min ?? 0) * 60 + (s ?? 0);
}

async function hydrate(ids: string[]): Promise<YouTubeVideo[]> {
  if (!ids.length) return [];
  const data = await call<VideosResponse>('videos', {
    part: 'snippet,statistics,contentDetails',
    id: ids.join(','),
    maxResults: String(ids.length),
  });
  return (data?.items ?? []).map(v => {
    const t = v.snippet?.thumbnails ?? {};
    return {
      id: v.id,
      title: v.snippet?.title ?? 'Untitled video',
      channel: v.snippet?.channelTitle ?? '',
      url: `https://www.youtube.com/watch?v=${v.id}`,
      thumbnail: (t.high ?? t.medium ?? t.default)?.url ?? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      views: Number(v.statistics?.viewCount ?? 0),
      publishedAt: v.snippet?.publishedAt ?? '',
      durationSeconds: parseDuration(v.contentDetails?.duration),
    };
  });
}

function baseSearchParams(): Record<string, string> {
  return {
    part: 'snippet',
    type: 'video',
    safeSearch: 'moderate',
    relevanceLanguage: 'en',
    regionCode: process.env.YOUTUBE_REGION?.trim() || 'US',
  };
}

/**
 * Most-watched videos for a dish: take the most relevant results, then rank
 * them by views. Sorting the whole search by views tends to surface popular but
 * off-topic videos.
 */
export async function popularVideosFor(
  query: string,
  limit = 3,
  keep: (v: YouTubeVideo) => boolean = () => true
): Promise<YouTubeVideo[]> {
  const search = await call<SearchResponse>('search', {
    ...baseSearchParams(),
    q: query,
    order: 'relevance',
    maxResults: '8',
  });
  const ids = (search?.items ?? []).map(i => i.id?.videoId).filter((id): id is string => !!id);
  const videos = (await hydrate(ids)).filter(keep);
  return videos.sort((a, b) => b.views - a.views).slice(0, limit);
}

/**
 * Recipe videos going viral right now: most viewed, published in the last two
 * weeks. `query` narrows them (e.g. "vegetarian Indian recipe"); `keep` drops
 * some by title, so a filtered search fetches more to choose from (same quota).
 */
export async function trendingRecipeVideos(
  limit = 9,
  { query = 'recipe', keep }: { query?: string; keep?: (v: YouTubeVideo) => boolean } = {}
): Promise<YouTubeVideo[]> {
  // Day-aligned so the cache key (URL) is stable for the whole day.
  const since = new Date(Date.now() - 14 * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  const search = await call<SearchResponse>('search', {
    ...baseSearchParams(),
    q: query,
    order: 'viewCount',
    publishedAfter: since.toISOString(),
    maxResults: String(keep ? 25 : Math.min(limit + 3, 25)),
  });
  const ids = (search?.items ?? []).map(i => i.id?.videoId).filter((id): id is string => !!id);
  const videos = await hydrate(ids);
  return (keep ? videos.filter(keep) : videos).sort((a, b) => b.views - a.views).slice(0, limit);
}
