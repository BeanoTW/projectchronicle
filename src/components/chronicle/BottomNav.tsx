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
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50" style={{ height: '64px' }}>
      <div className="flex items-center justify-around h-full max-w-lg mx-auto px-1">
        {navItems.map(({ path, label, icon: Icon, primary }) => {
          const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className={primary ? 'relative' : ''}>
                <Icon className={`${primary && isActive ? 'h-6 w-6' : 'h-5 w-5'}`} />
              </div>
              <span className="text-[10px] mt-0.5 font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
