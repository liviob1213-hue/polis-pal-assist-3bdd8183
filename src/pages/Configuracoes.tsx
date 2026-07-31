import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Bot, CalendarDays, ChevronRight, UserCheck, Cake } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import GoogleCalendarConnect from "@/components/GoogleCalendarConnect";

const Configuracoes = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { role, user } = useAuth();

  const storageKey = user ? `perfil_parlamentar_${user.id}` : null;

  const [form, setForm] = useState({ nome: "", partido: "", email: "" });
  const [notifDemandas, setNotifDemandas] = useState(true);
  const [notifRelatorio, setNotifRelatorio] = useState(true);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const p = JSON.parse(saved);
        setForm({ nome: p.nome ?? "", partido: p.partido ?? "", email: p.email ?? user?.email ?? "" });
        if (typeof p.notifDemandas === "boolean") setNotifDemandas(p.notifDemandas);
        if (typeof p.notifRelatorio === "boolean") setNotifRelatorio(p.notifRelatorio);
      } else {
        setForm((f) => ({ ...f, email: user?.email ?? "" }));
      }
    } catch {
      /* ignore */
    }
  }, [storageKey, user?.email]);

  const handleSave = () => {
    if (!storageKey) {
      toast({ title: "Faça login para salvar", variant: "destructive" });
      return;
    }
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...form, notifDemandas, notifRelatorio }),
    );
    toast({ title: "Configurações salvas com sucesso!" });
  };


  const toolItems = [
    { title: "Agenda Oficial", description: "Gerencie compromissos e eventos", icon: CalendarDays, url: "/agenda" },
    { title: "Assistente Legislativo", description: "IA para projetos de lei e consultas", icon: Bot, url: "/assistente" },
    { title: "Aniversários", description: "Gestão de aniversários dos eleitores", icon: Cake, url: "/aniversarios" },
    ...(role === "politico" ? [{ title: "Assessores", description: "Gerencie seus assessores", icon: UserCheck, url: "/assessores" }] : []),
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">Gerencie preferências e acesse ferramentas.</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Ferramentas</CardTitle>
          <p className="text-sm text-muted-foreground">Acesse recursos adicionais do gabinete.</p>
        </CardHeader>
        <CardContent className="space-y-1 p-2">
          {toolItems.map((item) => (
            <button
              key={item.url}
              onClick={() => navigate(item.url)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-secondary/50 transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                <item.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </CardContent>
      </Card>

      <GoogleCalendarConnect />

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
