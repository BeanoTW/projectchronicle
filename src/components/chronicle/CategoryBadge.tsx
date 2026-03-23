interface CategoryBadgeProps {
  category: string;
}

const categoryTints: Record<string, string> = {
  'Management Conduct': 'bg-primary/8 text-primary border-primary/15',
  'Verbal Comment': 'bg-warm-accent-light text-warm-accent-foreground border-warm-accent/15',
  'Safety Concern': 'bg-severity-serious/8 text-severity-serious border-severity-serious/15',
  'Written Communication': 'bg-secondary text-secondary-foreground border-secondary-foreground/15',
  'Scheduling or Shift Change': 'bg-muted text-muted-foreground border-border',
  'Disciplinary Meeting': 'bg-destructive/8 text-destructive border-destructive/15',
  'Pay or Payroll Issue': 'bg-warm-accent-light text-warm-accent-foreground border-warm-accent/15',
  'Policy Application': 'bg-secondary text-secondary-foreground border-secondary-foreground/15',
  'Workplace Meeting': 'bg-primary/8 text-primary border-primary/15',
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
