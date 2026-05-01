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
import { Plus, Calendar, Clock, GripVertical, Pencil, UserCheck, AlertTriangle, Filter, X, Trash2, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay, isWithinInterval, startOfDay, endOfDay, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  status: string;
  assessor_id: string | null;
  created_at: string;
  demanda_id: string | null;
  tipo: string | null;
  setor: string | null;
}

interface AssessorOption {
  user_id: string;
  nome: string;
}

interface DemandaOption {
  id: string;
  titulo: string;
  tipo: string | null;
  setor: string | null;
}

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

type StatusKey = "Pendente" | "Em Andamento" | "Concluído";

const columns: { key: StatusKey; title: string; dotColor: string }[] = [
  { key: "Pendente", title: "Pendente", dotColor: "bg-warning" },
  { key: "Em Andamento", title: "Em Andamento", dotColor: "bg-info" },
  { key: "Concluído", title: "Concluído", dotColor: "bg-success" },
];

// Normaliza qualquer variante de status (sem acento, caixa, sinônimos antigos)
// para uma das chaves do Kanban. Garante que tarefas concluídas via WhatsApp
// (que podem vir como "Concluido", "concluído", "Finalizada", etc.) caiam
// sempre na coluna correta.
const normalizeStatus = (raw: string | null | undefined): StatusKey => {
  const s = (raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (
    s === "concluido" ||
    s === "concluida" ||
    s === "finalizada" ||
    s === "finalizado" ||
    s === "feito" ||
    s === "feita" ||
    s === "done"
  ) return "Concluído";
  if (
    s === "em andamento" ||
    s === "andamento" ||
    s === "em progresso" ||
    s === "iniciada" ||
    s === "iniciado" ||
    s === "in progress"
  ) return "Em Andamento";
  return "Pendente";
};

const Tarefas = () => {
  const { user, role } = useAuth();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [assessores, setAssessores] = useState<AssessorOption[]>([]);
  const [assessorMap, setAssessorMap] = useState<Record<string, string>>({});
  const [demandas, setDemandas] = useState<DemandaOption[]>([]);
  const [demandaMap, setDemandaMap] = useState<Record<string, DemandaOption>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | null>(null);
  const [form, setForm] = useState({ titulo: "", descricao: "", prazo: "", assessor_id: "", demanda_id: "", tipo: "", setor: "" });
  const [dragId, setDragId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [filterDateEnd, setFilterDateEnd] = useState<Date | undefined>(undefined);
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterSetor, setFilterSetor] = useState<string>("all");
  const [filterResponsavel, setFilterResponsavel] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const { toast } = useToast();

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
    const { data, error } = await supabase
      .from("demandas")
      .select("id, titulo, tipo, setor")
      .order("created_at", { ascending: false });
    if (error) { console.error("Erro ao buscar demandas:", error); return; }
    setDemandas(data || []);
    const map: Record<string, DemandaOption> = {};
    (data || []).forEach((d) => { map[d.id] = d as DemandaOption; });
    setDemandaMap(map);
  };

  const fetchTarefas = async () => {
    if (!user) return;
    if (role === "assessor") {
      const { data, error } = await supabase
        .from("tarefas")
        .select("*")
        .eq("assessor_id", user.id)
        .order("created_at", { ascending: false });
      if (error) { console.error("Erro ao buscar tarefas:", error); return; }
      setTarefas(data || []);
      return;
    }
    // Político: tarefas atribuídas a ele OU dos seus assessores vinculados OU órfãs
    // (sem politician_id e sem assessor_id — tipicamente criadas via WhatsApp antes
    // do vínculo ter sido preenchido). Buscamos em duas queries e fazemos merge,
    // pois `.or()` com `is.null` em múltiplos campos costuma falhar no PostgREST.
    const { data: links } = await supabase
      .from("politician_assessors")
      .select("assessor_id")
      .eq("politician_id", user.id);
    const assessorIds = (links || []).map((l) => l.assessor_id);

    const orParts = [`politician_id.eq.${user.id}`];
    if (assessorIds.length > 0) {
      orParts.push(`assessor_id.in.(${assessorIds.join(",")})`);
    }
    const { data: ownData, error: ownErr } = await supabase
      .from("tarefas")
      .select("*")
      .or(orParts.join(","))
      .order("created_at", { ascending: false });
    if (ownErr) { console.error("Erro ao buscar tarefas:", ownErr); return; }

    // Tarefas órfãs (sem dono nenhum) — visíveis a qualquer político até serem atribuídas.
    const { data: orphanData } = await supabase
      .from("tarefas")
      .select("*")
      .is("politician_id", null)
      .is("assessor_id", null)
      .order("created_at", { ascending: false });

    const merged = [...(ownData || [])];
    const seen = new Set(merged.map((t) => t.id));
    (orphanData || []).forEach((t) => { if (!seen.has(t.id)) merged.push(t); });
    setTarefas(merged);
  };

  useEffect(() => {
    fetchTarefas();
    fetchAssessores();
    fetchDemandas();
    const channel = supabase
      .channel("tarefas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, () => fetchTarefas())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, role]);

  const filteredTarefas = tarefas.filter((t) => {
    if (filterDate) {
      const createdAt = new Date(t.created_at);
      if (filterDateEnd) {
        if (!isWithinInterval(createdAt, { start: startOfDay(filterDate), end: endOfDay(filterDateEnd) })) return false;
      } else if (!isSameDay(createdAt, filterDate)) return false;
    }
    if (filterTipo !== "all" && t.tipo !== filterTipo) return false;
    if (filterSetor !== "all" && t.setor !== filterSetor) return false;
    if (filterResponsavel !== "all") {
      const isMatch = filterResponsavel === "none" ? !t.assessor_id : t.assessor_id === filterResponsavel;
      if (!isMatch) return false;
    }
    return true;
  });

  const handleDemandaChange = (v: string) => {
    if (v === "none") {
      setForm({ ...form, demanda_id: "" });
      return;
    }
    const d = demandaMap[v];
    setForm({
      ...form,
      demanda_id: v,
      tipo: d?.tipo || form.tipo,
      setor: d?.setor || form.setor,
    });
  };

  const handleSave = async () => {
    if (!form.titulo) {
      toast({ title: "Preencha o título", variant: "destructive" });
      return;
    }

    const payload: any = {
      titulo: form.titulo,
      descricao: form.descricao || null,
      prazo: form.prazo || null,
      demanda_id: form.demanda_id || null,
      tipo: form.tipo || null,
      setor: form.setor || null,
    };
    if (role === "politico" && user) {
      payload.assessor_id = form.assessor_id || null;
      payload.politician_id = user.id;
    }

    if (editingTarefa) {
      const { error } = await supabase.from("tarefas").update(payload).eq("id", editingTarefa.id);
      if (error) { toast({ title: "Erro ao atualizar", variant: "destructive" }); return; }
      toast({ title: "Tarefa atualizada!" });
    } else {
      if (role === "assessor" && user) {
        payload.assessor_id = user.id;
        // Vincula a tarefa ao político do assessor
        const { data: link } = await supabase
          .from("politician_assessors")
          .select("politician_id")
          .eq("assessor_id", user.id)
          .maybeSingle();
        if (link?.politician_id) payload.politician_id = link.politician_id;
        payload.criado_por = user.id;
      }
      const { error } = await supabase.from("tarefas").insert(payload);
      if (error) { toast({ title: "Erro ao criar", variant: "destructive" }); return; }
      toast({ title: "Tarefa criada!" });
    }

    setForm({ titulo: "", descricao: "", prazo: "", assessor_id: "", demanda_id: "", tipo: "", setor: "" });
    setEditingTarefa(null);
    setDialogOpen(false);
    fetchTarefas();
  };

  const openEdit = (tarefa: Tarefa) => {
    setEditingTarefa(tarefa);
    setForm({
      titulo: tarefa.titulo,
      descricao: tarefa.descricao || "",
      prazo: tarefa.prazo ? tarefa.prazo.split("T")[0] : "",
      assessor_id: tarefa.assessor_id || "",
      demanda_id: tarefa.demanda_id || "",
      tipo: tarefa.tipo || "",
      setor: tarefa.setor || "",
    });
    setDialogOpen(true);
  };

  const deleteTarefa = async (id: string) => {
    const { error } = await supabase.from("tarefas").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir", variant: "destructive" }); return; }
    toast({ title: "Tarefa excluída!" });
    fetchTarefas();
  };

  const moveTask = async (id: string, newStatus: StatusKey) => {
    const { error } = await supabase.from("tarefas").update({ status: newStatus }).eq("id", id);
    if (error) { toast({ title: "Erro ao mover tarefa", variant: "destructive" }); return; }
    fetchTarefas();
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
      toast({ title: "Tarefa movida!" });
    }
  };

  const isPrazoExpired = (prazo: string | null, status: string) => {
    if (!prazo || normalizeStatus(status) === "Concluído") return false;
    return isPast(new Date(prazo));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try { return new Date(dateStr).toLocaleDateString("pt-BR"); } catch { return dateStr; }
  };

  const clearFilters = () => {
    setFilterDate(undefined); setFilterDateEnd(undefined);
    setFilterTipo("all"); setFilterSetor("all"); setFilterResponsavel("all");
  };

  const hasFilters = !!filterDate || filterTipo !== "all" || filterSetor !== "all" || filterResponsavel !== "all";
  const total = filteredTarefas.length;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gestão de Tarefas</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Organize e acompanhe as atividades do gabinete.</p>
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
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingTarefa(null); setForm({ titulo: "", descricao: "", prazo: "", assessor_id: "", demanda_id: "", tipo: "", setor: "" }); } }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground gap-2 shadow-[var(--shadow-md)]">
                <Plus className="h-4 w-4" /> Nova Tarefa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingTarefa ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título da tarefa" /></div>
                <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descreva a tarefa (opcional)" rows={3} /></div>

                <div>
                  <Label>📌 Demanda vinculada</Label>
                  <Select value={form.demanda_id || "none"} onValueChange={handleDemandaChange}>
                    <SelectTrigger><SelectValue placeholder="Vincular a uma demanda (opcional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem vínculo</SelectItem>
                      {demandas.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.titulo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>🏷️ Tipo</Label>
                    <Select value={form.tipo || "none"} onValueChange={(v) => setForm({ ...form, tipo: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {TIPOS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>🏢 Setor responsável</Label>
                    <Select value={form.setor || "none"} onValueChange={(v) => setForm({ ...form, setor: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {SETORES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div><Label>📅 Prazo</Label><Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} /></div>
                {role === "politico" && assessores.length > 0 && (
                  <div>
                    <Label>👤 Responsável pela execução</Label>
                    <Select value={form.assessor_id || "none"} onValueChange={(v) => setForm({ ...form, assessor_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione um assessor (opcional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {assessores.map((a) => (
                          <SelectItem key={a.user_id} value={a.user_id}>{a.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={handleSave} className="w-full gradient-primary text-primary-foreground">
                  {editingTarefa ? "Salvar Alterações" : "Criar Tarefa"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros principais */}
      <Card className="glass-card">
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">🏷️ Tipo</Label>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {TIPOS.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">🏢 Setor</Label>
              <Select value={filterSetor} onValueChange={setFilterSetor}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {SETORES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">👤 Responsável</Label>
              <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {assessores.map((a) => (<SelectItem key={a.user_id} value={a.user_id}>{a.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              {hasFilters && (
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5" /> Limpar filtros
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 overflow-x-auto">
        {columns.map((col) => {
          const colTarefas = filteredTarefas.filter((t) => normalizeStatus(t.status) === col.key);
          return (
            <div key={col.key} className="space-y-3" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.key)}>
              <div className="flex items-center gap-2 pb-2">
                <div className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`} />
                <h3 className="font-semibold text-sm">{col.title}</h3>
                <Badge variant="secondary" className="text-xs ml-auto">{colTarefas.length}</Badge>
              </div>
              <div className={`space-y-2 sm:space-y-3 min-h-[120px] md:min-h-[200px] p-2 sm:p-3 rounded-xl bg-secondary/30 border border-border/50 transition-colors ${dragId ? "border-primary/20 bg-primary/5" : ""}`}>
                <AnimatePresence>
                  {colTarefas.map((tarefa) => {
                    const prazoExpirado = isPrazoExpired(tarefa.prazo, tarefa.status);
                    const demandaVinc = tarefa.demanda_id ? demandaMap[tarefa.demanda_id] : null;
                    return (
                      <motion.div
                        key={tarefa.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        draggable
                        onDragStart={(e: any) => handleDragStart(e, tarefa.id)}
                        onDragEnd={() => setDragId(null)}
                      >
                        <Card className={cn(
                          "glass-card hover:shadow-[var(--shadow-md)] transition-all cursor-grab active:cursor-grabbing group",
                          dragId === tarefa.id && "opacity-50 scale-95",
                          prazoExpirado && "border-destructive/50 bg-destructive/5"
                        )}>
                          <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs sm:text-sm font-medium flex-1">{tarefa.titulo}</p>
                                {prazoExpirado && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground" onClick={() => openEdit(tarefa)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { if (confirm("Excluir esta tarefa?")) deleteTarefa(tarefa.id); }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                                <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors hidden md:block" />
                              </div>
                            </div>

                            {tarefa.descricao && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{tarefa.descricao}</p>
                            )}

                            {demandaVinc && (
                              <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
                                <Link2 className="h-3 w-3 shrink-0" />
                                <span className="truncate">{demandaVinc.titulo}</span>
                              </div>
                            )}

                            {(tarefa.tipo || tarefa.setor) && (
                              <div className="flex flex-wrap gap-1">
                                {tarefa.tipo && (
                                  <Badge variant="outline" className="text-[10px] h-5">🏷️ {tarefa.tipo}</Badge>
                                )}
                                {tarefa.setor && (
                                  <Badge variant="outline" className="text-[10px] h-5">{SETORES.find(s => s.value === tarefa.setor)?.label || tarefa.setor}</Badge>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(tarefa.created_at), "dd/MM/yyyy")}
                              </span>
                              {tarefa.prazo && (
                                <span className={cn("flex items-center gap-1", prazoExpirado ? "text-destructive font-semibold" : "text-warning")}>
                                  <Clock className="h-3 w-3" />
                                  Prazo: {formatDate(tarefa.prazo)}
                                </span>
                              )}
                              {tarefa.assessor_id && assessorMap[tarefa.assessor_id] && (
                                <span className="flex items-center gap-1 text-primary"><UserCheck className="h-3 w-3" />{assessorMap[tarefa.assessor_id]}</span>
                              )}
                              {normalizeStatus(tarefa.status) === "Concluído" && (
                                <span className="flex items-center gap-1 text-success"><Clock className="h-3 w-3" />Concluído</span>
                              )}
                            </div>
                            {normalizeStatus(tarefa.status) !== "Concluído" && (
                              <div className="flex gap-1 pt-1">
                                {normalizeStatus(tarefa.status) === "Pendente" && (
                                  <Button size="sm" variant="ghost" className="text-xs h-7 text-info hover:text-info" onClick={() => moveTask(tarefa.id, "Em Andamento")}>Iniciar</Button>
                                )}
                                {normalizeStatus(tarefa.status) === "Em Andamento" && (
                                  <Button size="sm" variant="ghost" className="text-xs h-7 text-success hover:text-success" onClick={() => moveTask(tarefa.id, "Concluído")}>Concluir</Button>
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
    </motion.div>
  );
};

export default Tarefas;
