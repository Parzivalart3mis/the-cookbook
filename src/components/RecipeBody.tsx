'use client';

import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';

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

function renderRichText(richText: RichTextItem[], { skipBold = false } = {}): React.ReactNode {
  return richText.map((span, i) => {
    const { bold, italic, strikethrough, underline, code } = span.annotations;
    const applyBold = bold && !skipBold;
    let node: React.ReactNode = span.plain_text;

    if (code)           node = <code key={i}>{node}</code>;
    if (applyBold)      node = <strong key={i}>{node}</strong>;
    if (italic)         node = <em key={i}>{node}</em>;
    if (strikethrough)  node = <del key={i}>{node}</del>;
    if (underline)      node = <u key={i}>{node}</u>;
    if (span.href)      node = <a key={i} href={span.href} target="_blank" rel="noopener noreferrer">{node}</a>;

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

export default function RecipeBody({
  blocks,
  slug,
}: {
  blocks: BlockObjectResponse[];
  slug?: string;
}) {
  const storageKey = slug ? `cookbook-checklist-${slug}` : null;
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Load persisted checklist after mount to avoid SSR mismatch
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Support both legacy plain-array format and new { ids, savedAt } format
      if (Array.isArray(parsed)) {
        setChecked(new Set(parsed));
      } else if (parsed && typeof parsed === 'object') {
        const age = Date.now() - (parsed.savedAt ?? 0);
        if (age < 24 * 60 * 60 * 1000) {
          setChecked(new Set(parsed.ids ?? []));
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {}
  }, [storageKey]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify({ ids: [...next], savedAt: Date.now() })); } catch {}
      }
      return next;
    });
  }

  function reset() {
    setChecked(new Set());
    if (storageKey) {
      try { localStorage.removeItem(storageKey); } catch {}
    }
  }

  const groups = groupBlocks(blocks);

  return (
    <div>
      {/* Reset button — only shown when something is checked */}
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
            const Tag = group.kind === 'bulleted_list_item' ? 'ul' : 'ol';
            return (
              <Tag key={i}>
                {group.items.map((item) => {
                  const isChecked = checked.has(item.id);
                  return (
                    <li
                      key={item.id}
                      onClick={() => toggle(item.id)}
                      className="cursor-pointer select-none transition-opacity duration-200"
                      style={{ opacity: isChecked ? 0.35 : 1 }}
                    >
                      <span className={isChecked ? 'line-through' : ''}>
                        {renderRichText(getBlockRichText(item))}
                      </span>
                    </li>
                  );
                })}
              </Tag>
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
                  <img
                    src={src}
                    alt={altText}
                    className="rounded-xl w-full object-cover"
                    loading="lazy"
                  />
                  {caption.length > 0 && (
                    <figcaption className="text-center mt-2">
                      {renderRichText(caption)}
                    </figcaption>
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
