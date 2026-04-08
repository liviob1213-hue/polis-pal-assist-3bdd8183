import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MapPin, Calendar, Clock, Sparkles, GripVertical, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";

interface Demanda {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  localizacao: string | null;
  created_at: string;
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
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDemanda, setEditingDemanda] = useState<Demanda | null>(null);
  const [form, setForm] = useState({ titulo: "", descricao: "", localizacao: "" });
  const [dragId, setDragId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchDemandas = async () => {
    const { data } = await supabase.from("demandas").select("*").order("created_at", { ascending: false });
    setDemandas(data || []);
  };

  useEffect(() => {
    fetchDemandas();
    const channel = supabase.channel("demandas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "demandas" }, () => fetchDemandas())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSave = async () => {
    if (!form.titulo) { toast({ title: "Preencha o título", variant: "destructive" }); return; }

    if (editingDemanda) {
      const { error } = await supabase.from("demandas").update({
        titulo: form.titulo,
        descricao: form.descricao || null,
        localizacao: form.localizacao || null,
      }).eq("id", editingDemanda.id);
      if (error) { toast({ title: "Erro ao atualizar", variant: "destructive" }); return; }
      toast({ title: "Demanda atualizada!" });
    } else {
      const { error } = await supabase.from("demandas").insert({
        titulo: form.titulo,
        descricao: form.descricao || null,
        localizacao: form.localizacao || null,
      });
      if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Demanda criada!" });
    }

    setForm({ titulo: "", descricao: "", localizacao: "" });
    setEditingDemanda(null);
    setDialogOpen(false);
  };

  const openEdit = (demanda: Demanda) => {
    setEditingDemanda(demanda);
    setForm({ titulo: demanda.titulo, descricao: demanda.descricao || "", localizacao: demanda.localizacao || "" });
    setDialogOpen(true);
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

  const total = demandas.length;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gestão de Demandas</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Acompanhe e resolva as solicitações da população.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Badge variant="secondary" className="text-sm">{total} Total</Badge>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingDemanda(null); setForm({ titulo: "", descricao: "", localizacao: "" }); } }}>
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
          const colDemandas = demandas.filter((d) => d.status === col.key);
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
                        <Card className={`glass-card hover:shadow-[var(--shadow-md)] transition-all cursor-grab active:cursor-grabbing group ${dragId === demanda.id ? "opacity-50 scale-95" : ""}`}>
                          <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                            <div className="flex items-start justify-between">
                              <Badge variant="outline" className={`text-[10px] ${statusStyles[demanda.status] || ""}`}>{demanda.status}</Badge>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground" onClick={() => openEdit(demanda)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors hidden md:block" />
                              </div>
                            </div>
                            <div>
                              <h3 className="font-semibold text-xs sm:text-sm">{demanda.titulo}</h3>
                              {demanda.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{demanda.descricao}</p>}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {demanda.localizacao && (
                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{demanda.localizacao}</span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(demanda.created_at), "dd/MM/yyyy")}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{dias} dias</span>
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
