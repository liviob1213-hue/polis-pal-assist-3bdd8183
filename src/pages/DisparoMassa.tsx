import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, MessageCircle, Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const DisparoMassa = () => {
  const [mensagem, setMensagem] = useState("");
  const [delayMin, setDelayMin] = useState(15);
  const [delayMax, setDelayMax] = useState(30);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDisparo = async () => {
    if (!mensagem.trim()) {
      toast({ title: "Digite uma mensagem", variant: "destructive" });
      return;
    }

    if (delayMin > delayMax) {
      toast({ title: "A espera mínima não pode ser maior que a máxima", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-disparo-massa", {
        body: { mensagem, delayMin, delayMax },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: data.error, variant: "destructive" });
      } else {
        toast({
          title: "Campanha enviada para a fila com sucesso!",
          description: `${data?.totalEnviados || 0} mensagens serão enviadas.`,
        });
        setMensagem("");
      }
    } catch (err: any) {
      toast({
        title: "Erro ao iniciar disparo",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Disparo em Massa</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">
          Envie mensagens para toda a sua base de eleitores via WhatsApp.
        </p>
      </div>

      <Card className="glass-card max-w-2xl">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-success" />
            Nova Campanha
          </CardTitle>
          <CardDescription>
            Escreva a mensagem e configure o intervalo de envio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
          <div>
            <Label htmlFor="mensagem">Mensagem da Campanha</Label>
            <Textarea
              id="mensagem"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Digite aqui a mensagem que será enviada para todos os eleitores..."
              rows={6}
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="delayMin">Espera Mínima (segundos)</Label>
              <Input
                id="delayMin"
                type="number"
                min={1}
                max={60}
                value={delayMin}
                onChange={(e) => setDelayMin(Math.min(60, Math.max(1, Number(e.target.value))))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="delayMax">Espera Máxima (segundos)</Label>
              <Input
                id="delayMax"
                type="number"
                min={1}
                max={60}
                value={delayMax}
                onChange={(e) => setDelayMax(Math.min(60, Math.max(1, Number(e.target.value))))}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <Clock className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Defina um intervalo de tempo entre as mensagens para simular o comportamento humano e evitar bloqueios no WhatsApp.
            </p>
          </div>

          <Button
            onClick={handleDisparo}
            disabled={loading || !mensagem.trim()}
            className="w-full gradient-primary text-primary-foreground gap-2 shadow-[var(--shadow-md)]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Iniciar Disparo
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default DisparoMassa;
