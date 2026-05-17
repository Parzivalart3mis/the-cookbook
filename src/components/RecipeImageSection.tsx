'use client';

import { useState } from 'react';
import { ImageIcon, X, Loader2, Check, Link, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

type Photo = {
  id: string;
  url: string;
  thumb: string;
  photographer: string;
  downloadLocation: string;
};

export default function RecipeImageSection({
  pageId,
  slug,
  recipeName,
  initialImage,
}: {
  pageId: string;
  slug: string;
  recipeName: string;
  initialImage: string | null;
}) {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [image, setImage] = useState<string | null>(initialImage);
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null); // tracks which photo is saving
  const [manualUrl, setManualUrl] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    setPhotos([]);
    setError(null);
    try {
      const res = await fetch(`/api/unsplash?q=${encodeURIComponent(recipeName + ' food dish')}`);
      const data = await res.json();
      if (data.photos?.length === 0) setError('No photos found — try a custom URL below');
      setPhotos(data.photos ?? []);
    } catch {
      setError('Could not reach Unsplash — check your connection');
    }
    setLoading(false);
  }

  function handleOpen() {
    setOpen(true);
    setError(null);
    if (photos.length === 0) search();
  }

  async function saveImage(imageUrl: string | null, photoId?: string, downloadLocation?: string) {
    if (photoId) setSavingId(photoId);
    else setManualSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/recipe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, imageUrl, downloadLocation, slug }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error ?? `Save failed (${res.status})`;
        // Friendly message for missing Notion property
        const friendly = msg.includes('Cover Image') || msg.includes('property')
          ? 'Add a "Cover Image" URL property to your Notion database first'
          : msg;
        setError(friendly);
        setSavingId(null);
        setManualSaving(false);
        return;
      }

      // Success — update local state instantly, no cache wait
      setImage(imageUrl);
      setOpen(false);
      setManualUrl('');
      router.refresh(); // sync in background for next page load
    } catch {
      setError('Network error — please try again');
    }

    setSavingId(null);
    setManualSaving(false);
  }

  return (
    <>
      {/* Hero image */}
      {image && (
        <div className="mb-6 -mt-2 rounded-2xl overflow-hidden aspect-video w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={recipeName} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Admin controls — only for signed-in user */}
      {isSignedIn && (
        <div className="flex items-center gap-3 mt-1 mb-2">
          <button
            onClick={handleOpen}
            className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-accent transition-colors duration-150"
          >
            <ImageIcon size={12} />
            {image ? 'Change image' : 'Add image'}
          </button>
          {image && (
            <button
              onClick={() => saveImage(null)}
              className="text-xs text-ink-faint hover:text-red-400 transition-colors duration-150"
            >
              Remove
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg bg-surface rounded-2xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-ink">Recipe Image</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={search}
                  disabled={loading}
                  title="Search again"
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
              {/* Error banner */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Unsplash grid */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-ink-faint">
                  <Loader2 size={20} className="animate-spin text-accent" />
                  <span className="text-xs">Searching Unsplash…</span>
                </div>
              ) : photos.length > 0 ? (
                <div>
                  <p className="text-xs text-ink-faint mb-2">Photos from Unsplash — click to use</p>
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo) => {
                      const isSaving = savingId === photo.id;
                      return (
                        <button
                          key={photo.id}
                          onClick={() => saveImage(photo.url, photo.id, photo.downloadLocation)}
                          disabled={savingId !== null || manualSaving}
                          className="relative aspect-video rounded-lg overflow-hidden group focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.thumb}
                            alt=""
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                          {/* Hover / saving overlay */}
                          <div className={`absolute inset-0 flex items-center justify-center transition-colors duration-150 ${
                            isSaving ? 'bg-black/50' : 'bg-black/0 group-hover:bg-black/40'
                          }`}>
                            {isSaving
                              ? <Loader2 size={18} className="text-white animate-spin" />
                              : <Check size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150" strokeWidth={2.5} />
                            }
                          </div>
                          <p className="absolute bottom-0 left-0 right-0 px-1.5 py-1 text-[9px] text-white/80 bg-gradient-to-t from-black/50 to-transparent truncate">
                            {photo.photographer}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : !error ? (
                <div className="text-center py-6 text-xs text-ink-faint">
                  No results — try a custom URL below
                </div>
              ) : null}

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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualUrl.trim()) saveImage(manualUrl.trim());
                  }}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                />
                <button
                  onClick={() => manualUrl.trim() && saveImage(manualUrl.trim())}
                  disabled={!manualUrl.trim() || manualSaving || savingId !== null}
                  className="flex items-center gap-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-2 text-sm font-medium transition-colors"
                >
                  {manualSaving ? <Loader2 size={13} className="animate-spin" /> : <Link size={13} />}
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
