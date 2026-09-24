import { Component, ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("App error:", error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-background text-foreground">
        <img src="/favicon.png" alt="Democrat" className="h-16 w-16" />
        <p className="text-lg font-semibold">Ocorreu um erro ao carregar.</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium"
        >
          Toque para tentar novamente
        </button>
      </div>
    );
  }
}
