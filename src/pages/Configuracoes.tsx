import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Bot, CalendarDays, ChevronRight, UserCheck, Cake, Lock, MessageCircle, CheckSquare, BookOpen, MessageSquare, FileBarChart, CalendarCheck, GraduationCap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import GoogleCalendarConnect from "@/components/GoogleCalendarConnect";
import { FEATURE_COPY, LockableFeature, upgradeWhatsAppLink } from "@/config/planFeatures";

const Configuracoes = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { role, user, isLite } = useAuth();

  const storageKey = user ? `perfil_parlamentar_${user.id}` : null;

  const [form, setForm] = useState({ nome: "", partido: "", email: "" });

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const p = JSON.parse(saved);
        setForm({ nome: p.nome ?? "", partido: p.partido ?? "", email: p.email ?? user?.email ?? "" });
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
      JSON.stringify({ ...form, notifDemandas: true, notifRelatorio: true }),
    );
    toast({ title: "Configurações salvas com sucesso!" });
  };

  const toolItems: { title: string; description: string; icon: any; url: string; feature?: LockableFeature }[] = [
    { title: "Tutoriais", description: "Vídeos e guias de uso da ferramenta", icon: GraduationCap, url: "/tutoriais" },
    { title: "Agenda Oficial", description: "Gerencie compromissos e eventos", icon: CalendarDays, url: "/agenda", feature: "agenda" },
    { title: "Assistente Legislativo", description: "IA para projetos de lei e consultas", icon: Bot, url: "/assistente", feature: "assistente" },
    { title: "Aniversários", description: "Gestão de aniversários dos eleitores", icon: Cake, url: "/aniversarios" },
    ...(role === "politico"
      ? [{ title: "Assessores", description: "Gerencie seus assessores", icon: UserCheck, url: "/assessores", feature: "assessores" as LockableFeature }]
      : []),
  ];

  const lockedList: { icon: any; feature: LockableFeature }[] = [
    { icon: CalendarDays, feature: "agenda" },
    { icon: Bot, feature: "assistente" },
    { icon: CheckSquare, feature: "tarefas" },
    { icon: BookOpen, feature: "base-conhecimento" },
    { icon: MessageSquare, feature: "historico-conversas" },
    { icon: FileBarChart, feature: "resumo-mensal" },
    { icon: UserCheck, feature: "assessores" },
    { icon: CalendarCheck, feature: "google-agenda" },
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
          {toolItems.map((item) => {
            const locked = isLite && !!item.feature;
            return (
              <button
                key={item.url}
                onClick={() => navigate(item.url)}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] rounded-lg hover:bg-secondary/50 transition-colors text-left"
              >
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${locked ? "bg-secondary" : "gradient-primary"}`}>
                  <item.icon className={`h-5 w-5 ${locked ? "text-muted-foreground" : "text-primary-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    {item.title}
                    {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {locked ? "Disponível na versão completa" : item.description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </CardContent>
      </Card>

      {isLite ? (
        <Card className="glass-card border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              Google Agenda
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Espelhe automaticamente os compromissos do gabinete no Google Agenda do seu celular.
            </p>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold"
            >
              <a href={upgradeWhatsAppLink("Google Agenda")} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-5 w-5" />
                Liberar agora no WhatsApp
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <GoogleCalendarConnect />
      )}

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

      <Button onClick={handleSave} className="w-full sm:w-auto h-12 gradient-primary text-primary-foreground shadow-[var(--shadow-md)]">
        Salvar Alterações
      </Button>

      {isLite && (
        <Card className="glass-card border-primary/40">
          <CardHeader>
            <CardTitle className="text-lg">Libere a versão completa</CardTitle>
            <p className="text-sm text-muted-foreground">
              Você está usando a versão Lite. Estas funções ainda estão travadas na sua conta:
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {lockedList.map(({ icon: Icon, feature }) => (
                <li key={feature} className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2.5">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1">{FEATURE_COPY[feature].nome}</span>
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                </li>
              ))}
            </ul>

            <div className="rounded-xl bg-secondary/60 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Libere todas elas de uma vez.
              </p>
            </div>

            <Button
              asChild
              className="w-full h-14 rounded-xl gradient-primary text-base font-semibold text-primary-foreground shadow-[var(--shadow-md)]"
            >
              <a href={upgradeWhatsAppLink()} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-5 w-5" />
                Liberar agora no WhatsApp
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};

export default Configuracoes;
