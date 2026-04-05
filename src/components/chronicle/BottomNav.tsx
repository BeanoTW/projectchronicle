import { Mic, CalendarDays, CalendarRange, FileText, Shield } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { path: '/timeline', label: 'Timeline', icon: CalendarDays },
  { path: '/calendar', label: 'Calendar', icon: CalendarRange },
  { path: '/record', label: 'Record', icon: Mic, primary: true },
  { path: '/my-record', label: 'My Record', icon: FileText },
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
        <div className="flex items-center justify-around h-[60px] max-w-lg mx-auto">
          {navItems.map(({ path, label, icon: Icon, primary }) => {
            const isActive = location.pathname === path || location.pathname.startsWith(path + '/');

            if (primary) {
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="flex flex-col items-center justify-center transition-transform duration-150 active:scale-95"
                >
                  <div className="w-[42px] h-[42px] rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[var(--shadow-card)]">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  </div>
                  <span className="text-[10px] mt-0.5 font-semibold text-primary">
                    {label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex flex-col items-center justify-center h-full transition-all duration-200 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground/50 hover:text-muted-foreground/70'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.5} />
                <span className={`text-[10px] mt-0.5 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
