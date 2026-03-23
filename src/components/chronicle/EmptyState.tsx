import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  heading: string;
  body: string;
}

const EmptyState = ({ icon, heading, body }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
    <div className="text-muted-foreground/40 mb-5">{icon}</div>
    <h3 className="text-[15px] font-semibold text-foreground mb-2">{heading}</h3>
    <p className="text-[13px] text-muted-foreground max-w-xs leading-relaxed">{body}</p>
  </div>
);

export default EmptyState;
