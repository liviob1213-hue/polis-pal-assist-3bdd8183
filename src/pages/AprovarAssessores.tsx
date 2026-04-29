import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, X, UserCog, Mail, Phone } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Pendente {
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  status: string;
  created_at: string;
}

export default function AprovarAssessores() {
  const { toast } = useToast();
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, nome, email, telefone, status, created_at")
      .eq("role", "assessor")
      .eq("status", "pendente")
      .eq("politico_id_solicitado", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else {
      setPendentes((data || []) as any);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const aprovar = async (userId: string) => {
    const { error } = await supabase.rpc("approve_assessor", { _assessor_user_id: userId });
    if (error) {
      toast({ title: "Erro ao aprovar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Assessor aprovado!" });
      carregar();
    }
  };

  const rejeitar = async (userId: string) => {
    const { error } = await supabase.rpc("reject_assessor", { _assessor_user_id: userId });
    if (error) {
      toast({ title: "Erro ao rejeitar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cadastro rejeitado" });
      carregar();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserCog className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Aprovar Assessores</h1>
          <p className="text-sm text-muted-foreground">Revise e aprove cadastros pendentes</p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : pendentes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum cadastro pendente no momento.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendentes.map((p) => (
            <Card key={p.user_id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">{p.nome}</CardTitle>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{p.email}</span>
                    {p.telefone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{p.telefone}</span>}
                    <span>Solicitado em {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
                <Badge variant="outline" className="border-warning bg-warning/10 text-warning">Pendente</Badge>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button onClick={() => aprovar(p.user_id)} className="bg-success hover:bg-success/90 text-white">
                  <Check className="h-4 w-4 mr-2" /> Aprovar
                </Button>
                <Button onClick={() => rejeitar(p.user_id)} variant="destructive">
                  <X className="h-4 w-4 mr-2" /> Rejeitar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
