import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, LogIn } from "lucide-react";
import logoDemocrat from "@/assets/logo-democrat.png";

const MARTA_EMAIL = "martacmurta1@gmail.com";

export default function MartaMurta() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session?.user) navigate("/painel", { replace: true });
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entrar = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail || !senha) {
      toast({ title: "Informe e-mail e senha", variant: "destructive" });
      return;
    }
    if (mail !== MARTA_EMAIL) {
      toast({
        title: "Acesso não permitido",
        description: "Esta página é exclusiva de um cadastro. Use a tela de entrada padrão.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: mail, password: senha });
      if (error) throw error;
      navigate("/painel", { replace: true });
    } catch (err: any) {
      const msg = String(err?.message || "");
      toast({
        title: "Não foi possível entrar",
        description: /invalid login credentials/i.test(msg) ? "E-mail ou senha incorretos." : msg,
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
          <CardTitle className="text-2xl font-bold">Entrar</CardTitle>
          <CardDescription>Acesso com e-mail e senha.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === "Enter" && entrar()}
              />
            </div>
          </div>

          <Button onClick={entrar} disabled={loading} className="w-full" size="lg">
            {loading ? "Entrando..." : "Entrar"}
            <LogIn className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
