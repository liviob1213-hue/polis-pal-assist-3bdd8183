import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("App error:", error);
    if ((window as any).reportError) (window as any).reportError(error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-dvh safe-area-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-background text-foreground">
        <img src="/favicon.png" alt="Democrat" className="h-16 w-16" />
        <p className="text-lg font-semibold">Ocorreu um erro ao carregar.</p>
        <Button
          onClick={() => window.location.reload()}
          size="lg"
        >
          Tentar novamente
        </Button>
      </div>
    );
  }
}
