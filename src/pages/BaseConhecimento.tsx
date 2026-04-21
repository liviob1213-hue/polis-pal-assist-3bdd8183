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
    if (file.type !== "application/pdf") {
      toast({ title: "Formato inválido", description: "Envie apenas arquivos PDF.", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 20MB.", variant: "destructive" });
      return;
    }

    setProcessando(true);
    setProgresso(10);
    setStatusTexto("Enviando PDF para processamento...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("nome", file.name);

      setProgresso(30);
      setStatusTexto("Extraindo texto e gerando embeddings...");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/processar-pdf-conhecimento`;
      const { data: session } = await supabase.auth.getSession();
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      });

      setProgresso(80);
      setStatusTexto("Salvando inteligência na base...");

      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Erro ao processar");

      setProgresso(100);
      setStatusTexto("Concluído!");

      toast({
        title: "✅ Base atualizada",
        description: `${data.chunks_inseridos} trechos de "${data.arquivo}" foram processados (${data.paginas} páginas).`,
      });
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
