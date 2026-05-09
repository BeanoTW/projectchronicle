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
        className={`flex flex-1 flex-col items-center justify-center gap-[2px] transition-colors duration-150 ease-out active:scale-[0.97] ${
          active
            ? 'text-primary dark:text-primary'
            : 'text-muted-foreground/80 hover:text-foreground dark:text-white/70 dark:hover:text-white'
        }`}
        style={{ paddingTop: 4, paddingBottom: 4 }}
        aria-label={label}
      >
        <span
          className="transition-transform duration-150 ease-out"
          style={{ transform: active ? 'scale(1.05)' : 'scale(1)' }}
        >
          <Icon active={active} />
        </span>
        <span className={`text-[10px] leading-tight transition-all duration-150 ease-out ${active ? 'font-semibold' : 'font-medium'}`}>
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
        className="iridescent-nav relative h-[48px] rounded-[22px] overflow-hidden"
        style={{
          WebkitMaskImage: `radial-gradient(circle 34px at 50% 0%, transparent 98%, black 100%)`,
          maskImage: `radial-gradient(circle 34px at 50% 0%, transparent 98%, black 100%)`,
        }}
      >
        {/* Side icons - symmetrical halves around the centre */}
        <div className="relative grid h-full" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="flex h-full items-center pl-1 pr-8">
            {leftItems.map(renderItem)}
          </div>
          <div className="flex h-full items-center pl-8 pr-1">
            {rightItems.map(renderItem)}
          </div>
        </div>
      </nav>

      {/* Elevated Record button — dark glass iridescent orb */}
      <button
        onClick={() => navigate('/record')}
        aria-label="Record"
        className="absolute left-1/2 -translate-x-1/2 z-10 group"
        style={{ top: -14 }}
      >
        <span
          className="relative flex items-center justify-center rounded-full text-white transition-all duration-150 ease-out group-active:scale-[0.96]"
          style={{
            width: 60,
            height: 60,
            background:
              'radial-gradient(circle at 30% 28%, hsl(280 60% 55% / 0.32) 0%, transparent 55%), radial-gradient(circle at 75% 70%, hsl(190 70% 50% / 0.28) 0%, transparent 55%), radial-gradient(circle at 50% 90%, hsl(140 55% 50% / 0.22) 0%, transparent 60%), linear-gradient(160deg, hsl(220 22% 14%) 0%, hsl(220 25% 9%) 100%)',
            border: '1.25px solid hsl(var(--primary) / 0.6)',
            boxShadow:
              '0 0 22px -2px hsl(var(--primary) / 0.28), 0 8px 18px -6px hsl(0 0% 0% / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.08), inset 0 -6px 14px hsl(0 0% 0% / 0.45)',
          }}
        >
          <RecordIcon />
        </span>
      </button>
    </div>
  );
};

export default BottomNav;