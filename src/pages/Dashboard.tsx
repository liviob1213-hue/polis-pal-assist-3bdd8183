import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trophy, Clock, CheckCircle2, Users, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const monthlyData = [
  { name: "Jan", value: 12 }, { name: "Fev", value: 19 },
  { name: "Mar", value: 45 }, { name: "Abr", value: 52 },
  { name: "Mai", value: 68 }, { name: "Jun", value: 85 },
  { name: "Jul", value: 102 },
];

const bairroData = [
  { name: "Jan", value: 25 }, { name: "Fev", value: 40 },
  { name: "Mar", value: 55 }, { name: "Abr", value: 70 },
  { name: "Mai", value: 95 }, { name: "Jun", value: 130 },
];

const teamData = [
  { name: "Jan", value: 120 }, { name: "Fev", value: 200 },
  { name: "Mar", value: 380 }, { name: "Abr", value: 500 },
  { name: "Mai", value: 620 }, { name: "Jun", value: 850 },
];

const stats = [
  { label: "Demandas Abertas", value: "24", icon: TrendingUp, color: "text-info" },
  { label: "Eleitores Ativos", value: "1.247", icon: Users, color: "text-success" },
  { label: "Tarefas Pendentes", value: "8", icon: Clock, color: "text-warning" },
  { label: "Resolvidas este mês", value: "42", icon: CheckCircle2, color: "text-success" },
];

const agendaItems = [
  { title: "Reunião com Secretário de Obras", type: "Reunião", time: "09:00" },
  { title: "Sessão Plenária Ordinária", type: "Sessão", time: "14:00" },
];

const tarefasPendentes = [
  { title: "Preparar discurso da sessão", priority: "Alta Prioridade" },
  { title: "Reunião de alinhamento com equipe", priority: "Normal", status: "Em andamento" },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel de Controle</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral do gabinete</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-accent text-accent gap-1.5 px-3 py-1.5">
            <Trophy className="h-3.5 w-3.5" />
            Ranking: 20%
          </Badge>
          <Button onClick={() => navigate("/demandas")} className="gradient-primary text-primary-foreground gap-2 shadow-[var(--shadow-md)]">
            <Plus className="h-4 w-4" /> Nova Demanda
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="glass-card">
            <CardContent className="flex items-center gap-3 md:gap-4 p-4 md:p-5">
              <div className={`p-2 md:p-2.5 rounded-xl bg-secondary ${stat.color}`}>
                <stat.icon className="h-4 w-4 md:h-5 md:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{stat.value}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground truncate">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Charts + Quick View */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
        <div className="xl:col-span-2 space-y-4 md:space-y-6">
          <motion.div variants={item}>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold">Desempenho Mensal</CardTitle>
                <Badge variant="secondary" className="text-xs">Este Mês</Badge>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))", r: 4 }} activeDot={{ r: 6, fill: "hsl(var(--accent))" }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Atendimentos por Bairro</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={bairroData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                    <Bar dataKey="value" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Tarefas da Equipe</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={teamData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                    <Bar dataKey="value" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div variants={item} className="space-y-4 md:space-y-6">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Agenda do Dia</CardTitle>
                <Button variant="link" size="sm" className="text-accent p-0 h-auto text-xs" onClick={() => navigate("/agenda")}>Ver tudo</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {agendaItems.map((event) => (
                <div key={event.title} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-bold text-primary">{event.time}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    <Badge variant="secondary" className="text-[10px] mt-1">{event.type}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Tarefas Pendentes</CardTitle>
                <Button variant="link" size="sm" className="text-accent p-0 h-auto text-xs" onClick={() => navigate("/tarefas")}>Kanban</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {tarefasPendentes.map((tarefa) => (
                <div key={tarefa.title} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                  <div className="mt-0.5 h-4 w-4 rounded border-2 border-muted-foreground/30 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{tarefa.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={tarefa.priority === "Alta Prioridade" ? "destructive" : "secondary"} className="text-[10px]">{tarefa.priority}</Badge>
                      {tarefa.status && (
                        <Badge variant="outline" className="text-[10px] border-info text-info">{tarefa.status}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
