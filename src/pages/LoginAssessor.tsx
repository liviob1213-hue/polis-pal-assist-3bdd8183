import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, LogIn } from "lucide-react";
import logoDemocrat from "@/assets/logo-democrat.png";

export default function LoginAssessor() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email.trim() || !senha) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;

      // Verifica se está aprovado
      const { data: profile } = await supabase
        .from("profiles")
        .select("status, role")
        .eq("user_id", data.user!.id)
        .maybeSingle();

      if (profile?.role !== "assessor") {
        toast({ title: "Acesso negado", description: "Esta conta não é de assessor.", variant: "destructive" });
        await supabase.auth.signOut();
        return;
      }
      if (profile?.status === "pendente") {
        toast({ title: "Aguardando aprovação", description: "O político ainda não aprovou seu cadastro.", variant: "destructive" });
        await supabase.auth.signOut();
        return;
      }
      if (profile?.status === "rejeitado") {
        toast({ title: "Cadastro rejeitado", description: "Entre em contato com o político.", variant: "destructive" });
        await supabase.auth.signOut();
        return;
      }

      toast({ title: "Login realizado!" });
      navigate("/painel");
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
            <img src={logoDemocrat} alt="Democrat.AI" className="h-40 object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">Entrar como Assessor</CardTitle>
          <CardDescription>Acesso restrito a assessores aprovados</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" placeholder="seu@email.com"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="pl-10" placeholder="Sua senha"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
            </div>
          </div>

          <Button onClick={handleLogin} disabled={loading} className="w-full" size="lg">
            {loading ? "Entrando..." : "Entrar"}
            <LogIn className="ml-2 h-4 w-4" />
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link to="/cadastro-assessor" className="text-primary hover:underline font-medium">Cadastrar como assessor</Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            É político?{" "}
            <Link to="/login" className="text-primary hover:underline">Entrar como político</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
