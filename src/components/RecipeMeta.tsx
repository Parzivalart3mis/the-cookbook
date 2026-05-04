import React from 'react';
import { UtensilsCrossed, Clock, Timer } from 'lucide-react';
import SourcePreview from './SourcePreview';

interface RecipeMetaProps {
  servings: number | null;
  prepTime?: number | null;
  cookTime?: number | null;
  source: string | null;
  children?: React.ReactNode;
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function RecipeMeta({
  servings,
  prepTime,
  cookTime,
  source,
  children,
}: RecipeMetaProps) {
  const hasContent = servings !== null || prepTime || cookTime || source || children;
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

  if (prepTime) {
    items.push(
      <span key="prep" className="flex items-center gap-1.5">
        <Timer size={13} className="text-accent" />
        {formatTime(prepTime)} prep
      </span>
    );
  }

  if (cookTime) {
    items.push(
      <span key="cook" className="flex items-center gap-1.5">
        <Clock size={13} className="text-accent" />
        {formatTime(cookTime)} cook
      </span>
    );
  }

  if (source) {
    items.push(<SourcePreview key="source" url={source} />);
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
