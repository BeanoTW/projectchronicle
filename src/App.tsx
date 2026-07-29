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
import BottomNav from "@/components/chronicle/BottomNav";
import DesktopSideNav from "@/components/chronicle/DesktopSideNav";
import AuthDebugPanel from "@/components/chronicle/AuthDebugPanel";
import UpdateBanner from "@/components/chronicle/UpdateBanner";
import WelcomeScreen from "./pages/WelcomeScreen";
import LoginScreen from "./pages/LoginScreen";
import SignupScreen from "./pages/SignupScreen";
import ForgotPasswordScreen from "./pages/ForgotPasswordScreen";
import ResetPasswordScreen from "./pages/ResetPasswordScreen";
import AuthCallbackScreen from "./pages/AuthCallbackScreen";
import HomeScreen from "./pages/HomeScreen";
import RecordScreen from "./pages/RecordScreen";
import TimelineScreen from "./pages/TimelineScreen";
import FlowScreen from "./pages/FlowScreen";
import CalendarScreen from "./pages/CalendarScreen";
import MyRecordScreen from "./pages/MyRecordScreen";
import EvidenceScreen from "./pages/EvidenceScreen";
import SupportScreen from "./pages/SupportScreen";
import ExportScreen from "./pages/ExportScreen";
import SettingsScreen from "./pages/SettingsScreen";
import IncidentDetailScreen from "./pages/IncidentDetailScreen";
import ReviewScreen from "./pages/ReviewScreen";
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
import PrototypeApp from "./prototype/PrototypeApp";


const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="md:flex md:h-screen md:overflow-hidden">
    <DesktopSideNav />
    <div className="flex-1 min-w-0 max-w-lg mx-auto md:max-w-none md:mx-0 md:h-screen md:overflow-y-auto">
      <div className="md:max-w-5xl md:mx-auto md:px-4 md:py-2">
        {children}
      </div>
    </div>
    <BottomNav />
    <AuthDebugPanel />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { isLocked, isLockConfigured } = useLock();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  if (!user) return <Navigate to="/" replace />;
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
    return <Navigate to="/home" replace />;
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
          <Routes>
            <Route path="/" element={<PublicRoute><WelcomeScreen /></PublicRoute>} />
            <Route path="/login" element={<PublicRoute><LoginScreen /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignupScreen /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordScreen /></PublicRoute>} />
            <Route path="/reset-password" element={<ResetPasswordScreen />} />
            <Route path="/auth/callback" element={<AuthCallbackScreen />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsentScreen />} />
            <Route path="/home" element={<ProtectedRoute><AppLayout><HomeScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/record" element={<ProtectedRoute><AppLayout><RecordScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/timeline" element={<ProtectedRoute><AppLayout><TimelineScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><AppLayout><CalendarScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/activity" element={<Navigate to="/calendar" replace />} />
            <Route path="/flow" element={<Navigate to="/calendar" replace />} />
            <Route path="/my-record" element={<ProtectedRoute><AppLayout><MyRecordScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/patterns" element={<Navigate to="/my-record" replace />} />
            <Route path="/insights" element={<Navigate to="/my-record" replace />} />
            <Route path="/attachments" element={<ProtectedRoute><AppLayout><EvidenceScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/evidence" element={<ProtectedRoute><AppLayout><EvidenceScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute><AppLayout><SupportScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/rights" element={<Navigate to="/support" replace />} />
            <Route path="/export" element={<ProtectedRoute><AppLayout><ExportScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><AppLayout><SettingsScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/incident/:id" element={<ProtectedRoute><AppLayout><IncidentDetailScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/review" element={<ProtectedRoute><AppLayout><ReviewScreen /></AppLayout></ProtectedRoute>} />

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

            {/* Isolated design prototype — separate Dexie DB, no production writes */}
            <Route path="/prototype/*" element={<PrototypeApp />} />

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
