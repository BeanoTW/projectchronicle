interface CategoryBadgeProps {
  category: string;
}

const categoryTints: Record<string, string> = {
  'Communication': 'bg-primary/8 text-primary border-primary/15',
  'Action / Change': 'bg-warm-accent-light text-warm-accent-foreground border-warm-accent/15',
  'Process Event': 'bg-secondary text-secondary-foreground border-secondary-foreground/15',
  'Pay / Benefits': 'bg-warm-accent-light text-warm-accent-foreground border-warm-accent/15',
  'Working Conditions': 'bg-muted text-muted-foreground border-border',
  'Observed Behaviour': 'bg-info/8 text-info border-info/15',
  'Record Issued': 'bg-destructive/8 text-destructive border-destructive/15',
};

const CategoryBadge = ({ category }: CategoryBadgeProps) => {
  const tint = categoryTints[category] || 'bg-accent/80 text-accent-foreground border-accent-foreground/10';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${tint}`}>
      {category}
    </span>
  );
};

export default CategoryBadge;
