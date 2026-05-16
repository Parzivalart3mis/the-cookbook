import { auth } from '@clerk/nextjs/server';

type UnsplashPhoto = {
  id: string;
  urls: { regular: string; small: string };
  user: { name: string; links: { html: string } };
  links: { download_location: string };
};

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  if (!query) return Response.json({ photos: [] });

  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=6&content_filter=high`,
    { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
  );

  if (!res.ok) return Response.json({ photos: [] });
  const data = await res.json();

  const photos = (data.results as UnsplashPhoto[]).map((p) => ({
    id: p.id,
    url: p.urls.regular,
    thumb: p.urls.small,
    photographer: p.user.name,
    photographerUrl: p.user.links.html,
    downloadLocation: p.links.download_location,
  }));

  return Response.json({ photos });
}
