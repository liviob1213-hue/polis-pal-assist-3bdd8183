import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Dashboard from "./pages/Dashboard";
import Eleitores from "./pages/Eleitores";
import MapaEleitores from "./pages/MapaEleitores";
import Demandas from "./pages/Demandas";
import Tarefas from "./pages/Tarefas";
import Agenda from "./pages/Agenda";
import Assistente from "./pages/Assistente";
import Configuracoes from "./pages/Configuracoes";
import Aniversarios from "./pages/Aniversarios";
import Assessores from "./pages/Assessores";
import HistoricoConversas from "./pages/HistoricoConversas";
import ResumoMensal from "./pages/ResumoMensal";
import BaseConhecimento from "./pages/BaseConhecimento";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PoliticoRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, role } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== "politico") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/cadastro" element={<PublicRoute><Cadastro /></PublicRoute>} />
        <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/eleitores" element={<ProtectedRoute><AppLayout><Eleitores /></AppLayout></ProtectedRoute>} />
        <Route path="/mapa-eleitores" element={<ProtectedRoute><AppLayout><MapaEleitores /></AppLayout></ProtectedRoute>} />
        <Route path="/demandas" element={<ProtectedRoute><AppLayout><Demandas /></AppLayout></ProtectedRoute>} />
        <Route path="/tarefas" element={<ProtectedRoute><AppLayout><Tarefas /></AppLayout></ProtectedRoute>} />
        <Route path="/agenda" element={<ProtectedRoute><AppLayout><Agenda /></AppLayout></ProtectedRoute>} />
        <Route path="/assistente" element={<ProtectedRoute><AppLayout><Assistente /></AppLayout></ProtectedRoute>} />
        <Route path="/aniversarios" element={<ProtectedRoute><AppLayout><Aniversarios /></AppLayout></ProtectedRoute>} />
        <Route path="/assessores" element={<PoliticoRoute><AppLayout><Assessores /></AppLayout></PoliticoRoute>} />
        <Route path="/historico-conversas" element={<ProtectedRoute><AppLayout><HistoricoConversas /></AppLayout></ProtectedRoute>} />
        <Route path="/resumo-mensal" element={<ProtectedRoute><AppLayout><ResumoMensal /></AppLayout></ProtectedRoute>} />
        <Route path="/base-conhecimento" element={<ProtectedRoute><AppLayout><BaseConhecimento /></AppLayout></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><AppLayout><Configuracoes /></AppLayout></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AnimatedRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
