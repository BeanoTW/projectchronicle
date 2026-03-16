import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BottomNav from "@/components/chronicle/BottomNav";
import OnboardingScreen from "./pages/OnboardingScreen";
import RecordScreen from "./pages/RecordScreen";
import TimelineScreen from "./pages/TimelineScreen";
import InsightsScreen from "./pages/InsightsScreen";
import EvidenceScreen from "./pages/EvidenceScreen";
import RightsScreen from "./pages/RightsScreen";
import ExportScreen from "./pages/ExportScreen";
import IncidentDetailScreen from "./pages/IncidentDetailScreen";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-lg mx-auto">
    {children}
    <BottomNav />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<OnboardingScreen />} />
          <Route path="/record" element={<AppLayout><RecordScreen /></AppLayout>} />
          <Route path="/timeline" element={<AppLayout><TimelineScreen /></AppLayout>} />
          <Route path="/insights" element={<AppLayout><InsightsScreen /></AppLayout>} />
          <Route path="/evidence" element={<AppLayout><EvidenceScreen /></AppLayout>} />
          <Route path="/rights" element={<AppLayout><RightsScreen /></AppLayout>} />
          <Route path="/export" element={<AppLayout><ExportScreen /></AppLayout>} />
          <Route path="/incident/:id" element={<AppLayout><IncidentDetailScreen /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
