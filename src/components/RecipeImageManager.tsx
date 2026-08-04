'use client';

import { useState } from 'react';
import { ImageIcon, X, Loader2, Check, Link, RefreshCw } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

type Photo = {
  id: string;
  url: string;
  thumb: string;
  photographer: string;
  photographerUrl: string;
  downloadLocation: string;
};

export default function RecipeImageManager({
  pageId,
  recipeName,
  hasImage,
}: {
  pageId: string;
  recipeName: string;
  hasImage: boolean;
}) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isSignedIn) return null;

  async function search() {
    setLoading(true);
    setPhotos([]);
    try {
      const res = await fetch(`/api/unsplash?q=${encodeURIComponent(recipeName + ' food dish')}`);
      const data = await res.json();
      setPhotos(data.photos ?? []);
    } catch {}
    setLoading(false);
  }

  function handleOpen() {
    setOpen(true);
    if (photos.length === 0) search();
  }

  async function save(imageUrl: string | null, downloadLocation?: string) {
    setSaving(true);
    await fetch('/api/recipe-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId, imageUrl, downloadLocation }),
    });
    setSaving(false);
    setOpen(false);
    setManualUrl('');
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center gap-3 mt-1">
        <button
          onClick={handleOpen}
          className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-accent transition-colors duration-150"
        >
          <ImageIcon size={12} />
          {hasImage ? 'Change image' : 'Add image'}
        </button>
        {hasImage && (
          <button
            onClick={() => save(null)}
            disabled={saving}
            className="text-xs text-ink-faint hover:text-red-400 transition-colors duration-150"
          >
            Remove
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-surface rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-ink">Recipe Image</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={search}
                  disabled={loading}
                  title="Search again"
                  aria-label="Search for another image"
                  className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-hover transition-colors"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-hover transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Unsplash grid */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-ink-faint">
                  <Loader2 size={20} className="animate-spin text-accent" />
                  <span className="text-xs">Searching Unsplash…</span>
                </div>
              ) : photos.length > 0 ? (
                <div>
                  <p className="text-xs text-ink-faint mb-2">
                    Photos from Unsplash — click to use
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => save(photo.url, photo.downloadLocation)}
                        disabled={saving}
                        className="relative aspect-video rounded-lg overflow-hidden group focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.thumb}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-150 flex items-center justify-center">
                          <Check
                            size={18}
                            className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                            strokeWidth={2.5}
                          />
                        </div>
                        <p className="absolute bottom-0 left-0 right-0 px-1.5 py-1 text-[9px] text-white/80 bg-gradient-to-t from-black/50 to-transparent truncate">
                          {photo.photographer}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-ink-faint">
                  No results — try a custom URL below
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-ink-faint">or paste a URL</span>
                <div className="flex-1 border-t border-border" />
              </div>

              {/* Manual URL */}
              <div className="flex gap-2">
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && manualUrl && save(manualUrl)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                />
                <button
                  onClick={() => manualUrl && save(manualUrl)}
                  disabled={!manualUrl.trim() || saving}
                  className="flex items-center gap-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-2 text-sm font-medium transition-colors"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Link size={13} />}
                  Use
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
