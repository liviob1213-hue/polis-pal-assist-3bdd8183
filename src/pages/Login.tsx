import { useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, LogIn, MailCheck, ArrowLeft } from "lucide-react";
import logoDemocrat from "@/assets/logo-democrat.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const location = useLocation();
  const redirectParam = new URLSearchParams(location.search).get("redirect");
  const stateFrom = (location.state as { from?: string } | null)?.from;
  const redirectTo =
    redirectParam?.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : stateFrom || "/painel";

  const enviarLink = async () => {
    if (!email.trim()) {
      toast({ title: "Informe seu e-mail", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}${redirectTo}`,
        },
      });
      if (error) throw error;
      setEnviado(true);
      toast({
        title: "Link enviado!",
        description: "Abra seu e-mail e clique no link para entrar.",
      });
    } catch (err: any) {
      const msg = String(err?.message || "");
      toast({
        title: "Não foi possível enviar",
        description: /signups not allowed|not found|invalid/i.test(msg)
          ? "Este e-mail não está cadastrado na ferramenta."
          : msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--sidebar-background))] to-[hsl(var(--background))] p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <img src={logoDemocrat} alt="Democrat.AI" className="h-56 md:h-64 object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">Entrar Agora</CardTitle>
          <CardDescription>
            {enviado
              ? `Enviamos um link de acesso para ${email}`
              : "Acesse com seu e-mail — sem senha."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {enviado ? (
            <>
              <div className="flex flex-col items-center gap-3 rounded-xl bg-secondary/40 p-6 text-center">
                <MailCheck className="h-10 w-10 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Abra a caixa de entrada e clique no link para entrar automaticamente.
                  Se não encontrar, verifique o spam.
                </p>
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setEnviado(false)}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" /> Trocar e-mail
                </button>
                <button
                  type="button"
                  onClick={enviarLink}
                  disabled={loading}
                  className="text-primary hover:underline font-medium"
                >
                  Reenviar link
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    onKeyDown={(e) => e.key === "Enter" && enviarLink()}
                  />
                </div>
              </div>

              <Button onClick={enviarLink} disabled={loading} className="w-full" size="lg">
                {loading ? "Enviando..." : "Receber link de acesso"}
                <LogIn className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}

          <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Políticos e assessores entram por aqui. As contas são criadas pelo administrador.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
