import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, Phone, UserPlus } from "lucide-react";
import logoDemocrat from "@/assets/logo-democrat.png";

export default function CadastroAssessor() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [politicoId, setPoliticoId] = useState("");
  const [politicos, setPoliticos] = useState<{ user_id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("list_politicos");
      if (!error && data) setPoliticos(data as any);
    })();
  }, []);

  const handleCadastro = async () => {
    if (!nome.trim() || !email.trim() || !senha || !politicoId) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (senha.length < 6) {
      toast({ title: "A senha deve ter ao menos 6 caracteres", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          emailRedirectTo: `${window.location.origin}/login-assessor`,
          data: {
            nome,
            telefone,
            role: "assessor",
            politico_id_solicitado: politicoId,
          },
        },
      });
      if (error) throw error;
      toast({
        title: "Cadastro enviado!",
        description: "Aguarde a aprovação do político responsável para acessar.",
      });
      navigate("/login-assessor");
    } catch (err: any) {
      toast({ title: "Erro no cadastro", description: err.message, variant: "destructive" });
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
          <CardTitle className="text-2xl font-bold">Cadastro de Assessor</CardTitle>
          <CardDescription>Crie sua conta e aguarde aprovação do político</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo *</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={nome} onChange={(e) => setNome(e.target.value)} className="pl-10" placeholder="Seu nome" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>E-mail *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" placeholder="seu@email.com" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Telefone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="pl-10" placeholder="(11) 99999-9999" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Senha *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="pl-10" placeholder="Mínimo 6 caracteres" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Político responsável *</Label>
            <Select value={politicoId} onValueChange={setPoliticoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o político" />
              </SelectTrigger>
              <SelectContent>
                {politicos.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleCadastro} disabled={loading} className="w-full" size="lg">
            {loading ? "Enviando..." : "Solicitar acesso"}
            <UserPlus className="ml-2 h-4 w-4" />
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login-assessor" className="text-primary hover:underline font-medium">Entrar</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
