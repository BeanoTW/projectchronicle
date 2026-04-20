import { CATEGORY_BADGE_TINTS, resolveCategory } from '@/lib/categories';

interface CategoryBadgeProps {
  category: string;
  subtype?: string;
}

/** Display "Not sure yet" for empty/Other/unknown categories */
function displayCategory(category: string): string {
  const resolved = resolveCategory(category);
  if (resolved === 'Other' || !resolved) return 'Not sure yet';
  return resolved;
}

const CategoryBadge = ({ category, subtype }: CategoryBadgeProps) => {
  const resolved = resolveCategory(category);
  const display = displayCategory(category);
  const tint = CATEGORY_BADGE_TINTS[resolved]
    || 'bg-accent/80 text-accent-foreground border-accent-foreground/10';
  const showSubtype = subtype && subtype !== 'Unclassified' && subtype !== 'Not sure yet' && subtype !== 'Other' && subtype !== category;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${tint}`}>
      {display}
      {showSubtype && (
        <span className="opacity-60">→ {subtype}</span>
      )}
    </span>
  );
};

/** Render category as a label line above incident title (for Timeline, My Record) */
export function CategoryLabel({ category, subtype }: CategoryBadgeProps) {
  const display = displayCategory(category);
  const showSubtype = subtype && subtype !== 'Unclassified' && subtype !== 'Not sure yet' && subtype !== 'Other' && subtype !== category;
  return (
    <p className="text-[11px] text-muted-foreground font-medium leading-tight">
      [{display}{showSubtype ? ` — ${subtype}` : ''}]
    </p>
  );
}

export default CategoryBadge;
