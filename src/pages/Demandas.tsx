import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Plus, MapPin, Calendar, Clock, Sparkles, GripVertical, Pencil, UserCheck, AlertTriangle, Filter, X, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, isSameDay, isWithinInterval, startOfDay, endOfDay, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { normalizePayload, normalizeText } from "@/lib/textEncoding";

interface Demanda {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  localizacao: string | null;
  assessor_id: string | null;
  eleitor_id: string | null;
  prazo: string | null;
  created_at: string;
  origem: string | null;
  tipo: string | null;
  setor: string | null;
}

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

interface AssessorOption {
  user_id: string;
  nome: string;
}

interface EleitorOption {
  id: string;
  nome: string;
}

type StatusKey = "Aberto" | "Em Análise" | "Em Andamento" | "Resolvido";

const columns: { key: StatusKey; title: string; dotColor: string }[] = [
  { key: "Aberto", title: "Aberto", dotColor: "bg-warning" },
  { key: "Em Análise", title: "Em Análise", dotColor: "bg-info" },
  { key: "Em Andamento", title: "Em Andamento", dotColor: "bg-accent" },
  { key: "Resolvido", title: "Resolvido", dotColor: "bg-success" },
];

const statusStyles: Record<string, string> = {
  "Aberto": "border-warning bg-warning/10 text-warning",
  "Em Análise": "border-info bg-info/10 text-info",
  "Em Andamento": "border-accent bg-accent/10 text-accent",
  "Resolvido": "border-success bg-success/10 text-success",
};

const Demandas = () => {
  const { user, role } = useAuth();
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [assessores, setAssessores] = useState<AssessorOption[]>([]);
  const [assessorMap, setAssessorMap] = useState<Record<string, string>>({});
  const [eleitores, setEleitores] = useState<EleitorOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDemanda, setEditingDemanda] = useState<Demanda | null>(null);
  const [form, setForm] = useState({ titulo: "", descricao: "", localizacao: "", assessor_id: "", eleitor_id: "", prazo: "", origem: "", tipo: "", setor: "" });
  const [dragId, setDragId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [filterDateEnd, setFilterDateEnd] = useState<Date | undefined>(undefined);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterOrigem, setFilterOrigem] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterResponsavel, setFilterResponsavel] = useState<string>("all");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterSetor, setFilterSetor] = useState<string>("all");
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchAssessores = async () => {
    if (!user || role !== "politico") return;
    const { data: links } = await supabase
      .from("politician_assessors")
      .select("assessor_id")
      .eq("politician_id", user.id);
    if (!links || links.length === 0) return;
    const ids = links.map((l) => l.assessor_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nome")
      .in("user_id", ids);
    if (profiles) {
      setAssessores(profiles);
      const map: Record<string, string> = {};
      profiles.forEach((p) => { map[p.user_id] = p.nome; });
      setAssessorMap(map);
    }
  };

  const fetchDemandas = async () => {
    const { data } = await supabase.from("demandas").select("*").order("created_at", { ascending: false });
    // Normaliza encoding (corrige eventuais "Em AnÃ¡lise" -> "Em Análise") e NFC
    setDemandas(((data || []) as Demanda[]).map((d) => ({ ...d, status: normalizeText(d.status), titulo: normalizeText(d.titulo) })) as Demanda[]);
  };

  const fetchEleitores = async () => {
    const { data } = await supabase
      .from("eleitores")
      .select("id, nome")
      .order("nome", { ascending: true });
    setEleitores((data as EleitorOption[]) || []);
  };

  useEffect(() => {
    fetchDemandas();
    fetchAssessores();
    fetchEleitores();
    const channel = supabase.channel("demandas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "demandas" }, () => fetchDemandas())
      .on("postgres_changes", { event: "*", schema: "public", table: "eleitores" }, () => fetchEleitores())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, role]);

  const filteredDemandas = demandas.filter((d) => {
    if (filterDate) {
      const createdAt = new Date(d.created_at);
      if (filterDateEnd) {
        if (!isWithinInterval(createdAt, { start: startOfDay(filterDate), end: endOfDay(filterDateEnd) })) return false;
      } else if (!isSameDay(createdAt, filterDate)) return false;
    }
    if (filterOrigem !== "all" && (d.origem || "") !== filterOrigem) return false;
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    if (filterTipo !== "all" && (d.tipo || "") !== filterTipo) return false;
    if (filterSetor !== "all" && (d.setor || "") !== filterSetor) return false;
    if (filterResponsavel !== "all") {
      if (filterResponsavel === "none" && d.assessor_id) return false;
      if (filterResponsavel !== "none" && d.assessor_id !== filterResponsavel) return false;
    }
    return true;
  });

  const handleSave = async () => {
    if (!form.titulo) { toast({ title: "Preencha o título", variant: "destructive" }); return; }

    const payload: any = {
      titulo: form.titulo,
      descricao: form.descricao || null,
      localizacao: form.localizacao || null,
      prazo: form.prazo ? new Date(form.prazo).toISOString() : null,
      origem: form.origem || null,
      tipo: form.tipo || null,
      setor: form.setor || null,
      eleitor_id: form.eleitor_id || null,
    };
    if (role === "politico") {
      payload.assessor_id = form.assessor_id || null;
    }

    const safePayload = normalizePayload(payload);
    if (editingDemanda) {
      const { error } = await supabase.from("demandas").update(safePayload).eq("id", editingDemanda.id);
      if (error) { toast({ title: "Erro ao atualizar", variant: "destructive" }); return; }
      toast({ title: "Demanda atualizada!" });
    } else {
      if (role === "assessor" && user) {
        safePayload.assessor_id = user.id;
      }
      const { error } = await supabase.from("demandas").insert(safePayload);
      if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Demanda criada!" });
    }

    setForm({ titulo: "", descricao: "", localizacao: "", assessor_id: "", eleitor_id: "", prazo: "", origem: "", tipo: "", setor: "" });
    setEditingDemanda(null);
    setDialogOpen(false);
  };

  const openEdit = (demanda: Demanda) => {
    setEditingDemanda(demanda);
    setForm({
      titulo: demanda.titulo,
      descricao: demanda.descricao || "",
      localizacao: demanda.localizacao || "",
      assessor_id: demanda.assessor_id || "",
      eleitor_id: demanda.eleitor_id || "",
      prazo: demanda.prazo ? demanda.prazo.split("T")[0] : "",
      origem: demanda.origem || "",
      tipo: demanda.tipo || "",
      setor: (demanda as any).setor || "",
    });
    setDialogOpen(true);
  };

  const deleteDemanda = async (id: string) => {
    const { error } = await supabase.from("demandas").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir", variant: "destructive" }); return; }
    toast({ title: "Demanda excluída!" });
    fetchDemandas();
  };

  const moveTask = async (id: string, newStatus: StatusKey) => {
    const { error } = await supabase.from("demandas").update({ status: normalizeText(newStatus) }).eq("id", id);
    if (error) { toast({ title: "Erro ao mover demanda", variant: "destructive" }); return; }
    fetchDemandas();
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
      moveTask(dragId, status);
      setDragId(null);
      toast({ title: "Demanda movida!" });
    }
  };

  const handleCreatePL = (demanda: Demanda) => {
    const msg = `Crie um Projeto de Lei baseado nesta demanda:\n\nTítulo: ${demanda.titulo}\nDescrição: ${demanda.descricao || "N/A"}\nLocalização: ${demanda.localizacao || "N/A"}`;
    navigate("/assistente", { state: { prefill: msg } });
  };

  const isPrazoExpired = (prazo: string | null, status: string) => {
    if (!prazo || status === "Resolvido") return false;
    return isPast(new Date(prazo));
  };

  const total = filteredDemandas.length;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gestão de Demandas</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Acompanhe e resolva as solicitações da população.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2", filterDate && "border-primary text-primary")}>
                <Filter className="h-4 w-4" />
                {filterDate ? (filterDateEnd ? `${format(filterDate, "dd/MM")} - ${format(filterDateEnd, "dd/MM")}` : format(filterDate, "dd/MM/yyyy")) : "Filtrar por data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="end">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Filtrar por período</p>
                  {filterDate && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setFilterDate(undefined); setFilterDateEnd(undefined); setFilterOpen(false); }}>
                      <X className="h-3 w-3 mr-1" />Limpar
                    </Button>
                  )}
                </div>
                <CalendarComponent
                  mode="range"
                  selected={filterDate && filterDateEnd ? { from: filterDate, to: filterDateEnd } : filterDate ? { from: filterDate, to: filterDate } : undefined}
                  onSelect={(range: any) => {
                    setFilterDate(range?.from);
                    setFilterDateEnd(range?.to);
                  }}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => { setFilterDate(new Date()); setFilterDateEnd(undefined); }}>
                  Hoje
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Badge variant="secondary" className="text-sm">{total} Total</Badge>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingDemanda(null); setForm({ titulo: "", descricao: "", localizacao: "", assessor_id: "", eleitor_id: "", prazo: "", origem: "", tipo: "", setor: "" }); } }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground gap-2 shadow-[var(--shadow-md)]">
                <Plus className="h-4 w-4" /> Nova Demanda
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingDemanda ? "Editar Demanda" : "Nova Demanda"}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título da demanda" /></div>
                <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descreva a demanda" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>📍 Origem</Label>
                    <Select value={form.origem || "none"} onValueChange={(v) => setForm({ ...form, origem: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="De onde veio" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informado</SelectItem>
                        {ORIGENS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>🏷️ Tipo</Label>
                    <Select value={form.tipo || "none"} onValueChange={(v) => setForm({ ...form, tipo: v === "none" ? "" : v })}>
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
                  <Select value={form.setor || "none"} onValueChange={(v) => setForm({ ...form, setor: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não informado</SelectItem>
                      {SETORES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Localização</Label><Input value={form.localizacao} onChange={(e) => setForm({ ...form, localizacao: e.target.value })} placeholder="Local da demanda" /></div>
                <div><Label>Prazo</Label><Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} /></div>
                <div>
                  <Label>👤 Vincular a Eleitor (opcional)</Label>
                  <Select value={form.eleitor_id || "none"} onValueChange={(v) => setForm({ ...form, eleitor_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione um eleitor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem vínculo</SelectItem>
                      {eleitores.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {role === "politico" && assessores.length > 0 && (
                  <div>
                    <Label>Atribuir a Assessor</Label>
                    <Select value={form.assessor_id} onValueChange={(v) => setForm({ ...form, assessor_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Sem atribuição" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem atribuição</SelectItem>
                        {assessores.map((a) => (
                          <SelectItem key={a.user_id} value={a.user_id}>{a.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={handleSave} className="w-full gradient-primary text-primary-foreground">
                  {editingDemanda ? "Salvar Alterações" : "Criar Demanda"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">📍 Origem</Label>
          <Select value={filterOrigem} onValueChange={setFilterOrigem}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              {ORIGENS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">📌 Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {columns.map((c) => <SelectItem key={c.key} value={c.key}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">👤 Responsável</Label>
          <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="none">Sem responsável</SelectItem>
              {assessores.map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">🏷️ Tipo</Label>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">🏛️ Setor</Label>
          <Select value={filterSetor} onValueChange={setFilterSetor}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {SETORES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(filterOrigem !== "all" || filterStatus !== "all" || filterResponsavel !== "all" || filterTipo !== "all" || filterSetor !== "all" || filterDate) && (
          <Button variant="ghost" size="sm" className="col-span-2 md:col-span-3 lg:col-span-5 h-8 text-xs gap-1 justify-start text-muted-foreground hover:text-foreground"
            onClick={() => { setFilterOrigem("all"); setFilterStatus("all"); setFilterResponsavel("all"); setFilterTipo("all"); setFilterSetor("all"); setFilterDate(undefined); setFilterDateEnd(undefined); }}>
            <X className="h-3 w-3" /> Limpar todos os filtros
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {columns.map((col) => {
          const colDemandas = filteredDemandas.filter((d) => d.status === col.key);
          return (
            <div key={col.key} className="space-y-3" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.key)}>
              <div className="flex items-center gap-2 pb-2">
                <div className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`} />
                <h3 className="font-semibold text-sm">{col.title}</h3>
                <Badge variant="secondary" className="text-xs ml-auto">{colDemandas.length}</Badge>
              </div>
              <div className={`space-y-2 sm:space-y-3 min-h-[120px] md:min-h-[200px] p-2 sm:p-3 rounded-xl bg-secondary/30 border border-border/50 transition-colors ${dragId ? "border-primary/20 bg-primary/5" : ""}`}>
                <AnimatePresence>
                  {colDemandas.map((demanda) => {
                    const dias = differenceInDays(new Date(), new Date(demanda.created_at));
                    const assessorNome = demanda.assessor_id ? assessorMap[demanda.assessor_id] : null;
                    const prazoExpirado = isPrazoExpired(demanda.prazo, demanda.status);
                    return (
                      <motion.div
                        key={demanda.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        draggable
                        onDragStart={(e: any) => handleDragStart(e, demanda.id)}
                        onDragEnd={() => setDragId(null)}
                      >
                        <Card className={cn(
                          "glass-card hover:shadow-[var(--shadow-md)] transition-all cursor-grab active:cursor-grabbing group",
                          dragId === demanda.id && "opacity-50 scale-95",
                          prazoExpirado && "border-destructive/50 bg-destructive/5"
                        )}>
                          <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className={`text-[10px] ${statusStyles[demanda.status] || ""}`}>{demanda.status}</Badge>
                                {demanda.tipo && <Badge variant="secondary" className="text-[10px]">🏷️ {demanda.tipo}</Badge>}
                                {demanda.origem && <Badge variant="outline" className="text-[10px]">{ORIGENS.find(o => o.value === demanda.origem)?.label || `📍 ${demanda.origem}`}</Badge>}
                                {(demanda as any).setor && <Badge variant="outline" className="text-[10px]">{SETORES.find(s => s.value === (demanda as any).setor)?.label || `🏛️ ${(demanda as any).setor}`}</Badge>}
                                {prazoExpirado && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground" onClick={() => openEdit(demanda)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { if (confirm("Excluir esta demanda?")) deleteDemanda(demanda.id); }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                                <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors hidden md:block" />
                              </div>
                            </div>
                            <div>
                              <h3 className="font-semibold text-xs sm:text-sm">{demanda.titulo}</h3>
                              {demanda.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{demanda.descricao}</p>}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {demanda.localizacao && (
                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{demanda.localizacao}</span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(demanda.created_at), "dd/MM/yyyy")}
                              </span>
                              {demanda.prazo && (
                                <span className={cn("flex items-center gap-1", prazoExpirado ? "text-destructive font-semibold" : "text-warning")}>
                                  <Clock className="h-3 w-3" />
                                  Prazo: {format(new Date(demanda.prazo), "dd/MM/yyyy")}
                                </span>
                              )}
                              {assessorNome && (
                                <span className="flex items-center gap-1 text-primary">
                                  <UserCheck className="h-3 w-3" />{assessorNome}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{dias} dias</span>
                              <div className="flex items-center gap-1">
                                {demanda.status !== "Resolvido" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 gap-1 text-[10px] text-info hover:bg-info/10 hover:text-info"
                                    onClick={() => {
                                      const nextStatus: Record<string, StatusKey> = {
                                        "Aberto": "Em Análise",
                                        "Em Análise": "Em Andamento",
                                        "Em Andamento": "Resolvido",
                                      };
                                      moveTask(demanda.id, nextStatus[demanda.status]);
                                    }}
                                  >
                                    Avançar →
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 gap-1 text-[10px] text-accent hover:bg-accent/10 hover:text-accent"
                                  onClick={() => handleCreatePL(demanda)}
                                >
                                  <Sparkles className="h-3 w-3" />
                                  Criar PL
                                </Button>
                              </div>
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
    </motion.div>
  );
};

export default Demandas;
