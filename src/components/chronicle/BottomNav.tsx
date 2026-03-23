import { Mic, CalendarDays, BarChart3, Paperclip, Shield } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { path: '/timeline', label: 'Timeline', icon: CalendarDays },
  { path: '/insights', label: 'Insights', icon: BarChart3 },
  { path: '/record', label: 'Record', icon: Mic, primary: true },
  { path: '/evidence', label: 'Evidence', icon: Paperclip },
  { path: '/rights', label: 'Rights', icon: Shield },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-3 mb-3 rounded-2xl glass-nav border border-border/50 shadow-[var(--shadow-nav)]">
        <div className="flex items-center justify-around h-[64px] max-w-lg mx-auto px-2">
          {navItems.map(({ path, label, icon: Icon, primary }) => {
            const isActive = location.pathname === path || location.pathname.startsWith(path + '/');

            if (primary) {
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="flex flex-col items-center justify-center -mt-5 transition-transform duration-200 active:scale-95"
                >
                  <div className="w-[52px] h-[52px] rounded-full bg-primary text-primary-foreground flex items-center justify-center record-glow ring-4 ring-background">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <span className="text-[10px] mt-1 font-semibold text-primary">
                    {label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-150 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground/50 hover:text-muted-foreground'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${isActive ? 'scale-105' : ''}`} strokeWidth={isActive ? 2 : 1.5} />
                <span className={`text-[10px] mt-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
