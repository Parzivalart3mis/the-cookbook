import { auth } from '@clerk/nextjs/server';

const NOTION_VERSION = '2022-06-28';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { pageId, imageUrl, downloadLocation } = await req.json();

  // Unsplash requires triggering the download endpoint when an image is chosen
  if (downloadLocation && process.env.UNSPLASH_ACCESS_KEY) {
    fetch(`${downloadLocation}?client_id=${process.env.UNSPLASH_ACCESS_KEY}`).catch(() => {});
  }

  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({
      properties: {
        'Cover Image': imageUrl ? { url: imageUrl } : { url: null },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return Response.json({ error: text }, { status: res.status });
  }

  return Response.json({ ok: true });
}
