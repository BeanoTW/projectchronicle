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
import PatternsScreen from "./pages/InsightsScreen";
import EvidenceScreen from "./pages/EvidenceScreen";
import RightsScreen from "./pages/RightsScreen";
import ExportScreen from "./pages/ExportScreen";
import SettingsScreen from "./pages/SettingsScreen";
import IncidentDetailScreen from "./pages/IncidentDetailScreen";
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
            <Route path="/patterns" element={<ProtectedRoute><AppLayout><PatternsScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute><AppLayout><PatternsScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/attachments" element={<ProtectedRoute><AppLayout><EvidenceScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/evidence" element={<ProtectedRoute><AppLayout><EvidenceScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/rights" element={<ProtectedRoute><AppLayout><RightsScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/export" element={<ProtectedRoute><AppLayout><ExportScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><AppLayout><SettingsScreen /></AppLayout></ProtectedRoute>} />
            <Route path="/incident/:id" element={<ProtectedRoute><AppLayout><IncidentDetailScreen /></AppLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </DevModeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
