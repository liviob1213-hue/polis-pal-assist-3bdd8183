import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Não foi possível iniciar o aplicativo.");
}
try {
  createRoot(root).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} catch (e) {
  console.error(e);
  root.innerHTML =
    '<div style="min-height:100dvh;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;gap:16px;text-align:center;padding:max(env(safe-area-inset-top),24px) max(env(safe-area-inset-right),24px) max(env(safe-area-inset-bottom),24px) max(env(safe-area-inset-left),24px);background:#fff;color:#183634"><p>Ocorreu um erro ao carregar.</p><button onclick="location.reload()" style="padding:12px 24px;border-radius:8px;background:#449895;color:#fff;border:0">Tentar novamente</button></div>';
}

window.addEventListener("unhandledrejection", (e) => console.error("Unhandled:", e.reason));
