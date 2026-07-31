import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Clock, CalendarDays, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AgendaItem {
  id: string;
  titulo: string;
  descricao: string | null;
  data_hora: string;
  tarefa_id: string | null;
  assessor_id?: string | null;
  criado_por?: string | null;
}

interface TarefaItem {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prazo: string | null;
}

const Agenda = () => {
  const [date, setDate] = useState<Date>(new Date());
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [tarefas, setTarefas] = useState<TarefaItem[]>([]);
  const [assessores, setAssessores] = useState<{ user_id: string; nome: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaItem | null>(null);
  const [form, setForm] = useState({ titulo: "", tipo: "Reunião", horario: "", data: "", responsavel: "eu" });
  const { toast } = useToast();
  const { user, role } = useAuth();

  const fetchData = async () => {
    const [agendaRes, tarefasRes] = await Promise.all([
      supabase.from("agenda").select("*").order("data_hora", { ascending: true }),
      supabase.from("tarefas").select("*").order("created_at", { ascending: false }),
    ]);
    setAgendaItems(agendaRes.data || []);
    setTarefas(tarefasRes.data || []);
  };

  // Lista de assessores do político (para rotear o compromisso ao Google Agenda correto)
  useEffect(() => {
    const loadAssessores = async () => {
      if (role !== "politico" || !user) return;
      const { data: links } = await supabase
        .from("politician_assessors")
        .select("assessor_id")
        .eq("politician_id", user.id);
      const ids = (links || []).map((l: { assessor_id: string }) => l.assessor_id);
      if (!ids.length) return setAssessores([]);
      const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids);
      setAssessores(profs || []);
    };
    loadAssessores();
  }, [role, user]);

  // Envia o compromisso para a Edge Function; ela resolve o DONO e usa o token dele
  const syncGoogle = async (action: "create" | "update" | "delete", agendaId: string, ownerUserId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("sync-google-event", {
        body: { action, agenda_id: agendaId, owner_user_id: ownerUserId },
      });
      if (error) console.warn("Falha ao sincronizar com o Google Agenda:", error);
      else if (data?.skipped) console.info("Google Agenda não conectado para o dono do evento.");
    } catch (e) {
      console.warn("sync-google-event:", e);
    }
  };


  useEffect(() => {
    fetchData();
    const ch1 = supabase.channel("agenda-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agenda" }, () => fetchData())
      .subscribe();
    const ch2 = supabase.channel("tarefas-agenda-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, []);

  // Compromissos da agenda para o dia selecionado
  const dayAgenda = agendaItems.filter((a) => isSameDay(new Date(a.data_hora), date));

  // Tarefas com prazo para o dia selecionado
  const dayTarefas = tarefas.filter((t) => t.prazo && isSameDay(new Date(t.prazo), date));

  // Datas com eventos (para highlight no calendário) — apenas compromissos da agenda
  const datesWithEvents = agendaItems.map((a) => new Date(a.data_hora));

  const buildDataHora = (dataStr: string, horario: string): Date | null => {
    if (!dataStr || !horario) return null;
    const [y, m, d] = dataStr.split("-").map(Number);
    const [hours, minutes] = horario.split(":").map(Number);
    if (!y || !m || !d) return null;
    const dh = new Date(y, m - 1, d);
    dh.setHours(hours || 0, minutes || 0, 0, 0);
    return dh;
  };

  const openNew = () => {
    setEditing(null);
    setForm({
      titulo: "",
      tipo: "Reunião",
      horario: "",
      data: format(date, "yyyy-MM-dd"),
      responsavel: "eu",
    });
    setDialogOpen(true);
  };

  const openEdit = (item: AgendaItem) => {
    const dh = new Date(item.data_hora);
    setEditing(item);
    setForm({
      titulo: item.titulo,
      tipo: item.descricao || "Reunião",
      horario: format(dh, "HH:mm"),
      data: format(dh, "yyyy-MM-dd"),
      responsavel: item.assessor_id && item.assessor_id !== user?.id ? item.assessor_id : "eu",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo || !form.horario || !form.data) {
      toast({ title: "Preencha título, data e horário", variant: "destructive" });
      return;
    }
    const dataHora = buildDataHora(form.data, form.horario);
    if (!dataHora) {
      toast({ title: "Data ou horário inválidos", variant: "destructive" });
      return;
    }

    // Dono do compromisso: assessor escolhido ou o próprio usuário logado
    const ownerId = form.responsavel !== "eu" ? form.responsavel : user?.id ?? null;

    const payload = {
      titulo: form.titulo,
      descricao: form.tipo,
      data_hora: dataHora.toISOString(),
      assessor_id: ownerId,
      criado_por: user?.id ?? null,
    };

    const { data: saved, error } = editing
      ? await supabase.from("agenda").update(payload).eq("id", editing.id).select("id").maybeSingle()
      : await supabase.from("agenda").insert(payload).select("id").maybeSingle();

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    const agendaId = saved?.id ?? editing?.id;
    if (agendaId && ownerId) {
      await syncGoogle(editing ? "update" : "create", agendaId, ownerId);
    }

    const [y, m, d] = form.data.split("-").map(Number);
    setDate(new Date(y, m - 1, d));
    setForm({ titulo: "", tipo: "Reunião", horario: "", data: "", responsavel: "eu" });
    setEditing(null);
    setDialogOpen(false);
    toast({ title: editing ? "Compromisso atualizado!" : "Compromisso adicionado!" });
    fetchData();
  };

  const handleDelete = async (item: AgendaItem) => {
    const ownerId = item.assessor_id ?? item.criado_por ?? user?.id ?? null;
    if (ownerId) await syncGoogle("delete", item.id, ownerId);
    const { error } = await supabase.from("agenda").delete().eq("id", item.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    setDialogOpen(false);
    setEditing(null);
    toast({ title: "Compromisso excluído" });
    fetchData();
  };



  const statusBadge: Record<string, string> = {
    "Novas Tarefas": "bg-warning/10 text-warning border-warning/20",
    "Em Andamento": "bg-info/10 text-info border-info/20",
    "Finalizadas": "bg-success/10 text-success border-success/20",
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Agenda Oficial</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Compromissos e sessões plenárias.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gradient-primary text-primary-foreground gap-2 shadow-[var(--shadow-md)]">
              <Plus className="h-4 w-4" /> Novo Compromisso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar Compromisso" : "Novo Compromisso"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título do compromisso" /></div>
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
              <div><Label>Horário</Label><Input value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} placeholder="HH:MM" /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Reunião">Reunião</SelectItem>
                    <SelectItem value="Sessão">Sessão</SelectItem>
                    <SelectItem value="Visita">Visita</SelectItem>
                    <SelectItem value="Evento">Evento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full gradient-primary text-primary-foreground">{editing ? "Salvar alterações" : "Adicionar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="glass-card lg:col-span-1">
          <CardContent className="p-4 flex flex-col items-center gap-2">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              locale={ptBR}
              className="pointer-events-auto"
              modifiers={{ hasEvent: datesWithEvents }}
              modifiersClassNames={{
                hasEvent:
                  "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-primary after:ring-2 after:ring-background",
              }}
              classNames={{
                day_today: "bg-transparent text-foreground ring-1 ring-border",
                cell: "text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
              }}
            />
            <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] sm:text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="relative h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                Tem compromisso
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Dia selecionado
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full ring-1 ring-border" />
                Hoje
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              Agenda do Dia: {format(date, "d 'de' MMMM", { locale: ptBR })}
            </h2>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Compromissos</h3>
            {dayAgenda.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum compromisso para esta data.</p>
            ) : (
              <div className="space-y-3">
                {dayAgenda.map((c) => (
                  <Card
                    key={c.id}
                    onClick={() => openEdit(c)}
                    className="glass-card hover:shadow-[var(--shadow-md)] transition-shadow cursor-pointer"
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-primary/5 min-w-[60px]">
                        <Clock className="h-4 w-4 text-primary mb-1" />
                        <span className="text-sm font-bold text-primary">
                          {format(new Date(c.data_hora), "HH:mm")}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{c.titulo}</p>
                        {c.descricao && <Badge variant="secondary" className="text-xs mt-1">{c.descricao}</Badge>}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                        aria-label="Editar compromisso"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tarefas para Hoje</h3>
            {dayTarefas.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhuma tarefa com prazo para hoje.</p>
            ) : (
              <div className="space-y-3">
                {dayTarefas.map((t) => (
                  <Card key={t.id} className="glass-card hover:shadow-[var(--shadow-md)] transition-shadow">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-semibold text-sm">{t.titulo}</p>
                        {t.descricao && <p className="text-xs text-muted-foreground mt-1">{t.descricao}</p>}
                      </div>
                      <Badge variant="outline" className={statusBadge[t.status] || ""}>
                        {t.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Agenda;
