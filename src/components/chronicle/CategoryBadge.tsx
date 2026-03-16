import type { IncidentCategory } from '@/types/incident';

interface CategoryBadgeProps {
  category: IncidentCategory;
}

const CategoryBadge = ({ category }: CategoryBadgeProps) => (
  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent text-accent-foreground">
    {category}
  </span>
);

export default CategoryBadge;
