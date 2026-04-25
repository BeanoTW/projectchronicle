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
        className={`flex flex-1 flex-col items-center justify-center gap-[2px] transition-colors duration-200 ${
          active ? 'text-primary' : 'text-muted-foreground/90 hover:text-foreground'
        }`}
        style={{ paddingTop: 4, paddingBottom: 4 }}
        aria-label={label}
      >
        <Icon active={active} />
        <span className={`text-[10px] leading-tight ${active ? 'font-semibold' : 'font-medium'}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <div
      className="fixed left-1/2 z-50 -translate-x-1/2"
      style={{
        bottom: `calc(16px + env(safe-area-inset-bottom, 0px))`,
        width: 'calc(100% - 32px)',
        maxWidth: '720px',
      }}
    >
      {/* Nav bar with center cutout */}
      <nav
        className="relative h-[48px] rounded-[16px]"
        style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #f5f6f5 100%)',
          border: '1px solid rgba(20, 30, 40, 0.06)',
          boxShadow:
            '0 8px 16px -4px rgba(15, 23, 42, 0.05), 0 3px 6px -2px rgba(15, 23, 42, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
          WebkitMaskImage: `radial-gradient(circle 34px at 50% 0%, transparent 98%, black 100%)`,
          maskImage: `radial-gradient(circle 34px at 50% 0%, transparent 98%, black 100%)`,
        }}
      >
        {/* Side icons - symmetrical halves around the centre */}
        <div className="grid h-full" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="flex h-full items-center pr-6">
            {leftItems.map(renderItem)}
          </div>
          <div className="flex h-full items-center pl-4">
            {rightItems.map(renderItem)}
          </div>
        </div>
      </nav>

      {/* Elevated Record button — anchored, ~30% above nav */}
      <button
        onClick={() => navigate('/record')}
        aria-label="Record"
        className="absolute left-1/2 -translate-x-1/2 group"
        style={{ top: -14 }}
      >
        <span
          className="flex items-center justify-center rounded-full text-white transition-transform duration-150 group-active:scale-95"
          style={{
            width: 60,
            height: 60,
            border: '3px solid #ffffff',
            background:
              'radial-gradient(circle at 30% 25%, hsl(100 45% 62%), hsl(var(--primary)) 55%, hsl(100 42% 46%) 100%)',
            boxShadow:
              '0 6px 12px -3px hsl(var(--primary) / 0.22), 0 2px 4px -1px hsl(220 25% 12% / 0.05), inset 0 2px 3px hsl(0 0% 100% / 0.35), inset 0 -3px 6px hsl(100 50% 22% / 0.22)',
          }}
        >
          <RecordIcon />
        </span>
      </button>
    </div>
  );
};

export default BottomNav;