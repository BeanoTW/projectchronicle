// Canonical authenticated Home route. Real production data only.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIncidents } from '@/hooks/useIncidents';
import { useBackup } from '@/contexts/BackupContext';
import { usePrivacy } from '@/contexts/PrivacyContext';
import AppSurface from '@/chronicle/shared/AppSurface';
import HomeView from '@/chronicle/shared/HomeView';
import { buildHomeState } from '@/chronicle/shared/homeModel';
import '@/chronicle/styles.css';

const HomeScreen = () => {
  const navigate = useNavigate();
  const { data: incidents, isLoading } = useIncidents();
  const { backupEnabled } = useBackup();
  const privacy = usePrivacy();

  const state = useMemo(
    () => buildHomeState({ incidents: incidents ?? [], backupEnabled }),
    [incidents, backupEnabled],
  );

  // Privacy Shield masks the only free-text Home surfaces (the latest record
  // title) exactly as it does elsewhere. Display-only.
  const shown = useMemo(() => {
    if (!privacy.enabled || !state.latest) return state;
    return { ...state, latest: { ...state.latest, title: privacy.maskText(state.latest.title) } };
  }, [state, privacy]);

  return (
    <AppSurface>
      <div className="proto-page">
        <HomeView
          state={shown}
          loading={isLoading}
          onCapture={() => navigate('/record')}
          onOpenNotebook={() => navigate('/timeline')}
          onOpenMyRecord={() => navigate('/export')}
          onOpenRecord={id => navigate(`/incident/${id}`)}
          onNavigate={path => navigate(path)}
        />
      </div>
    </AppSurface>
  );
};

export default HomeScreen;
