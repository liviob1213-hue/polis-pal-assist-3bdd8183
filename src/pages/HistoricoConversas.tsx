import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Search, Bot, User as UserIcon, Phone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChatMessage {
  id: string;
  telefone: string;
  role: string;
  message: string;
  created_at: string;
}

interface Conversa {
  telefone: string;
  nome: string | null;
  ultimaMensagem: string;
  ultimaData: string;
  total: number;
}

export default function HistoricoConversas() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [eleitoresMap, setEleitoresMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    const [{ data: msgs }, { data: eleitores }] = await Promise.all([
      supabase.from("chat_history").select("*").order("created_at", { ascending: true }).limit(5000),
      supabase.from("eleitores").select("nome, telefone"),
    ]);
    setMessages((msgs || []) as ChatMessage[]);
    const map: Record<string, string> = {};
    (eleitores || []).forEach((e: any) => {
      if (e.telefone) {
        const clean = e.telefone.replace(/\D/g, "");
        map[clean] = e.nome;
      }
    });
    setEleitoresMap(map);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    const channel = supabase
      .channel("chat-history-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_history" }, (payload) => {
        setMessages((prev) => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const conversas = useMemo<Conversa[]>(() => {
    const grupos = new Map<string, ChatMessage[]>();
    messages.forEach((m) => {
      const arr = grupos.get(m.telefone) || [];
      arr.push(m);
      grupos.set(m.telefone, arr);
    });
    const lista: Conversa[] = [];
    grupos.forEach((msgs, telefone) => {
      const ordenadas = [...msgs].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      const ultima = ordenadas[ordenadas.length - 1];
      const cleanTel = telefone.replace(/\D/g, "");
      lista.push({
        telefone,
        nome: eleitoresMap[cleanTel] || null,
        ultimaMensagem: ultima.message,
        ultimaData: ultima.created_at,
        total: msgs.length,
      });
    });
    lista.sort((a, b) => new Date(b.ultimaData).getTime() - new Date(a.ultimaData).getTime());
    if (busca.trim()) {
      const q = busca.toLowerCase();
      return lista.filter(
        (c) =>
          c.telefone.toLowerCase().includes(q) ||
          (c.nome || "").toLowerCase().includes(q) ||
          c.ultimaMensagem.toLowerCase().includes(q),
      );
    }
    return lista;
  }, [messages, eleitoresMap, busca]);

  const mensagensAtivas = useMemo(() => {
    if (!selecionado) return [];
    return messages
      .filter((m) => m.telefone === selecionado)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages, selecionado]);

  const conversaAtiva = conversas.find((c) => c.telefone === selecionado);

  const formatTel = (tel: string) => {
    const clean = tel.replace(/\D/g, "");
    if (clean.length >= 12) {
      return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
    }
    return tel;
  };

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
            <MessageSquare className="h-8 w-8 text-primary" />
            Histórico de Conversas
          </h1>
          <p className="text-muted-foreground mt-1">
            Conversas do agente de WhatsApp com eleitores
          </p>
        </div>
        <Button variant="outline" onClick={carregar} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
        {/* Lista de conversas */}
        <Card className="glass-card lg:col-span-1 flex flex-col overflow-hidden">
          <CardHeader className="shrink-0 pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Conversas</span>
              <Badge variant="secondary">{conversas.length}</Badge>
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full px-3 pb-3">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : conversas.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>Nenhuma conversa encontrada</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversas.map((c) => {
                    const ativo = c.telefone === selecionado;
                    const initials = (c.nome || c.telefone)
                      .split(" ")
                      .map((s) => s[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <button
                        key={c.telefone}
                        onClick={() => setSelecionado(c.telefone)}
                        className={`w-full text-left p-3 rounded-lg transition-all ${
                          ativo
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted/60 border border-transparent"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-bold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold truncate text-sm">
                                {c.nome || formatTel(c.telefone)}
                              </span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {format(new Date(c.ultimaData), "dd/MM HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            {c.nome && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {formatTel(c.telefone)}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {c.ultimaMensagem}
                            </p>
                            <div className="mt-1">
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                {c.total} mensagens
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Mensagens da conversa */}
        <Card className="glass-card lg:col-span-2 flex flex-col overflow-hidden">
          {selecionado && conversaAtiva ? (
            <>
              <CardHeader className="shrink-0 border-b border-border pb-3">
                <CardTitle className="text-lg flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="gradient-accent text-accent-foreground text-xs font-bold">
                      {(conversaAtiva.nome || conversaAtiva.telefone)
                        .split(" ")
                        .map((s) => s[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      {conversaAtiva.nome || "Eleitor não cadastrado"}
                    </div>
                    <div className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {formatTel(conversaAtiva.telefone)}
                    </div>
                  </div>
                  <Badge variant="secondary">{mensagensAtivas.length} mensagens</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-3">
                    {mensagensAtivas.map((m) => {
                      const isUser = m.role === "user";
                      return (
                        <div
                          key={m.id}
                          className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}
                        >
                          {!isUser && (
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                <Bot className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                              isUser
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-muted text-foreground rounded-bl-sm"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                            <div
                              className={`text-[10px] mt-1 ${
                                isUser ? "text-primary-foreground/70" : "text-muted-foreground"
                              }`}
                            >
                              {format(new Date(m.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            </div>
                          </div>
                          {isUser && (
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarFallback className="bg-accent text-accent-foreground">
                                <UserIcon className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div className="text-muted-foreground">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Selecione uma conversa</p>
                <p className="text-sm mt-1">
                  Escolha um eleitor à esquerda para ver o histórico de mensagens
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
