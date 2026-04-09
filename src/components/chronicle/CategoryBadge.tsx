import { CATEGORY_BADGE_TINTS } from '@/lib/categories';

interface CategoryBadgeProps {
  category: string;
  subtype?: string;
}

const CategoryBadge = ({ category, subtype }: CategoryBadgeProps) => {
  const displayCategory = category === 'Other' ? 'Unclassified' : category;
  const tint = CATEGORY_BADGE_TINTS[category as keyof typeof CATEGORY_BADGE_TINTS]
    || CATEGORY_BADGE_TINTS['Unclassified' as keyof typeof CATEGORY_BADGE_TINTS]
    || 'bg-accent/80 text-accent-foreground border-accent-foreground/10';
  const showSubtype = subtype && subtype !== 'Other' && subtype !== 'Unclassified' && subtype !== category;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${tint}`}>
      {displayCategory}
      {showSubtype && (
        <span className="opacity-60">— {subtype}</span>
      )}
    </span>
  );
};

export default CategoryBadge;
