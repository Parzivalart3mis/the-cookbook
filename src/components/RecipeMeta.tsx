import { ExternalLink, UtensilsCrossed } from 'lucide-react';

interface RecipeMetaProps {
  servings: number | null;
  source: string | null;
}

export default function RecipeMeta({ servings, source }: RecipeMetaProps) {
  if (!servings && !source) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted flex-wrap">
      {servings !== null && (
        <span className="flex items-center gap-1.5">
          <UtensilsCrossed size={14} className="text-accent" />
          {servings} {servings === 1 ? 'serving' : 'servings'}
        </span>
      )}

      {servings !== null && source && (
        <span className="text-ink-faint select-none">·</span>
      )}

      {source && (
        <a
          href={source}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-accent transition-colors duration-150"
        >
          Source
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}
