import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, MessageCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Eleitor {
  id: string;
  nome: string;
  endereco: string;
  contato: string;
  interesse: string;
}

const initialEleitores: Eleitor[] = [
  { id: "1", nome: "Dona Maria da Silva", endereco: "Rua das Flores, 123 - Centro", contato: "(11) 99999-1234", interesse: "Saúde" },
  { id: "2", nome: "Seu João Oliveira", endereco: "Av. Paulista, 456 - Bela Vista", contato: "(11) 98888-5678", interesse: "Obras" },
  { id: "3", nome: "Ana Santos", endereco: "Rua Augusta, 789 - Jardins", contato: "(11) 97777-9012", interesse: "Educação" },
];

const interesses = ["Saúde", "Obras", "Educação", "Segurança", "Transporte", "Meio Ambiente"];

const interestColors: Record<string, string> = {
  Saúde: "bg-success/10 text-success border-success/20",
  Obras: "bg-warning/10 text-warning border-warning/20",
  Educação: "bg-info/10 text-info border-info/20",
  Segurança: "bg-destructive/10 text-destructive border-destructive/20",
  Transporte: "bg-accent/10 text-accent border-accent/20",
  "Meio Ambiente": "bg-success/10 text-success border-success/20",
};

const Eleitores = () => {
  const [eleitores, setEleitores] = useState<Eleitor[]>(initialEleitores);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", endereco: "", contato: "", interesse: "" });
  const { toast } = useToast();

  const filtered = eleitores.filter(
    (e) =>
      e.nome.toLowerCase().includes(search.toLowerCase()) ||
      e.interesse.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    if (!form.nome || !form.contato) {
      toast({ title: "Preencha nome e contato", variant: "destructive" });
      return;
    }
    if (editingId) {
      setEleitores((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...form } : e)));
      toast({ title: "Eleitor atualizado!" });
    } else {
      setEleitores((prev) => [...prev, { id: Date.now().toString(), ...form }]);
      toast({ title: "Eleitor adicionado!" });
    }
    setForm({ nome: "", endereco: "", contato: "", interesse: "" });
    setEditingId(null);
    setDialogOpen(false);
  };

  const handleEdit = (eleitor: Eleitor) => {
    setForm({ nome: eleitor.nome, endereco: eleitor.endereco, contato: eleitor.contato, interesse: eleitor.interesse });
    setEditingId(eleitor.id);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setEleitores((prev) => prev.filter((e) => e.id !== id));
    toast({ title: "Eleitor removido" });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Base de Eleitores</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie os contatos e interesses da sua base.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); setForm({ nome: "", endereco: "", contato: "", interesse: "" }); } }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground gap-2 shadow-[var(--shadow-md)]">
              <Plus className="h-4 w-4" /> Novo Eleitor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Eleitor" : "Novo Eleitor"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" /></div>
              <div><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Endereço" /></div>
              <div><Label>Contato</Label><Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} placeholder="(00) 00000-0000" /></div>
              <div>
                <Label>Interesse</Label>
                <Select value={form.interesse} onValueChange={(v) => setForm({ ...form, interesse: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {interesses.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full gradient-primary text-primary-foreground">
                {editingId ? "Salvar Alterações" : "Adicionar Eleitor"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou interesse..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                <TableHead className="font-semibold">Nome</TableHead>
                <TableHead className="font-semibold hidden md:table-cell">Endereço</TableHead>
                <TableHead className="font-semibold">Contato</TableHead>
                <TableHead className="font-semibold">Interesse</TableHead>
                <TableHead className="font-semibold text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((eleitor) => (
                <TableRow key={eleitor.id} className="hover:bg-secondary/30">
                  <TableCell className="font-medium">{eleitor.nome}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{eleitor.endereco}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <MessageCircle className="h-3.5 w-3.5 text-success" />
                      {eleitor.contato}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={interestColors[eleitor.interesse] || ""}>{eleitor.interesse}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(eleitor)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(eleitor.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum eleitor encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default Eleitores;
