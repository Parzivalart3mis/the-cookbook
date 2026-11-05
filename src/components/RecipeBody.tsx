'use client';

import { useState, useEffect, useRef } from 'react';
import { RotateCcw, Check } from 'lucide-react';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { useAuth } from '@clerk/nextjs';

function storeGuestChecklist(slug: string, ids: string[], reset: boolean, legacySlugs: string[]): boolean {
  try {
    for (const key of legacySlugs) localStorage.removeItem(`cookbook-checklist-${key}`);
    if (reset) localStorage.removeItem(`cookbook-checklist-${slug}`);
    else localStorage.setItem(`cookbook-checklist-${slug}`, JSON.stringify({ ids, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}

type RichTextItem = {
  plain_text: string;
  href: string | null;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
  };
};

// ── Rich text renderer ────────────────────────────────────────────────────────

function renderRichText(
  richText: RichTextItem[],
  { skipBold = false } = {}
): React.ReactNode {
  return richText.map((span, i) => {
    const { bold, italic, strikethrough, underline, code } = span.annotations;
    const applyBold = bold && !skipBold;
    let node: React.ReactNode = span.plain_text;

    if (code)          node = <code key={i}>{node}</code>;
    if (applyBold)     node = <strong key={i}>{node}</strong>;
    if (italic)        node = <em key={i}>{node}</em>;
    if (strikethrough) node = <del key={i}>{node}</del>;
    if (underline)     node = <u key={i}>{node}</u>;
    if (span.href)     node = <a key={i} href={span.href} target="_blank" rel="noopener noreferrer">{node}</a>;

    if (!code && !applyBold && !italic && !strikethrough && !underline && !span.href) {
      node = <span key={i}>{node}</span>;
    }

    return node;
  });
}

function getBlockRichText(block: BlockObjectResponse): RichTextItem[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((block as any)[block.type]?.rich_text ?? []) as RichTextItem[];
}

// ── Block grouping ────────────────────────────────────────────────────────────

type ListGroup = {
  kind: 'bulleted_list_item' | 'numbered_list_item';
  items: BlockObjectResponse[];
};

type RenderedGroup = ListGroup | BlockObjectResponse;

function groupBlocks(blocks: BlockObjectResponse[]): RenderedGroup[] {
  const groups: RenderedGroup[] = [];
  for (const block of blocks) {
    const isBulleted = block.type === 'bulleted_list_item';
    const isNumbered = block.type === 'numbered_list_item';
    if (isBulleted || isNumbered) {
      const last = groups[groups.length - 1];
      if (last && 'kind' in last && last.kind === block.type) {
        last.items.push(block);
      } else {
        groups.push({ kind: block.type as ListGroup['kind'], items: [block] });
      }
    } else {
      groups.push(block);
    }
  }
  return groups;
}

// ── Main component ────────────────────────────────────────────────────────────

function RecipeBodyContent({
  blocks,
  slug,
  legacySlugs = [],
}: {
  blocks: BlockObjectResponse[];
  slug?: string;
  legacySlugs?: string[];
}) {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState(false);
  const checkedRef = useRef(new Set<string>());
  const revision = useRef(0);
  const writes = useRef(Promise.resolve());
  const disposed = useRef(false);
  useEffect(() => {
    disposed.current = false;
    return () => { disposed.current = true; };
  }, []);
  // Stable effect dependency even when the server passes a new array instance.
  const legacyKeys = JSON.stringify(legacySlugs);

  useEffect(() => {
    if (!slug || !authLoaded) return;
    let cancelled = false;
    const loadedRevision = revision.current;

    /** Server for signed-in users, localStorage otherwise. Returns null if nothing usable. */
    async function loadChecklist(): Promise<string[] | null> {
      if (isSignedIn) {
        try {
          const res = await fetch(`/api/checklist/${slug}`);
          const data = await res.json();
          if (!res.ok) return null;
          return Array.isArray(data.ids) ? data.ids : Array.isArray(data.itemIds) ? data.itemIds : null;
        } catch {
          return null;
        }
      }

      try {
        for (const key of [slug, ...JSON.parse(legacyKeys) as string[]]) {
          const raw = localStorage.getItem(`cookbook-checklist-${key}`);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed.filter(id => typeof id === 'string');
          if (parsed && Date.now() - (parsed.savedAt ?? 0) < 24 * 60 * 60 * 1000 && Array.isArray(parsed.ids)) return parsed.ids.filter((id: unknown) => typeof id === 'string');
        }
        return null;
      } catch {
        return null;
      }
    }

    void loadChecklist().then((ids) => {
      if (!cancelled && revision.current === loadedRevision) {
        const restored = new Set(ids ?? []);
        checkedRef.current = restored;
        setChecked(restored);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [slug, isSignedIn, authLoaded, legacyKeys]);

  function persist(ids: string[], reset = false) {
    if (!slug) return;
    if (!isSignedIn) {
      setSaveError(!storeGuestChecklist(slug, ids, reset, legacySlugs));
      return;
    }
    // Serialize snapshots so a slow earlier save cannot overwrite a newer one.
    writes.current = writes.current.then(async () => {
      if (disposed.current) return;
      const res = await fetch(`/api/checklist/${slug}`, reset ? { method: 'DELETE', signal: AbortSignal.timeout(15_000) } : {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }), signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error('Checklist save failed');
      setSaveError(false);
    }).catch(() => setSaveError(true));
  }

  function toggle(id: string) {
    revision.current++;
    const next = new Set(checkedRef.current);
    if (next.has(id)) next.delete(id); else next.add(id);
    checkedRef.current = next;
    setChecked(next);
    persist([...next]);
  }

  function reset() {
    revision.current++;
    checkedRef.current = new Set();
    setChecked(new Set());
    persist([], true);
  }

  const groups = groupBlocks(blocks);

  return (
    <div>
      {saveError && <p role="alert" className="mb-3 text-sm text-red-600">Progress could not be saved. <button onClick={() => persist([...checkedRef.current])} className="underline">Retry save</button></p>}
      {checked.size > 0 && (
        <div className="flex items-center justify-between mb-4 text-xs text-ink-muted">
          <span>{checked.size} item{checked.size !== 1 ? 's' : ''} checked off</span>
          <button
            onClick={reset}
            className="flex items-center gap-1 hover:text-accent transition-colors duration-150"
          >
            <RotateCcw size={11} />
            Reset
          </button>
        </div>
      )}

      <div className="prose prose-neutral max-w-none dark:prose-invert">
        {groups.map((group, i) => {
          if ('kind' in group) {
            if (group.kind === 'bulleted_list_item') {
              return (
                <div key={i} className="not-prose my-4 flex flex-col gap-2">
                  {group.items.map((item) => {
                    const isChecked = checked.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-2.5 group"
                      >
                        <span
                          onClick={() => toggle(item.id)}
                          className={`mt-[2px] flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded border-2 transition-all duration-150 ${
                            isChecked ? 'border-accent bg-accent' : 'border-border group-hover:border-accent/60'
                          }`}
                        >
                          {isChecked && <Check size={11} className="text-white" strokeWidth={3} />}
                        </span>
                        <span className={`text-sm leading-relaxed transition-all duration-200 ${
                          isChecked ? 'line-through opacity-40 text-ink-muted' : 'text-ink'
                        }`}>
                          {renderRichText(getBlockRichText(item))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            }

            return (
              <ol key={i}>
                {group.items.map((item) => {
                  const isChecked = checked.has(item.id);
                  return (
                    <li
                      key={item.id}
                      className="transition-opacity duration-200"
                      style={{ opacity: isChecked ? 0.35 : 1 }}
                    >
                      <span className={isChecked ? 'line-through' : ''}>
                        {renderRichText(getBlockRichText(item))}
                      </span>
                      <button
                        onClick={() => toggle(item.id)}
                        title={isChecked ? 'Uncheck' : 'Check off'}
                        className={`ml-2 inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded border-2 transition-all duration-150 align-middle ${
                          isChecked ? 'border-accent bg-accent' : 'border-border hover:border-accent/60'
                        }`}
                      >
                        {isChecked && <Check size={9} className="text-white" strokeWidth={3} />}
                      </button>
                    </li>
                  );
                })}
              </ol>
            );
          }

          const block = group;
          const rich = getBlockRichText(block);
          const rendered = renderRichText(rich);
          const hasContent = rich.some((r) => r.plain_text.trim());

          switch (block.type) {
            case 'heading_1': return <h1 key={block.id}>{renderRichText(rich, { skipBold: true })}</h1>;
            case 'heading_2': return <h2 key={block.id}>{renderRichText(rich, { skipBold: true })}</h2>;
            case 'heading_3': return <h3 key={block.id}>{renderRichText(rich, { skipBold: true })}</h3>;
            case 'paragraph': return hasContent ? <p key={block.id}>{rendered}</p> : null;
            case 'quote':     return <blockquote key={block.id}>{rendered}</blockquote>;
            case 'divider':   return <hr key={block.id} />;
            case 'image': {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const img = (block as any).image;
              const src: string = img.type === 'file' ? img.file.url : img.external.url;
              const caption: RichTextItem[] = img.caption ?? [];
              const altText = caption.map((c: RichTextItem) => c.plain_text).join('');
              return (
                <figure key={block.id} className="my-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={altText} className="rounded-xl w-full object-cover" loading="lazy" />
                  {caption.length > 0 && (
                    <figcaption className="text-center mt-2">{renderRichText(caption)}</figcaption>
                  )}
                </figure>
              );
            }
            default: return null;
          }
        })}
      </div>
    </div>
  );
}


export default function RecipeBody(props: { blocks: BlockObjectResponse[]; slug?: string; legacySlugs?: string[] }) {
  const { userId } = useAuth();
  return <RecipeBodyContent key={`${userId ?? 'guest'}:${props.slug}`} {...props} />;
}
