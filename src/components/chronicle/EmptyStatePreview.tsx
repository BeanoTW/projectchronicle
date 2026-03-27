import type { ReactNode } from 'react';

interface EmptyStatePreviewProps {
  icon: ReactNode;
  heading: string;
  body: string;
  children?: ReactNode;
}

const EmptyStatePreview = ({ icon, heading, body, children }: EmptyStatePreviewProps) => (
  <div className="flex flex-col items-center py-12 px-6 text-center">
    <div className="text-muted-foreground/40 mb-4">{icon}</div>
    <h3 className="text-[15px] font-semibold text-foreground mb-1.5">{heading}</h3>
    <p className="text-[13px] text-muted-foreground max-w-xs leading-relaxed mb-6">{body}</p>
    {children}
  </div>
);

export default EmptyStatePreview;
