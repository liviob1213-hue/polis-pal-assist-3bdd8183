import { Navigate } from "react-router-dom";

// Cadastro público de político foi desativado.
// Contas de político/assessor são criadas pelo painel /admin (apenas por políticos logados).
// Assessores podem se inscrever em /cadastro-assessor.
export default function Cadastro() {
  return <Navigate to="/cadastro-assessor" replace />;
}
