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
          active ? 'text-primary' : 'text-white/75 hover:text-white'
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
        className="relative h-[48px] rounded-[18px] overflow-hidden backdrop-blur-md backdrop-saturate-150 bg-[rgba(30,34,38,0.34)] dark:bg-[rgba(10,12,16,0.5)] border border-[rgba(255,255,255,0.18)] dark:border-[rgba(255,255,255,0.08)] shadow-[0_8px_20px_-6px_rgba(15,23,42,0.18),0_2px_6px_-2px_rgba(15,23,42,0.10)] dark:shadow-[0_10px_24px_-6px_rgba(0,0,0,0.55),0_2px_8px_-2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]"
        style={{
          WebkitMaskImage: `radial-gradient(circle 34px at 50% 0%, transparent 98%, black 100%)`,
          maskImage: `radial-gradient(circle 34px at 50% 0%, transparent 98%, black 100%)`,
        }}
      >
        {/* Subtle smoked gradient overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] to-black/15 dark:from-white/[0.03] dark:to-black/25"
        />

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

      {/* Elevated Record button — anchored, ~30% above nav */}
      <button
        onClick={() => navigate('/record')}
        aria-label="Record"
        className="absolute left-1/2 -translate-x-1/2 z-10 group"
        style={{ top: -14 }}
      >
        <span
          className="flex items-center justify-center rounded-full text-white transition-all duration-100 ease-out group-active:scale-[0.96] border-[3px] border-white dark:border-[hsl(220_18%_14%)] shadow-[0_10px_20px_-4px_hsl(220_25%_12%/0.16),0_3px_8px_-2px_hsl(220_25%_12%/0.10),inset_0_1px_1.5px_hsl(0_0%_100%/0.40),inset_0_-2px_4px_hsl(100_50%_22%/0.18)] dark:shadow-[0_8px_18px_-6px_hsl(0_0%_0%/0.55),0_2px_6px_-2px_hsl(0_0%_0%/0.4),inset_0_1px_1px_hsl(0_0%_100%/0.18)]"
          style={{
            width: 60,
            height: 60,
            background:
              'linear-gradient(180deg, hsl(100 44% 60%) 0%, hsl(var(--primary)) 50%, hsl(100 42% 50%) 100%)',
          }}
        >
          <RecordIcon />
        </span>
      </button>
    </div>
  );
};

export default BottomNav;