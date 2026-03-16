import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  heading: string;
  body: string;
}

const EmptyState = ({ icon, heading, body }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="text-muted-foreground mb-4">{icon}</div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{heading}</h3>
    <p className="text-sm text-muted-foreground max-w-xs">{body}</p>
  </div>
);

export default EmptyState;
