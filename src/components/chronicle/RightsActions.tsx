import { ArrowRight } from 'lucide-react';

interface RightsActionsProps {
  actions: string[];
}

const RightsActions = ({ actions }: RightsActionsProps) => {
  return (
    <div>
      <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        What you can do
      </p>
      <div className="space-y-3">
        {actions.map((action, i) => (
          <div key={i} className="flex items-start gap-3">
            <ArrowRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-[14px] text-foreground leading-relaxed">{action}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RightsActions;
