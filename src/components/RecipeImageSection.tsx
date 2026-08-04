'use client';

import { useState } from 'react';
import { ImageIcon, X, Loader2, Check, Link2, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

type Mode = 'url' | 'unsplash';

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
  const [mode, setMode] = useState<Mode>('url');

  // URL mode
  const [manualUrl, setManualUrl] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  // Unsplash mode
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    setPhotos([]);
    setError(null);
    try {
      const res = await fetch(`/api/unsplash?q=${encodeURIComponent(recipeName + ' food dish')}`);
      const data = await res.json();
      if ((data.photos ?? []).length === 0) setError('No photos found — try a custom URL instead');
      setPhotos(data.photos ?? []);
    } catch {
      setError('Could not reach Unsplash — check your connection');
    }
    setLoading(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    if (next === 'unsplash' && photos.length === 0) search();
  }

  function handleOpen() {
    setOpen(true);
    setError(null);
    setMode('url'); // always open on URL tab
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
        const friendly = msg.includes('Cover Image') || msg.includes('property')
          ? 'Add a "Cover Image" URL property to your Notion database first'
          : msg;
        setError(friendly);
        setSavingId(null);
        setManualSaving(false);
        return;
      }

      setImage(imageUrl);
      setOpen(false);
      setManualUrl('');
      router.refresh();
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

      {/* Admin controls */}
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
                {mode === 'unsplash' && (
                  <button
                    onClick={search}
                    disabled={loading}
                    title="Search again"
                    aria-label="Search for another image"
                    className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-hover transition-colors"
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-hover transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-1 px-5 pt-4">
              {(['url', 'unsplash'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors duration-150 ${
                    mode === m
                      ? 'bg-accent text-white'
                      : 'bg-surface-hover text-ink-muted hover:text-ink'
                  }`}
                >
                  {m === 'url' ? 'Paste URL' : 'Unsplash'}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-4">
              {/* Error banner */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* URL mode */}
              {mode === 'url' && (
                <div className="space-y-3">
                  <p className="text-xs text-ink-faint">
                    Paste any image URL — from Google Images, Pinterest, or anywhere.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && manualUrl.trim()) saveImage(manualUrl.trim());
                      }}
                      autoFocus
                      placeholder="https://example.com/image.jpg"
                      className="flex-1 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                    />
                    <button
                      onClick={() => manualUrl.trim() && saveImage(manualUrl.trim())}
                      disabled={!manualUrl.trim() || manualSaving}
                      className="flex items-center gap-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-2 text-sm font-medium transition-colors"
                    >
                      {manualSaving ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Unsplash mode */}
              {mode === 'unsplash' && (
                loading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-ink-faint">
                    <Loader2 size={20} className="animate-spin text-accent" />
                    <span className="text-xs">Searching Unsplash…</span>
                  </div>
                ) : photos.length > 0 ? (
                  <div>
                    <p className="text-xs text-ink-faint mb-2">Click a photo to use it</p>
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
                            <div className={`absolute inset-0 flex items-center justify-center transition-colors duration-150 ${
                              isSaving ? 'bg-black/50' : 'bg-black/0 group-hover:bg-black/40'
                            }`}>
                              {isSaving
                                ? <Loader2 size={18} className="text-white animate-spin" />
                                : <Check size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={2.5} />
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
                  <div className="text-center py-6 text-xs text-ink-faint">No results found</div>
                ) : null
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
