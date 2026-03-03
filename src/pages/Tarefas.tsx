import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, Clock, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Tarefa {
  id: string;
  titulo: string;
  prioridade: "Alta" | "Média" | "Baixa";
  data: string;
  status: "nova" | "andamento" | "finalizada";
}

const initialTarefas: Tarefa[] = [
  { id: "1", titulo: "Preparar discurso da sessão", prioridade: "Alta", data: "02/03/2026", status: "nova" },
  { id: "2", titulo: "Reunião de alinhamento com equipe", prioridade: "Média", data: "02/03/2026", status: "andamento" },
  { id: "3", titulo: "Visita ao Bairro Novo Horizonte", prioridade: "Baixa", data: "02/03/2026", status: "finalizada" },
];

const columns = [
  { key: "nova" as const, title: "Novas Tarefas", dotColor: "bg-warning" },
  { key: "andamento" as const, title: "Em Andamento", dotColor: "bg-info" },
  { key: "finalizada" as const, title: "Finalizadas", dotColor: "bg-success" },
];

const prioridadeBadge: Record<string, string> = {
  Alta: "bg-destructive/10 text-destructive border-destructive/20",
  Média: "bg-warning/10 text-warning border-warning/20",
  Baixa: "bg-success/10 text-success border-success/20",
};

const Tarefas = () => {
  const [tarefas, setTarefas] = useState<Tarefa[]>(initialTarefas);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ titulo: "", prioridade: "Média" });
  const { toast } = useToast();

  const handleAdd = () => {
    if (!form.titulo) { toast({ title: "Preencha o título", variant: "destructive" }); return; }
    setTarefas((prev) => [...prev, {
      id: Date.now().toString(), titulo: form.titulo,
      prioridade: form.prioridade as Tarefa["prioridade"],
      data: new Date().toLocaleDateString("pt-BR"), status: "nova",
    }]);
    setForm({ titulo: "", prioridade: "Média" });
    setDialogOpen(false);
    toast({ title: "Tarefa criada!" });
  };

  const moveTask = (id: string, newStatus: Tarefa["status"]) => {
    setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
  };

  const total = tarefas.length;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Tarefas</h1>
          <p className="text-muted-foreground text-sm mt-1">Organize e acompanhe as atividades do gabinete.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm">{total} Total</Badge>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground gap-2 shadow-[var(--shadow-md)]">
                <Plus className="h-4 w-4" /> Nova Tarefa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título da tarefa" /></div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Alta">Alta</SelectItem>
                      <SelectItem value="Média">Média</SelectItem>
                      <SelectItem value="Baixa">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} className="w-full gradient-primary text-primary-foreground">Criar Tarefa</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map((col) => {
          const colTarefas = tarefas.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center gap-2 pb-2">
                <div className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`} />
                <h3 className="font-semibold text-sm">{col.title}</h3>
                <Badge variant="secondary" className="text-xs ml-auto">{colTarefas.length}</Badge>
              </div>
              <div className="space-y-3 min-h-[200px] p-3 rounded-xl bg-secondary/30 border border-border/50">
                {colTarefas.map((tarefa) => (
                  <motion.div key={tarefa.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="glass-card hover:shadow-[var(--shadow-md)] transition-all cursor-pointer group">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-medium">{tarefa.titulo}</p>
                          <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                        </div>
                        <Badge variant="outline" className={prioridadeBadge[tarefa.prioridade]}>{tarefa.prioridade}</Badge>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{tarefa.data}</span>
                          {tarefa.status === "finalizada" && (
                            <span className="flex items-center gap-1 text-success"><Clock className="h-3 w-3" />Concluído</span>
                          )}
                        </div>
                        {tarefa.status !== "finalizada" && (
                          <div className="flex gap-1 pt-1">
                            {tarefa.status === "nova" && (
                              <Button size="sm" variant="ghost" className="text-xs h-7 text-info hover:text-info" onClick={() => moveTask(tarefa.id, "andamento")}>Iniciar</Button>
                            )}
                            {tarefa.status === "andamento" && (
                              <Button size="sm" variant="ghost" className="text-xs h-7 text-success hover:text-success" onClick={() => moveTask(tarefa.id, "finalizada")}>Concluir</Button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default Tarefas;
