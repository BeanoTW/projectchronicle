interface CategoryBadgeProps {
  category: string;
}

const CategoryBadge = ({ category }: CategoryBadgeProps) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/80 text-accent-foreground border border-accent-foreground/10">
    {category}
  </span>
);

export default CategoryBadge;
