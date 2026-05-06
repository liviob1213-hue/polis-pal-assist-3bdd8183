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
import PainelAssessor from "./pages/PainelAssessor";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Admin from "./pages/Admin";
import LoginAssessor from "./pages/LoginAssessor";
import CadastroAssessor from "./pages/CadastroAssessor";
import AprovarAssessores from "./pages/AprovarAssessores";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const loginPath = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to={loginPath} replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

function PoliticoRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, role } = useAuth();
  const location = useLocation();
  const loginPath = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to={loginPath} replace state={{ from: location.pathname + location.search }} />;
  // Aguarda o role carregar antes de decidir redirecionar (evita kick para "/" no primeiro render)
  if (!role) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (role !== "politico") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRoute() {
  const { role, loading } = useAuth();
  if (loading || !role) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }
  return role === "assessor" ? <PainelAssessor /> : <Dashboard />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const redirectParam = new URLSearchParams(location.search).get("redirect");
  const stateFrom = (location.state as { from?: string } | null)?.from;
  const redirectTo = redirectParam?.startsWith("/") ? redirectParam : stateFrom || "/";
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (user) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/cadastro" element={<PublicRoute><Cadastro /></PublicRoute>} />
        <Route path="/login-assessor" element={<PublicRoute><LoginAssessor /></PublicRoute>} />
        <Route path="/cadastro-assessor" element={<PublicRoute><CadastroAssessor /></PublicRoute>} />
        <Route path="/aprovar-assessores" element={<PoliticoRoute><AppLayout><AprovarAssessores /></AppLayout></PoliticoRoute>} />
        <Route path="/admin" element={<PoliticoRoute><AppLayout><Admin /></AppLayout></PoliticoRoute>} />
        <Route path="/" element={<ProtectedRoute><AppLayout><HomeRoute /></AppLayout></ProtectedRoute>} />
        <Route path="/eleitores" element={<PoliticoRoute><AppLayout><Eleitores /></AppLayout></PoliticoRoute>} />
        <Route path="/mapa-eleitores" element={<PoliticoRoute><AppLayout><MapaEleitores /></AppLayout></PoliticoRoute>} />
        <Route path="/demandas" element={<PoliticoRoute><AppLayout><Demandas /></AppLayout></PoliticoRoute>} />
        <Route path="/tarefas" element={<PoliticoRoute><AppLayout><Tarefas /></AppLayout></PoliticoRoute>} />
        <Route path="/agenda" element={<PoliticoRoute><AppLayout><Agenda /></AppLayout></PoliticoRoute>} />
        <Route path="/assistente" element={<PoliticoRoute><AppLayout><Assistente /></AppLayout></PoliticoRoute>} />
        <Route path="/aniversarios" element={<PoliticoRoute><AppLayout><Aniversarios /></AppLayout></PoliticoRoute>} />
        <Route path="/assessores" element={<PoliticoRoute><AppLayout><Assessores /></AppLayout></PoliticoRoute>} />
        <Route path="/historico-conversas" element={<PoliticoRoute><AppLayout><HistoricoConversas /></AppLayout></PoliticoRoute>} />
        <Route path="/resumo-mensal" element={<PoliticoRoute><AppLayout><ResumoMensal /></AppLayout></PoliticoRoute>} />
        <Route path="/base-conhecimento" element={<PoliticoRoute><AppLayout><BaseConhecimento /></AppLayout></PoliticoRoute>} />
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
