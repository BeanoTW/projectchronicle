import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DevModeProvider } from "@/contexts/DevModeContext";
import BottomNav from "@/components/chronicle/BottomNav";
import WelcomeScreen from "./pages/WelcomeScreen";
import LoginScreen from "./pages/LoginScreen";
import SignupScreen from "./pages/SignupScreen";
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

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-lg mx-auto">
    {children}
    <BottomNav />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  if (user) return <Navigate to="/home" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <DevModeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicRoute><WelcomeScreen /></PublicRoute>} />
            <Route path="/login" element={<PublicRoute><LoginScreen /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignupScreen /></PublicRoute>} />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </DevModeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
