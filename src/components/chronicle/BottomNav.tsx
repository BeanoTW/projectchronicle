import { useLocation, useNavigate } from 'react-router-dom';
import {
  TimelineIcon,
  CalendarIcon,
  RecordIcon,
  MyRecordIcon,
  SupportIcon,
} from './NavIcons';
import { useFullV2 } from '@/hooks/useFeatureFlag';

// In full V2 the chronology is the Notebook. Labels converge; routes do not move.
const leftItems = (fullV2: boolean) => [
  { path: '/timeline', label: fullV2 ? 'Notebook' : 'Timeline', Icon: TimelineIcon },
  { path: '/calendar', label: 'Calendar', Icon: CalendarIcon },
];

// In full V2, "My Record" is the workspace where records are selected and a
// report is generated. The URL (/export) stays stable for deep links.
const rightItems = (fullV2: boolean) => [
  { path: fullV2 ? '/export' : '/my-record', label: 'My Record', Icon: MyRecordIcon },
  { path: '/support', label: 'Support', Icon: SupportIcon },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const fullV2 = useFullV2();

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
      data-testid="v1-bottom-nav"
      className="fixed left-1/2 z-50 -translate-x-1/2 md:hidden"
      style={{
        bottom: `calc(16px + env(safe-area-inset-bottom, 0px))`,
        width: 'calc(100% - 32px)',
        maxWidth: '720px',
      }}
    >
      {/* Continuous frosted-glass nav pill — no cut-out, centre orb floats above */}
      <nav className="iridescent-nav relative h-[56px] rounded-[22px] overflow-hidden">
        <div className="relative grid h-full" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="flex h-full items-center pl-1 pr-10">
            {leftItems(fullV2).map(renderItem)}
          </div>
          <div className="flex h-full items-center pl-10 pr-1">
            {rightItems(fullV2).map(renderItem)}
          </div>
        </div>
      </nav>

      {/* Elevated Record button — dark glass iridescent orb */}
      <button
        onClick={() => navigate('/record')}
        aria-label={fullV2 ? 'Capture' : 'Record'}
        className="absolute left-1/2 -translate-x-1/2 z-10 group"
        style={{ top: -18 }}
      >
        <span
          className="iridescent-orb relative flex items-center justify-center rounded-full text-foreground/75 dark:text-white transition-all duration-150 ease-out group-active:scale-[0.96]"
          style={{ width: 60, height: 60 }}
        >
          <RecordIcon />
        </span>
      </button>
    </div>
  );
};

export default BottomNav;