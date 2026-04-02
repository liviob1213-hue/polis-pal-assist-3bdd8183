import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Clock, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Compromisso {
  id: string;
  titulo: string;
  tipo: string;
  horario: string;
  data: Date;
}

const initialCompromissos: Compromisso[] = [
  { id: "1", titulo: "Reunião com Secretário de Obras", tipo: "Reunião", horario: "09:00", data: new Date(2026, 2, 3) },
  { id: "2", titulo: "Sessão Plenária Ordinária", tipo: "Sessão", horario: "14:00", data: new Date(2026, 2, 3) },
];

const Agenda = () => {
  const [date, setDate] = useState<Date>(new Date());
  const [compromissos, setCompromissos] = useState<Compromisso[]>(initialCompromissos);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ titulo: "", tipo: "Reunião", horario: "" });
  const { toast } = useToast();

  const dayCompromissos = compromissos.filter(
    (c) => c.data.toDateString() === date.toDateString()
  );

  const handleAdd = () => {
    if (!form.titulo || !form.horario) { toast({ title: "Preencha título e horário", variant: "destructive" }); return; }
    setCompromissos((prev) => [...prev, {
      id: Date.now().toString(), titulo: form.titulo, tipo: form.tipo, horario: form.horario, data: date,
    }]);
    setForm({ titulo: "", tipo: "Reunião", horario: "" });
    setDialogOpen(false);
    toast({ title: "Compromisso adicionado!" });
  };

  const datesWithEvents = compromissos.map((c) => c.data);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Agenda Oficial</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Compromissos e sessões plenárias.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground gap-2 shadow-[var(--shadow-md)]">
              <Plus className="h-4 w-4" /> Novo Compromisso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Compromisso</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título do compromisso" /></div>
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
              <Button onClick={handleAdd} className="w-full gradient-primary text-primary-foreground">Adicionar</Button>
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
            {dayCompromissos.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum compromisso para esta data.</p>
            ) : (
              <div className="space-y-3">
                {dayCompromissos.map((c) => (
                  <Card key={c.id} className="glass-card hover:shadow-[var(--shadow-md)] transition-shadow">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-primary/5 min-w-[60px]">
                        <Clock className="h-4 w-4 text-primary mb-1" />
                        <span className="text-sm font-bold text-primary">{c.horario}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{c.titulo}</p>
                        <Badge variant="secondary" className="text-xs mt-1">{c.tipo}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tarefas para Hoje</h3>
            <p className="text-sm text-muted-foreground italic">Nenhuma tarefa com prazo para hoje.</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Demandas Recebidas</h3>
            <p className="text-sm text-muted-foreground italic">Nenhuma demanda registrada nesta data.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Agenda;
