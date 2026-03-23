import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  heading: string;
  body: string;
}

const EmptyState = ({ icon, heading, body }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
    <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mb-5">
      <div className="text-muted-foreground/50">{icon}</div>
    </div>
    <h3 className="text-base font-semibold text-foreground mb-2">{heading}</h3>
    <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{body}</p>
  </div>
);

export default EmptyState;
