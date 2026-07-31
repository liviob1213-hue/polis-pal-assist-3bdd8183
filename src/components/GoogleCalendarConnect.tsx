import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL ?? "https://aecwbjydyoxkonqbkfft.supabase.co"}/functions/v1`;

const GoogleCalendarConnect = () => {
  const { toast } = useToast();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    const { data, error } = await supabase.functions.invoke("google-auth", { body: { action: "status" } });
    if (error) { setConnected(false); return; }
    setConnected(!!data?.connected);
  };

  useEffect(() => {
    checkStatus();
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (g === "ok") toast({ title: "Google Agenda conectado!" });
    if (g === "erro") toast({ title: "Não foi possível conectar o Google Agenda", variant: "destructive" });
    if (g) window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("google-auth", {
      method: "POST",
      body: { action: "start" },
    });
    if (error || !data?.url) {
      toast({ title: "Não foi possível iniciar a conexão com o Google", variant: "destructive" });
      setLoading(false);
      return;
    }
    window.location.href = data.url as string;
  };


  const handleDisconnect = async () => {
    setLoading(true);
    await supabase.functions.invoke("google-auth", { body: { action: "disconnect" } });
    setConnected(false);
    setLoading(false);
    toast({ title: "Google Agenda desconectado" });
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          Google Agenda
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Conecte sua conta Google para espelhar automaticamente os compromissos lançados para você.
        </p>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="text-sm">
          Status:{" "}
          {connected === null ? (
            <span className="text-muted-foreground">verificando…</span>
          ) : connected ? (
            <Badge className="bg-success/10 text-success border-success/20">Conectado</Badge>
          ) : (
            <Badge variant="outline">Não conectado</Badge>
          )}
        </div>
        {connected ? (
          <Button variant="outline" onClick={handleDisconnect} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Desconectar
          </Button>
        ) : (
          <Button onClick={handleConnect} disabled={loading} className="gradient-primary text-primary-foreground">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Conectar meu Google Agenda
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default GoogleCalendarConnect;
