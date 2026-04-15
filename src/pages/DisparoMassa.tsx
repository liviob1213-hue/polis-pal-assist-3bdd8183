import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, MessageCircle, Clock, Radio, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type QueueItem = {
  id: string;
  tipo: string;
  destinatario_nome: string | null;
  destinatario_telefone: string;
  mensagem_original: string;
  mensagem_variacao: string | null;
  status: string;
  agendado_para: string;
  enviado_em: string | null;
  campanha_id: string | null;
  erro_detalhe: string | null;
  created_at: string;
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Na fila", color: "bg-warning/20 text-warning border-warning/30", icon: <Clock className="h-3 w-3" /> },
  enviando: { label: "Enviando", color: "bg-info/20 text-info border-info/30", icon: <Radio className="h-3 w-3 animate-pulse" /> },
  enviado: { label: "Aguardando resposta", color: "bg-info/20 text-info border-info/30", icon: <MessageCircle className="h-3 w-3" /> },
  erro: { label: "Erro", color: "bg-destructive/20 text-destructive border-destructive/30", icon: <XCircle className="h-3 w-3" /> },
};

const DisparoMassa = () => {
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState({ pendente: 0, enviando: 0, enviado: 0, erro: 0 });
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  // Fetch queue items
  const fetchQueue = async () => {
    const { data, error } = await supabase
      .from("message_queue")
      .select("*")
      .order("agendado_para", { ascending: true })
      .limit(100);
    if (!error && data) {
      setQueue(data as QueueItem[]);
      const s = { pendente: 0, enviando: 0, enviado: 0, erro: 0 };
      data.forEach((item: any) => {
        if (s[item.status as keyof typeof s] !== undefined) s[item.status as keyof typeof s]++;
      });
      setStats(s);
    }
  };

  useEffect(() => {
    fetchQueue();
    // Realtime subscription
    const channel = supabase
      .channel("message_queue_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "message_queue" }, () => {
        fetchQueue();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Process queue (trigger the processor)
  const processQueue = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-message-queue");
      if (error) throw error;
      if (data?.processed > 0) {
        toast({ title: `✅ Mensagem enviada para ${data.destinatario}`, description: `${data.remaining} restantes na fila` });
      } else {
        toast({ title: "Nenhuma mensagem para processar agora" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao processar fila", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
      fetchQueue();
    }
  };

  const handleDisparo = async () => {
    if (!mensagem.trim()) {
      toast({ title: "Digite uma mensagem", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-disparo-massa", {
        body: { mensagem },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: data.error, variant: "destructive" });
      } else {
        toast({
          title: "🚀 Campanha criada com sucesso!",
          description: `${data?.totalEnfileirados || 0} mensagens na fila. Lógica anti-banimento: próxima mensagem só envia após o eleitor responder + delay aleatório.`,
        });
        setMensagem("");
        fetchQueue();
      }
    } catch (err: any) {
      toast({ title: "Erro ao criar campanha", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const clearCompleted = async () => {
    await supabase.from("message_queue").delete().eq("status", "enviado");
    await supabase.from("message_queue").delete().eq("status", "erro");
    fetchQueue();
    toast({ title: "Fila limpa" });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Central de Comando</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">
          Gerencie disparos em massa e notificações para assessores com variações humanizadas.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10"><Clock className="h-4 w-4 text-warning" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Aguardando</p>
              <p className="text-lg font-bold">{stats.pendente}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10"><Radio className="h-4 w-4 text-info" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Enviando</p>
              <p className="text-lg font-bold">{stats.enviando}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10"><CheckCircle2 className="h-4 w-4 text-success" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Enviados</p>
              <p className="text-lg font-bold">{stats.enviado}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><XCircle className="h-4 w-4 text-destructive" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Erros</p>
              <p className="text-lg font-bold">{stats.erro}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Campaign Creation */}
        <Card className="glass-card">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="h-5 w-5 text-success" />
              Nova Campanha
            </CardTitle>
            <CardDescription>
              Cada eleitor receberá uma variação única. A próxima mensagem só é enviada após o eleitor anterior responder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
            <div>
              <Label htmlFor="mensagem">Mensagem Base da Campanha</Label>
              <Textarea
                id="mensagem"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Digite a mensagem base. A IA criará variações humanizadas para cada eleitor..."
                rows={4}
                className="mt-1.5 text-sm"
              />
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong>Anti-banimento:</strong> A IA gera variações únicas com pergunta no final. A próxima mensagem só é enviada <strong>após o eleitor anterior responder</strong> + delay aleatório de 8-20 min. Timeout de 60 min se não houver resposta.
              </p>
            </div>

            <Button
              onClick={handleDisparo}
              disabled={loading || !mensagem.trim()}
              className="w-full gradient-primary text-primary-foreground gap-2 shadow-[var(--shadow-md)]"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Criando campanha...</>
              ) : (
                <><Send className="h-4 w-4" /> Criar Campanha</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Queue Controls */}
        <Card className="glass-card">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="h-5 w-5 text-primary" />
              Processador de Fila
            </CardTitle>
            <CardDescription>
              Processe mensagens manualmente ou configure o cron automático.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p><strong>Lógica anti-banimento:</strong></p>
                <p className="mt-1">1. Envia mensagem com variação única + pergunta no final</p>
                <p className="mt-1">2. Aguarda o destinatário responder (timeout: 60 min)</p>
                <p className="mt-1">3. Após resposta, espera 8-20 min aleatórios</p>
                <p className="mt-1">4. Só então envia a próxima mensagem da fila</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={processQueue}
                disabled={processing || stats.pendente === 0}
                variant="outline"
                className="flex-1 gap-2"
              >
                {processing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
                ) : (
                  <><RefreshCw className="h-4 w-4" /> Processar Próxima</>
                )}
              </Button>
              <Button
                onClick={clearCompleted}
                variant="ghost"
                className="gap-2 text-muted-foreground"
                disabled={stats.enviado === 0 && stats.erro === 0}
              >
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue List */}
      {queue.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg">Fila de Mensagens</CardTitle>
            <CardDescription>{queue.length} mensagens na fila</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {queue.map((item) => {
                const cfg = statusConfig[item.status] || statusConfig.pendente;
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50">
                    <div className="shrink-0">{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{item.destinatario_nome || "Destinatário"}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {item.tipo === "disparo_massa" ? "Campanha" : item.tipo === "tarefa" ? "Tarefa" : "Demanda"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {item.mensagem_variacao || item.mensagem_original}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        Agendado: {new Date(item.agendado_para).toLocaleString("pt-BR")}
                        {item.enviado_em && ` • Enviado: ${new Date(item.enviado_em).toLocaleString("pt-BR")}`}
                      </p>
                      {item.erro_detalhe && (
                        <p className="text-[10px] text-destructive mt-0.5">{item.erro_detalhe}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};

export default DisparoMassa;
