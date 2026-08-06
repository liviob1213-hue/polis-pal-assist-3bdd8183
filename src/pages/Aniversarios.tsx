import { useEffect, useMemo, useState } from "react";
import { useHeaderSearch } from "@/contexts/HeaderSearchContext";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Cake, Search, MessageCircle, Sparkles, PartyPopper, Phone, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getStatusEleitor } from "@/lib/statusEleitor";
import {
  KEY_MSG_PADRAO_ANIVERSARIO,
  MSG_PADRAO_ANIVERSARIO_DEFAULT,
  getMensagemPadrao,
  setMensagemPadrao,
  aplicarVariaveis,
} from "@/lib/mensagensPadrao";


interface Eleitor {
  id: string;
  nome: string;
  telefone: string | null;
  data_nascimento: string | null;
  interesse: string | null;
  status_eleitor: string | null;
}

const interestColors: Record<string, string> = {
  "Saúde": "bg-success/10 text-success border-success/20",
  "Obras": "bg-warning/10 text-warning border-warning/20",
  "Educação": "bg-info/10 text-info border-info/20",
  "Segurança": "bg-destructive/10 text-destructive border-destructive/20",
  "Transporte": "bg-accent/10 text-accent border-accent/20",
  "Meio Ambiente": "bg-success/10 text-success border-success/20",
  "Juventude": "bg-info/10 text-info border-info/20",
  "Emprego": "bg-accent/10 text-accent border-accent/20",
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function diasAteAniversario(dataIso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  let proximo = new Date(hoje.getFullYear(), mes - 1, dia);
  if (proximo < hoje) proximo = new Date(hoje.getFullYear() + 1, mes - 1, dia);
  return Math.round((proximo.getTime() - hoje.getTime()) / 86400000);
}

function calcularIdade(dataIso: string): number {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  const m = hoje.getMonth() + 1;
  if (m < mes || (m === mes && hoje.getDate() < dia)) idade--;
  return idade;
}

const MSG_KEY = "mensagens_aniversario";

function getMensagensCustom(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MSG_KEY) || "{}");
  } catch {
    return {};
  }
}

function mensagemPadrao(nome: string): string {
  const base = getMensagemPadrao(KEY_MSG_PADRAO_ANIVERSARIO, MSG_PADRAO_ANIVERSARIO_DEFAULT);
  return aplicarVariaveis(base, { nome });
}

function mensagemAniversario(id: string, nome: string): string {
  const custom = getMensagensCustom()[id];
  if (custom && custom.trim()) return aplicarVariaveis(custom, { nome });
  return mensagemPadrao(nome);
}

export default function Aniversarios() {
  const [busca, setBusca] = useState("");
  const { query: headerQuery } = useHeaderSearch();
  useEffect(() => { setBusca(headerQuery); }, [headerQuery]);
  const queryClient = useQueryClient();

  const [editando, setEditando] = useState<Eleitor | null>(null);
  const [formEdit, setFormEdit] = useState({ nome: "", telefone: "", data_nascimento: "", mensagem: "" });
  const [salvando, setSalvando] = useState(false);
  const [msgPadraoOpen, setMsgPadraoOpen] = useState(false);
  const [msgPadraoTexto, setMsgPadraoTexto] = useState("");

  const abrirEdicao = (e: Eleitor) => {
    setEditando(e);
    setFormEdit({
      nome: e.nome ?? "",
      telefone: e.telefone ?? "",
      data_nascimento: e.data_nascimento ?? "",
      mensagem: getMensagensCustom()[e.id] || mensagemPadrao(e.nome ?? ""),
    });
  };

  const salvarEdicao = async () => {
    if (!editando) return;
    if (!formEdit.nome.trim()) {
      toast({ title: "Informe o nome", variant: "destructive" });
      return;
    }
    setSalvando(true);
    const { error } = await supabase
      .from("eleitores")
      .update({
        nome: formEdit.nome.trim(),
        telefone: formEdit.telefone.trim() || null,
        data_nascimento: formEdit.data_nascimento || null,
      })
      .eq("id", editando.id);
    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    const msgs = getMensagensCustom();
    if (formEdit.mensagem.trim() && formEdit.mensagem !== mensagemPadrao(formEdit.nome)) {
      msgs[editando.id] = formEdit.mensagem;
    } else {
      delete msgs[editando.id];
    }
    localStorage.setItem(MSG_KEY, JSON.stringify(msgs));
    toast({ title: "Aniversariante atualizado!" });
    setEditando(null);
    queryClient.invalidateQueries({ queryKey: ["eleitores-aniversarios"] });
    queryClient.invalidateQueries({ queryKey: ["eleitores"] });
  };

  const { data: eleitores = [], isLoading } = useQuery({
    queryKey: ["eleitores-aniversarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eleitores")
        .select("id, nome, telefone, data_nascimento, interesse, status_eleitor")
        .not("data_nascimento", "is", null);
      if (error) throw error;
      return data as Eleitor[];
    },
  });

  const { aniversariantesHoje, ordenados, totalMes } = useMemo(() => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const diaAtual = hoje.getDate();

    const filtrados = eleitores.filter((e) =>
      e.nome.toLowerCase().includes(busca.toLowerCase()),
    );

    const ordenados = [...filtrados]
      .filter((e) => e.data_nascimento)
      .map((e) => {
        const dias = diasAteAniversario(e.data_nascimento!);
        const idade = calcularIdade(e.data_nascimento!);
        return { ...e, dias, idade };
      })
      .sort((a, b) => a.dias - b.dias);

    const aniversariantesHoje = ordenados.filter((e) => {
      const [_, m, d] = e.data_nascimento!.split("-").map(Number);
      return m === mesAtual && d === diaAtual;
    });

    const totalMes = ordenados.filter((e) => {
      const [_, m] = e.data_nascimento!.split("-").map(Number);
      return m === mesAtual;
    }).length;

    return { aniversariantesHoje, ordenados, totalMes };
  }, [eleitores, busca]);

  const enviarWhatsapp = (eleitor: Eleitor) => {
    if (!eleitor.telefone) {
      toast({ title: "Telefone não cadastrado", variant: "destructive" });
      return;
    }
    const phone = eleitor.telefone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const msg = encodeURIComponent(mensagemAniversario(eleitor.id, eleitor.nome));
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
    toast({ title: "WhatsApp aberto!", description: `Mensagem pronta para ${eleitor.nome.split(" ")[0]}` });
  };


  const formatDataBR = (iso: string) => {
    const [_, m, d] = iso.split("-").map(Number);
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  };

  const initials = (nome: string) =>
    nome.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <Cake className="h-8 w-8 text-primary" />
            Gestão de Aniversários
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe os aniversários dos seus eleitores e envie mensagens personalizadas
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Badge variant="secondary" className="text-sm py-1.5 px-3">
            <PartyPopper className="h-3.5 w-3.5 mr-1.5" />
            {aniversariantesHoje.length} hoje
          </Badge>
          <Badge variant="outline" className="text-sm py-1.5 px-3">
            {totalMes} este mês
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              setMsgPadraoTexto(getMensagemPadrao(KEY_MSG_PADRAO_ANIVERSARIO, MSG_PADRAO_ANIVERSARIO_DEFAULT));
              setMsgPadraoOpen(true);
            }}
          >
            <MessageCircle className="h-4 w-4" /> Mensagem padrão
          </Button>
        </div>
      </div>

      {/* Aniversariantes do dia */}
      {aniversariantesHoje.length > 0 && (
        <Card className="glass-card border-primary/40 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-6 w-6 text-primary animate-pulse" />
              🎉 Aniversariantes de Hoje!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {aniversariantesHoje.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-4 p-4 rounded-lg bg-card/60 backdrop-blur border border-primary/20"
              >
                <Avatar className="h-14 w-14 ring-2 ring-primary">
                  <AvatarFallback className="gradient-primary text-primary-foreground font-bold text-lg">
                    {initials(e.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-lg">{e.nome}</span>
                    <Badge className="gradient-primary text-primary-foreground border-0">
                      {e.idade} anos
                    </Badge>
                    {e.status_eleitor && (() => {
                      const s = getStatusEleitor(e.status_eleitor);
                      return (
                        <Badge variant="outline" className={s.badgeClass}>
                          <span className="mr-1">{s.emoji}</span>{s.label}
                        </Badge>
                      );
                    })()}
                    {e.interesse && (
                      <Badge variant="outline" className={interestColors[e.interesse] || "bg-muted text-muted-foreground"}>
                        {e.interesse}
                      </Badge>
                    )}
                  </div>
                  {e.telefone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" /> {e.telefone}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => abrirEdicao(e)} title="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => enviarWhatsapp(e)}
                  className="bg-success hover:bg-success/90 text-success-foreground gap-2 shrink-0"
                  disabled={!e.telefone}
                >
                  <MessageCircle className="h-4 w-4" />
                  Parabenizar
                </Button>

              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar eleitor..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista ordenada por proximidade */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Próximos Aniversários</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : ordenados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Cake className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Nenhum eleitor com data de nascimento cadastrada</p>
              <p className="text-xs mt-1">Adicione a data ao cadastrar/editar eleitores</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ordenados.map((e) => {
                const isHoje = e.dias === 0;
                const [_, mes] = e.data_nascimento!.split("-").map(Number);
                return (
                  <div
                    key={e.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isHoje
                        ? "bg-primary/10 border-primary/30"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className={isHoje ? "gradient-primary text-primary-foreground" : "bg-muted"}>
                        {initials(e.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{e.nome}</span>
                        {isHoje && (
                          <Badge className="gradient-primary text-primary-foreground border-0 text-[10px]">
                            HOJE 🎂
                          </Badge>
                        )}
                        {e.status_eleitor && (() => {
                          const s = getStatusEleitor(e.status_eleitor);
                          return (
                            <Badge variant="outline" className={`${s.badgeClass} text-[10px]`}>
                              <span className="mr-1">{s.emoji}</span>{s.label}
                            </Badge>
                          );
                        })()}
                        {e.interesse && (
                          <Badge variant="outline" className={`text-[10px] ${interestColors[e.interesse] || "bg-muted text-muted-foreground"}`}>
                            {e.interesse}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDataBR(e.data_nascimento!)} · {MESES[mes - 1]} · vai fazer {e.idade + (isHoje ? 0 : 1)} anos
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">
                        {isHoje ? "Hoje!" : e.dias === 1 ? "Amanhã" : `${e.dias} dias`}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => abrirEdicao(e)} title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 shrink-0 text-success hover:text-success hover:bg-success/10"
                      onClick={() => enviarWhatsapp(e)}
                      disabled={!e.telefone}
                      title={e.telefone ? "Enviar parabéns" : "Telefone não cadastrado"}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </Button>

                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar aniversariante</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={formEdit.nome} onChange={(ev) => setFormEdit({ ...formEdit, nome: ev.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Data de nascimento</Label>
                <Input
                  type="date"
                  value={formEdit.data_nascimento}
                  onChange={(ev) => setFormEdit({ ...formEdit, data_nascimento: ev.target.value })}
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={formEdit.telefone}
                  onChange={(ev) => setFormEdit({ ...formEdit, telefone: ev.target.value })}
                  placeholder="31 99999-9999"
                />
              </div>
            </div>
            <div>
              <Label>Mensagem de aniversário</Label>
              <Textarea
                rows={6}
                value={formEdit.mensagem}
                onChange={(ev) => setFormEdit({ ...formEdit, mensagem: ev.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use <code>{"{nome}"}</code> para inserir o primeiro nome automaticamente.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={salvarEdicao} disabled={salvando} className="gradient-primary text-primary-foreground">
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

