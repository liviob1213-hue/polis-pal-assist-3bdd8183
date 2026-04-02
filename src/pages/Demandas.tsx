import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, User, Calendar, Clock, CheckCircle2, FileText, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Demanda {
  id: string;
  titulo: string;
  descricao: string;
  status: "Aberto" | "Em Análise" | "Resolvido";
  prioridade: "Alta" | "Média" | "Baixa";
  solicitante: string;
  data: string;
  tarefas: string;
  dias: number;
}

const initialDemandas: Demanda[] = [
  {
    id: "1", titulo: "Buraco na rua em frente à escola", descricao: "Solicitação de reparo asfáltico urgente devido ao risco para as crianças.",
    status: "Em Análise", prioridade: "Alta", solicitante: "Dona Maria da Silva", data: "09/03/2024", tarefas: "1/2", dias: 723,
  },
  {
    id: "2", titulo: "Falta de iluminação na praça", descricao: "Lâmpadas queimadas há 2 semanas, gerando insegurança.",
    status: "Aberto", prioridade: "Média", solicitante: "Seu João Oliveira", data: "11/03/2024", tarefas: "0/0", dias: 721,
  },
];

const statusStyles: Record<string, string> = {
  "Aberto": "border-warning bg-warning/10 text-warning",
  "Em Análise": "border-info bg-info/10 text-info",
  "Resolvido": "border-success bg-success/10 text-success",
};

const prioridadeStyles: Record<string, string> = {
  Alta: "bg-destructive/10 text-destructive border-destructive/20",
  Média: "bg-warning/10 text-warning border-warning/20",
  Baixa: "bg-success/10 text-success border-success/20",
};

const borderLeftStyles: Record<string, string> = {
  Alta: "border-l-destructive",
  Média: "border-l-warning",
  Baixa: "border-l-success",
};

const Demandas = () => {
  const [demandas, setDemandas] = useState<Demanda[]>(initialDemandas);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ titulo: "", descricao: "", prioridade: "Média" as string, solicitante: "" });
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleAdd = () => {
    if (!form.titulo) { toast({ title: "Preencha o título", variant: "destructive" }); return; }
    const newDemanda: Demanda = {
      id: Date.now().toString(), titulo: form.titulo, descricao: form.descricao,
      status: "Aberto", prioridade: form.prioridade as Demanda["prioridade"],
      solicitante: form.solicitante || "Não informado",
      data: new Date().toLocaleDateString("pt-BR"), tarefas: "0/0", dias: 0,
    };
    setDemandas((prev) => [...prev, newDemanda]);
    setForm({ titulo: "", descricao: "", prioridade: "Média", solicitante: "" });
    setDialogOpen(false);
    toast({ title: "Demanda criada!" });
  };

  const handleCreatePL = (demanda: Demanda) => {
    const msg = `Crie um Projeto de Lei baseado nesta demanda:\n\nTítulo: ${demanda.titulo}\nDescrição: ${demanda.descricao}\nSolicitante: ${demanda.solicitante}\nPrioridade: ${demanda.prioridade}`;
    navigate("/assistente", { state: { prefill: msg } });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gestão de Demandas</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Acompanhe e resolva as solicitações da população.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground gap-2 shadow-[var(--shadow-md)]">
              <Plus className="h-4 w-4" /> Nova Demanda
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Demanda</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título da demanda" /></div>
              <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descreva a demanda" /></div>
              <div><Label>Solicitante</Label><Input value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} placeholder="Nome do solicitante" /></div>
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
              <Button onClick={handleAdd} className="w-full gradient-primary text-primary-foreground">Criar Demanda</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {demandas.map((demanda) => (
          <motion.div key={demanda.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
            <Card className={`glass-card border-l-4 ${borderLeftStyles[demanda.prioridade]} hover:shadow-[var(--shadow-lg)] transition-all cursor-pointer`}>
              <CardContent className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={statusStyles[demanda.status]}>{demanda.status}</Badge>
                  <Badge variant="outline" className={prioridadeStyles[demanda.prioridade]}>{demanda.prioridade}</Badge>
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{demanda.titulo}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{demanda.descricao}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><User className="h-3 w-3" />{demanda.solicitante}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{demanda.data}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{demanda.tarefas} tarefas</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{demanda.dias} dias</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-xs border-accent/30 text-accent hover:bg-accent/10 hover:text-accent"
                  onClick={() => handleCreatePL(demanda)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Criar Projeto de Lei com IA
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default Demandas;
