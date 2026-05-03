import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileBarChart, Download, Users, FileText, CheckSquare, CalendarDays, Cake, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BRAND, drawCover, drawHeader, drawFooter, drawSectionTitle, getLogoDataUrl } from "@/lib/pdfBranding";
import { renderChartToDataUrl } from "@/lib/chartImage";

interface ResumoData {
  inicio: Date;
  fim: Date;
  rotuloMes: string;
  eleitores: any[];
  demandas: any[];
  demandasResolvidas: any[];
  tarefas: any[];
  tarefasConcluidas: any[];
  agenda: any[];
  aniversariantes: any[];
  topInteresses: { interesse: string; total: number }[];
}

function inicioMesAtual() {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0);
}
function fimMesAtual() {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
}

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ResumoMensal = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [data, setData] = useState<ResumoData | null>(null);

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setLoading(true);
    const inicio = inicioMesPassado();
    const fim = fimMesPassado();
    const inicioIso = inicio.toISOString();
    const fimIso = fim.toISOString();

    const [
      { data: eleitores },
      { data: demandas },
      { data: demandasResolvidas },
      { data: tarefas },
      { data: tarefasConcluidas },
      { data: agenda },
      { data: aniversariantes },
    ] = await Promise.all([
      supabase.from("eleitores").select("*").gte("created_at", inicioIso).lte("created_at", fimIso),
      supabase.from("demandas").select("*").gte("created_at", inicioIso).lte("created_at", fimIso),
      supabase.from("demandas").select("*").eq("status", "Resolvida").gte("updated_at", inicioIso).lte("updated_at", fimIso),
      supabase.from("tarefas").select("*").gte("created_at", inicioIso).lte("created_at", fimIso),
      supabase.from("tarefas").select("*").eq("status", "Concluído").gte("updated_at", inicioIso).lte("updated_at", fimIso),
      supabase.from("agenda").select("*").gte("data_hora", inicioIso).lte("data_hora", fimIso),
      supabase.from("eleitores").select("*").not("data_nascimento", "is", null),
    ]);

    // Aniversariantes do mês passado
    const mesAlvo = inicio.getMonth() + 1;
    const anivMes = (aniversariantes || []).filter((e: any) => {
      if (!e.data_nascimento) return false;
      const m = parseInt(e.data_nascimento.split("-")[1], 10);
      return m === mesAlvo;
    });

    // Top interesses dos eleitores cadastrados no mês
    const contInt: Record<string, number> = {};
    (eleitores || []).forEach((e: any) => {
      const i = (e.interesse || "Não informado").trim();
      contInt[i] = (contInt[i] || 0) + 1;
    });
    const topInteresses = Object.entries(contInt)
      .map(([interesse, total]) => ({ interesse, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    setData({
      inicio,
      fim,
      rotuloMes: `${NOMES_MES[inicio.getMonth()]} de ${inicio.getFullYear()}`,
      eleitores: eleitores || [],
      demandas: demandas || [],
      demandasResolvidas: demandasResolvidas || [],
      tarefas: tarefas || [],
      tarefasConcluidas: tarefasConcluidas || [],
      agenda: agenda || [],
      aniversariantes: anivMes,
      topInteresses,
    });
    setLoading(false);
  };

  const gerarPDF = async () => {
    if (!data) return;
    setGerandoPDF(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      const margem = 40;
      const logo = await getLogoDataUrl();

      // ============ CAPA ============
      drawCover(doc, {
        titulo: `Resumo Mensal`,
        subtitulo: data.rotuloMes,
        logo,
        etiqueta: "RELATÓRIO EXECUTIVO",
      });

      // ============ PÁGINA 2: SUMÁRIO EXECUTIVO ============
      doc.addPage();
      drawHeader(doc, { logo, titulo: `Resumo Mensal · ${data.rotuloMes}` });
      let y = 80;
      y = drawSectionTitle(doc, y, "01", "Sumário Executivo");

      // Cards de KPI
      const kpis = [
        { label: "Eleitores cadastrados", value: data.eleitores.length, color: BRAND.teal },
        { label: "Demandas abertas", value: data.demandas.length, color: BRAND.crimson },
        { label: "Demandas resolvidas", value: data.demandasResolvidas.length, color: BRAND.teal },
        { label: "Tarefas criadas", value: data.tarefas.length, color: BRAND.crimson },
        { label: "Tarefas concluídas", value: data.tarefasConcluidas.length, color: BRAND.teal },
        { label: "Eventos na agenda", value: data.agenda.length, color: BRAND.crimson },
        { label: "Aniversariantes", value: data.aniversariantes.length, color: BRAND.teal },
        { label: "Taxa de resolução", value: `${data.demandas.length ? Math.round((data.demandasResolvidas.length / data.demandas.length) * 100) : 0}%`, color: BRAND.crimson },
      ];

      const cardW = (w - margem * 2 - 24) / 4;
      const cardH = 70;
      kpis.forEach((kpi, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = margem + col * (cardW + 8);
        const cy = y + row * (cardH + 8);
        // sombra suave
        doc.setFillColor(...BRAND.bg);
        doc.roundedRect(x + 1, cy + 1, cardW, cardH, 8, 8, "F");
        // card
        doc.setFillColor(...BRAND.white);
        doc.setDrawColor(...BRAND.tealLight);
        doc.roundedRect(x, cy, cardW, cardH, 8, 8, "FD");
        // barra colorida lateral
        doc.setFillColor(...kpi.color);
        doc.roundedRect(x, cy, 4, cardH, 2, 2, "F");
        // valor
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(...BRAND.ink);
        doc.text(String(kpi.value), x + 14, cy + 32);
        // label
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...BRAND.muted);
        const lbl = doc.splitTextToSize(kpi.label, cardW - 18);
        doc.text(lbl, x + 14, cy + 50);
      });
      y += Math.ceil(kpis.length / 4) * (cardH + 8) + 16;

      // Insight em destaque
      const taxaResol = data.demandas.length
        ? Math.round((data.demandasResolvidas.length / data.demandas.length) * 100)
        : 0;
      doc.setFillColor(...BRAND.tealLight);
      doc.roundedRect(margem, y, w - margem * 2, 50, 8, 8, "F");
      doc.setFillColor(...BRAND.crimson);
      doc.roundedRect(margem, y, 4, 50, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...BRAND.crimson);
      doc.text("DESTAQUE DO PERÍODO", margem + 14, y + 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...BRAND.ink);
      const destaque = `${data.eleitores.length} novos eleitores cadastrados, ${data.demandasResolvidas.length} demandas resolvidas (${taxaResol}% de taxa de resolução) e ${data.tarefasConcluidas.length} tarefas concluídas em ${data.rotuloMes}.`;
      const dlines = doc.splitTextToSize(destaque, w - margem * 2 - 24);
      doc.text(dlines, margem + 14, y + 34);
      y += 70;

      // ============ PÁGINA 3: GRÁFICOS ============
      doc.addPage();
      drawHeader(doc, { logo, titulo: `Resumo Mensal · ${data.rotuloMes}` });
      y = 80;
      y = drawSectionTitle(doc, y, "02", "Visão Analítica");

      // Gráfico 1: Comparativo Geral
      const chart1 = await renderChartToDataUrl({
        type: "bar",
        title: "Atividade do mês",
        labels: ["Eleitores", "Demandas", "Resolvidas", "Tarefas", "Concluídas", "Eventos"],
        data: [
          data.eleitores.length,
          data.demandas.length,
          data.demandasResolvidas.length,
          data.tarefas.length,
          data.tarefasConcluidas.length,
          data.agenda.length,
        ],
        colors: ["#449895", "#D2264F", "#449895", "#D2264F", "#449895", "#D2264F"],
      });
      doc.addImage(chart1, "PNG", margem, y, w - margem * 2, 220);
      y += 240;

      // Gráfico 2: Top Interesses (donut) — se houver
      if (data.topInteresses.length) {
        const top = data.topInteresses.slice(0, 6);
        const chart2 = await renderChartToDataUrl({
          type: "doughnut",
          title: "Principais interesses dos novos eleitores",
          labels: top.map((i) => i.interesse),
          data: top.map((i) => i.total),
        });
        if (y + 240 > h - 50) {
          doc.addPage();
          drawHeader(doc, { logo, titulo: `Resumo Mensal · ${data.rotuloMes}` });
          y = 80;
        }
        doc.addImage(chart2, "PNG", margem, y, w - margem * 2, 220);
        y += 240;
      }

      // ============ DETALHAMENTO ============
      const ensure = (need: number) => {
        if (y + need > h - 60) {
          doc.addPage();
          drawHeader(doc, { logo, titulo: `Resumo Mensal · ${data.rotuloMes}` });
          y = 80;
        }
      };

      const tableTheme = {
        theme: "grid" as const,
        headStyles: {
          fillColor: BRAND.teal,
          textColor: 255,
          fontStyle: "bold" as const,
          fontSize: 10,
        },
        bodyStyles: { fontSize: 9, textColor: [55, 70, 75] as [number, number, number] },
        alternateRowStyles: { fillColor: [248, 250, 250] as [number, number, number] },
        margin: { left: margem, right: margem },
      };

      let secNum = 3;
      const fmtSec = () => String(secNum++).padStart(2, "0");

      // Eleitores
      if (data.eleitores.length) {
        doc.addPage();
        drawHeader(doc, { logo, titulo: `Resumo Mensal · ${data.rotuloMes}` });
        y = 80;
        y = drawSectionTitle(doc, y, fmtSec(), `Eleitores Cadastrados (${data.eleitores.length})`);
        autoTable(doc, {
          ...tableTheme,
          startY: y,
          head: [["Nome", "Telefone", "Interesse", "Cadastro"]],
          body: data.eleitores.map((e: any) => [
            e.nome || "-",
            e.telefone || "-",
            e.interesse || "-",
            new Date(e.created_at).toLocaleDateString("pt-BR"),
          ]),
        });
        y = (doc as any).lastAutoTable.finalY + 20;
      }

      // Top interesses
      if (data.topInteresses.length) {
        ensure(120);
        y = drawSectionTitle(doc, y, fmtSec(), "Principais Interesses");
        autoTable(doc, {
          ...tableTheme,
          startY: y,
          head: [["Interesse", "Quantidade"]],
          body: data.topInteresses.map((i) => [i.interesse, String(i.total)]),
          headStyles: { ...tableTheme.headStyles, fillColor: BRAND.crimson },
        });
        y = (doc as any).lastAutoTable.finalY + 20;
      }

      // Demandas
      if (data.demandas.length) {
        ensure(140);
        y = drawSectionTitle(doc, y, fmtSec(), `Demandas do Mês (${data.demandas.length})`);
        autoTable(doc, {
          ...tableTheme,
          startY: y,
          head: [["Título", "Status", "Local", "Aberta em"]],
          body: data.demandas.map((d: any) => [
            d.titulo || "-",
            d.status || "-",
            d.localizacao || "-",
            new Date(d.created_at).toLocaleDateString("pt-BR"),
          ]),
        });
        y = (doc as any).lastAutoTable.finalY + 20;
      }

      // Tarefas concluídas
      if (data.tarefasConcluidas.length) {
        ensure(140);
        y = drawSectionTitle(doc, y, fmtSec(), `Tarefas Concluídas (${data.tarefasConcluidas.length})`);
        autoTable(doc, {
          ...tableTheme,
          startY: y,
          head: [["Título", "Concluída em"]],
          body: data.tarefasConcluidas.map((t: any) => [
            t.titulo || "-",
            new Date(t.updated_at).toLocaleDateString("pt-BR"),
          ]),
        });
        y = (doc as any).lastAutoTable.finalY + 20;
      }

      // Agenda
      if (data.agenda.length) {
        ensure(140);
        y = drawSectionTitle(doc, y, fmtSec(), `Eventos na Agenda (${data.agenda.length})`);
        autoTable(doc, {
          ...tableTheme,
          startY: y,
          head: [["Evento", "Data/Hora"]],
          body: data.agenda.map((a: any) => [
            a.titulo || "-",
            new Date(a.data_hora).toLocaleString("pt-BR"),
          ]),
        });
        y = (doc as any).lastAutoTable.finalY + 20;
      }

      // Aniversariantes
      if (data.aniversariantes.length) {
        ensure(140);
        y = drawSectionTitle(doc, y, fmtSec(), `Aniversariantes (${data.aniversariantes.length})`);
        autoTable(doc, {
          ...tableTheme,
          startY: y,
          head: [["Nome", "Data de Nascimento", "Telefone"]],
          body: data.aniversariantes.map((a: any) => [
            a.nome || "-",
            a.data_nascimento ? new Date(a.data_nascimento + "T12:00:00").toLocaleDateString("pt-BR") : "-",
            a.telefone || "-",
          ]),
          headStyles: { ...tableTheme.headStyles, fillColor: BRAND.crimson },
        });
      }

      drawFooter(doc, doc.getNumberOfPages());
      doc.save(`resumo-${data.rotuloMes.toLowerCase().replace(/\s/g, "-")}.pdf`);
      toast({ title: "PDF gerado", description: "Resumo mensal estilizado baixado com sucesso." });
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e.message, variant: "destructive" });
    } finally {
      setGerandoPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    { label: "Eleitores cadastrados", value: data.eleitores.length, icon: Users, color: "text-primary" },
    { label: "Demandas abertas", value: data.demandas.length, icon: FileText, color: "text-accent" },
    { label: "Demandas resolvidas", value: data.demandasResolvidas.length, icon: FileText, color: "text-success" },
    { label: "Tarefas criadas", value: data.tarefas.length, icon: CheckSquare, color: "text-primary" },
    { label: "Tarefas concluídas", value: data.tarefasConcluidas.length, icon: CheckSquare, color: "text-success" },
    { label: "Eventos na agenda", value: data.agenda.length, icon: CalendarDays, color: "text-accent" },
    { label: "Aniversariantes", value: data.aniversariantes.length, icon: Cake, color: "text-accent" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <FileBarChart className="h-6 w-6 text-accent" />
            <h1 className="text-2xl font-bold tracking-tight">Resumo Mensal</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Tudo que aconteceu em <strong>{data.rotuloMes}</strong>. Baixe o relatório completo em PDF.
          </p>
        </div>
        <Button onClick={gerarPDF} disabled={gerandoPDF} className="gradient-primary text-primary-foreground gap-2">
          {gerandoPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar PDF Completo
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="glass-card p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" /> Top interesses
          </h3>
          {data.topInteresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum eleitor cadastrado no período.</p>
          ) : (
            <div className="space-y-2">
              {data.topInteresses.map((i) => (
                <div key={i.interesse} className="flex items-center justify-between text-sm">
                  <span className="truncate">{i.interesse}</span>
                  <Badge variant="secondary">{i.total}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="glass-card p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Últimas demandas resolvidas
          </h3>
          {data.demandasResolvidas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma demanda resolvida no período.</p>
          ) : (
            <div className="space-y-2">
              {data.demandasResolvidas.slice(0, 6).map((d: any) => (
                <div key={d.id} className="text-sm border-l-2 border-success pl-3 py-1">
                  <p className="font-medium truncate">{d.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
};

export default ResumoMensal;
