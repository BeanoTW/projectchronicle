import { CATEGORY_BADGE_TINTS, resolveCategory } from '@/lib/categories';

interface CategoryBadgeProps {
  category: string;
  subtype?: string;
}

const CategoryBadge = ({ category, subtype }: CategoryBadgeProps) => {
  const resolved = resolveCategory(category);
  const tint = CATEGORY_BADGE_TINTS[resolved]
    || 'bg-accent/80 text-accent-foreground border-accent-foreground/10';
  const showSubtype = subtype && subtype !== 'Unclassified' && subtype !== 'Other' && subtype !== category;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${tint}`}>
      {resolved}
      {showSubtype && (
        <span className="opacity-60">→ {subtype}</span>
      )}
    </span>
  );
};

export default CategoryBadge;
