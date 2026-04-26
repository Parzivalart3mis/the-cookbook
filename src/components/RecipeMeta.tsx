import React from 'react';
import { ExternalLink, UtensilsCrossed } from 'lucide-react';

interface RecipeMetaProps {
  servings: number | null;
  source: string | null;
  children?: React.ReactNode;
}

export default function RecipeMeta({ servings, source, children }: RecipeMetaProps) {
  const hasContent = servings !== null || source || children;
  if (!hasContent) return null;

  const items: React.ReactNode[] = [];

  if (servings !== null) {
    items.push(
      <span key="servings" className="flex items-center gap-1.5">
        <UtensilsCrossed size={14} className="text-accent" />
        {servings} {servings === 1 ? 'serving' : 'servings'}
      </span>
    );
  }

  if (source) {
    items.push(
      <a
        key="source"
        href={source}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 hover:text-accent transition-colors duration-150"
      >
        Source
        <ExternalLink size={12} />
      </a>
    );
  }

  if (children) {
    items.push(<span key="children">{children}</span>);
  }

  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted flex-wrap">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-ink-faint select-none">·</span>}
          {item}
        </React.Fragment>
      ))}
    </div>
  );
}
