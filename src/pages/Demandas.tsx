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

interface Demanda {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  localizacao: string | null;
  assessor_id: string | null;
  prazo: string | null;
  created_at: string;
  origem: string | null;
  tipo: string | null;
}

const ORIGENS = ["WhatsApp", "Presencial", "Telefone", "E-mail", "Redes Sociais", "Site", "Evento", "Outro"];
const TIPOS = ["Saúde", "Educação", "Infraestrutura", "Segurança", "Transporte", "Meio Ambiente", "Assistência Social", "Cultura/Esporte", "Outro"];

interface AssessorOption {
  user_id: string;
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDemanda, setEditingDemanda] = useState<Demanda | null>(null);
  const [form, setForm] = useState({ titulo: "", descricao: "", localizacao: "", assessor_id: "", prazo: "" });
  const [dragId, setDragId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [filterDateEnd, setFilterDateEnd] = useState<Date | undefined>(undefined);
  const [filterOpen, setFilterOpen] = useState(false);
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
    setDemandas(data || []);
  };

  useEffect(() => {
    fetchDemandas();
    fetchAssessores();
    const channel = supabase.channel("demandas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "demandas" }, () => fetchDemandas())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, role]);

  const filteredDemandas = demandas.filter((d) => {
    if (!filterDate) return true;
    const createdAt = new Date(d.created_at);
    if (filterDateEnd) {
      return isWithinInterval(createdAt, { start: startOfDay(filterDate), end: endOfDay(filterDateEnd) });
    }
    return isSameDay(createdAt, filterDate);
  });

  const handleSave = async () => {
    if (!form.titulo) { toast({ title: "Preencha o título", variant: "destructive" }); return; }

    const payload: any = {
      titulo: form.titulo,
      descricao: form.descricao || null,
      localizacao: form.localizacao || null,
      prazo: form.prazo ? new Date(form.prazo).toISOString() : null,
    };
    if (role === "politico") {
      payload.assessor_id = form.assessor_id || null;
    }

    if (editingDemanda) {
      const { error } = await supabase.from("demandas").update(payload).eq("id", editingDemanda.id);
      if (error) { toast({ title: "Erro ao atualizar", variant: "destructive" }); return; }
      toast({ title: "Demanda atualizada!" });
    } else {
      if (role === "assessor" && user) {
        payload.assessor_id = user.id;
      }
      const { error } = await supabase.from("demandas").insert(payload);
      if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Demanda criada!" });
    }

    setForm({ titulo: "", descricao: "", localizacao: "", assessor_id: "", prazo: "" });
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
      prazo: demanda.prazo ? demanda.prazo.split("T")[0] : "",
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
    const { error } = await supabase.from("demandas").update({ status: newStatus }).eq("id", id);
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
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingDemanda(null); setForm({ titulo: "", descricao: "", localizacao: "", assessor_id: "", prazo: "" }); } }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground gap-2 shadow-[var(--shadow-md)]">
                <Plus className="h-4 w-4" /> Nova Demanda
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingDemanda ? "Editar Demanda" : "Nova Demanda"}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título da demanda" /></div>
                <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descreva a demanda" /></div>
                <div><Label>Localização</Label><Input value={form.localizacao} onChange={(e) => setForm({ ...form, localizacao: e.target.value })} placeholder="Local da demanda" /></div>
                <div><Label>Prazo</Label><Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} /></div>
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
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className={`text-[10px] ${statusStyles[demanda.status] || ""}`}>{demanda.status}</Badge>
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
