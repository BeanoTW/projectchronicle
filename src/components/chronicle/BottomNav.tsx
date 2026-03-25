import { Mic, CalendarDays, GitBranch, TrendingUp, Shield } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { path: '/timeline', label: 'Timeline', icon: CalendarDays },
  { path: '/flow', label: 'Flow', icon: GitBranch },
  { path: '/record', label: 'Record', icon: Mic, primary: true },
  { path: '/patterns', label: 'Insights', icon: TrendingUp },
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
      <div className="mx-3 mb-3 rounded-2xl glass-nav border border-border shadow-[var(--shadow-elevated)]">
        <div className="flex items-center justify-around h-[60px] max-w-lg mx-auto px-1">
          {navItems.map(({ path, label, icon: Icon, primary }) => {
            const isActive = location.pathname === path || location.pathname.startsWith(path + '/');

            if (primary) {
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="flex flex-col items-center justify-center -mt-5 transition-transform duration-150 active:scale-95"
                >
                  <div className="w-[50px] h-[50px] rounded-full bg-primary text-primary-foreground flex items-center justify-center record-glow ring-[3px] ring-background shadow-[var(--shadow-elevated)]">
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
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-250 ease-out ${
                isActive
                  ? 'text-primary scale-105'
                  : 'text-muted-foreground/40 hover:text-muted-foreground/60 scale-100'
              }`}
            >
              <Icon className={`h-[18px] w-[18px] transition-all duration-250`} strokeWidth={isActive ? 2 : 1.5} />
              <span className={`text-[10px] mt-0.5 transition-all duration-250 ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
