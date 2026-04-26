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
  mountainHeight?: number;
}

const PageHeader = ({ title, subtitle, children, hideHome, hideSettings, hideMountain, mountainHeight }: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="relative px-5 pt-8 pb-4">
      {!hideMountain && <MountainBackdrop height={mountainHeight} />}
      <div className="relative z-10 flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          {!hideHome && (
            <button
              onClick={() => navigate('/home')}
              className="p-1.5 -ml-1.5 text-warm-accent/95 hover:text-warm-accent active:text-warm-accent/70 transition-colors duration-150 rounded-lg hover:bg-warm-accent/5 active:bg-warm-accent/10"
              aria-label="Home"
            >
              <Home className="h-[18px] w-[18px]" strokeWidth={1.85} />
            </button>
          )}
          <h1>{title}</h1>
        </div>
        <div className="flex items-center gap-1">
          {children}
          {!hideSettings && (
            <button
              onClick={() => navigate('/settings')}
              className="p-2 -mr-1 text-warm-accent/65 hover:text-warm-accent/90 active:text-warm-accent/50 transition-colors duration-150 rounded-lg hover:bg-warm-accent/5 active:bg-warm-accent/10"
              aria-label="Settings"
            >
              <Settings className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
      {subtitle && (
        <p className="relative z-10 text-[13px] text-muted-foreground mt-0.5 leading-relaxed pl-[30px]">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default PageHeader;
