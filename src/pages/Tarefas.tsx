import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, Clock, GripVertical, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: "Alta" | "Média" | "Baixa";
  data: string;
  status: "nova" | "andamento" | "finalizada";
}

const initialTarefas: Tarefa[] = [
  { id: "1", titulo: "Preparar discurso da sessão", descricao: "", prioridade: "Alta", data: "02/03/2026", status: "nova" },
  { id: "2", titulo: "Reunião de alinhamento com equipe", descricao: "", prioridade: "Média", data: "02/03/2026", status: "andamento" },
  { id: "3", titulo: "Visita ao Bairro Novo Horizonte", descricao: "", prioridade: "Baixa", data: "02/03/2026", status: "finalizada" },
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
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | null>(null);
  const [form, setForm] = useState({ titulo: "", descricao: "", prioridade: "Média" });
  const [dragId, setDragId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSave = () => {
    if (!form.titulo) { toast({ title: "Preencha o título", variant: "destructive" }); return; }
    if (editingTarefa) {
      setTarefas((prev) => prev.map((t) =>
        t.id === editingTarefa.id ? { ...t, titulo: form.titulo, descricao: form.descricao, prioridade: form.prioridade as Tarefa["prioridade"] } : t
      ));
      toast({ title: "Tarefa atualizada!" });
    } else {
      setTarefas((prev) => [...prev, {
        id: Date.now().toString(), titulo: form.titulo, descricao: form.descricao,
        prioridade: form.prioridade as Tarefa["prioridade"],
        data: new Date().toLocaleDateString("pt-BR"), status: "nova",
      }]);
      toast({ title: "Tarefa criada!" });
    }
    setForm({ titulo: "", descricao: "", prioridade: "Média" });
    setEditingTarefa(null);
    setDialogOpen(false);
  };

  const openEdit = (tarefa: Tarefa) => {
    setEditingTarefa(tarefa);
    setForm({ titulo: tarefa.titulo, descricao: tarefa.descricao || "", prioridade: tarefa.prioridade });
    setDialogOpen(true);
  };

  const moveTask = (id: string, newStatus: Tarefa["status"]) => {
    setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, status: Tarefa["status"]) => {
    e.preventDefault();
    if (dragId) {
      moveTask(dragId, status);
      setDragId(null);
      toast({ title: "Tarefa movida!" });
    }
  };

  const total = tarefas.length;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gestão de Tarefas</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Organize e acompanhe as atividades do gabinete.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Badge variant="secondary" className="text-sm">{total} Total</Badge>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingTarefa(null); setForm({ titulo: "", descricao: "", prioridade: "Média" }); } }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground gap-2 shadow-[var(--shadow-md)]">
                <Plus className="h-4 w-4" /> Nova Tarefa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingTarefa ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título da tarefa" /></div>
                <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descreva a tarefa (opcional)" rows={3} /></div>
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
                <Button onClick={handleSave} className="w-full gradient-primary text-primary-foreground">
                  {editingTarefa ? "Salvar Alterações" : "Criar Tarefa"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 overflow-x-auto">
        {columns.map((col) => {
          const colTarefas = tarefas.filter((t) => t.status === col.key);
          return (
            <div
              key={col.key}
              className="space-y-3"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              <div className="flex items-center gap-2 pb-2">
                <div className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`} />
                <h3 className="font-semibold text-sm">{col.title}</h3>
                <Badge variant="secondary" className="text-xs ml-auto">{colTarefas.length}</Badge>
              </div>
              <div className={`space-y-3 min-h-[200px] p-3 rounded-xl bg-secondary/30 border border-border/50 transition-colors ${dragId ? "border-primary/20 bg-primary/5" : ""}`}>
                <AnimatePresence>
                  {colTarefas.map((tarefa) => (
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
                      <Card className={`glass-card hover:shadow-[var(--shadow-md)] transition-all cursor-grab active:cursor-grabbing group ${dragId === tarefa.id ? "opacity-50 scale-95" : ""}`}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <p className="text-sm font-medium flex-1">{tarefa.titulo}</p>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground" onClick={() => openEdit(tarefa)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                            </div>
                          </div>
                          {tarefa.descricao && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{tarefa.descricao}</p>
                          )}
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
