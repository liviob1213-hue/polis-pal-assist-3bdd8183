import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, CheckCircle2, Users, TrendingUp, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function groupByMonth(rows: { created_at: string }[]) {
  const counts: Record<string, number> = {};
  rows.forEach((r) => {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  return sorted.map(([key, value]) => ({
    name: MONTH_NAMES[parseInt(key.split("-")[1])],
    value,
  }));
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ demandas: 0, eleitores: 0, tarefasPendentes: 0, tarefasFinalizadas: 0 });
  const [demandasChart, setDemandasChart] = useState<{ name: string; value: number }[]>([]);
  const [eleitoresChart, setEleitoresChart] = useState<{ name: string; value: number }[]>([]);
  const [agendaItems, setAgendaItems] = useState<{ titulo: string; data_hora: string }[]>([]);
  const [tarefasPendentes, setTarefasPendentes] = useState<{ id: string; titulo: string; status: string }[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      const [demRes, eleRes, tarRes, agendaRes] = await Promise.all([
        supabase.from("demandas").select("id, status, created_at"),
        supabase.from("eleitores").select("id, created_at"),
        supabase.from("tarefas").select("id, titulo, status, created_at"),
        supabase.from("agenda").select("titulo, data_hora").gte("data_hora", new Date().toISOString().split("T")[0]).order("data_hora", { ascending: true }).limit(5),
      ]);

      const demandas = demRes.data || [];
      const eleitores = eleRes.data || [];
      const tarefas = tarRes.data || [];
      const agenda = agendaRes.data || [];

      const abertas = demandas.filter((d) => d.status !== "Resolvida" && d.status !== "Finalizada").length;
      const pendentes = tarefas.filter((t) => t.status !== "Finalizadas");
      const finalizadas = tarefas.filter((t) => t.status === "Finalizadas").length;

      setStats({ demandas: abertas, eleitores: eleitores.length, tarefasPendentes: pendentes.length, tarefasFinalizadas: finalizadas });
      setDemandasChart(groupByMonth(demandas));
      setEleitoresChart(groupByMonth(eleitores));
      setAgendaItems(agenda);
      setTarefasPendentes(pendentes.slice(0, 5));
    };

    fetchAll();
  }, []);

  const statCards = [
    { label: "Demandas Abertas", value: stats.demandas.toString(), icon: TrendingUp, color: "text-info" },
    { label: "Eleitores Cadastrados", value: stats.eleitores.toString(), icon: Users, color: "text-success" },
    { label: "Tarefas Pendentes", value: stats.tarefasPendentes.toString(), icon: Clock, color: "text-warning" },
    { label: "Tarefas Finalizadas", value: stats.tarefasFinalizadas.toString(), icon: CheckCircle2, color: "text-success" },
  ];

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Painel de Controle</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Visão geral do gabinete</p>
        </div>
        <Button onClick={() => navigate("/demandas")} size="sm" className="gradient-primary text-primary-foreground gap-1.5 sm:gap-2 shadow-[var(--shadow-md)] text-xs sm:text-sm">
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Nova Demanda
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="glass-card">
            <CardContent className="flex items-center gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 md:p-5">
              <div className={`p-1.5 sm:p-2 md:p-2.5 rounded-lg sm:rounded-xl bg-secondary ${stat.color}`}>
                <stat.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl md:text-2xl font-bold">{stat.value}</p>
                <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground truncate">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Charts + Quick View */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
        <div className="xl:col-span-2 space-y-4 md:space-y-6">
          <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Demandas por Mês</CardTitle></CardHeader>
              <CardContent>
                {demandasChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={demandasChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                      <Bar dataKey="value" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-10">Nenhuma demanda registrada</p>
                )}
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Eleitores por Mês</CardTitle></CardHeader>
              <CardContent>
                {eleitoresChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={eleitoresChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                      <Bar dataKey="value" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-10">Nenhum eleitor registrado</p>
                )}
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
              {agendaItems.length > 0 ? agendaItems.map((event) => (
                <div key={event.titulo + event.data_hora} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-bold text-primary">{formatTime(event.data_hora)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{event.titulo}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento hoje</p>
              )}
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
              {tarefasPendentes.length > 0 ? tarefasPendentes.map((tarefa) => (
                <div key={tarefa.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                  <div className="mt-0.5 h-4 w-4 rounded border-2 border-muted-foreground/30 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{tarefa.titulo}</p>
                    <Badge variant="secondary" className="text-[10px] mt-1">{tarefa.status}</Badge>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa pendente</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
