import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Lock } from "lucide-react";

function formatPhone(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}
function phoneForBackend(value: string): string {
  let d = value.replace(/\D/g, "");
  if (!d.startsWith("55")) d = `55${d}`;
  if (d.length === 13 && d[4] === "9") d = d.slice(0, 4) + d.slice(5);
  return d;
}

export default function Admin() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [authForm, setAuthForm] = useState({ email: "", senha: "" });
  const [authLoading, setAuthLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", senha: "", role: "assessor" as "politico" | "assessor" });

  const reauth = async () => {
    if (!authForm.email || !authForm.senha) {
      toast({ title: "Preencha email e senha", variant: "destructive" });
      return;
    }
    if (user?.email && authForm.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      toast({ title: "Email diferente do usuário logado", variant: "destructive" });
      return;
    }
    setAuthLoading(true);
    try {
      // Verifica a senha sem deslogar a sessão atual: tenta autenticar e mantém sessão.
      const { error } = await supabase.auth.signInWithPassword({
        email: authForm.email,
        password: authForm.senha,
      });
      if (error) throw error;
      setUnlocked(true);
      toast({ title: "Acesso liberado" });
    } catch (e: any) {
      toast({ title: "Senha inválida", description: e.message, variant: "destructive" });
    } finally {
      setAuthLoading(false);
    }
  };

  const submit = async () => {
    if (!form.nome || !form.email || !form.telefone || !form.senha) {
      toast({ title: "Preencha nome, email, WhatsApp e senha", variant: "destructive" });
      return;
    }
    if (form.senha.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    const digits = form.telefone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast({ title: "WhatsApp inválido", description: "Informe DDD + número", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          nome: form.nome,
          email: form.email,
          telefone: phoneForBackend(form.telefone),
          senha: form.senha,
          role: form.role,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Conta criada com sucesso!", description: `${form.role === "politico" ? "Político" : "Assessor"}: ${form.email}` });
      setForm({ nome: "", email: "", telefone: "", senha: "", role: form.role });
    } catch (e: any) {
      toast({ title: "Erro ao criar conta", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto py-8 px-4">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-3"><Lock className="h-6 w-6 text-primary" /></div>
              <div>
                <CardTitle>Acesso restrito</CardTitle>
                <CardDescription>Confirme seu email e senha de político para acessar o painel</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); reauth(); }}
            >
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  placeholder={user?.email || "seu@email.com"}
                  autoComplete="email"
                />
              </div>
              <div>
                <Label>Senha</Label>
                <Input
                  type="password"
                  value={authForm.senha}
                  onChange={(e) => setAuthForm({ ...authForm, senha: e.target.value })}
                  placeholder="Sua senha"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" disabled={authLoading} className="w-full gradient-primary text-primary-foreground" size="lg">
                {authLoading ? "Verificando..." : "Acessar painel"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-3"><ShieldCheck className="h-6 w-6 text-primary" /></div>
            <div>
              <CardTitle>Painel Administrativo</CardTitle>
              <CardDescription>Criar contas de políticos e assessores</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); submit(); }}
          >
            <div>
              <Label>Tipo de conta</Label>
              <Select value={form.role} onValueChange={(v: any) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="politico">Político</SelectItem>
                  <SelectItem value="assessor">Assessor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome completo</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do usuário" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input value={formatPhone(form.telefone)} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(31) 99999-9999" maxLength={15} />
            </div>
            <div>
              <Label>Senha</Label>
              <Input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} placeholder="Mínimo 6 caracteres" />
            </div>
            <Button type="submit" disabled={loading} className="w-full gradient-primary text-primary-foreground" size="lg">
              {loading ? "Criando..." : "Criar conta"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
