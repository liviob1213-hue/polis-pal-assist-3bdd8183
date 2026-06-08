import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, LogIn } from "lucide-react";
import logoDemocrat from "@/assets/logo-democrat.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectParam = new URLSearchParams(location.search).get("redirect");
  const stateFrom = (location.state as { from?: string } | null)?.from;
  const redirectTo = redirectParam?.startsWith("/") && !redirectParam.startsWith("//") ? redirectParam : stateFrom || "/painel";

  const handleLogin = async () => {
    if (!email.trim() || !senha) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      toast({ title: "Login realizado!" });
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      toast({ title: "Erro no login", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--sidebar-background))] to-[hsl(var(--background))] p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <img src={logoDemocrat} alt="Democrat.AI" className="h-72 md:h-80 object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">Entrar Agora</CardTitle>
          <CardDescription>Acesse sua conta DEMOCRAT.AI</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
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
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="senha"
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="pl-10 pr-10"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button onClick={handleLogin} disabled={loading} className="w-full" size="lg">
            {loading ? "Entrando..." : "Entrar Agora"}
            <LogIn className="ml-2 h-4 w-4" />
          </Button>

          <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 space-y-1 text-center">
            <p className="text-xs font-semibold text-foreground">Sou Político</p>
            <p className="text-xs text-muted-foreground">
              Contas de político são criadas pelo administrador.
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 space-y-1 text-center">
            <p className="text-xs font-semibold text-foreground">Sou Assessor</p>
            <p className="text-xs text-muted-foreground">
              <Link to="/login-assessor" className="text-primary hover:underline font-medium">
                Entrar
              </Link>
            </p>
            <p className="text-[10px] text-muted-foreground">Contas de assessor são criadas pelo administrador.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
