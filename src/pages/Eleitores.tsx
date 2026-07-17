import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { useHeaderSearch } from "@/contexts/HeaderSearchContext";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Pencil, MessageCircle, Trash2, Send, Save, Star, Loader2, Cake, AlertCircle, Bot, Megaphone, ArrowRight, History, CheckCircle2, Clock, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { useGoogleMapsKey } from "@/hooks/useGoogleMapsKey";
import { STATUS_ELEITOR_LIST, getStatusEleitor, normalizeStatusEleitor, type StatusEleitor } from "@/lib/statusEleitor";

interface Eleitor {
  id: string;
  nome: string;
  endereco: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  interesse: string | null;
  observacoes: string | null;
  latitude: number | null;
  longitude: number | null;
  data_nascimento: string | null;
  agente_ativo: boolean;
  status_eleitor: string | null;
}

interface DemandaEleitor {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  created_at: string;
  eleitor_id: string;
}

const interesses = ["Saúde", "Obras", "Educação", "Segurança", "Transporte", "Meio Ambiente", "Manutenção", "Cultura", "Social", "Esporte"];

const ORIGENS = [
  { value: "Rua", label: "🏠 Rua" },
  { value: "Gabinete", label: "🏢 Gabinete" },
  { value: "Instagram/TikTok", label: "📱 Instagram / TikTok" },
  { value: "WhatsApp", label: "💬 WhatsApp" },
  { value: "Pessoal", label: "🤝 Pessoal (contato direto)" },
];
const TIPOS_DEMANDA = [
  { value: "Reclamação", label: "Reclamação" },
  { value: "Sugestão", label: "Sugestão" },
  { value: "Solicitação", label: "Solicitação" },
  { value: "Elogio", label: "Elogio" },
];
const SETORES_DEMANDA = [
  { value: "Jurídico", label: "⚖️ Jurídico" },
  { value: "Comunicação", label: "📢 Comunicação" },
  { value: "Administrativo", label: "📊 Administrativo" },
];

const interestColors: Record<string, string> = {
  Saúde: "bg-success/10 text-success border-success/20",
  Obras: "bg-warning/10 text-warning border-warning/20",
  Educação: "bg-info/10 text-info border-info/20",
  Segurança: "bg-destructive/10 text-destructive border-destructive/20",
  Transporte: "bg-accent/10 text-accent border-accent/20",
  "Meio Ambiente": "bg-success/10 text-success border-success/20",
  Manutenção: "bg-warning/10 text-warning border-warning/20",
  Cultura: "bg-accent/10 text-accent border-accent/20",
  Social: "bg-primary/10 text-primary border-primary/20",
  Esporte: "bg-info/10 text-info border-info/20",
};

const Eleitores = () => {
  const [search, setSearch] = useState("");
  const { query: headerQuery } = useHeaderSearch();
  useEffect(() => { setSearch(headerQuery); }, [headerQuery]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", cep: "", telefone: "", interesse: "", status_eleitor: "possivel_eleitor" as StatusEleitor, observacoes: "", data_nascimento: "", demanda_titulo: "", demanda_descricao: "", demanda_origem: "", demanda_tipo: "", demanda_setor: "", demanda_localizacao: "", demanda_prazo: "" });
  const [whatsappDialog, setWhatsappDialog] = useState<Eleitor | null>(null);
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [demandaDialog, setDemandaDialog] = useState<{ eleitor: Eleitor; demandas: DemandaEleitor[] } | null>(null);
  const [demandaUnicaDialog, setDemandaUnicaDialog] = useState<{ eleitor: Eleitor; demanda: DemandaEleitor } | null>(null);
  const [novaDemandaDialog, setNovaDemandaDialog] = useState<Eleitor | null>(null);
  const [novaDemandaForm, setNovaDemandaForm] = useState({ titulo: "", descricao: "" });
  const [savedMessages, setSavedMessages] = useState<{ id: string; label: string; text: string }[]>(() => {
    const stored = localStorage.getItem("whatsapp-templates");
    return stored ? JSON.parse(stored) : [
      { id: "1", label: "Saudação", text: "Olá! Tudo bem? Aqui é do gabinete. Como posso ajudá-lo(a)?" },
      { id: "2", label: "Agradecimento", text: "Obrigado pelo seu contato! Estamos trabalhando na sua demanda." },
    ];
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: mapsApiKey = "" } = useGoogleMapsKey();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });

  const normHeader = (s: string) =>
    String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").trim();

  const HEADER_MAP: Record<string, "nome" | "telefone" | "endereco"> = {
    nome: "nome", nomecompleto: "nome",
    telefone: "telefone", celular: "telefone", fone: "telefone", whatsapp: "telefone", contato: "telefone",
    endereco: "endereco", logradouro: "endereco", rua: "endereco",
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportProgress({ done: 0, total: 0 });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
        setImporting(false);
        return;
      }

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });

      // Build column mapping from first row's keys
      const colMap: Record<string, "nome" | "telefone" | "endereco"> = {};
      if (rows[0]) {
        for (const key of Object.keys(rows[0])) {
          const canonical = HEADER_MAP[normHeader(key)];
          if (canonical) colMap[key] = canonical;
        }
      }

      const payloads: any[] = [];
      let skipped = 0;
      for (const row of rows) {
        const rec: any = { nome: null, telefone: null, endereco: null };
        for (const [origKey, canonical] of Object.entries(colMap)) {
          const val = row[origKey];
          if (val !== null && val !== undefined && String(val).trim() !== "") {
            rec[canonical] = String(val).trim();
          }
        }
        if (!rec.nome) { skipped++; continue; }
        payloads.push({
          nome: rec.nome,
          telefone: rec.telefone,
          endereco: rec.endereco,
          politico_id: user.id,
          criado_por: user.id,
          status_eleitor: "possivel_eleitor",
          agente_ativo: true,
        });
      }

      setImportProgress({ done: 0, total: payloads.length });
      const BATCH = 500;
      let inserted = 0;
      let errors = 0;
      const errorMsgs: string[] = [];
      for (let i = 0; i < payloads.length; i += BATCH) {
        const lote = payloads.slice(i, i + BATCH);
        const { error } = await supabase.from("eleitores").insert(lote);
        if (error) {
          errors += lote.length;
          if (errorMsgs.length < 2) errorMsgs.push(error.message);
        } else {
          inserted += lote.length;
        }
        setImportProgress({ done: Math.min(i + BATCH, payloads.length), total: payloads.length });
      }

      queryClient.invalidateQueries({ queryKey: ["eleitores"] });
      queryClient.invalidateQueries({ queryKey: ["eleitores-mapa"] });

      toast({
        title: "Importação concluída",
        description: `${inserted} inseridos, ${skipped} sem nome pulados${errors ? `, ${errors} com erro: ${errorMsgs.join("; ")}` : ""}.`,
        variant: errors ? "destructive" : "default",
      });
    } catch (err: any) {
      console.error("[Import]", err);
      toast({ title: "Falha ao importar", description: err?.message || "Erro desconhecido", variant: "destructive" });
    } finally {
      setImporting(false);
      setImportProgress({ done: 0, total: 0 });
    }
  };

  const { data: eleitores = [], isLoading } = useQuery({
    queryKey: ["eleitores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eleitores")
        .select("id, nome, endereco, logradouro, numero, complemento, bairro, cidade, estado, cep, telefone, interesse, observacoes, latitude, longitude, data_nascimento, agente_ativo, status_eleitor")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Eleitor[];
    },
  });

  // Carrega todas as demandas vinculadas a eleitores para mostrar contadores nos cards
  const { data: demandasPorEleitor = {} } = useQuery({
    queryKey: ["demandas-por-eleitor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandas")
        .select("id, titulo, descricao, status, created_at, eleitor_id")
        .not("eleitor_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, DemandaEleitor[]> = {};
      (data as DemandaEleitor[]).forEach((d) => {
        if (!d.eleitor_id) return;
        if (!map[d.eleitor_id]) map[d.eleitor_id] = [];
        map[d.eleitor_id].push(d);
      });
      return map;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: typeof form & { id?: string }) => {
      const endereco = [payload.rua, payload.numero, payload.complemento, payload.bairro, payload.cidade, payload.estado, payload.cep].filter(Boolean).join(", ");
      const enderecoFields = {
        logradouro: payload.rua || null,
        numero: payload.numero || null,
        complemento: payload.complemento || null,
        bairro: payload.bairro || null,
        cidade: payload.cidade || null,
        estado: payload.estado || null,
        cep: payload.cep || null,
      };
      let eleitorId = payload.id;
      if (payload.id) {
        const { error } = await supabase.from("eleitores").update({
          nome: payload.nome,
          endereco: endereco || null,
          ...enderecoFields,
          telefone: payload.telefone || null,
          interesse: payload.interesse || null,
          status_eleitor: payload.status_eleitor || "possivel_eleitor",
          observacoes: payload.observacoes || null,
          data_nascimento: payload.data_nascimento || null,
        }).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("eleitores").insert({
          nome: payload.nome,
          endereco: endereco || null,
          ...enderecoFields,
          telefone: payload.telefone || null,
          interesse: payload.interesse || null,
          status_eleitor: payload.status_eleitor || "possivel_eleitor",
          observacoes: payload.observacoes || null,
          data_nascimento: payload.data_nascimento || null,
        }).select("id").single();
        if (error) throw error;
        eleitorId = data.id;
      }

      // Cria demanda inicial vinculada ao eleitor (se preenchida)
      if (eleitorId && payload.demanda_titulo.trim()) {
        const { error: dErr } = await supabase.from("demandas").insert({
          titulo: payload.demanda_titulo.trim(),
          descricao: payload.demanda_descricao.trim() || null,
          eleitor_id: eleitorId,
          status: "Em Análise",
          origem: payload.demanda_origem || null,
          tipo: payload.demanda_tipo || null,
          setor: payload.demanda_setor || null,
          localizacao: payload.demanda_localizacao.trim() || endereco || null,
          prazo: payload.demanda_prazo ? new Date(payload.demanda_prazo).toISOString() : null,
        });
        if (dErr) console.warn("Erro ao criar demanda do eleitor:", dErr);
      }

      if (endereco && eleitorId) {
        try {
          await supabase.functions.invoke("geocode", {
            body: { eleitor_id: eleitorId, endereco },
          });
        } catch (geoErr) {
          console.warn("Geocoding failed:", geoErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eleitores"] });
      queryClient.invalidateQueries({ queryKey: ["eleitores-mapa"] });
      queryClient.invalidateQueries({ queryKey: ["demandas-por-eleitor"] });
      queryClient.invalidateQueries({ queryKey: ["demandas"] });
      toast({ title: editingId ? "Eleitor atualizado!" : "Eleitor adicionado!" });
      setForm({ nome: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", cep: "", telefone: "", interesse: "", status_eleitor: "possivel_eleitor" as StatusEleitor, observacoes: "", data_nascimento: "", demanda_titulo: "", demanda_descricao: "", demanda_origem: "", demanda_tipo: "", demanda_setor: "", demanda_localizacao: "", demanda_prazo: "" });
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

  const toggleAgenteMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("eleitores").update({ agente_ativo: ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["eleitores"] });
      toast({
        title: vars.ativo ? "🤖 Agente ativado!" : "Agente desativado",
        description: vars.ativo
          ? "A partir de agora o agente responderá as mensagens deste eleitor automaticamente."
          : "O agente não responderá mais as mensagens deste eleitor.",
      });
    },
  });

  const enviarParaGestaoMutation = useMutation({
    mutationFn: async (demandaId: string) => {
      const { error } = await supabase
        .from("demandas")
        .update({ status: "Em Andamento" })
        .eq("id", demandaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandas-por-eleitor"] });
      queryClient.invalidateQueries({ queryKey: ["demandas"] });
      toast({ title: "✅ Enviada para Gestão de Demandas!", description: "A demanda foi movida para 'Em Andamento'." });
      setDemandaDialog(null);
    },
  });

  const criarDemandaMutation = useMutation({
    mutationFn: async ({ eleitor, titulo, descricao }: { eleitor: Eleitor; titulo: string; descricao: string }) => {
      const { error } = await supabase.from("demandas").insert({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        eleitor_id: eleitor.id,
        localizacao: eleitor.endereco,
        status: "Em Análise",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandas-por-eleitor"] });
      queryClient.invalidateQueries({ queryKey: ["demandas"] });
      toast({ title: "📌 Demanda registrada!" });
      setNovaDemandaDialog(null);
      setNovaDemandaForm({ titulo: "", descricao: "" });
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
    const parts = (eleitor.endereco || "").split(", ");
    setForm({
      nome: eleitor.nome,
      rua: eleitor.logradouro || parts[0] || "",
      numero: eleitor.numero || parts[1] || "",
      complemento: eleitor.complemento || "",
      bairro: eleitor.bairro || parts[2] || "",
      cidade: eleitor.cidade || parts[3] || "",
      estado: eleitor.estado || parts[4] || "",
      cep: eleitor.cep || parts[5] || "",
      telefone: eleitor.telefone || "",
      interesse: eleitor.interesse || "",
      status_eleitor: normalizeStatusEleitor(eleitor.status_eleitor),
      observacoes: eleitor.observacoes || "",
      data_nascimento: eleitor.data_nascimento || "",
      demanda_titulo: "",
      demanda_descricao: "",
      demanda_origem: "",
      demanda_tipo: "",
      demanda_setor: "",
      demanda_localizacao: "",
      demanda_prazo: "",
    });
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

  const statusBadgeClass = (status: string) => {
    if (status === "Resolvido") return "bg-success/10 text-success border-success/20";
    if (status === "Em Andamento") return "bg-warning/10 text-warning border-warning/20";
    return "bg-info/10 text-info border-info/20";
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Base de Eleitores</h1>
            <Badge variant="secondary" className="text-xs font-semibold">{eleitores.length}</Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Gerencie os contatos e interesses da sua base.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleImportFile}
        />
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {importing
            ? (importProgress.total > 0 ? `Importando ${importProgress.done} de ${importProgress.total}` : "Importando...")
            : "Importar planilha"}
        </Button>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); setForm({ nome: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", cep: "", telefone: "", interesse: "", status_eleitor: "possivel_eleitor" as StatusEleitor, observacoes: "", data_nascimento: "", demanda_titulo: "", demanda_descricao: "", demanda_origem: "", demanda_tipo: "", demanda_setor: "", demanda_localizacao: "", demanda_prazo: "" }); } }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground gap-2 shadow-[var(--shadow-md)]">
              <Plus className="h-4 w-4" /> Novo Eleitor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Eleitor" : "Novo Eleitor"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-1">
              <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" /></div>

              <div className="space-y-3 p-3 rounded-lg bg-secondary/30 border border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endereço</p>
                <div><Label>Rua / Logradouro</Label><AddressAutocomplete apiKey={mapsApiKey} value={form.rua} onChange={(v) => setForm((prev) => ({ ...prev, rua: v }))} onAddressSelect={(c) => setForm((prev) => ({ ...prev, rua: c.rua, bairro: c.bairro, cidade: c.cidade, estado: c.estado, cep: c.cep }))} placeholder="Ex: Rua das Flores" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Número</Label><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Nº" /></div>
                  <div><Label>Complemento</Label><Input value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} placeholder="Apto, Bloco..." /></div>
                </div>
                <div><Label>Bairro</Label><Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} placeholder="Bairro" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Cidade" /></div>
                  <div><Label>Estado</Label><Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} placeholder="UF" maxLength={2} /></div>
                </div>
                <div className="w-1/2"><Label>CEP</Label><Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} placeholder="00000-000" /></div>
              </div>

              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" /></div>
              <div>
                <Label className="flex items-center gap-1.5"><Cake className="h-3.5 w-3.5 text-primary" /> Data de Nascimento</Label>
                <Input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
              </div>
              <div>
                <Label>Interesses</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 p-3 rounded-md border border-border bg-card/50">
                  {interesses.map((i) => {
                    const selected = form.interesse.split(",").map(s => s.trim()).filter(Boolean);
                    const checked = selected.includes(i);
                    return (
                      <label key={i} className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = v
                              ? [...selected, i]
                              : selected.filter(x => x !== i);
                            setForm({ ...form, interesse: next.join(", ") });
                          }}
                        />
                        <span>{i}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Status do Eleitor</Label>
                <Select value={form.status_eleitor} onValueChange={(v) => setForm({ ...form, status_eleitor: v as StatusEleitor })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_ELEITOR_LIST.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className="mr-2">{s.emoji}</span>{s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Anotações sobre o eleitor..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              {/* Demanda inicial — só no cadastro novo */}
              {!editingId && (
                <div className="space-y-3 p-3 rounded-lg border border-warning/30 bg-warning/5">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-warning" />
                    <p className="text-xs font-semibold text-warning uppercase tracking-wider">Reclamação ou Solicitação (Opcional)</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Caso o eleitor já tenha alguma demanda, registre aqui. Será criada automaticamente vinculada a ele.</p>
                  <div>
                    <Label>Título da Demanda</Label>
                    <Input
                      value={form.demanda_titulo}
                      onChange={(e) => setForm({ ...form, demanda_titulo: e.target.value })}
                      placeholder="Ex: Buraco na rua, falta d'água..."
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea
                      value={form.demanda_descricao}
                      onChange={(e) => setForm({ ...form, demanda_descricao: e.target.value })}
                      placeholder="Detalhes da reclamação ou solicitação..."
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>📍 Origem</Label>
                      <Select value={form.demanda_origem || "none"} onValueChange={(v) => setForm({ ...form, demanda_origem: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Não informado" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não informado</SelectItem>
                          {ORIGENS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>🏷️ Tipo</Label>
                      <Select value={form.demanda_tipo || "none"} onValueChange={(v) => setForm({ ...form, demanda_tipo: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Não informado" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não informado</SelectItem>
                          {TIPOS_DEMANDA.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>🏛️ Setor responsável</Label>
                    <Select value={form.demanda_setor || "none"} onValueChange={(v) => setForm({ ...form, demanda_setor: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Não informado" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informado</SelectItem>
                        {SETORES_DEMANDA.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Localização</Label>
                    <Input
                      value={form.demanda_localizacao}
                      onChange={(e) => setForm({ ...form, demanda_localizacao: e.target.value })}
                      placeholder="Local da demanda (padrão: endereço do eleitor)"
                    />
                  </div>
                  <div>
                    <Label>Prazo</Label>
                    <Input
                      type="date"
                      value={form.demanda_prazo}
                      onChange={(e) => setForm({ ...form, demanda_prazo: e.target.value })}
                    />
                  </div>
                  <div className="rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-xs text-primary">
                    👤 A demanda será vinculada automaticamente a <strong>este eleitor</strong> ({form.nome || "novo cadastro"}).
                  </div>
                </div>
              )}

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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((eleitor) => {
            const demandas = demandasPorEleitor[eleitor.id] || [];
            const abertas = demandas.filter((d) => d.status !== "Resolvido");
            return (
              <div key={eleitor.id} className="space-y-2">

                {/* Card do eleitor */}
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-sm sm:text-base">{eleitor.nome}</p>
                          {(() => {
                            const s = getStatusEleitor(eleitor.status_eleitor);
                            return (
                              <Badge variant="outline" className={s.badgeClass}>
                                <span className="mr-1">{s.emoji}</span>{s.label}
                              </Badge>
                            );
                          })()}
                          {eleitor.interesse && eleitor.interesse.split(",").map(s => s.trim()).filter(Boolean).map((int) => (
                            <Badge key={int} variant="outline" className={interestColors[int] || ""}>
                              {int}
                            </Badge>
                          ))}
                          {eleitor.agente_ativo && (
                            <Badge className="bg-primary/15 text-primary border-primary/30 gap-1">
                              <Bot className="h-3 w-3" /> Agente ativo
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{eleitor.endereco || "Sem endereço"}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MessageCircle className="h-3 w-3 text-success" /> {eleitor.telefone || "Sem telefone"}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 md:gap-3 md:border-l md:border-border md:pl-4">
                        {/* Toggle Agente */}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/50 border border-border">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium">Agente</span>
                          <Switch
                            checked={eleitor.agente_ativo}
                            onCheckedChange={(c) => toggleAgenteMutation.mutate({ id: eleitor.id, ativo: c })}
                          />
                        </div>

                        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setNovaDemandaDialog(eleitor)}>
                          <Megaphone className="h-3.5 w-3.5" /> Demanda
                        </Button>
                        {demandas.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs border-warning/40 bg-warning/5 hover:bg-warning/10 text-warning"
                                title="Ver demandas deste eleitor"
                              >
                                <AlertCircle className="h-3.5 w-3.5" />
                                Demandas
                                <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                                  {demandas.length}
                                </Badge>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-y-auto bg-popover">
                              <DropdownMenuLabel className="text-xs">Demandas de {eleitor.nome}</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {demandas.map((d) => (
                                <DropdownMenuItem
                                  key={d.id}
                                  onClick={() => setDemandaUnicaDialog({ eleitor, demanda: d })}
                                  className="flex items-start gap-2 py-2 cursor-pointer"
                                >
                                  <AlertCircle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{d.titulo}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <Badge variant="outline" className={`${statusBadgeClass(d.status)} text-[10px] px-1.5 py-0 h-4`}>
                                        {d.status}
                                      </Badge>
                                      <span className="text-[10px] text-muted-foreground">
                                        {new Date(d.created_at).toLocaleDateString("pt-BR")}
                                      </span>
                                    </div>
                                  </div>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() => setDemandaDialog({ eleitor, demandas })}
                          title="Histórico de demandas"
                        >
                          <History className="h-3.5 w-3.5" /> Histórico
                          {demandas.length > 0 && (
                            <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                              {demandas.length}
                            </Badge>
                          )}
                        </Button>
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
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <Card className="glass-card">
              <CardContent className="text-center py-12 text-muted-foreground text-sm">
                Nenhum eleitor encontrado.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Dialog: histórico de demandas do eleitor */}
      <Dialog open={!!demandaDialog} onOpenChange={(o) => { if (!o) setDemandaDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico de Demandas — {demandaDialog?.eleitor.nome}
            </DialogTitle>
          </DialogHeader>
          {demandaDialog && (() => {
            const total = demandaDialog.demandas.length;
            const resolvidas = demandaDialog.demandas.filter((d) => d.status === "Resolvido").length;
            const andamento = demandaDialog.demandas.filter((d) => d.status === "Em Andamento").length;
            const analise = demandaDialog.demandas.filter((d) => d.status === "Em Análise").length;
            const sorted = [...demandaDialog.demandas].sort((a, b) => {
              const order: Record<string, number> = { "Em Análise": 0, "Em Andamento": 1, "Resolvido": 2 };
              const oa = order[a.status] ?? 99;
              const ob = order[b.status] ?? 99;
              if (oa !== ob) return oa - ob;
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
            return (
              <div className="space-y-3">
                {/* Resumo */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-lg border border-border bg-secondary/30 p-2 text-center">
                    <p className="text-lg font-bold">{total}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                  </div>
                  <div className="rounded-lg border border-info/20 bg-info/5 p-2 text-center">
                    <p className="text-lg font-bold text-info">{analise}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Análise</p>
                  </div>
                  <div className="rounded-lg border border-warning/20 bg-warning/5 p-2 text-center">
                    <p className="text-lg font-bold text-warning">{andamento}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Andamento</p>
                  </div>
                  <div className="rounded-lg border border-success/20 bg-success/5 p-2 text-center">
                    <p className="text-lg font-bold text-success">{resolvidas}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Resolvidas</p>
                  </div>
                </div>

                {/* Lista */}
                {total === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                    Nenhuma demanda registrada para este eleitor.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {sorted.map((d) => (
                      <div key={d.id} className="p-3 rounded-lg border border-border bg-secondary/30 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{d.titulo}</p>
                            {d.descricao && <p className="text-xs text-muted-foreground mt-1">{d.descricao}</p>}
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(d.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            </p>
                          </div>
                          <Badge variant="outline" className={statusBadgeClass(d.status)}>
                            {d.status === "Resolvido" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {d.status}
                          </Badge>
                        </div>
                        {d.status === "Em Análise" && (
                          <Button
                            size="sm"
                            className="w-full gradient-primary text-primary-foreground gap-1"
                            onClick={() => enviarParaGestaoMutation.mutate(d.id)}
                            disabled={enviarParaGestaoMutation.isPending}
                          >
                            <Send className="h-3.5 w-3.5" /> Enviar para Gestão de Demandas
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog: visualização de uma demanda específica */}
      <Dialog open={!!demandaUnicaDialog} onOpenChange={(o) => { if (!o) setDemandaUnicaDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Demanda
            </DialogTitle>
          </DialogHeader>
          {demandaUnicaDialog && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Eleitor: <span className="font-medium text-foreground">{demandaUnicaDialog.eleitor.nome}</span></p>
                <Badge variant="outline" className={statusBadgeClass(demandaUnicaDialog.demanda.status)}>
                  {demandaUnicaDialog.demanda.status === "Resolvido" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {demandaUnicaDialog.demanda.status}
                </Badge>
              </div>
              <div className="p-3 rounded-lg border border-border bg-secondary/30 space-y-2">
                <p className="font-semibold text-sm">{demandaUnicaDialog.demanda.titulo}</p>
                {demandaUnicaDialog.demanda.descricao && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{demandaUnicaDialog.demanda.descricao}</p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
                  <Clock className="h-3 w-3" />
                  Registrada em {new Date(demandaUnicaDialog.demanda.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </p>
              </div>
              {demandaUnicaDialog.demanda.status === "Em Análise" && (
                <Button
                  size="sm"
                  className="w-full gradient-primary text-primary-foreground gap-1"
                  onClick={() => {
                    enviarParaGestaoMutation.mutate(demandaUnicaDialog.demanda.id);
                    setDemandaUnicaDialog(null);
                  }}
                  disabled={enviarParaGestaoMutation.isPending}
                >
                  <Send className="h-3.5 w-3.5" /> Enviar para Gestão de Demandas
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: nova demanda para eleitor existente */}
      <Dialog open={!!novaDemandaDialog} onOpenChange={(o) => { if (!o) { setNovaDemandaDialog(null); setNovaDemandaForm({ titulo: "", descricao: "" }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-warning" />
              Nova demanda — {novaDemandaDialog?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>Título</Label>
              <Input value={novaDemandaForm.titulo} onChange={(e) => setNovaDemandaForm({ ...novaDemandaForm, titulo: e.target.value })} placeholder="Ex: Buraco na rua" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={novaDemandaForm.descricao} onChange={(e) => setNovaDemandaForm({ ...novaDemandaForm, descricao: e.target.value })} rows={3} placeholder="Detalhes..." />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => novaDemandaDialog && criarDemandaMutation.mutate({ eleitor: novaDemandaDialog, ...novaDemandaForm })}
              disabled={!novaDemandaForm.titulo.trim() || criarDemandaMutation.isPending}
              className="gradient-primary text-primary-foreground"
            >
              {criarDemandaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrar Demanda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
