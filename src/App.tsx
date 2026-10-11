import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth, ROUTE_TO_PERMISSION, PermissionKey } from "@/hooks/useAuth";
import { HeaderSearchProvider } from "@/contexts/HeaderSearchContext";
import UpgradeGate from "@/components/UpgradeGate";
import type { LockableFeature } from "@/config/planFeatures";
// A landing é a porta de entrada: carrega junto com o bundle principal.
import Landing from "./pages/Landing";

// Demais páginas sob demanda — quem visita a página de vendas não baixa
// Google Maps, jsPDF, html2canvas, xlsx etc.
const AppLayout = lazy(() => import("@/components/AppLayout").then((m) => ({ default: m.AppLayout })));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Eleitores = lazy(() => import("./pages/Eleitores"));
const MapaEleitores = lazy(() => import("./pages/MapaEleitores"));
const Demandas = lazy(() => import("./pages/Demandas"));
const Tarefas = lazy(() => import("./pages/Tarefas"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Assistente = lazy(() => import("./pages/Assistente"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Aniversarios = lazy(() => import("./pages/Aniversarios"));
const Assessores = lazy(() => import("./pages/Assessores"));
const Tutoriais = lazy(() => import("./pages/Tutoriais"));
const ResumoMensal = lazy(() => import("./pages/ResumoMensal"));
const BaseConhecimento = lazy(() => import("./pages/BaseConhecimento"));
const PainelAssessor = lazy(() => import("./pages/PainelAssessor"));
const Login = lazy(() => import("./pages/Login"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const Admin = lazy(() => import("./pages/Admin"));
const AcessoWebhook = lazy(() => import("./pages/AcessoWebhook"));
const LoginAssessor = lazy(() => import("./pages/LoginAssessor"));
const MartaMurta = lazy(() => import("./pages/MartaMurta"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));

const queryClient = new QueryClient();

const Spinner = () => (
  <div className="min-h-dvh safe-area-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
    <img src="/favicon.png" alt="Democrat" className="h-16 w-16" onError={(e) => (e.currentTarget.style.display = "none")} />
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    <p className="text-sm text-muted-foreground">Carregando...</p>
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const loginPath = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;
  if (loading) return <Spinner />;
  if (!user) return <Navigate to={loginPath} replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

function PoliticoRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, role } = useAuth();
  const location = useLocation();
  const loginPath = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;
  if (loading) return <Spinner />;
  if (!user) return <Navigate to={loginPath} replace state={{ from: location.pathname + location.search }} />;
  if (!role && user) return <Spinner />;
  if (role !== "politico") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PlanGate({ children, feature }: { children: React.ReactNode; feature: LockableFeature }) {
  const { isLite } = useAuth();
  if (isLite) return <UpgradeGate feature={feature} />;
  return <>{children}</>;
}

function PermissionRoute({ children, permission, requirePlan }: { children: React.ReactNode; permission: PermissionKey; requirePlan?: ("prata" | "ouro")[] }) {
  const { user, loading, role, permissions, permsLoaded, plano } = useAuth();
  const location = useLocation();
  const loginPath = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;

  useEffect(() => {
    if (permsLoaded && !loading && user && role === "assessor" && !permissions[permission]) {
      toast.error("Você não tem permissão para acessar essa página.");
    }
  }, [permsLoaded, loading, user, role, permissions, permission]);

  useEffect(() => {
    if (!loading && user && requirePlan && !requirePlan.includes(plano as any)) {
      toast.error("Recurso disponível apenas nos planos Prata e Ouro. Faça upgrade para acessar.");
    }
  }, [loading, user, plano, requirePlan]);

  if (loading || !permsLoaded) return <Spinner />;
  if (!user) return <Navigate to={loginPath} replace state={{ from: location.pathname + location.search }} />;
  if (!role && user) return <Spinner />;

  const allowed = role === "politico" || (role === "assessor" && permissions[permission] === true);
  if (!allowed) return <Navigate to="/" replace />;
  if (requirePlan && !requirePlan.includes(plano as any)) return <Navigate to="/painel" replace />;

  return <>{children}</>;
}

function HomeRoute() {
  const { user, role, loading, permissions, permsLoaded } = useAuth();
  if (loading || !permsLoaded || !role && user) return <Spinner />;
  if (!role) return <Navigate to="/login" replace />;
  if (role === "assessor" && !permissions["painel"]) {
    // Sem permissão para painel: tenta primeira rota liberada
    const first = Object.entries(ROUTE_TO_PERMISSION).find(([, k]) => k !== "painel" && permissions[k]);
    if (first) return <Navigate to={first[0]} replace />;
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 text-center text-muted-foreground">
        Nenhuma função foi liberada para você. Fale com o político responsável.
      </div>
    );
  }
  return role === "assessor" ? <PainelAssessor /> : <Dashboard />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const redirectParam = new URLSearchParams(location.search).get("redirect");
  const stateFrom = (location.state as { from?: string } | null)?.from;
  const redirectTo = redirectParam?.startsWith("/") && !redirectParam.startsWith("//") ? redirectParam : stateFrom || "/painel";
  if (loading) return <Spinner />;
  if (user) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Suspense key={location.pathname} fallback={<Spinner />}>
      <Routes location={location}>
        <Route path="/" element={<Landing />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/politica-privacidade" element={<PoliticaPrivacidade />} />

        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/cadastro" element={<PublicRoute><Cadastro /></PublicRoute>} />
        <Route path="/login-assessor" element={<PublicRoute><LoginAssessor /></PublicRoute>} />
        <Route path="/cadastro-assessor" element={<Navigate to="/login-assessor" replace />} />
        <Route path="/martamurta" element={<MartaMurta />} />

        <Route path="/admin" element={<PoliticoRoute><AppLayout><Admin /></AppLayout></PoliticoRoute>} />
        <Route path="/acesso-webhook" element={<AcessoWebhook />} />
        <Route path="/assessores" element={<PoliticoRoute><AppLayout><PlanGate feature="assessores"><Assessores /></PlanGate></AppLayout></PoliticoRoute>} />
        <Route path="/painel" element={<ProtectedRoute><AppLayout><HomeRoute /></AppLayout></ProtectedRoute>} />
        <Route path="/eleitores" element={<PermissionRoute permission="eleitores"><AppLayout><Eleitores /></AppLayout></PermissionRoute>} />
        <Route path="/mapa-eleitores" element={<PermissionRoute permission="mapa-eleitores"><AppLayout><MapaEleitores /></AppLayout></PermissionRoute>} />
        <Route path="/demandas" element={<PermissionRoute permission="demandas"><AppLayout><Demandas /></AppLayout></PermissionRoute>} />
        <Route path="/tarefas" element={<PermissionRoute permission="tarefas"><AppLayout><PlanGate feature="tarefas"><Tarefas /></PlanGate></AppLayout></PermissionRoute>} />
        <Route path="/agenda" element={<PermissionRoute permission="agenda"><AppLayout><PlanGate feature="agenda"><Agenda /></PlanGate></AppLayout></PermissionRoute>} />
        <Route path="/assistente" element={<PermissionRoute permission="assistente"><AppLayout><PlanGate feature="assistente"><Assistente /></PlanGate></AppLayout></PermissionRoute>} />
        <Route path="/aniversarios" element={<PermissionRoute permission="aniversarios"><AppLayout><Aniversarios /></AppLayout></PermissionRoute>} />
        <Route path="/tutoriais" element={<ProtectedRoute><AppLayout><Tutoriais /></AppLayout></ProtectedRoute>} />
        <Route path="/resumo-mensal" element={<PermissionRoute permission="resumo-mensal"><AppLayout><PlanGate feature="resumo-mensal"><ResumoMensal /></PlanGate></AppLayout></PermissionRoute>} />
        <Route path="/base-conhecimento" element={<PermissionRoute permission="base-conhecimento"><AppLayout><PlanGate feature="base-conhecimento"><BaseConhecimento /></PlanGate></AppLayout></PermissionRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><AppLayout><Configuracoes /></AppLayout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </Suspense>
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
          <HeaderSearchProvider>
            <AnimatedRoutes />
          </HeaderSearchProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
