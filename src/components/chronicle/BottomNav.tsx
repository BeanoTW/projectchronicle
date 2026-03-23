import { Mic, CalendarDays, BarChart3, Paperclip, Shield, Download } from 'lucide-react';
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
      <div className="mx-3 mb-3 rounded-2xl glass-nav border border-white/20 shadow-[var(--shadow-nav)]">
        <div className="flex items-center justify-around h-[68px] max-w-lg mx-auto px-2">
          {navItems.map(({ path, label, icon: Icon, primary }) => {
            const isActive = location.pathname === path || location.pathname.startsWith(path + '/');

            if (primary) {
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="flex flex-col items-center justify-center -mt-6 transition-transform duration-200 active:scale-95"
                >
                  <div className="w-[56px] h-[56px] rounded-full bg-primary text-primary-foreground flex items-center justify-center record-glow ring-4 ring-card/80">
                    <Icon className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <span className="text-[10px] mt-1.5 font-semibold text-primary">
                    {label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground/45 hover:text-muted-foreground/65'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] transition-all duration-200 ${isActive ? 'scale-110' : ''}`} strokeWidth={isActive ? 2.2 : 1.5} />
                <span className={`text-[10px] mt-1 transition-all duration-200 ${isActive ? 'font-semibold' : 'font-medium opacity-80'}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
