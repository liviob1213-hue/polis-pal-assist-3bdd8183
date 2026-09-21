import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Webhook, CheckCircle2 } from "lucide-react";

const PERIODOS = [
  { value: "30", label: "1 mês" },
  { value: "60", label: "2 meses" },
  { value: "90", label: "3 meses" },
  { value: "180", label: "6 meses" },
  { value: "365", label: "12 meses" },
];

type Registro = {
  email: string;
  nome: string | null;
  tier: string | null;
  assinatura_status: string | null;
  assinatura_expira_em: string | null;
};

export default function AcessoWebhook() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [dias, setDias] = useState("30");
  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState<Registro[]>([]);

  const carregar = async () => {
    const { data } = await (supabase as any)
      .from("profiles")
      .select("email, nome, tier, assinatura_status, assinatura_expira_em")
      .not("assinatura_expira_em", "is", null)
      .order("assinatura_expira_em", { ascending: false })
      .limit(30);
    setLista((data as Registro[]) || []);
  };

  useEffect(() => {
    void carregar();
  }, []);

  const conceder = async () => {
    if (!email.trim()) {
      toast({ title: "Informe o e-mail", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("conceder_acesso", {
        _email: email.trim().toLowerCase(),
        _dias: Number(dias),
      });
      if (error) throw error;
      if (!data) throw new Error("E-mail não encontrado no sistema.");
      toast({
        title: "Acesso liberado!",
        description: `${email} tem acesso completo por ${PERIODOS.find((p) => p.value === dias)?.label}.`,
      });
      setEmail("");
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro ao liberar acesso", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const revogar = async (alvo: string) => {
    try {
      const { error } = await (supabase as any).rpc("revogar_acesso", { _email: alvo });
      if (error) throw error;
      toast({ title: "Acesso revogado", description: alvo });
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro ao revogar", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--sidebar-background))] to-[hsl(var(--background))] p-4 sm:p-8">
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-2xl mx-auto">
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-3">
              <Webhook className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Acesso Webhook</CardTitle>
              <CardDescription>Libere acesso completo para um e-mail por um período</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); conceder(); }}>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label>Período de acesso</Label>
              <Select value={dias} onValueChange={setDias}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODOS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={loading} className="w-full gradient-primary text-primary-foreground" size="lg">
              {loading ? "Liberando..." : "Liberar acesso"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Acessos liberados</CardTitle>
          <CardDescription>Últimos e-mails com período definido</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {lista.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum acesso liberado ainda.</p>
          )}
          {lista.map((r) => {
            const venc = r.assinatura_expira_em ? new Date(r.assinatura_expira_em) : null;
            const ativo = !!venc && venc.getTime() > Date.now();
            return (
              <div key={r.email} className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2.5">
                <CheckCircle2 className={`h-4 w-4 shrink-0 ${ativo ? "text-primary" : "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.nome || r.email}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.email} · {ativo ? "ativo até " : "expirou em "}
                    {venc ? venc.toLocaleDateString("pt-BR") : "-"}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => revogar(r.email)}>
                  Revogar
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
    </div>
  );
}
