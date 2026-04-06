import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MapPin, Calendar, Clock, Sparkles } from "lucide-react";
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

const statusStyles: Record<string, string> = {
  "Aberto": "border-warning bg-warning/10 text-warning",
  "Em Análise": "border-info bg-info/10 text-info",
  "Resolvido": "border-success bg-success/10 text-success",
};

const borderLeftStyles: Record<string, string> = {
  "Aberto": "border-l-warning",
  "Em Análise": "border-l-info",
  "Resolvido": "border-l-success",
};

const Demandas = () => {
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ titulo: "", descricao: "", localizacao: "" });
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

  const handleAdd = async () => {
    if (!form.titulo) { toast({ title: "Preencha o título", variant: "destructive" }); return; }
    const { error } = await supabase.from("demandas").insert({
      titulo: form.titulo,
      descricao: form.descricao || null,
      localizacao: form.localizacao || null,
    });
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setForm({ titulo: "", descricao: "", localizacao: "" });
    setDialogOpen(false);
    toast({ title: "Demanda criada!" });
  };

  const handleCreatePL = (demanda: Demanda) => {
    const msg = `Crie um Projeto de Lei baseado nesta demanda:\n\nTítulo: ${demanda.titulo}\nDescrição: ${demanda.descricao || "N/A"}\nLocalização: ${demanda.localizacao || "N/A"}`;
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
              <div><Label>Localização</Label><Input value={form.localizacao} onChange={(e) => setForm({ ...form, localizacao: e.target.value })} placeholder="Local da demanda" /></div>
              <Button onClick={handleAdd} className="w-full gradient-primary text-primary-foreground">Criar Demanda</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {demandas.map((demanda) => {
          const dias = differenceInDays(new Date(), new Date(demanda.created_at));
          return (
            <motion.div key={demanda.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
              <Card className={`glass-card border-l-4 ${borderLeftStyles[demanda.status] || "border-l-muted"} hover:shadow-[var(--shadow-lg)] transition-all cursor-pointer`}>
                <CardContent className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={statusStyles[demanda.status] || ""}>{demanda.status}</Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{demanda.titulo}</h3>
                    {demanda.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{demanda.descricao}</p>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {demanda.localizacao && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{demanda.localizacao}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(demanda.created_at), "dd/MM/yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center justify-end text-xs text-muted-foreground border-t border-border pt-3">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{dias} dias</span>
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
          );
        })}
      </div>
    </motion.div>
  );
};

export default Demandas;
