import { useLocation, useNavigate } from 'react-router-dom';
import { Settings, Home } from 'lucide-react';
import {
  TimelineIcon,
  RecordIcon,
  MyRecordIcon,
  SupportIcon,
} from './NavIcons';

const items = [
  { path: '/home', label: 'Home', Icon: Home as any, isLucide: true },
  { path: '/timeline', label: 'Notebook', Icon: TimelineIcon },
  { path: '/record', label: 'Capture', Icon: RecordIcon, primary: true },
  { path: '/export', label: 'My Record', Icon: MyRecordIcon },
  { path: '/support', label: 'Support', Icon: SupportIcon },
];

const DesktopSideNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <aside
      className="hidden md:flex flex-col shrink-0 sticky top-0 h-screen w-[232px] px-4 py-6 border-r border-border/60 bg-background/60 backdrop-blur-sm"
      aria-label="Primary"
    >
      <button
        onClick={() => navigate('/home')}
        className="flex items-center gap-2 px-2 mb-8 text-left"
        aria-label="Chronicle home"
      >
        <span className="font-serif text-[20px] font-medium text-foreground tracking-tight">
          Chronicle
        </span>
      </button>

      <nav className="flex flex-col gap-1">
        {items.map(({ path, label, Icon, primary, isLucide }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-all duration-150 ease-out active:scale-[0.98] ${
                active
                  ? primary
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'bg-accent text-foreground font-semibold'
                  : primary
                  ? 'text-primary/90 hover:bg-primary/5 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center ${
                  primary && !active ? 'text-primary' : ''
                }`}
              >
                {isLucide ? (
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.75} />
                ) : (
                  <Icon active={active} />
                )}
              </span>
              <span>{label}</span>
              {primary && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary/70" aria-hidden />
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 border-t border-border/60">
        <button
          onClick={() => navigate('/settings')}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-all duration-150 ease-out active:scale-[0.98] ${
            isActive('/settings')
              ? 'bg-accent text-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
          }`}
        >
          <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
};

export default DesktopSideNav;
