import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  UserPlus,
  FilePlus,
  CalendarPlus,
  ListPlus,
  CheckCircle2,
  Clock,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StatusItem {
  id: string;
  tipo: "Eleitor" | "Demanda" | "Tarefa" | "Compromisso";
  created_at: string;
  status?: string;
}

const interesses = ["Saúde", "Obras", "Educação", "Segurança", "Transporte", "Meio Ambiente"];

export default function PainelAssessor() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Histórico de ações (somente status, sem dados sensíveis)
  const [historico, setHistorico] = useState<StatusItem[]>([]);

  // Demandas em aberto (sem responsável) que o assessor pode pegar
  const [demandasAbertas, setDemandasAbertas] = useState<any[]>([]);

  // Lista mínima de eleitores criados pelo próprio assessor (apenas id + nome para vincular demanda)
  // Não conseguimos SELECT pelos RLS, então mantemos um cache em memória dos cadastrados na sessão
  const [meusEleitoresSessao, setMeusEleitoresSessao] = useState<{ id: string; nome: string }[]>(
    () => {
      try {
        const raw = sessionStorage.getItem("assessor-eleitores-cache");
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
  );

  // Dialog states
  const [eleitorOpen, setEleitorOpen] = useState(false);
  const [demandaOpen, setDemandaOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [tarefaOpen, setTarefaOpen] = useState(false);

  const [eleitorForm, setEleitorForm] = useState({
    nome: "",
    telefone: "",
    endereco: "",
    interesse: "",
    observacoes: "",
  });
  const [demandaForm, setDemandaForm] = useState({
    titulo: "",
    descricao: "",
    eleitor_id: "",
    responsavel: "eu" as "eu" | "aberto",
    prazo: "",
  });
  const [agendaForm, setAgendaForm] = useState({ titulo: "", descricao: "", data: "", hora: "" });
  const [tarefaForm, setTarefaForm] = useState({ titulo: "", descricao: "", prazo: "" });

  const persistEleitoresCache = (next: { id: string; nome: string }[]) => {
    setMeusEleitoresSessao(next);
    try {
      sessionStorage.setItem("assessor-eleitores-cache", JSON.stringify(next));
    } catch {}
  };

  const fetchHistorico = async () => {
    if (!user) return;
    const [demandas, tarefas, agenda] = await Promise.all([
      supabase
        .from("demandas")
        .select("id, created_at, status, criado_por, assessor_id")
        .or(`criado_por.eq.${user.id},assessor_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("tarefas")
        .select("id, created_at, status, criado_por, assessor_id")
        .or(`criado_por.eq.${user.id},assessor_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("agenda")
        .select("id, created_at, criado_por, assessor_id")
        .or(`criado_por.eq.${user.id},assessor_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const items: StatusItem[] = [];
    (demandas.data || []).forEach((d) =>
      items.push({ id: d.id, tipo: "Demanda", created_at: d.created_at, status: d.status })
    );
    (tarefas.data || []).forEach((t) =>
      items.push({ id: t.id, tipo: "Tarefa", created_at: t.created_at, status: t.status })
    );
    (agenda.data || []).forEach((a) =>
      items.push({ id: a.id, tipo: "Compromisso", created_at: a.created_at })
    );
    // Eleitores cadastrados pelo assessor (apenas contagem em sessão — sem PII)
    meusEleitoresSessao.forEach((e) =>
      items.push({ id: e.id, tipo: "Eleitor", created_at: new Date().toISOString(), status: "Cadastrado" })
    );

    items.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    setHistorico(items);
  };

  const fetchDemandasAbertas = async () => {
    const { data } = await supabase
      .from("demandas")
      .select("id, titulo, created_at, status, prazo")
      .is("assessor_id", null)
      .neq("status", "Resolvido")
      .order("created_at", { ascending: false });
    setDemandasAbertas(data || []);
  };

  useEffect(() => {
    fetchHistorico();
    fetchDemandasAbertas();
    const ch = supabase
      .channel("assessor-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "demandas" }, () => {
        fetchHistorico();
        fetchDemandasAbertas();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, fetchHistorico)
      .on("postgres_changes", { event: "*", schema: "public", table: "agenda" }, fetchHistorico)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // CADASTRAR ELEITOR
  const handleCriarEleitor = async () => {
    if (!eleitorForm.nome.trim() || !eleitorForm.telefone.trim()) {
      toast({ title: "Nome e telefone são obrigatórios", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase
      .from("eleitores")
      .insert({
        nome: eleitorForm.nome.trim(),
        telefone: eleitorForm.telefone.trim(),
        endereco: eleitorForm.endereco || null,
        interesse: eleitorForm.interesse || null,
        observacoes: eleitorForm.observacoes || null,
        criado_por: user?.id,
      })
      .select("id, nome")
      .single();

    if (error || !data) {
      toast({
        title: "Erro ao cadastrar eleitor",
        description: error?.message,
        variant: "destructive",
      });
      return;
    }
    persistEleitoresCache([{ id: data.id, nome: data.nome }, ...meusEleitoresSessao]);
    toast({ title: "✅ Eleitor cadastrado!", description: "Agora você pode criar demandas para ele." });
    setEleitorForm({ nome: "", telefone: "", endereco: "", interesse: "", observacoes: "" });
    setEleitorOpen(false);
    fetchHistorico();
  };

  // CRIAR DEMANDA
  const handleCriarDemanda = async () => {
    if (!demandaForm.titulo.trim()) {
      toast({ title: "Informe o título", variant: "destructive" });
      return;
    }
    if (!demandaForm.eleitor_id) {
      toast({
        title: "Selecione um eleitor",
        description: "Toda demanda deve ser vinculada a um eleitor cadastrado por você.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.from("demandas").insert({
      titulo: demandaForm.titulo.trim(),
      descricao: demandaForm.descricao || null,
      eleitor_id: demandaForm.eleitor_id,
      assessor_id: demandaForm.responsavel === "eu" ? user?.id : null,
      prazo: demandaForm.prazo ? new Date(demandaForm.prazo).toISOString() : null,
      criado_por: user?.id,
      status: "Em Análise",
    });
    if (error) {
      toast({ title: "Erro ao criar demanda", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Demanda criada!" });
    setDemandaForm({ titulo: "", descricao: "", eleitor_id: "", responsavel: "eu", prazo: "" });
    setDemandaOpen(false);
    fetchHistorico();
    fetchDemandasAbertas();
  };

  // CRIAR AGENDA
  const handleCriarAgenda = async () => {
    if (!agendaForm.titulo.trim() || !agendaForm.data) {
      toast({ title: "Informe título e data", variant: "destructive" });
      return;
    }
    const [h, m] = (agendaForm.hora || "09:00").split(":").map(Number);
    const dt = new Date(agendaForm.data);
    dt.setHours(h || 9, m || 0, 0, 0);
    const { error } = await supabase.from("agenda").insert({
      titulo: agendaForm.titulo.trim(),
      descricao: agendaForm.descricao || null,
      data_hora: dt.toISOString(),
      assessor_id: user?.id,
      criado_por: user?.id,
    });
    if (error) {
      toast({ title: "Erro ao criar compromisso", variant: "destructive" });
      return;
    }
    toast({ title: "✅ Compromisso criado!" });
    setAgendaForm({ titulo: "", descricao: "", data: "", hora: "" });
    setAgendaOpen(false);
    fetchHistorico();
  };

  // CRIAR TAREFA
  const handleCriarTarefa = async () => {
    if (!tarefaForm.titulo.trim()) {
      toast({ title: "Informe o título", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("tarefas").insert({
      titulo: tarefaForm.titulo.trim(),
      descricao: tarefaForm.descricao || null,
      prazo: tarefaForm.prazo ? new Date(tarefaForm.prazo).toISOString() : null,
      assessor_id: user?.id,
      criado_por: user?.id,
    });
    if (error) {
      toast({ title: "Erro ao criar tarefa", variant: "destructive" });
      return;
    }
    toast({ title: "✅ Tarefa criada!" });
    setTarefaForm({ titulo: "", descricao: "", prazo: "" });
    setTarefaOpen(false);
    fetchHistorico();
  };

  const pegarDemanda = async (id: string) => {
    const { error } = await supabase
      .from("demandas")
      .update({ assessor_id: user?.id })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao assumir demanda", variant: "destructive" });
      return;
    }
    toast({ title: "✅ Demanda assumida!" });
    fetchDemandasAbertas();
    fetchHistorico();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Painel do Assessor</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cadastre eleitores, registre demandas e organize sua agenda.
        </p>
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Cadastrar Eleitor */}
        <Dialog open={eleitorOpen} onOpenChange={setEleitorOpen}>
          <DialogTrigger asChild>
            <Card className="glass-card cursor-pointer hover:shadow-[var(--shadow-md)] transition-all">
              <CardContent className="p-5 flex flex-col items-center justify-center gap-2 text-center">
                <UserPlus className="h-7 w-7 text-primary" />
                <p className="font-semibold text-sm">Cadastrar Eleitor</p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Eleitor</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>
                  Nome <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={eleitorForm.nome}
                  onChange={(e) => setEleitorForm({ ...eleitorForm, nome: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label>
                  Telefone <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={eleitorForm.telefone}
                  onChange={(e) => setEleitorForm({ ...eleitorForm, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label>Endereço</Label>
                <Input
                  value={eleitorForm.endereco}
                  onChange={(e) => setEleitorForm({ ...eleitorForm, endereco: e.target.value })}
                  placeholder="Endereço completo"
                />
              </div>
              <div>
                <Label>Área de Interesse</Label>
                <Select
                  value={eleitorForm.interesse}
                  onValueChange={(v) => setEleitorForm({ ...eleitorForm, interesse: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {interesses.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={eleitorForm.observacoes}
                  onChange={(e) =>
                    setEleitorForm({ ...eleitorForm, observacoes: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <Button
                onClick={handleCriarEleitor}
                className="w-full gradient-primary text-primary-foreground"
              >
                Cadastrar Eleitor
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Criar Demanda */}
        <Dialog open={demandaOpen} onOpenChange={setDemandaOpen}>
          <DialogTrigger asChild>
            <Card className="glass-card cursor-pointer hover:shadow-[var(--shadow-md)] transition-all">
              <CardContent className="p-5 flex flex-col items-center justify-center gap-2 text-center">
                <FilePlus className="h-7 w-7 text-accent" />
                <p className="font-semibold text-sm">Criar Demanda</p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Demanda</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>
                  Título <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={demandaForm.titulo}
                  onChange={(e) => setDemandaForm({ ...demandaForm, titulo: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={demandaForm.descricao}
                  onChange={(e) =>
                    setDemandaForm({ ...demandaForm, descricao: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div>
                <Label>
                  Eleitor vinculado <span className="text-destructive">*</span>
                </Label>
                {meusEleitoresSessao.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic mt-1">
                    Cadastre um eleitor primeiro para poder vincular a demanda.
                  </p>
                ) : (
                  <Select
                    value={demandaForm.eleitor_id}
                    onValueChange={(v) => setDemandaForm({ ...demandaForm, eleitor_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o eleitor" />
                    </SelectTrigger>
                    <SelectContent>
                      {meusEleitoresSessao.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label>Responsável</Label>
                <Select
                  value={demandaForm.responsavel}
                  onValueChange={(v: "eu" | "aberto") =>
                    setDemandaForm({ ...demandaForm, responsavel: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eu">Eu mesmo realizarei</SelectItem>
                    <SelectItem value="aberto">
                      Deixar em aberto (outro assessor pega)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prazo</Label>
                <Input
                  type="date"
                  value={demandaForm.prazo}
                  onChange={(e) => setDemandaForm({ ...demandaForm, prazo: e.target.value })}
                />
              </div>
              <Button
                onClick={handleCriarDemanda}
                className="w-full gradient-primary text-primary-foreground"
                disabled={meusEleitoresSessao.length === 0}
              >
                Criar Demanda
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                ⚠️ Após criada, a demanda não pode ser editada nem excluída.
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Criar Compromisso */}
        <Dialog open={agendaOpen} onOpenChange={setAgendaOpen}>
          <DialogTrigger asChild>
            <Card className="glass-card cursor-pointer hover:shadow-[var(--shadow-md)] transition-all">
              <CardContent className="p-5 flex flex-col items-center justify-center gap-2 text-center">
                <CalendarPlus className="h-7 w-7 text-info" />
                <p className="font-semibold text-sm">Criar Compromisso</p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Compromisso</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>Título</Label>
                <Input
                  value={agendaForm.titulo}
                  onChange={(e) => setAgendaForm({ ...agendaForm, titulo: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={agendaForm.descricao}
                  onChange={(e) =>
                    setAgendaForm({ ...agendaForm, descricao: e.target.value })
                  }
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={agendaForm.data}
                    onChange={(e) => setAgendaForm({ ...agendaForm, data: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Hora</Label>
                  <Input
                    type="time"
                    value={agendaForm.hora}
                    onChange={(e) => setAgendaForm({ ...agendaForm, hora: e.target.value })}
                  />
                </div>
              </div>
              <Button
                onClick={handleCriarAgenda}
                className="w-full gradient-primary text-primary-foreground"
              >
                Criar Compromisso
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Criar Tarefa */}
        <Dialog open={tarefaOpen} onOpenChange={setTarefaOpen}>
          <DialogTrigger asChild>
            <Card className="glass-card cursor-pointer hover:shadow-[var(--shadow-md)] transition-all">
              <CardContent className="p-5 flex flex-col items-center justify-center gap-2 text-center">
                <ListPlus className="h-7 w-7 text-success" />
                <p className="font-semibold text-sm">Criar Tarefa</p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Tarefa</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>Título</Label>
                <Input
                  value={tarefaForm.titulo}
                  onChange={(e) => setTarefaForm({ ...tarefaForm, titulo: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={tarefaForm.descricao}
                  onChange={(e) =>
                    setTarefaForm({ ...tarefaForm, descricao: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div>
                <Label>Prazo</Label>
                <Input
                  type="date"
                  value={tarefaForm.prazo}
                  onChange={(e) => setTarefaForm({ ...tarefaForm, prazo: e.target.value })}
                />
              </div>
              <Button
                onClick={handleCriarTarefa}
                className="w-full gradient-primary text-primary-foreground"
              >
                Criar Tarefa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Listas */}
      <Tabs defaultValue="historico" className="space-y-4">
        <TabsList>
          <TabsTrigger value="historico">Meu Histórico</TabsTrigger>
          <TabsTrigger value="abertas">
            Demandas em Aberto{" "}
            <Badge variant="secondary" className="ml-2">
              {demandasAbertas.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="historico">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">Status das suas ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {historico.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Nenhuma ação registrada ainda.
                </p>
              ) : (
                historico.map((h) => (
                  <div
                    key={`${h.tipo}-${h.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/20"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <div>
                        <p className="text-sm font-medium">
                          {h.tipo} {h.tipo === "Eleitor" ? "cadastrado" : "registrado"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                    {h.status && (
                      <Badge variant="outline" className="text-xs">
                        {h.status}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="abertas">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">
                Demandas sem responsável — você pode assumir
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {demandasAbertas.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Nenhuma demanda em aberto no momento.
                </p>
              ) : (
                demandasAbertas.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/20"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-warning" />
                      <div>
                        <p className="text-sm font-medium">{d.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          Criada em{" "}
                          {format(new Date(d.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          {d.prazo &&
                            ` · Prazo: ${format(new Date(d.prazo), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => pegarDemanda(d.id)}
                      className="gradient-primary text-primary-foreground gap-1"
                    >
                      <User className="h-3.5 w-3.5" /> Assumir
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
