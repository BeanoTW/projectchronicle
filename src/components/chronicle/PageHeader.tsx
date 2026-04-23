import { Home, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MountainBackdrop from './MountainBackdrop';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  hideHome?: boolean;
  hideSettings?: boolean;
  hideMountain?: boolean;
}

const PageHeader = ({ title, subtitle, children, hideHome, hideSettings, hideMountain }: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="relative px-5 pt-8 pb-4">
      {!hideMountain && <MountainBackdrop />}
      <div className="relative z-10 flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          {!hideHome && (
            <button
              onClick={() => navigate('/home')}
              className="p-1.5 -ml-1.5 text-muted-foreground/60 hover:text-foreground transition-colors rounded-lg hover:bg-muted/40"
              aria-label="Home"
            >
              <Home className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>
          )}
          <h1>{title}</h1>
        </div>
        <div className="flex items-center gap-1">
          {children}
          {!hideSettings && (
            <button
              onClick={() => navigate('/settings')}
              className="p-2 -mr-1 text-muted-foreground/60 hover:text-foreground transition-colors rounded-lg hover:bg-muted/40"
              aria-label="Settings"
            >
              <Settings className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
      {subtitle && (
        <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed pl-[30px]">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default PageHeader;
