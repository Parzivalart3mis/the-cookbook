'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, PlayCircle } from 'lucide-react';

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) {
      return u.searchParams.get('v') ?? u.pathname.split('/').pop() ?? null;
    }
  } catch {}
  return null;
}

export default function SourcePreview({ url }: { url: string }) {
  const ytId = getYouTubeId(url);
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!ytId) return;
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
      .then(r => r.json())
      .then(d => setTitle(d.title ?? null))
      .catch(() => {});
  }, [url, ytId]);

  if (ytId) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-red-500 hover:text-red-400 transition-colors duration-150 text-sm"
      >
        <PlayCircle size={14} />
        {title ?? 'Watch on YouTube'}
        <ExternalLink size={11} />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 hover:text-accent transition-colors duration-150"
    >
      Source
      <ExternalLink size={12} />
    </a>
  );
}
