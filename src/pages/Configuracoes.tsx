import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const Configuracoes = () => {
  const [form, setForm] = useState({
    nome: "Carlos Mendes",
    partido: "Partido Novo",
    email: "gabinete@camara.gov.br",
  });
  const [notifDemandas, setNotifDemandas] = useState(true);
  const [notifRelatorio, setNotifRelatorio] = useState(true);
  const { toast } = useToast();

  const handleSave = () => {
    toast({ title: "Configurações salvas com sucesso!" });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie as preferências do gabinete.</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Perfil do Parlamentar</CardTitle>
          <p className="text-sm text-muted-foreground">Informações exibidas nos documentos oficiais.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome Parlamentar</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>Partido</Label>
            <Input value={form.partido} onChange={(e) => setForm({ ...form, partido: e.target.value })} />
          </div>
          <div>
            <Label>Email Oficial</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Notificações</CardTitle>
          <p className="text-sm text-muted-foreground">Configure como deseja receber alertas.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Novas Demandas</p>
              <p className="text-xs text-muted-foreground">Receber email quando uma demanda for criada.</p>
            </div>
            <Switch checked={notifDemandas} onCheckedChange={setNotifDemandas} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Relatório Semanal</p>
              <p className="text-xs text-muted-foreground">Resumo de produtividade toda segunda-feira.</p>
            </div>
            <Switch checked={notifRelatorio} onCheckedChange={setNotifRelatorio} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="gradient-primary text-primary-foreground shadow-[var(--shadow-md)]">
        Salvar Alterações
      </Button>
    </motion.div>
  );
};

export default Configuracoes;
