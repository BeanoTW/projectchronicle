import { Home, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ChroniclePageHeader from '@/chronicle/brand/ChroniclePageHeader';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  hideHome?: boolean;
  hideSettings?: boolean;
  hideMountain?: boolean;
}

const PageHeader = ({ title, subtitle, children, hideHome, hideSettings }: PageHeaderProps) => {
  const navigate = useNavigate();

  const actions = (
    <>
      {!hideHome && (
        <button
          onClick={() => navigate('/home')}
          className="p-2 text-warm-accent/80 hover:text-warm-accent transition-colors rounded-lg hover:bg-warm-accent/5"
          aria-label="Home"
        >
          <Home className="h-[18px] w-[18px]" strokeWidth={1.85} />
        </button>
      )}
      {children}
      {!hideSettings && (
        <button
          onClick={() => navigate('/settings')}
          className="p-2 text-warm-accent/65 hover:text-warm-accent/90 transition-colors rounded-lg hover:bg-warm-accent/5"
          aria-label="Settings"
        >
          <Settings className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>
      )}
    </>
  );

  return (
    <div className="px-5 pt-8 pb-1">
      <ChroniclePageHeader
        title={title}
        subtitle={subtitle}
        eyebrow="Chronicle workspace"
        actions={actions}
      />
    </div>
  );
};

export default PageHeader;
