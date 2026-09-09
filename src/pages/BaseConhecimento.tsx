import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BookOpen, Upload, FileText, Trash2, Loader2, Brain, CheckCircle2, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://aecwbjydyoxkonqbkfft.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlY3dianlkeW94a29ucWJrZmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTQwMTcsImV4cCI6MjA5MzA5MDAxN30.9Q7U3XiXAkOqd7MvB8gSJjpBdiP9KGxGHL4VAlp3vQw";

interface ArquivoBase {
  arquivo: string;
  paginas: number;
  chunks: number;
  ultima_atualizacao: string;
}

export default function BaseConhecimento() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [statusTexto, setStatusTexto] = useState("");
  const [arquivos, setArquivos] = useState<ArquivoBase[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [carregando, setCarregando] = useState(true);

  async function carregarArquivos() {
    setCarregando(true);
    const { data, error } = await supabase
      .from("legislacao_conhecimento")
      .select("metadados, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar base", description: error.message, variant: "destructive" });
      setCarregando(false);
      return;
    }

    const mapa = new Map<string, ArquivoBase>();
    for (const r of data || []) {
      const md: any = r.metadados || {};
      const nome = md.arquivo || "Sem nome";
      const existente = mapa.get(nome);
      if (existente) {
        existente.chunks += 1;
        if (md.pagina && md.pagina > existente.paginas) existente.paginas = md.pagina;
      } else {
        mapa.set(nome, {
          arquivo: nome,
          paginas: md.total_paginas || md.pagina || 0,
          chunks: 1,
          ultima_atualizacao: r.created_at,
        });
      }
    }
    setArquivos(Array.from(mapa.values()));
    setTotalChunks(data?.length || 0);
    setCarregando(false);
  }

  useEffect(() => { carregarArquivos(); }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ehPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!ehPdf) {
      toast({ title: "Formato inválido", description: "Envie apenas arquivos PDF.", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 50MB.", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setProcessando(true);
    setProgresso(5);
    setStatusTexto("Enviando PDF...");

    const caminho = `pdfs/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;

    try {
      const { error: erroUpload } = await supabase.storage
        .from("conhecimento")
        .upload(caminho, file, { contentType: "application/pdf", upsert: true });
      if (erroUpload) {
        throw new Error(
          `Não foi possível enviar o arquivo (${erroUpload.message}). Verifique se o armazenamento "conhecimento" existe.`
        );
      }

      const url = `${SUPABASE_URL}/functions/v1/processar-pdf-conhecimento`;
      const { data: session } = await supabase.auth.getSession();
      const headers = {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.session?.access_token || SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
      };

      const chamar = async (body: any) => {
        const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
        const bruto = await r.text();
        let data: any = null;
        try {
          data = bruto ? JSON.parse(bruto) : null;
        } catch {
          data = null;
        }
        if (!r.ok || !data?.sucesso) {
          const detalhe =
            data?.error ||
            data?.msg ||
            (r.status === 401 || r.status === 403
              ? "Sem permissão para usar o processador de PDF (verifique se a função está publicada e liberada)."
              : r.status === 404
              ? "A função de processamento de PDF não está publicada no servidor."
              : r.status === 546 || r.status === 504
              ? "Este trecho do PDF passou do tempo limite. Tente novamente."
              : bruto?.slice(0, 200) || `Falha inesperada (código ${r.status}).`);
          throw new Error(detalhe);
        }
        return data;
      };

      setProgresso(12);
      setStatusTexto("Lendo o documento...");
      const info = await chamar({ storage_path: caminho, nome: file.name, apenas_info: true });
      const totalPaginas = info.total_paginas || 0;
      if (!totalPaginas) throw new Error("Nenhuma página legível encontrada neste PDF.");

      const PASSO = 15; // páginas por chamada, evita estourar o tempo limite
      let inseridos = 0;

      for (let inicio = 1; inicio <= totalPaginas; inicio += PASSO) {
        const fim = Math.min(inicio + PASSO - 1, totalPaginas);
        setStatusTexto(`Processando páginas ${inicio}–${fim} de ${totalPaginas}...`);
        const parte = await chamar({
          storage_path: caminho,
          nome: file.name,
          pagina_inicio: inicio,
          pagina_fim: fim,
        });
        inseridos += parte.chunks_inseridos || 0;
        setProgresso(12 + Math.round((fim / totalPaginas) * 85));
      }

      setProgresso(100);
      setStatusTexto("Concluído!");

      toast({
        title: "✅ Base atualizada",
        description: `${inseridos} trechos de "${file.name}" foram processados (${totalPaginas} páginas).`,
      });
      await supabase.storage.from("conhecimento").remove([caminho]);
      await carregarArquivos();
    } catch (err: any) {
      toast({ title: "Erro no processamento", description: err.message, variant: "destructive" });
    } finally {
      setTimeout(() => {
        setProcessando(false);
        setProgresso(0);
        setStatusTexto("");
      }, 800);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removerArquivo(nome: string) {
    const { error } = await supabase
      .from("legislacao_conhecimento")
      .delete()
      .eq("metadados->>arquivo", nome);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Removido", description: `"${nome}" foi removido da base.` });
    carregarArquivos();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto p-6 space-y-6 max-w-6xl"
    >
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl gradient-accent">
          <BookOpen className="h-7 w-7 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Base de Conhecimento</h1>
          <p className="text-muted-foreground">
            Faça upload de PDFs (Lei Orgânica, Regimento, Decretos) para o assistente consultar.
          </p>
        </div>
      </div>

      {/* Upload Card */}
      <Card className="p-6 glass-card border-2 border-dashed border-primary/30">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 rounded-full bg-primary/10">
            {processando ? (
              <Brain className="h-12 w-12 text-primary animate-pulse" />
            ) : (
              <FileUp className="h-12 w-12 text-primary" />
            )}
          </div>

          {processando ? (
            <div className="w-full max-w-md space-y-3">
              <p className="font-semibold text-primary flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando Inteligência...
              </p>
              <Progress value={progresso} className="h-2" />
              <p className="text-sm text-muted-foreground">{statusTexto}</p>
            </div>
          ) : (
            <>
              <div>
                <h3 className="text-lg font-semibold">Adicionar documento à base</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  PDF até 20MB. O texto será dividido, vetorizado e indexado para busca semântica.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleUpload}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()} size="lg" className="gap-2">
                <Upload className="h-4 w-4" />
                Selecionar PDF
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 glass-card">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{arquivos.length}</p>
              <p className="text-xs text-muted-foreground">Documentos</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 glass-card">
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-accent" />
            <div>
              <p className="text-2xl font-bold">{totalChunks}</p>
              <p className="text-xs text-muted-foreground">Trechos vetorizados</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 glass-card">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{arquivos.length > 0 ? "Ativo" : "Vazio"}</p>
              <p className="text-xs text-muted-foreground">Status RAG</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Lista de arquivos */}
      <Card className="p-6 glass-card">
        <h2 className="text-xl font-semibold mb-4">Documentos na Base</h2>
        {carregando ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : arquivos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum documento na base ainda.</p>
            <p className="text-sm">Faça upload de um PDF para começar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {arquivos.map((a) => (
              <div
                key={a.arquivo}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{a.arquivo}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {a.paginas} {a.paginas === 1 ? "página" : "páginas"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {a.chunks} trechos
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {new Date(a.ultima_atualizacao).toLocaleDateString("pt-BR")}
                      </Badge>
                    </div>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover "{a.arquivo}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Todos os {a.chunks} trechos vetorizados deste documento serão removidos da base.
                        O assistente não poderá mais consultar este conteúdo.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => removerArquivo(a.arquivo)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
