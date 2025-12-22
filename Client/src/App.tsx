import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GlobalProvider } from "@/contexts/GlobalContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import VoiceCalls from "./pages/VoiceCalls";
import Appointments from "./pages/Appointments";
import Call from "./pages/Call";
import InboundTranscripts from "./pages/OutboundTranscripts";
import InboundTranscript from "./pages/InboundTranscript";
import DbChat from "./pages/DbChat";
import NotFound from "./pages/NotFound";
import OutboundTranscripts from "./pages/OutboundTranscripts";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <GlobalProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/chat" element={<Chat />} />
          <Route path="/dashboard/appointments" element={<Appointments />} />
          <Route path="/dashboard/lead-management" element={<VoiceCalls />} />
          <Route path="/dashboard/call" element={<Call />} />
          <Route path="/dashboard/outbound-transcripts" element={<OutboundTranscripts/>} />
          <Route path="/dashboard/inbound-transcript" element={<InboundTranscript />} />
          <Route path="/dashboard/db-chat" element={<DbChat />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </GlobalProvider>
  </QueryClientProvider>
);

export default App;
