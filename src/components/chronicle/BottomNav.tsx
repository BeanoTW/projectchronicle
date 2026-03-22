import { Mic, CalendarDays, BarChart3, Paperclip, Shield, Download } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { path: '/record', label: 'Record', icon: Mic, primary: true },
  { path: '/timeline', label: 'Timeline', icon: CalendarDays },
  { path: '/insights', label: 'Insights', icon: BarChart3 },
  { path: '/evidence', label: 'Evidence', icon: Paperclip },
  { path: '/rights', label: 'Rights', icon: Shield },
  { path: '/export', label: 'Export', icon: Download },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-2 mb-2 rounded-2xl bg-card/95 backdrop-blur-lg border border-border/60 shadow-[var(--shadow-elevated)]">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
          {navItems.map(({ path, label, icon: Icon, primary }) => {
            const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground/70 hover:text-muted-foreground'
                }`}
              >
                <div className={`relative flex items-center justify-center ${isActive ? 'scale-110' : ''} transition-transform duration-200`}>
                  {isActive && (
                    <div className="absolute inset-0 -m-1.5 rounded-xl bg-primary/10" />
                  )}
                  <Icon className={`relative ${primary && isActive ? 'h-[22px] w-[22px]' : 'h-5 w-5'}`} strokeWidth={isActive ? 2.2 : 1.8} />
                </div>
                <span className={`text-[10px] mt-1 transition-all duration-200 ${isActive ? 'font-semibold' : 'font-medium opacity-70'}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
