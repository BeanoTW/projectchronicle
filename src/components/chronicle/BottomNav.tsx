import { useLocation, useNavigate } from 'react-router-dom';
import {
  TimelineIcon,
  CalendarIcon,
  RecordIcon,
  MyRecordIcon,
  SupportIcon,
} from './NavIcons';

const leftItems = [
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
        className={`flex flex-col items-center justify-center gap-1 px-2 py-1 transition-colors duration-200 ${
          active ? 'text-primary' : 'text-muted-foreground/70 hover:text-foreground/85'
        }`}
        aria-label={label}
      >
        <Icon active={active} />
        <span className={`text-[10px] leading-none ${active ? 'font-semibold' : 'font-medium'}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <div
      className="fixed left-1/2 z-50 w-[calc(100%-24px)] max-w-[560px] -translate-x-1/2"
      style={{ bottom: `calc(12px + env(safe-area-inset-bottom, 0px))` }}
    >
      <nav
        className="relative h-[68px] rounded-[28px] border border-border/60"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(210 12% 97%) 100%)',
          boxShadow:
            '0 18px 36px -12px hsl(220 25% 12% / 0.18), 0 6px 14px -4px hsl(220 25% 12% / 0.10), inset 0 1px 0 hsl(0 0% 100% / 0.9)',
        }}
      >
        <div
          className="grid h-full items-center"
          style={{ gridTemplateColumns: '1fr 96px 1fr' }}
        >
          <div className="flex items-center justify-around">
            {leftItems.map(renderItem)}
          </div>
          <div aria-hidden />
          <div className="flex items-center justify-around">
            {rightItems.map(renderItem)}
          </div>
        </div>

        {/* Elevated Record button — viewport-centred via parent, overlaps nav bar */}
        <button
          onClick={() => navigate('/record')}
          aria-label="Record"
          className="absolute left-1/2 -translate-x-1/2 group"
          style={{ top: -26 }}
        >
          <span
            className="flex items-center justify-center rounded-full text-white transition-transform duration-150 group-active:scale-95"
            style={{
              width: 68,
              height: 68,
              border: '5px solid hsl(var(--background))',
              background:
                'radial-gradient(circle at 30% 25%, hsl(100 45% 62%), hsl(var(--primary)) 55%, hsl(100 42% 46%) 100%)',
              boxShadow:
                '0 14px 26px -6px hsl(var(--primary) / 0.50), 0 5px 12px -2px hsl(220 25% 12% / 0.20), inset 0 2px 3px hsl(0 0% 100% / 0.35), inset 0 -4px 8px hsl(100 50% 22% / 0.30)',
            }}
          >
            <RecordIcon />
          </span>
        </button>
      </nav>
    </div>
  );
};

export default BottomNav;
