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

interface AgendaItem {
  id: string;
  titulo: string;
  descricao: string | null;
  data_hora: string;
  tarefa_id: string | null;
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaItem | null>(null);
  const [form, setForm] = useState({ titulo: "", tipo: "Reunião", horario: "", data: "" });
  const { toast } = useToast();

  const fetchData = async () => {
    const [agendaRes, tarefasRes] = await Promise.all([
      supabase.from("agenda").select("*").order("data_hora", { ascending: true }),
      supabase.from("tarefas").select("*").order("created_at", { ascending: false }),
    ]);
    setAgendaItems(agendaRes.data || []);
    setTarefas(tarefasRes.data || []);
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

  // Datas com eventos (para highlight no calendário)
  const datesWithEvents = [
    ...agendaItems.map((a) => new Date(a.data_hora)),
    ...tarefas.filter((t) => t.prazo).map((t) => new Date(t.prazo!)),
  ];

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

    const payload = {
      titulo: form.titulo,
      descricao: form.tipo,
      data_hora: dataHora.toISOString(),
    };

    const { error } = editing
      ? await supabase.from("agenda").update(payload).eq("id", editing.id)
      : await supabase.from("agenda").insert(payload);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    setDate(dataHora);
    setForm({ titulo: "", tipo: "Reunião", horario: "", data: "" });
    setEditing(null);
    setDialogOpen(false);
    toast({ title: editing ? "Compromisso atualizado!" : "Compromisso adicionado!" });
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
          <CardContent className="p-4 flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              locale={ptBR}
              className="pointer-events-auto"
              modifiers={{ hasEvent: datesWithEvents }}
              modifiersStyles={{ hasEvent: { fontWeight: "bold", textDecoration: "underline" } }}
            />
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
                  <Card key={c.id} className="glass-card hover:shadow-[var(--shadow-md)] transition-shadow">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-primary/5 min-w-[60px]">
                        <Clock className="h-4 w-4 text-primary mb-1" />
                        <span className="text-sm font-bold text-primary">
                          {format(new Date(c.data_hora), "HH:mm")}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{c.titulo}</p>
                        {c.descricao && <Badge variant="secondary" className="text-xs mt-1">{c.descricao}</Badge>}
                      </div>
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
