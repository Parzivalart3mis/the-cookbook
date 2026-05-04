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

// ── Scale helpers ─────────────────────────────────────────────────────────────

const FRACS: [number, string][] = [
  [0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.67, '⅔'], [0.75, '¾'],
  [1.25, '1¼'], [1.33, '1⅓'], [1.5, '1½'], [1.67, '1⅔'], [1.75, '1¾'],
  [2.25, '2¼'], [2.5, '2½'], [2.75, '2¾'], [3.5, '3½'],
];

function prettyNum(n: number): string {
  if (n === Math.round(n)) return String(Math.round(n));
  for (const [val, sym] of FRACS) {
    if (Math.abs(n - val) < 0.05) return sym;
  }
  return n.toFixed(1);
}

function scaleText(text: string, factor: number): string {
  if (factor === 1) return text;
  // Match fractions (1/2), decimals (1.5), integers (2). Skip temperatures (°).
  return text.replace(/\b(\d+(?:\/\d+|\.\d+)?)\b(?!\s*°)/g, (match, numStr: string) => {
    let val: number;
    if (numStr.includes('/')) {
      const [a, b] = numStr.split('/').map(Number);
      val = a / b;
    } else {
      val = parseFloat(numStr);
    }
    if (isNaN(val) || val === 0) return match;
    return prettyNum(val * factor);
  });
}

// ── Rich text renderer ────────────────────────────────────────────────────────

function renderRichText(
  richText: RichTextItem[],
  { skipBold = false, scale = 1 } = {}
): React.ReactNode {
  return richText.map((span, i) => {
    const text = scale !== 1 ? scaleText(span.plain_text, scale) : span.plain_text;
    const { bold, italic, strikethrough, underline, code } = span.annotations;
    const applyBold = bold && !skipBold;
    let node: React.ReactNode = text;

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

// ── Scale controls ────────────────────────────────────────────────────────────

const SCALE_OPTIONS = [
  { label: '½×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '2×', value: 2 },
  { label: '3×', value: 3 },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function RecipeBody({
  blocks,
  slug,
}: {
  blocks: BlockObjectResponse[];
  slug?: string;
}) {
  const storageKey = slug ? `cookbook-checklist-${slug}` : null;
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [scale, setScale] = useState(1);

  const hasList = blocks.some(b => b.type === 'bulleted_list_item' || b.type === 'numbered_list_item');

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
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
      {/* Scale controls */}
      {hasList && (
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          <span className="text-xs text-ink-muted font-medium mr-1">Scale:</span>
          {SCALE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setScale(opt.value)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors duration-150 ${
                scale === opt.value
                  ? 'bg-accent text-white'
                  : 'border border-border text-ink-muted hover:border-accent/30 hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Checklist reset */}
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
            // Only scale bulleted lists (ingredients), not numbered (steps)
            const listScale = group.kind === 'bulleted_list_item' ? scale : 1;
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
                        {renderRichText(getBlockRichText(item), { scale: listScale })}
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
