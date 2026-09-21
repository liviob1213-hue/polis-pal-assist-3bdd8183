import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, LogIn, KeyRound, ArrowLeft } from "lucide-react";
import logoDemocrat from "@/assets/logo-democrat.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectParam = new URLSearchParams(location.search).get("redirect");
  const stateFrom = (location.state as { from?: string } | null)?.from;
  const redirectTo =
    redirectParam?.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : stateFrom || "/painel";

  const enviarCodigo = async () => {
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
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) throw error;
      setEtapa("codigo");
      toast({
        title: "Enviamos um e-mail para você",
        description: "Clique no link do e-mail ou digite o código de 6 dígitos aqui.",
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

  const validarCodigo = async () => {
    const token = codigo.replace(/\D/g, "");
    if (token.length < 6) {
      toast({ title: "Digite o código de 6 dígitos", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });
      if (error) throw error;
      toast({ title: "Acesso liberado!" });
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      toast({ title: "Código inválido ou expirado", description: err.message, variant: "destructive" });
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
            {etapa === "email"
              ? "Acesse com seu e-mail — sem senha."
              : `Enviamos um código para ${email}`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {etapa === "email" ? (
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
                    onKeyDown={(e) => e.key === "Enter" && enviarCodigo()}
                  />
                </div>
              </div>

              <Button onClick={enviarCodigo} disabled={loading} className="w-full" size="lg">
                {loading ? "Enviando..." : "Receber acesso por e-mail"}
                <LogIn className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="codigo">Código de 6 dígitos</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="codigo"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    className="pl-10 tracking-[0.4em] text-center text-lg"
                    onKeyDown={(e) => e.key === "Enter" && validarCodigo()}
                  />
                </div>
              </div>

              <Button onClick={validarCodigo} disabled={loading} className="w-full" size="lg">
                {loading ? "Validando..." : "Entrar"}
              </Button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => { setEtapa("email"); setCodigo(""); }}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" /> Trocar e-mail
                </button>
                <button
                  type="button"
                  onClick={enviarCodigo}
                  disabled={loading}
                  className="text-primary hover:underline font-medium"
                >
                  Reenviar código
                </button>
              </div>
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
