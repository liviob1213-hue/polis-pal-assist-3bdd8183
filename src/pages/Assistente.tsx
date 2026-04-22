import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Sparkles, Loader2, Download, Plus, MessageSquare, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import jsPDF from "jspdf";
import { BRAND, drawCover, drawHeader, drawFooter, getLogoDataUrl } from "@/lib/pdfBranding";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
}

interface Sessao {
  sessao_id: string;
  titulo: string;
  ultima: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Olá! Sou seu **Assistente Legislativo Especialista**. Posso ajudar com:\n\n1. Redação de **Projetos de Lei**\n2. **Discursos** parlamentares\n3. **Indicações** e **Requerimentos**\n4. Análise jurídica de proposições\n5. **Ofícios** e documentos oficiais\n6. **Lei Orgânica** municipal\n\nSobre o que gostaria de trabalhar hoje? Toda resposta gerada pode ser baixada em **PDF**.",
};

function detectarTipo(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes("lei orgânica") || t.includes("lei organica")) return "lei_organica";
  if (t.includes("projeto de lei")) return "projeto_lei";
  if (t.includes("discurso")) return "discurso";
  if (t.includes("ofício") || t.includes("oficio")) return "oficio";
  if (t.includes("requerimento")) return "requerimento";
  if (t.includes("indicação") || t.includes("indicacao")) return "indicacao";
  return "livre";
}

function tipoLabel(tipo: string): string {
  const map: Record<string, string> = {
    projeto_lei: "PROJETO DE LEI",
    lei_organica: "LEI ORGÂNICA",
    discurso: "DISCURSO PARLAMENTAR",
    oficio: "OFÍCIO",
    requerimento: "REQUERIMENTO",
    indicacao: "INDICAÇÃO",
    livre: "DOCUMENTO LEGISLATIVO",
  };
  return map[tipo] || "DOCUMENTO LEGISLATIVO";
}

async function gerarPDFDocumento(titulo: string, conteudo: string, tipo = "livre") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margem = 56;
  const larguraUtil = w - margem * 2;
  const logo = await getLogoDataUrl();

  // === CAPA ===
  drawCover(doc, {
    titulo,
    subtitulo: "Documento elaborado pelo Assistente Legislativo Democrat.IA",
    logo,
    etiqueta: tipoLabel(tipo),
  });

  // === CONTEÚDO ===
  doc.addPage();
  drawHeader(doc, { logo, titulo: tipoLabel(tipo) });
  let y = 80;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...BRAND.ink);
  const tituloLines = doc.splitTextToSize(titulo, larguraUtil);
  doc.text(tituloLines, margem, y);
  y += tituloLines.length * 22 + 6;

  // Linha decorativa
  doc.setDrawColor(...BRAND.crimson);
  doc.setLineWidth(2);
  doc.line(margem, y, margem + 60, y);
  y += 24;

  // Renderização do markdown simplificado
  const linhas = conteudo.split("\n");
  for (const linha of linhas) {
    const trimmed = linha.trim();

    if (y > h - 80) {
      doc.addPage();
      drawHeader(doc, { logo, titulo: tipoLabel(tipo) });
      y = 80;
    }

    if (!trimmed) { y += 8; continue; }

    // H1
    if (/^#\s+/.test(trimmed)) {
      const txt = trimmed.replace(/^#\s+/, "");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(...BRAND.teal);
      const lines = doc.splitTextToSize(txt, larguraUtil);
      doc.text(lines, margem, y);
      y += lines.length * 18 + 6;
      continue;
    }
    // H2
    if (/^##\s+/.test(trimmed)) {
      const txt = trimmed.replace(/^##\s+/, "");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...BRAND.ink);
      const lines = doc.splitTextToSize(txt, larguraUtil);
      doc.text(lines, margem, y);
      y += lines.length * 16 + 4;
      continue;
    }
    // H3
    if (/^###\s+/.test(trimmed)) {
      const txt = trimmed.replace(/^###\s+/, "");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...BRAND.tealDark);
      const lines = doc.splitTextToSize(txt, larguraUtil);
      doc.text(lines, margem, y);
      y += lines.length * 14 + 3;
      continue;
    }
    // Lista
    if (/^[-*]\s+/.test(trimmed)) {
      const txt = trimmed.replace(/^[-*]\s+/, "").replace(/\*\*(.*?)\*\*/g, "$1");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...BRAND.text);
      doc.setFillColor(...BRAND.crimson);
      doc.circle(margem + 6, y - 4, 2, "F");
      const lines = doc.splitTextToSize(txt, larguraUtil - 18);
      doc.text(lines, margem + 16, y);
      y += lines.length * 14 + 2;
      continue;
    }
    // Citação artigos / Art.
    if (/^Art\.?\s*\d+/i.test(trimmed)) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...BRAND.ink);
      const lines = doc.splitTextToSize(trimmed.replace(/\*\*(.*?)\*\*/g, "$1"), larguraUtil);
      doc.text(lines, margem, y);
      y += lines.length * 14 + 4;
      continue;
    }
    // Parágrafo normal
    const txt = trimmed
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...BRAND.text);
    const lines = doc.splitTextToSize(txt, larguraUtil);
    for (const line of lines) {
      if (y > h - 80) {
        doc.addPage();
        drawHeader(doc, { logo, titulo: tipoLabel(tipo) });
        y = 80;
      }
      doc.text(line, margem, y);
      y += 15;
    }
    y += 4;
  }

  drawFooter(doc, doc.getNumberOfPages());

  const slug = titulo.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60);
  doc.save(`${slug || "documento"}.pdf`);
}

const Assistente = () => {
  const location = useLocation();
  const { user } = useAuth();
  const prefill = (location.state as any)?.prefill;
  const { toast } = useToast();

  const [sessaoId, setSessaoId] = useState<string>(() => crypto.randomUUID());
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState(prefill || "");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  // Carregar sessões salvas
  const carregarSessoes = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("assistente_historico")
      .select("sessao_id, conteudo, created_at, role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (!data) return;
    const map = new Map<string, Sessao>();
    for (const r of data) {
      if (!map.has(r.sessao_id) && r.role === "user") {
        map.set(r.sessao_id, {
          sessao_id: r.sessao_id,
          titulo: r.conteudo.slice(0, 60),
          ultima: r.created_at,
        });
      }
    }
    setSessoes(Array.from(map.values()));
  };

  useEffect(() => {
    carregarSessoes();
  }, [user]);

  const carregarSessao = async (sid: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("assistente_historico")
      .select("*")
      .eq("user_id", user.id)
      .eq("sessao_id", sid)
      .order("created_at", { ascending: true });
    if (!data) return;
    setSessaoId(sid);
    setMessages([
      WELCOME,
      ...data.map((d) => ({ id: d.id, role: d.role as "user" | "assistant", content: d.conteudo })),
    ]);
  };

  const novaConversa = () => {
    setSessaoId(crypto.randomUUID());
    setMessages([WELCOME]);
    setInput("");
  };

  const apagarSessao = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (!confirm("Apagar esta conversa?")) return;
    await supabase.from("assistente_historico").delete().eq("user_id", user.id).eq("sessao_id", sid);
    if (sid === sessaoId) novaConversa();
    carregarSessoes();
  };

  const salvarMensagem = async (role: "user" | "assistant", conteudo: string, tipo = "livre") => {
    if (!user) {
      console.warn("[Assistente] Não foi possível salvar — usuário não autenticado");
      return;
    }
    const { error } = await supabase.from("assistente_historico").insert({
      user_id: user.id,
      sessao_id: sessaoId,
      role,
      conteudo,
      tipo_documento: tipo,
    });
    if (error) {
      console.error("[Assistente] Erro ao salvar histórico:", error);
      toast({
        title: "Histórico não salvo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: userText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const tipoDoc = detectarTipo(userText);
    await salvarMensagem("user", userText, tipoDoc);

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${resp.status}`);
      }
      if (!resp.body) throw new Error("Sem resposta do servidor");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.id.startsWith("ai-")) {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { id: "ai-" + Date.now(), role: "assistant", content: assistantSoFar }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (assistantSoFar) {
        salvarMensagem("assistant", assistantSoFar, tipoDoc);
        carregarSessoes();
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao se comunicar com o assistente", description: e.message, variant: "destructive" });
      if (!assistantSoFar) {
        setMessages((prev) => [
          ...prev,
          { id: "err-" + Date.now(), role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const baixarPDF = async (msg: Message) => {
    const linhas = msg.content.split("\n").filter((l) => l.trim());
    let titulo = "Documento Legislativo";
    const primeira = linhas[0]?.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
    if (primeira && primeira.length < 120) titulo = primeira;
    // Detecta tipo a partir da última pergunta do usuário ou do próprio conteúdo
    const ultUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const tipo = detectarTipo(ultUser + " " + msg.content);
    try {
      await gerarPDFDocumento(titulo, msg.content, tipo);
      toast({ title: "PDF gerado", description: "Documento estilizado baixado com sucesso." });
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e.message, variant: "destructive" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3 sm:space-y-4 h-[calc(100vh-6.5rem)] sm:h-[calc(100vh-8rem)] flex flex-col"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Assistente Legislativo</h1>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            IA especializada em redação parlamentar. Histórico salvo automaticamente.
          </p>
        </div>
        <Button onClick={novaConversa} variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nova conversa
        </Button>
      </div>

      <div className="flex-1 flex gap-3 overflow-hidden">
        {/* Sidebar de sessões */}
        <Card className="glass-card hidden md:flex flex-col w-64 shrink-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Histórico</span>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {sessoes.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-3">Nenhuma conversa ainda.</p>
              )}
              {sessoes.map((s) => (
                <button
                  key={s.sessao_id}
                  onClick={() => carregarSessao(s.sessao_id)}
                  className={`group w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-start gap-2 ${
                    s.sessao_id === sessaoId
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-secondary text-foreground/80"
                  }`}
                >
                  <span className="flex-1 line-clamp-2">{s.titulo}</span>
                  <Trash2
                    onClick={(e) => apagarSessao(s.sessao_id, e)}
                    className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0 mt-0.5"
                  />
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Chat */}
        <Card className="glass-card flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">
              IA Online — toda resposta pode ser baixada em PDF
            </span>
          </div>

          <ScrollArea className="flex-1 p-3 sm:p-4 md:p-5" ref={scrollRef}>
            <div className="space-y-4 max-w-3xl mx-auto">
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg gradient-primary flex items-center justify-center shrink-0 mt-1">
                        <Bot className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                    <div
                      className={`max-w-[90%] sm:max-w-[85%] md:max-w-[80%] rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-secondary text-secondary-foreground rounded-bl-md"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <>
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_p]:my-1">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                          {msg.id !== "welcome" && msg.content.length > 80 && (
                            <div className="mt-2 pt-2 border-t border-border/40 flex justify-end">
                              <Button
                                onClick={() => baixarPDF(msg)}
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1.5 text-xs"
                              >
                                <Download className="h-3.5 w-3.5" /> Baixar PDF
                              </Button>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-accent flex items-center justify-center shrink-0 mt-1">
                        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent-foreground" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && !messages[messages.length - 1]?.id.startsWith("ai-") && (
                <div className="flex gap-3 items-start">
                  <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-2 sm:p-3 md:p-4 border-t border-border">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2 max-w-3xl mx-auto"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex.: Elabore um projeto de lei sobre... ou Redija a lei orgânica de..."
                className="flex-1 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/20"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                className="gradient-primary text-primary-foreground shrink-0"
                disabled={isLoading || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </motion.div>
  );
};

export default Assistente;
