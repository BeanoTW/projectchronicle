import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DevModeProvider } from "@/contexts/DevModeContext";
import { BackupProvider } from "@/contexts/BackupContext";
import { PrivacyProvider } from "@/contexts/PrivacyContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LockProvider, useLock } from "@/contexts/LockContext";
import { AttachmentRevealProvider } from "@/contexts/AttachmentRevealContext";
import LockGate from "@/components/chronicle/LockGate";
import AttachmentUnlockDialog from "@/components/chronicle/AttachmentUnlockDialog";
import AppBottomNav from "@/components/chronicle/AppBottomNav";

import AppSideNav from "@/components/chronicle/AppSideNav";
import AuthDebugPanel from "@/components/chronicle/AuthDebugPanel";
import ScrollRestoration from "@/components/chronicle/ScrollRestoration";
import UpdateBanner from "@/components/chronicle/UpdateBanner";
import WelcomeScreen from "./pages/WelcomeScreen";
import LoginScreen from "./pages/LoginScreen";
import SignupScreen from "./pages/SignupScreen";
import ForgotPasswordScreen from "./pages/ForgotPasswordScreen";
import ResetPasswordScreen from "./pages/ResetPasswordScreen";
import AuthCallbackScreen from "./pages/AuthCallbackScreen";
import CaptureScreen from "./pages/CaptureScreen";
import CaptureDetailsScreen from "./pages/CaptureDetailsScreen";
import NotebookScreen from "./pages/NotebookScreen";
import MyRecordScreen from "./pages/MyRecordScreen";
import EvidenceScreen from "./pages/EvidenceScreen";
import SupportScreen from "./pages/SupportScreen";
import SettingsScreen from "./pages/SettingsScreen";
import EntryScreen from "./pages/EntryScreen";
import NotFound from "./pages/NotFound";
import GuidesIndex from "./pages/guides/GuidesIndex";
import {
  HowToDocument,
  ProveBullying,
  PrepareTimeline,
  TribunalEvidence,
  WorkDiary,
  RaiseGrievance,
} from "./pages/guides/GuidePages";
import FaqPage from "./pages/FaqPage";
import PrivacyPage from "./pages/PrivacyPage";
import AboutPage from "./pages/AboutPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import OAuthConsentScreen from "./pages/OAuthConsentScreen";


const queryClient = new QueryClient();

// One canonical shell for every account. Desktop gets a persistent left rail,
// mobile keeps the accepted bottom bar. Same routes, same screens.
const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="proto-root proto-shell" data-testid="app-shell">
    <AppSideNav />
    <div className="proto-shell-main">
      {children}
      <AppBottomNav />
    </div>
    <AuthDebugPanel />
  </div>
);


const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { isLocked, isLockConfigured } = useLock();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  if (!user) {
    // Preserve the intended destination; PublicRoute honours a safe `next`.
    const intended = window.location.pathname + window.location.search;
    const next = intended && intended !== '/' ? `?next=${encodeURIComponent(intended)}` : '';
    return <Navigate to={`/${next}`} replace />;
  }
  if (isLockConfigured && isLocked) return <LockGate />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  if (user) {
    const next = new URLSearchParams(window.location.search).get('next');
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
    if (safeNext) {
      window.location.replace(safeNext);
      return null;
    }
    return <Navigate to="/timeline" replace />;
  }
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider>
      <LockProvider>
      <BackupProvider>
      <PrivacyProvider>
      <DevModeProvider>
      <AttachmentRevealProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <UpdateBanner />
        <AttachmentUnlockDialog />
        <BrowserRouter>
          <ScrollRestoration />
          <Routes>
            <Route path="/" element={<PublicRoute><WelcomeScreen /></PublicRoute>} />
            <Route path="/login" element={<PublicRoute><LoginScreen /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignupScreen /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordScreen /></PublicRoute>} />
            <Route path="/reset-password" element={<ResetPasswordScreen />} />
            <Route path="/auth/callback" element={<AuthCallbackScreen />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsentScreen />} />
            <Route path="/home" element={<Navigate to="/timeline" replace />} />
            <Route path="/record" element={<ProtectedRoute><AppLayout><CaptureScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/record/details/:id" element={<ProtectedRoute><AppLayout><CaptureDetailsScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/timeline" element={<ProtectedRoute><AppLayout><NotebookScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/calendar" element={<Navigate to="/timeline" replace />} />
            <Route path="/activity" element={<Navigate to="/timeline" replace />} />
            <Route path="/flow" element={<Navigate to="/timeline" replace />} />
            <Route path="/my-record" element={<Navigate to="/export" replace />} />
            <Route path="/patterns" element={<Navigate to="/export" replace />} />
            <Route path="/insights" element={<Navigate to="/export" replace />} />
            <Route path="/attachments" element={<ProtectedRoute><AppLayout><EvidenceScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/evidence" element={<ProtectedRoute><AppLayout><EvidenceScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute><AppLayout><SupportScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/rights" element={<Navigate to="/support" replace />} />
            <Route path="/export" element={<ProtectedRoute><AppLayout><MyRecordScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><AppLayout><SettingsScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/incident/:id" element={<ProtectedRoute><AppLayout><EntryScreen /></AppLayout></ProtectedRoute>} />

            {/* Public marketing & content surfaces (indexable, no auth) */}
            <Route path="/about" element={<AboutPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/guides" element={<GuidesIndex />} />
            <Route path="/guides/how-to-document-workplace-incidents" element={<HowToDocument />} />
            <Route path="/guides/how-to-prove-workplace-bullying" element={<ProveBullying />} />
            <Route path="/guides/preparing-a-timeline-for-a-grievance" element={<PrepareTimeline />} />
            <Route path="/guides/evidence-for-an-employment-tribunal" element={<TribunalEvidence />} />
            <Route path="/guides/keeping-a-work-diary" element={<WorkDiary />} />
            <Route path="/guides/raising-a-grievance-at-work" element={<RaiseGrievance />} />

            {/* Retired preview/prototype shell — existing links land on the Notebook. */}
            <Route path="/v2/*" element={<Navigate to="/timeline" replace />} />
            <Route path="/prototype/*" element={<Navigate to="/timeline" replace />} />

            <Route path="*" element={<NotFound />} />

          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </AttachmentRevealProvider>
      </DevModeProvider>
      </PrivacyProvider>
      </BackupProvider>
      </LockProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
