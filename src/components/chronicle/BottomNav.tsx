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
        className={`flex flex-1 flex-col items-center justify-center gap-[2px] transition-colors duration-120 ease-out active:scale-[0.97] ${
          active ? 'text-primary' : 'text-muted-foreground/80 hover:text-foreground'
        }`}
        style={{ paddingTop: 4, paddingBottom: 4 }}
        aria-label={label}
      >
        <span
          className="transition-transform duration-120 ease-out"
          style={{ transform: active ? 'scale(1.05)' : 'scale(1)' }}
        >
          <Icon active={active} />
        </span>
        <span className={`text-[10px] leading-tight transition-all duration-120 ease-out ${active ? 'font-semibold' : 'font-medium'}`}>
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
        className="relative h-[48px] rounded-[18px]"
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
          <div className="flex h-full items-center pl-1 pr-8">
            {leftItems.map(renderItem)}
          </div>
          <div className="flex h-full items-center pl-8 pr-1">
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
              'linear-gradient(180deg, hsl(100 44% 60%) 0%, hsl(var(--primary)) 50%, hsl(100 42% 50%) 100%)',
            boxShadow:
              '0 10px 20px -4px hsl(220 25% 12% / 0.16), 0 3px 8px -2px hsl(220 25% 12% / 0.10), inset 0 1px 1.5px hsl(0 0% 100% / 0.40), inset 0 -2px 4px hsl(100 50% 22% / 0.18)',
          }}
        >
          <RecordIcon />
        </span>
      </button>
    </div>
  );
};

export default BottomNav;