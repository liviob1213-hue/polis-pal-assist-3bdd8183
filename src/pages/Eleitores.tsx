import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, MessageCircle, Trash2, Send, Save, Star, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Eleitor {
  id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  interesse: string | null;
}

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
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", endereco: "", telefone: "", interesse: "" });
  const [whatsappDialog, setWhatsappDialog] = useState<Eleitor | null>(null);
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [savedMessages, setSavedMessages] = useState<{ id: string; label: string; text: string }[]>(() => {
    const stored = localStorage.getItem("whatsapp-templates");
    return stored ? JSON.parse(stored) : [
      { id: "1", label: "Saudação", text: "Olá! Tudo bem? Aqui é do gabinete. Como posso ajudá-lo(a)?" },
      { id: "2", label: "Agradecimento", text: "Obrigado pelo seu contato! Estamos trabalhando na sua demanda." },
    ];
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: eleitores = [], isLoading } = useQuery({
    queryKey: ["eleitores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eleitores")
        .select("id, nome, endereco, telefone, interesse")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Eleitor[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: { id?: string; nome: string; endereco: string; telefone: string; interesse: string }) => {
      if (payload.id) {
        const { error } = await supabase.from("eleitores").update({
          nome: payload.nome,
          endereco: payload.endereco || null,
          telefone: payload.telefone || null,
          interesse: payload.interesse || null,
        }).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("eleitores").insert({
          nome: payload.nome,
          endereco: payload.endereco || null,
          telefone: payload.telefone || null,
          interesse: payload.interesse || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eleitores"] });
      toast({ title: editingId ? "Eleitor atualizado!" : "Eleitor adicionado!" });
      setForm({ nome: "", endereco: "", telefone: "", interesse: "" });
      setEditingId(null);
      setDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eleitores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eleitores"] });
      toast({ title: "Eleitor removido" });
    },
  });

  const saveMessage = () => {
    if (!whatsappMsg.trim()) return;
    const label = prompt("Nome para esta mensagem salva:");
    if (!label) return;
    const newMsg = { id: Date.now().toString(), label, text: whatsappMsg };
    const updated = [...savedMessages, newMsg];
    setSavedMessages(updated);
    localStorage.setItem("whatsapp-templates", JSON.stringify(updated));
    toast({ title: "Mensagem salva!" });
  };

  const deleteTemplate = (id: string) => {
    const updated = savedMessages.filter((m) => m.id !== id);
    setSavedMessages(updated);
    localStorage.setItem("whatsapp-templates", JSON.stringify(updated));
  };

  const filtered = eleitores.filter(
    (e) =>
      e.nome.toLowerCase().includes(search.toLowerCase()) ||
      (e.interesse || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    if (!form.nome || !form.telefone) {
      toast({ title: "Preencha nome e telefone", variant: "destructive" });
      return;
    }
    upsertMutation.mutate({ id: editingId || undefined, ...form });
  };

  const handleEdit = (eleitor: Eleitor) => {
    setForm({ nome: eleitor.nome, endereco: eleitor.endereco || "", telefone: eleitor.telefone || "", interesse: eleitor.interesse || "" });
    setEditingId(eleitor.id);
    setDialogOpen(true);
  };

  const openWhatsapp = (eleitor: Eleitor) => {
    setWhatsappDialog(eleitor);
    setWhatsappMsg("");
  };

  const sendWhatsapp = () => {
    if (!whatsappDialog) return;
    const phone = (whatsappDialog.telefone || "").replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const url = `https://wa.me/${fullPhone}${whatsappMsg ? `?text=${encodeURIComponent(whatsappMsg)}` : ""}`;
    window.open(url, "_blank");
    setWhatsappDialog(null);
    setWhatsappMsg("");
    toast({ title: "WhatsApp aberto!" });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Base de Eleitores</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Gerencie os contatos e interesses da sua base.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); setForm({ nome: "", endereco: "", telefone: "", interesse: "" }); } }}>
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
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" /></div>
              <div>
                <Label>Interesse</Label>
                <Select value={form.interesse} onValueChange={(v) => setForm({ ...form, interesse: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {interesses.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} disabled={upsertMutation.isPending} className="w-full gradient-primary text-primary-foreground">
                {upsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingId ? "Salvar Alterações" : "Adicionar Eleitor"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou interesse..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
      </div>

      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                      <TableHead className="font-semibold">Nome</TableHead>
                      <TableHead className="font-semibold">Endereço</TableHead>
                      <TableHead className="font-semibold">Telefone</TableHead>
                      <TableHead className="font-semibold">Interesse</TableHead>
                      <TableHead className="font-semibold text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((eleitor) => (
                      <TableRow key={eleitor.id} className="hover:bg-secondary/30">
                        <TableCell className="font-medium">{eleitor.nome}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{eleitor.endereco}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <MessageCircle className="h-3.5 w-3.5 text-success" />
                            {eleitor.telefone}
                          </div>
                        </TableCell>
                        <TableCell>
                          {eleitor.interesse && <Badge variant="outline" className={interestColors[eleitor.interesse] || ""}>{eleitor.interesse}</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success hover:bg-success/10" onClick={() => openWhatsapp(eleitor)} title="Enviar WhatsApp">
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(eleitor)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(eleitor.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum eleitor encontrado.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3 p-4">
                {filtered.map((eleitor) => (
                  <Card key={eleitor.id} className="glass-card">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm">{eleitor.nome}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{eleitor.endereco}</p>
                        </div>
                        {eleitor.interesse && <Badge variant="outline" className={interestColors[eleitor.interesse] || ""}>{eleitor.interesse}</Badge>}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MessageCircle className="h-3.5 w-3.5 text-success" />
                        {eleitor.telefone}
                      </div>
                      <div className="flex gap-1 pt-1 border-t border-border">
                        <Button variant="ghost" size="sm" className="text-success hover:text-success hover:bg-success/10 gap-1 text-xs" onClick={() => openWhatsapp(eleitor)}>
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => handleEdit(eleitor)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive text-xs" onClick={() => deleteMutation.mutate(eleitor.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground text-sm">Nenhum eleitor encontrado.</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Dialog */}
      <Dialog open={!!whatsappDialog} onOpenChange={(o) => { if (!o) setWhatsappDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-success" />
              Enviar WhatsApp
            </DialogTitle>
          </DialogHeader>
          {whatsappDialog && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-sm font-medium">{whatsappDialog.nome}</p>
                <p className="text-xs text-muted-foreground">{whatsappDialog.telefone}</p>
              </div>
              {savedMessages.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Mensagens salvas</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {savedMessages.map((msg) => (
                      <div key={msg.id} className="group flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1 h-7"
                          onClick={() => {
                            const phone = (whatsappDialog!.telefone || "").replace(/\D/g, "");
                            const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
                            window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg.text)}`, "_blank");
                            setWhatsappDialog(null);
                            toast({ title: "WhatsApp aberto!" });
                          }}
                        >
                          <Star className="h-3 w-3" />
                          {msg.label}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => deleteTemplate(msg.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label>Mensagem (opcional)</Label>
                <Textarea value={whatsappMsg} onChange={(e) => setWhatsappMsg(e.target.value)} placeholder="Digite a mensagem ou selecione uma salva acima..." rows={4} className="mt-1" />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">A mensagem será pré-preenchida no WhatsApp.</p>
                  {whatsappMsg.trim() && (
                    <Button variant="ghost" size="sm" className="text-xs h-6 gap-1 text-muted-foreground hover:text-foreground" onClick={saveMessage}>
                      <Save className="h-3 w-3" /> Salvar
                    </Button>
                  )}
                </div>
              </div>
              <Button onClick={sendWhatsapp} className="w-full bg-success hover:bg-success/90 text-success-foreground gap-2">
                <Send className="h-4 w-4" />
                Abrir WhatsApp
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Eleitores;
