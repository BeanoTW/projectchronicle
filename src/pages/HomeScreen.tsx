// Canonical authenticated Home route. Real production data only.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIncidents } from '@/hooks/useIncidents';
import { useBackup } from '@/contexts/BackupContext';
import { usePrivacy } from '@/contexts/PrivacyContext';
import AppSurface from '@/chronicle/shared/AppSurface';
import HomeView from '@/chronicle/shared/HomeView';
import { buildHomeState } from '@/chronicle/shared/homeModel';
import GuidanceTour from '@/chronicle/guidance/GuidanceTour';
import { appTourSteps, APP_TOUR_FINAL_NOTE } from '@/chronicle/guidance/tours';
import { useGuidance } from '@/chronicle/guidance/useGuidance';
import { isNewAccount } from '@/chronicle/guidance/guidanceModel';
import { useAuth } from '@/contexts/AuthContext';
import '@/chronicle/styles.css';

const HomeScreen = () => {
  const navigate = useNavigate();
  const { data: incidents, isLoading } = useIncidents();
  const { backupEnabled } = useBackup();
  const privacy = usePrivacy();
  const { user } = useAuth();

  /* Only a genuinely new, empty account is offered the introduction, and only
     once. Established accounts are never interrupted. Guidance is presentation
     only: it never touches routing, authentication or records. */
  const eligible =
    !isLoading && !!user && isNewAccount(user.created_at, (incidents ?? []).length);
  const guidance = useGuidance('app_intro_completed', eligible);

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
      <GuidanceTour
        steps={appTourSteps}
        open={guidance.open}
        label="Introduction to Project Chronicle"
        onEnd={guidance.end}
        finalNote={APP_TOUR_FINAL_NOTE}
        finalAction={{ label: 'Start recording', onClick: () => navigate('/record') }}
        testId="app-guidance"
      />
    </AppSurface>
  );
};

export default HomeScreen;
