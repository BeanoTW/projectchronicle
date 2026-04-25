import { useLocation, useNavigate } from 'react-router-dom';
import {
  TimelineIcon,
  CalendarIcon,
  RecordIcon,
  MyRecordIcon,
  SupportIcon,
} from './NavIcons';

const sideItems = [
  { path: '/timeline', label: 'Timeline', Icon: TimelineIcon },
  { path: '/calendar', label: 'Calendar', Icon: CalendarIcon },
];

const rightItems = [
  { path: '/my-record', label: 'My Record', Icon: MyRecordIcon },
  { path: '/support', label: 'Support', Icon: SupportIcon },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const renderItem = ({ path, label, Icon }: { path: string; label: string; Icon: typeof TimelineIcon }) => {
    const active = isActive(path);
    return (
      <button
        key={path}
        onClick={() => navigate(path)}
        className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 ${
          active ? 'text-primary' : 'text-muted-foreground/60 hover:text-muted-foreground/85'
        }`}
        aria-label={label}
      >
        <Icon active={active} />
        <span className={`text-[10px] mt-0.5 ${active ? 'font-semibold' : 'font-medium'}`}>
          {label}
        </span>
      </button>
    );
  };

  const recordActive = isActive('/record');

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="relative mx-3 mb-3 max-w-lg lg:mx-auto">
        {/* Nav bar with circular cutout for record button */}
        <div className="relative h-[64px] rounded-2xl glass-nav border border-border shadow-[var(--shadow-elevated)]">
          <div className="flex items-center h-full px-2">
            {/* Left items */}
            <div className="flex flex-1 h-full">
              {sideItems.map(renderItem)}
            </div>

            {/* Spacer for centre record button */}
            <div className="w-[72px] flex-shrink-0" aria-hidden />

            {/* Right items */}
            <div className="flex flex-1 h-full">
              {rightItems.map(renderItem)}
            </div>
          </div>
        </div>

        {/* Elevated Record button — overlaps the nav */}
        <button
          onClick={() => navigate('/record')}
          aria-label="Record"
          className="absolute left-1/2 -translate-x-1/2 -top-6 flex flex-col items-center group"
        >
          <span
            className="w-[60px] h-[60px] rounded-full flex items-center justify-center text-white transition-transform duration-150 group-active:scale-95"
            style={{
              background:
                'radial-gradient(circle at 30% 25%, hsl(var(--primary) / 0.95), hsl(var(--primary)) 55%, hsl(var(--primary) / 0.88) 100%)',
              boxShadow:
                '0 10px 22px -8px hsl(var(--primary) / 0.55), 0 2px 4px hsl(var(--primary) / 0.25), inset 0 1px 0 hsl(0 0% 100% / 0.35), inset 0 -2px 4px hsl(var(--primary) / 0.4)',
            }}
          >
            <RecordIcon />
          </span>
          <span
            className={`text-[10px] mt-1 ${
              recordActive ? 'font-semibold text-primary' : 'font-semibold text-primary/85'
            }`}
          >
            Record
          </span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
