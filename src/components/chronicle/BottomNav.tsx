import { useLocation, useNavigate } from 'react-router-dom';
import {
  TimelineIcon,
  CalendarIcon,
  RecordIcon,
  MyRecordIcon,
  SupportIcon,
} from './NavIcons';

const navItems = [
  { path: '/timeline', label: 'Timeline', Icon: TimelineIcon },
  { path: '/calendar', label: 'Calendar', Icon: CalendarIcon },
  { path: '/record', label: 'Record', Icon: RecordIcon, primary: true },
  { path: '/my-record', label: 'My Record', Icon: MyRecordIcon },
  { path: '/support', label: 'Support', Icon: SupportIcon },
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
          {navItems.map(({ path, label, Icon, primary }) => {
            const isActive = location.pathname === path || location.pathname.startsWith(path + '/');

            if (primary) {
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="flex flex-col items-center justify-center transition-transform duration-150 active:scale-95"
                  aria-label={label}
                >
                  <div className="w-[42px] h-[42px] rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[var(--shadow-card)]">
                    <Icon active width={20} height={20} />
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
                className={`flex flex-col items-center justify-center h-full transition-colors duration-200 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground/55 hover:text-muted-foreground/80'
                }`}
                aria-label={label}
              >
                <Icon active={isActive} width={20} height={20} />
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
