import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

const root = document.getElementById("root")!;
try {
  createRoot(root).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} catch (e) {
  console.error(e);
  root.innerHTML =
    '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;gap:16px;text-align:center;padding:24px"><p>Ocorreu um erro ao carregar.</p><button onclick="location.reload()" style="padding:12px 24px;border-radius:8px;background:#449895;color:#fff;border:0">Toque para tentar novamente</button></div>';
}

window.addEventListener("unhandledrejection", (e) => console.error("Unhandled:", e.reason));
