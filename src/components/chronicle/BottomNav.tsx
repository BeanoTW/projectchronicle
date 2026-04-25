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

const NOTCH_DIAMETER = 76; // diameter of cutout, slightly larger than button

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

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="relative mx-3 mb-3 max-w-lg lg:mx-auto">
        {/* Nav bar with SVG-defined circular notch */}
        <div
          className="relative h-[60px]"
          style={{
            // Mask cuts a circular notch in the top centre of the bar
            WebkitMaskImage: `radial-gradient(circle ${NOTCH_DIAMETER / 2}px at 50% 0%, transparent 99%, black 100%)`,
            maskImage: `radial-gradient(circle ${NOTCH_DIAMETER / 2}px at 50% 0%, transparent 99%, black 100%)`,
          }}
        >
          <div className="absolute inset-0 rounded-2xl glass-nav border border-border shadow-[var(--shadow-elevated)]" />
          <div className="relative flex items-center h-full">
            {/* Left items */}
            <div className="flex h-full" style={{ width: `calc(50% - ${NOTCH_DIAMETER / 2}px)` }}>
              {leftItems.map(renderItem)}
            </div>
            {/* Centre gap reserved for record button */}
            <div style={{ width: NOTCH_DIAMETER }} aria-hidden />
            {/* Right items */}
            <div className="flex h-full" style={{ width: `calc(50% - ${NOTCH_DIAMETER / 2}px)` }}>
              {rightItems.map(renderItem)}
            </div>
          </div>
        </div>

        {/* Elevated Record button — absolutely centred, overlaps nav bar */}
        <button
          onClick={() => navigate('/record')}
          aria-label="Record"
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center group"
          style={{ top: -26 }}
        >
          <span
            className="w-[64px] h-[64px] rounded-full flex items-center justify-center text-white transition-transform duration-150 group-active:scale-95"
            style={{
              background:
                'radial-gradient(circle at 30% 25%, hsl(var(--primary) / 0.95), hsl(var(--primary)) 55%, hsl(var(--primary) / 0.88) 100%)',
              boxShadow:
                '0 12px 24px -8px hsl(var(--primary) / 0.55), 0 2px 6px hsl(var(--primary) / 0.25), inset 0 1px 0 hsl(0 0% 100% / 0.4), inset 0 -2px 4px hsl(var(--primary) / 0.4)',
            }}
          >
            <RecordIcon />
          </span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
