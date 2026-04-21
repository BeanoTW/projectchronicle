import { CATEGORY_BADGE_TINTS, resolveCategory } from '@/lib/categories';
import { getCategoryIcon } from '@/lib/categoryIcons';

interface CategoryBadgeProps {
  category: string;
  subtype?: string;
  /** Show the category line icon inside the chip (default true). */
  showIcon?: boolean;
}

/** Display "Not sure yet" for empty/Other/unknown categories */
function displayCategory(category: string): string {
  const resolved = resolveCategory(category);
  if (resolved === 'Other' || !resolved) return 'Not sure yet';
  return resolved;
}

const CategoryBadge = ({ category, subtype, showIcon = true }: CategoryBadgeProps) => {
  const resolved = resolveCategory(category);
  const display = displayCategory(category);
  const Icon = getCategoryIcon(category);
  const tint = CATEGORY_BADGE_TINTS[resolved]
    || 'bg-accent/80 text-accent-foreground border-accent-foreground/10';
  const showSubtype = subtype && subtype !== 'Unclassified' && subtype !== 'Not sure yet' && subtype !== 'Other' && subtype !== category;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${tint}`}>
      {showIcon && <Icon className="h-3 w-3 opacity-80" strokeWidth={1.75} aria-hidden="true" />}
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
