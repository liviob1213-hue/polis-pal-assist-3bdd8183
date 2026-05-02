import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  UserPlus,
  FilePlus,
  CalendarPlus,
  ListPlus,
  Clock,
  User,
  MapPin,
  Calendar,
  GripVertical,
  AlertTriangle,
  CheckCircle2,
  Cake,
  Megaphone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { useGoogleMapsKey } from "@/hooks/useGoogleMapsKey";
import { STATUS_ELEITOR_LIST, type StatusEleitor } from "@/lib/statusEleitor";

interface Demanda {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  localizacao: string | null;
  assessor_id: string | null;
  prazo: string | null;
  created_at: string;
  eleitor_id: string | null;
}

interface TarefaAssessor {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  status: string;
  created_at: string;
}

type TarefaStatusKey = "Pendente" | "Em Andamento" | "Concluído";
const tarefaColumns: { key: TarefaStatusKey; title: string; dotColor: string }[] = [
  { key: "Pendente", title: "Pendente", dotColor: "bg-warning" },
  { key: "Em Andamento", title: "Em Andamento", dotColor: "bg-info" },
  { key: "Concluído", title: "Concluído", dotColor: "bg-success" },
];

const interesses = ["Saúde", "Obras", "Educação", "Segurança", "Transporte", "Meio Ambiente"];

const ORIGENS = [
  { value: "Rua", label: "🏠 Rua" },
  { value: "Gabinete", label: "🏢 Gabinete" },
  { value: "Instagram/TikTok", label: "📱 Instagram / TikTok" },
  { value: "WhatsApp", label: "💬 WhatsApp" },
  { value: "Pessoal", label: "🤝 Pessoal (contato direto)" },
];
const TIPOS = [
  { value: "Reclamação", label: "Reclamação" },
  { value: "Sugestão", label: "Sugestão" },
  { value: "Solicitação", label: "Solicitação" },
  { value: "Elogio", label: "Elogio" },
];
const SETORES = [
  { value: "Jurídico", label: "⚖️ Jurídico" },
  { value: "Comunicação", label: "📢 Comunicação" },
  { value: "Administrativo", label: "📊 Administrativo" },
];

type StatusKey = "Aberto" | "Em Análise" | "Em Andamento" | "Resolvido";
const columns: { key: StatusKey; title: string; dotColor: string }[] = [
  { key: "Aberto", title: "Aberto", dotColor: "bg-warning" },
  { key: "Em Análise", title: "Em Análise", dotColor: "bg-info" },
  { key: "Em Andamento", title: "Em Andamento", dotColor: "bg-accent" },
  { key: "Resolvido", title: "Resolvido", dotColor: "bg-success" },
];
const statusStyles: Record<string, string> = {
  Aberto: "border-warning bg-warning/10 text-warning",
  "Em Análise": "border-info bg-info/10 text-info",
  "Em Andamento": "border-accent bg-accent/10 text-accent",
  Resolvido: "border-success bg-success/10 text-success",
};

export default function PainelAssessor() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [minhasDemandas, setMinhasDemandas] = useState<Demanda[]>([]);
  const [demandasAbertas, setDemandasAbertas] = useState<Demanda[]>([]);
  const [minhasTarefas, setMinhasTarefas] = useState<TarefaAssessor[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragTarefaId, setDragTarefaId] = useState<string | null>(null);

  // Eleitores cadastrados pelo próprio assessor (RLS permite SELECT onde criado_por = auth.uid())
  const [meusEleitoresSessao, setMeusEleitoresSessao] = useState<{ id: string; nome: string }[]>([]);
  const [historicoEleitores, setHistoricoEleitores] = useState<Array<{ id: string; nome: string; telefone: string | null; interesse: string | null; created_at: string }>>([]);

  // Dialog states
  const [eleitorOpen, setEleitorOpen] = useState(false);
  const [demandaOpen, setDemandaOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [tarefaOpen, setTarefaOpen] = useState(false);

  const [eleitorForm, setEleitorForm] = useState({
    nome: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    telefone: "",
    interesse: "",
    status_eleitor: "possivel_eleitor" as StatusEleitor,
    observacoes: "",
    data_nascimento: "",
    demanda_titulo: "",
    demanda_descricao: "",
  });
  const [demandaForm, setDemandaForm] = useState({
    titulo: "",
    descricao: "",
    eleitor_id: "",
    responsavel: "eu" as "eu" | "aberto",
    prazo: "",
    localizacao: "",
    origem: "",
    tipo: "",
    setor: "",
  });
  const [agendaForm, setAgendaForm] = useState({ titulo: "", descricao: "", data: "", hora: "" });
  const [tarefaForm, setTarefaForm] = useState({ titulo: "", descricao: "", prazo: "" });
  const { data: mapsApiKey = "" } = useGoogleMapsKey();

  const fetchMeusEleitores = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("eleitores")
      .select("id, nome, telefone, interesse, created_at")
      .eq("criado_por", user.id)
      .order("created_at", { ascending: false });
    const list = (data as any[]) || [];
    setMeusEleitoresSessao(list.map((e) => ({ id: e.id, nome: e.nome })));
    setHistoricoEleitores(list);
  };

  const fetchDemandas = async () => {
    if (!user) return;
    // Próprias (assessor_id = self) - todas as colunas
    const { data: minhas } = await supabase
      .from("demandas")
      .select("*")
      .eq("assessor_id", user.id)
      .order("created_at", { ascending: false });
    setMinhasDemandas((minhas as Demanda[]) || []);

    // Em aberto (sem responsável)
    const { data: abertas } = await supabase
      .from("demandas")
      .select("*")
      .is("assessor_id", null)
      .neq("status", "Resolvido")
      .order("created_at", { ascending: false });
    setDemandasAbertas((abertas as Demanda[]) || []);
  };

  const fetchMinhasTarefas = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tarefas")
      .select("id, titulo, descricao, prazo, status, created_at")
      .eq("assessor_id", user.id)
      .order("created_at", { ascending: false });
    setMinhasTarefas((data as TarefaAssessor[]) || []);
  };

  useEffect(() => {
    fetchDemandas();
    fetchMeusEleitores();
    fetchMinhasTarefas();
    const ch = supabase
      .channel("assessor-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "demandas" }, fetchDemandas)
      .on("postgres_changes", { event: "*", schema: "public", table: "eleitores" }, fetchMeusEleitores)
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, fetchMinhasTarefas)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // CADASTRAR ELEITOR
  const resetEleitorForm = () => setEleitorForm({
    nome: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", cep: "",
    telefone: "", interesse: "", status_eleitor: "possivel_eleitor" as StatusEleitor,
    observacoes: "", data_nascimento: "", demanda_titulo: "", demanda_descricao: "",
  });

  const handleCriarEleitor = async () => {
    if (!eleitorForm.nome.trim() || !eleitorForm.telefone.trim()) {
      toast({ title: "Nome e telefone são obrigatórios", variant: "destructive" });
      return;
    }
    const endereco = [
      eleitorForm.rua, eleitorForm.numero, eleitorForm.complemento,
      eleitorForm.bairro, eleitorForm.cidade, eleitorForm.estado, eleitorForm.cep,
    ].filter(Boolean).join(", ");

    const { data, error } = await supabase
      .from("eleitores")
      .insert({
        nome: eleitorForm.nome.trim(),
        telefone: eleitorForm.telefone.trim(),
        endereco: endereco || null,
        interesse: eleitorForm.interesse || null,
        status_eleitor: eleitorForm.status_eleitor || "possivel_eleitor",
        observacoes: eleitorForm.observacoes || null,
        data_nascimento: eleitorForm.data_nascimento || null,
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

    // Demanda inicial opcional vinculada ao eleitor
    if (eleitorForm.demanda_titulo.trim()) {
      const { error: dErr } = await supabase.from("demandas").insert({
        titulo: eleitorForm.demanda_titulo.trim(),
        descricao: eleitorForm.demanda_descricao.trim() || null,
        eleitor_id: data.id,
        assessor_id: user?.id,
        criado_por: user?.id,
        status: "Em Análise",
      });
      if (dErr) console.warn("Erro ao criar demanda do eleitor:", dErr);
    }

    // Geocoding (best-effort)
    if (endereco) {
      try {
        await supabase.functions.invoke("geocode", { body: { eleitor_id: data.id, endereco } });
      } catch (geoErr) {
        console.warn("Geocoding failed:", geoErr);
      }
    }

    await fetchMeusEleitores();
    toast({ title: "✅ Eleitor cadastrado!" });
    resetEleitorForm();
    setEleitorOpen(false);
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
      localizacao: demandaForm.localizacao || null,
      origem: demandaForm.origem || null,
      tipo: demandaForm.tipo || null,
      setor: demandaForm.setor || null,
      criado_por: user?.id,
      status: "Em Análise",
    });
    if (error) {
      toast({ title: "Erro ao criar demanda", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Demanda criada!" });
    setDemandaForm({ titulo: "", descricao: "", eleitor_id: "", responsavel: "eu", prazo: "", localizacao: "", origem: "", tipo: "", setor: "" });
    setDemandaOpen(false);
    fetchDemandas();
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
  };

  // CRIAR TAREFA
  const handleCriarTarefa = async () => {
    if (!tarefaForm.titulo.trim()) {
      toast({ title: "Informe o título", variant: "destructive" });
      return;
    }
    // Buscar político vinculado
    const { data: link } = await supabase
      .from("politician_assessors")
      .select("politician_id")
      .eq("assessor_id", user?.id ?? "")
      .maybeSingle();

    const { error } = await supabase.from("tarefas").insert({
      titulo: tarefaForm.titulo.trim(),
      descricao: tarefaForm.descricao || null,
      prazo: tarefaForm.prazo ? new Date(tarefaForm.prazo).toISOString() : null,
      assessor_id: user?.id,
      politician_id: link?.politician_id ?? null,
      criado_por: user?.id,
      status: "Pendente",
    });
    if (error) {
      toast({ title: "Erro ao criar tarefa", variant: "destructive" });
      return;
    }
    toast({ title: "✅ Tarefa criada!" });
    setTarefaForm({ titulo: "", descricao: "", prazo: "" });
    setTarefaOpen(false);
    fetchMinhasTarefas();
  };

  const assumirDemanda = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("demandas")
      .update({ assessor_id: user.id })
      .eq("id", id)
      .is("assessor_id", null);
    if (error) {
      toast({ title: "Erro ao assumir demanda", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Demanda assumida!", description: "Agora aparece em 'Minhas Demandas'." });
    fetchDemandas();
  };

  const moveStatus = async (id: string, newStatus: StatusKey) => {
    if (!user) return;
    const { error } = await supabase
      .from("demandas")
      .update({ status: newStatus })
      .eq("id", id)
      .eq("assessor_id", user.id);
    if (error) {
      toast({ title: "Erro ao mover demanda", description: error.message, variant: "destructive" });
      return;
    }
    fetchDemandas();
  };

  const moveTarefaStatus = async (id: string, newStatus: TarefaStatusKey) => {
    if (!user) return;
    const { error } = await supabase
      .from("tarefas")
      .update({ status: newStatus })
      .eq("id", id)
      .eq("assessor_id", user.id);
    if (error) {
      toast({ title: "Erro ao mover tarefa", description: error.message, variant: "destructive" });
      return;
    }
    fetchMinhasTarefas();
  };

  const handleTarefaDragStart = (e: React.DragEvent, id: string) => {
    setDragTarefaId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleTarefaDrop = (e: React.DragEvent, status: TarefaStatusKey) => {
    e.preventDefault();
    if (dragTarefaId) {
      moveTarefaStatus(dragTarefaId, status);
      setDragTarefaId(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleDrop = (e: React.DragEvent, status: StatusKey) => {
    e.preventDefault();
    if (dragId) {
      moveStatus(dragId, status);
      setDragId(null);
    }
  };

  const isPrazoExpired = (prazo: string | null, status: string) => {
    if (!prazo || status === "Resolvido") return false;
    return isPast(new Date(prazo));
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
          Cadastre eleitores, registre demandas e acompanhe seu trabalho.
        </p>
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Dialog open={eleitorOpen} onOpenChange={setEleitorOpen}>
          <DialogTrigger asChild>
            <Card className="glass-card cursor-pointer hover:shadow-[var(--shadow-md)] transition-all">
              <CardContent className="p-5 flex flex-col items-center justify-center gap-2 text-center">
                <UserPlus className="h-7 w-7 text-primary" />
                <p className="font-semibold text-sm">Cadastrar Eleitor</p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Eleitor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <Label>Nome <span className="text-destructive">*</span></Label>
                <Input value={eleitorForm.nome} onChange={(e) => setEleitorForm({ ...eleitorForm, nome: e.target.value })} placeholder="Nome completo" />
              </div>

              <div className="space-y-3 p-3 rounded-lg bg-secondary/30 border border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endereço</p>
                <div>
                  <Label>Rua / Logradouro</Label>
                  <AddressAutocomplete
                    apiKey={mapsApiKey}
                    value={eleitorForm.rua}
                    onChange={(v) => setEleitorForm((prev) => ({ ...prev, rua: v }))}
                    onAddressSelect={(c) => setEleitorForm((prev) => ({ ...prev, rua: c.rua, bairro: c.bairro, cidade: c.cidade, estado: c.estado, cep: c.cep }))}
                    placeholder="Ex: Rua das Flores"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Número</Label><Input value={eleitorForm.numero} onChange={(e) => setEleitorForm({ ...eleitorForm, numero: e.target.value })} placeholder="Nº" /></div>
                  <div><Label>Complemento</Label><Input value={eleitorForm.complemento} onChange={(e) => setEleitorForm({ ...eleitorForm, complemento: e.target.value })} placeholder="Apto, Bloco..." /></div>
                </div>
                <div><Label>Bairro</Label><Input value={eleitorForm.bairro} onChange={(e) => setEleitorForm({ ...eleitorForm, bairro: e.target.value })} placeholder="Bairro" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cidade</Label><Input value={eleitorForm.cidade} onChange={(e) => setEleitorForm({ ...eleitorForm, cidade: e.target.value })} placeholder="Cidade" /></div>
                  <div><Label>Estado</Label><Input value={eleitorForm.estado} onChange={(e) => setEleitorForm({ ...eleitorForm, estado: e.target.value })} placeholder="UF" maxLength={2} /></div>
                </div>
                <div className="w-1/2"><Label>CEP</Label><Input value={eleitorForm.cep} onChange={(e) => setEleitorForm({ ...eleitorForm, cep: e.target.value })} placeholder="00000-000" /></div>
              </div>

              <div>
                <Label>Telefone <span className="text-destructive">*</span></Label>
                <Input value={eleitorForm.telefone} onChange={(e) => setEleitorForm({ ...eleitorForm, telefone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><Cake className="h-3.5 w-3.5 text-primary" /> Data de Nascimento</Label>
                <Input type="date" value={eleitorForm.data_nascimento} onChange={(e) => setEleitorForm({ ...eleitorForm, data_nascimento: e.target.value })} />
              </div>
              <div>
                <Label>Interesse</Label>
                <Select value={eleitorForm.interesse} onValueChange={(v) => setEleitorForm({ ...eleitorForm, interesse: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{interesses.map((i) => (<SelectItem key={i} value={i}>{i}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status do Eleitor</Label>
                <Select value={eleitorForm.status_eleitor} onValueChange={(v) => setEleitorForm({ ...eleitorForm, status_eleitor: v as StatusEleitor })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_ELEITOR_LIST.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className="mr-2">{s.emoji}</span>{s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={eleitorForm.observacoes} onChange={(e) => setEleitorForm({ ...eleitorForm, observacoes: e.target.value })} rows={3} />
              </div>

              {/* Demanda inicial opcional */}
              <div className="space-y-3 p-3 rounded-lg border border-warning/30 bg-warning/5">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-warning" />
                  <p className="text-xs font-semibold text-warning uppercase tracking-wider">Reclamação ou Solicitação (Opcional)</p>
                </div>
                <p className="text-xs text-muted-foreground">Caso o eleitor já tenha alguma demanda, registre aqui. Será criada automaticamente vinculada a ele.</p>
                <div>
                  <Label>Título da Demanda</Label>
                  <Input value={eleitorForm.demanda_titulo} onChange={(e) => setEleitorForm({ ...eleitorForm, demanda_titulo: e.target.value })} placeholder="Ex: Buraco na rua, falta d'água..." />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={eleitorForm.demanda_descricao} onChange={(e) => setEleitorForm({ ...eleitorForm, demanda_descricao: e.target.value })} placeholder="Detalhes da reclamação ou solicitação..." rows={2} />
                </div>
              </div>

              <Button onClick={handleCriarEleitor} className="w-full gradient-primary text-primary-foreground">Cadastrar Eleitor</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={demandaOpen} onOpenChange={setDemandaOpen}>
          <DialogTrigger asChild>
            <Card className="glass-card cursor-pointer hover:shadow-[var(--shadow-md)] transition-all">
              <CardContent className="p-5 flex flex-col items-center justify-center gap-2 text-center">
                <FilePlus className="h-7 w-7 text-accent" />
                <p className="font-semibold text-sm">Criar Demanda</p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Demanda</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Título <span className="text-destructive">*</span></Label>
                <Input value={demandaForm.titulo} onChange={(e) => setDemandaForm({ ...demandaForm, titulo: e.target.value })} placeholder="Título da demanda" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={demandaForm.descricao} onChange={(e) => setDemandaForm({ ...demandaForm, descricao: e.target.value })} placeholder="Descreva a demanda" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>📍 Origem</Label>
                  <Select value={demandaForm.origem || "none"} onValueChange={(v) => setDemandaForm({ ...demandaForm, origem: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="De onde veio" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não informado</SelectItem>
                      {ORIGENS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>🏷️ Tipo</Label>
                  <Select value={demandaForm.tipo || "none"} onValueChange={(v) => setDemandaForm({ ...demandaForm, tipo: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não informado</SelectItem>
                      {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>🏛️ Setor responsável</Label>
                <Select value={demandaForm.setor || "none"} onValueChange={(v) => setDemandaForm({ ...demandaForm, setor: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não informado</SelectItem>
                    {SETORES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Localização</Label>
                <Input value={demandaForm.localizacao} onChange={(e) => setDemandaForm({ ...demandaForm, localizacao: e.target.value })} placeholder="Local da demanda" />
              </div>
              <div>
                <Label>Eleitor vinculado <span className="text-destructive">*</span></Label>
                {meusEleitoresSessao.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic mt-1">Cadastre um eleitor primeiro.</p>
                ) : (
                  <Select value={demandaForm.eleitor_id} onValueChange={(v) => setDemandaForm({ ...demandaForm, eleitor_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o eleitor" /></SelectTrigger>
                    <SelectContent>{meusEleitoresSessao.map((e) => (<SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>))}</SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label>Responsável</Label>
                <Select value={demandaForm.responsavel} onValueChange={(v: "eu" | "aberto") => setDemandaForm({ ...demandaForm, responsavel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eu">Eu mesmo realizarei</SelectItem>
                    <SelectItem value="aberto">Deixar em aberto (outro assessor pega)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prazo</Label>
                <Input type="date" value={demandaForm.prazo} onChange={(e) => setDemandaForm({ ...demandaForm, prazo: e.target.value })} />
              </div>
              <Button onClick={handleCriarDemanda} className="w-full gradient-primary text-primary-foreground" disabled={meusEleitoresSessao.length === 0}>Criar Demanda</Button>
              <p className="text-[11px] text-muted-foreground text-center">⚠️ Após criada, a demanda não pode ser editada nem excluída.</p>
            </div>
          </DialogContent>
        </Dialog>

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
            <DialogHeader><DialogTitle>Novo Compromisso</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div><Label>Título</Label><Input value={agendaForm.titulo} onChange={(e) => setAgendaForm({ ...agendaForm, titulo: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={agendaForm.descricao} onChange={(e) => setAgendaForm({ ...agendaForm, descricao: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data</Label><Input type="date" value={agendaForm.data} onChange={(e) => setAgendaForm({ ...agendaForm, data: e.target.value })} /></div>
                <div><Label>Hora</Label><Input type="time" value={agendaForm.hora} onChange={(e) => setAgendaForm({ ...agendaForm, hora: e.target.value })} /></div>
              </div>
              <Button onClick={handleCriarAgenda} className="w-full gradient-primary text-primary-foreground">Criar Compromisso</Button>
            </div>
          </DialogContent>
        </Dialog>

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
            <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div><Label>Título</Label><Input value={tarefaForm.titulo} onChange={(e) => setTarefaForm({ ...tarefaForm, titulo: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={tarefaForm.descricao} onChange={(e) => setTarefaForm({ ...tarefaForm, descricao: e.target.value })} rows={3} /></div>
              <div><Label>Prazo</Label><Input type="date" value={tarefaForm.prazo} onChange={(e) => setTarefaForm({ ...tarefaForm, prazo: e.target.value })} /></div>
              <Button onClick={handleCriarTarefa} className="w-full gradient-primary text-primary-foreground">Criar Tarefa</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs: Minhas Demandas (Kanban) | Em Aberto */}
      <Tabs defaultValue="minhas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="minhas">
            Minhas Demandas <Badge variant="secondary" className="ml-2">{minhasDemandas.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="abertas">
            Em Aberto <Badge variant="secondary" className="ml-2">{demandasAbertas.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="tarefas">
            Minhas Tarefas <Badge variant="secondary" className="ml-2">{minhasTarefas.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="minhas">
          {minhasDemandas.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground italic">Você ainda não tem demandas atribuídas. Assuma uma da aba "Em Aberto" ou crie uma nova.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
              {columns.map((col) => {
                const colDemandas = minhasDemandas.filter((d) => d.status === col.key);
                return (
                  <div key={col.key} className="space-y-3" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.key)}>
                    <div className="flex items-center gap-2 pb-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`} />
                      <h3 className="font-semibold text-sm">{col.title}</h3>
                      <Badge variant="secondary" className="text-xs ml-auto">{colDemandas.length}</Badge>
                    </div>
                    <div className={`space-y-2 sm:space-y-3 min-h-[120px] md:min-h-[200px] p-2 sm:p-3 rounded-xl bg-secondary/30 border border-border/50 transition-colors ${dragId ? "border-primary/20 bg-primary/5" : ""}`}>
                      <AnimatePresence>
                        {colDemandas.map((d) => {
                          const prazoExpirado = isPrazoExpired(d.prazo, d.status);
                          return (
                            <motion.div
                              key={d.id}
                              layout
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              draggable
                              onDragStart={(e: any) => handleDragStart(e, d.id)}
                              onDragEnd={() => setDragId(null)}
                            >
                              <Card className={cn("glass-card hover:shadow-[var(--shadow-md)] transition-all cursor-grab active:cursor-grabbing group", dragId === d.id && "opacity-50 scale-95", prazoExpirado && "border-destructive/50 bg-destructive/5")}>
                                <CardContent className="p-3 sm:p-4 space-y-2">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <Badge variant="outline" className={`text-[10px] ${statusStyles[d.status] || ""}`}>{d.status}</Badge>
                                      {prazoExpirado && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                                    </div>
                                    <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground hidden md:block" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-xs sm:text-sm">{d.titulo}</h3>
                                    {d.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.descricao}</p>}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    {d.localizacao && (<span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{d.localizacao}</span>)}
                                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(d.created_at), "dd/MM/yyyy")}</span>
                                    {d.prazo && (
                                      <span className={cn("flex items-center gap-1", prazoExpirado ? "text-destructive font-semibold" : "text-warning")}>
                                        <Clock className="h-3 w-3" />Prazo: {format(new Date(d.prazo), "dd/MM/yyyy")}
                                      </span>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="abertas">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">Demandas sem responsável — você pode assumir</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {demandasAbertas.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhuma demanda em aberto no momento.</p>
              ) : (
                demandasAbertas.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Clock className="h-4 w-4 text-warning shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.titulo}</p>
                        {d.descricao && <p className="text-xs text-muted-foreground truncate">{d.descricao}</p>}
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          <Badge variant="outline" className="text-[10px] mr-2">Em aberto</Badge>
                          Criada em {format(new Date(d.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          {d.prazo && ` · Prazo: ${format(new Date(d.prazo), "dd/MM/yyyy", { locale: ptBR })}`}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => assumirDemanda(d.id)} className="gradient-primary text-primary-foreground gap-1 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Assumir
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tarefas">
          {minhasTarefas.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground italic">Você ainda não tem tarefas atribuídas. Crie uma em "Criar Tarefa".</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              {tarefaColumns.map((col) => {
                const colTarefas = minhasTarefas.filter((t) => t.status === col.key);
                return (
                  <div
                    key={col.key}
                    className="space-y-3"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleTarefaDrop(e, col.key)}
                  >
                    <div className="flex items-center gap-2 pb-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`} />
                      <h3 className="font-semibold text-sm">{col.title}</h3>
                      <Badge variant="secondary" className="text-xs ml-auto">{colTarefas.length}</Badge>
                    </div>
                    <div className={`space-y-2 sm:space-y-3 min-h-[120px] md:min-h-[200px] p-2 sm:p-3 rounded-xl bg-secondary/30 border border-border/50 transition-colors ${dragTarefaId ? "border-primary/20 bg-primary/5" : ""}`}>
                      <AnimatePresence>
                        {colTarefas.map((t) => {
                          const prazoExpirado = isPrazoExpired(t.prazo, t.status);
                          return (
                            <motion.div
                              key={t.id}
                              layout
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              draggable
                              onDragStart={(e: any) => handleTarefaDragStart(e, t.id)}
                              onDragEnd={() => setDragTarefaId(null)}
                            >
                              <Card className={cn(
                                "glass-card hover:shadow-[var(--shadow-md)] transition-all cursor-grab active:cursor-grabbing",
                                dragTarefaId === t.id && "opacity-50 scale-95",
                                prazoExpirado && "border-destructive/50 bg-destructive/5"
                              )}>
                                <CardContent className="p-3 sm:p-4 space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-semibold text-xs sm:text-sm flex-1">{t.titulo}</h3>
                                    {prazoExpirado && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                                  </div>
                                  {t.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{t.descricao}</p>}
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(t.created_at), "dd/MM/yyyy")}</span>
                                    {t.prazo && (
                                      <span className={cn("flex items-center gap-1", prazoExpirado ? "text-destructive font-semibold" : "text-warning")}>
                                        <Clock className="h-3 w-3" />Prazo: {format(new Date(t.prazo), "dd/MM/yyyy")}
                                      </span>
                                    )}
                                  </div>
                                  {t.status !== "Concluído" && (
                                    <div className="flex gap-1 pt-1">
                                      {t.status === "Pendente" && (
                                        <Button size="sm" variant="ghost" className="text-xs h-7 text-info hover:text-info" onClick={() => moveTarefaStatus(t.id, "Em Andamento")}>Iniciar</Button>
                                      )}
                                      {t.status === "Em Andamento" && (
                                        <Button size="sm" variant="ghost" className="text-xs h-7 text-success hover:text-success" onClick={() => moveTarefaStatus(t.id, "Concluído")}>Concluir</Button>
                                      )}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Histórico de Eleitores Cadastrados por mim */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Eleitores cadastrados por mim
            <Badge variant="secondary" className="ml-2">{historicoEleitores.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {historicoEleitores.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Você ainda não cadastrou nenhum eleitor.</p>
          ) : (
            historicoEleitores.map((el) => (
              <div key={el.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/20">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <UserPlus className="h-4 w-4 text-success shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{el.nome}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Badge variant="outline" className="text-[10px] border-success bg-success/10 text-success">Eleitor cadastrado</Badge>
                      {el.telefone && <span>📱 {el.telefone}</span>}
                      {el.interesse && <span>· {el.interesse}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(el.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      <span>· por você</span>
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
