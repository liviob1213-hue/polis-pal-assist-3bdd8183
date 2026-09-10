import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Trash2, Loader2, Plus, Youtube } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Tutorial {
  id: string;
  titulo: string;
  embedUrl: string;
}

// Converte qualquer link do YouTube (watch, youtu.be, shorts, embed) para URL de embed
function paraEmbedUrl(link: string): string | null {
  const bruto = link.trim();
  if (!bruto) return null;
  // Se já veio um iframe completo, extrai o src
  const matchIframe = bruto.match(/src=["']([^"']+)["']/i);
  const url = matchIframe ? matchIframe[1] : bruto;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  if (!match) return null;
  return `https://www.youtube.com/embed/${match[1]}`;
}

const STORAGE_KEY = "tutoriais_youtube";


function loadLocal(): Tutorial[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveLocal(lista: Tutorial[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch { /* ignore */ }
}

export default function Tutoriais() {
  const { role, user } = useAuth();
  const isPolitico = role === "politico";
  const [tutoriais, setTutoriais] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [dbOk, setDbOk] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [link, setLink] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!user) return;
      setLoading(true);
      // Assessor vê os tutoriais do político responsável
      const { data: link } = await supabase
        .from("politician_assessors")
        .select("politician_id")
        .eq("assessor_id", user.id)
        .maybeSingle();
      const owner = ((link as any)?.politician_id as string) || user.id;
      if (!ativo) return;
      setOwnerId(owner);

      // Tutoriais são compartilhados com todos os usuários do sistema
      const { data, error } = await supabase
        .from("tutoriais" as any)
        .select("id, titulo, embed_url")
        .order("created_at", { ascending: true });

      if (!ativo) return;

      if (error) {
        console.warn("[Tutoriais] tabela indisponível, usando armazenamento local:", error.message);
        setDbOk(false);
        setTutoriais(loadLocal());
        setLoading(false);
        return;
      }

      // Remove qualquer resquício de vídeos salvos no navegador (causavam repetição)
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }

      // Lista do banco, sem repetições (mesmo título + mesmo link)
      const vistos = new Set<string>();
      const lista: Tutorial[] = (data as any[])
        .map((r) => ({ id: r.id, titulo: r.titulo, embedUrl: r.embed_url }))
        .filter((t) => {
          const chave = `${t.titulo}|${t.embedUrl}`;
          if (vistos.has(chave)) return false;
          vistos.add(chave);
          return true;
        });

      setTutoriais(lista);
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, [user]);

  const adicionar = async () => {
    const embedUrl = paraEmbedUrl(link);
    if (!titulo.trim()) {
      toast.error("Informe um título para o vídeo.");
      return;
    }
    if (!embedUrl) {
      toast.error("Link do YouTube inválido. Cole o link do vídeo ou o iframe de incorporação.");
      return;
    }
    // Evita duplicado (mesmo título + mesmo link)
    if (tutoriais.some((t) => t.embedUrl === embedUrl && t.titulo === titulo.trim())) {
      toast.error("Este vídeo já está cadastrado.");
      return;
    }
    setSalvando(true);
    if (dbOk && ownerId) {
      const { data, error } = await supabase
        .from("tutoriais" as any)
        .insert({ politician_id: ownerId, titulo: titulo.trim(), embed_url: embedUrl })
        .select("id, titulo, embed_url");
      if (error || !data || (data as any[]).length === 0) {
        toast.error("Não foi possível salvar no banco: " + (error?.message || "sem retorno"));
        setSalvando(false);
        return;
      }
      const r = (data as any[])[0];
      setTutoriais((lista) => [...lista, { id: r.id, titulo: r.titulo, embedUrl: r.embed_url }]);
    } else {
      const novo: Tutorial = { id: crypto.randomUUID(), titulo: titulo.trim(), embedUrl };
      const lista = [...tutoriais, novo];
      setTutoriais(lista);
      saveLocal(lista);
    }
    setTitulo("");
    setLink("");
    setSalvando(false);
    toast.success("Tutorial adicionado!");
  };

  const remover = async (id: string) => {
    if (dbOk && ownerId) {
      const { error } = await supabase.from("tutoriais" as any).delete().eq("id", id);
      if (error) {
        toast.error("Não foi possível remover: " + error.message);
        return;
      }
    }
    const lista = tutoriais.filter((t) => t.id !== id);
    setTutoriais(lista);
    saveLocal(lista);
    toast.success("Tutorial removido.");
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 pb-24 md:pb-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl gradient-primary flex items-center justify-center shrink-0">
          <GraduationCap className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Tutoriais</h1>
          <p className="text-sm text-muted-foreground">
            Aprenda a usar cada função do sistema com vídeos curtos.
          </p>
        </div>
      </div>

      {isPolitico && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2 font-medium">
              <Youtube className="h-5 w-5 text-primary" />
              Adicionar novo vídeo
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="titulo-video">Título</Label>
                <Input
                  id="titulo-video"
                  placeholder="Ex: Como cadastrar uma demanda"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link-video">Link do YouTube ou iframe</Label>
                <Input
                  id="link-video"
                  placeholder="https://www.youtube.com/watch?v=... ou o iframe"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={adicionar} disabled={salvando} className="gap-2">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar vídeo
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando tutoriais...
        </div>
      ) : tutoriais.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          Nenhum tutorial cadastrado ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tutoriais.map((t) => (
            <Card key={t.id} className="overflow-hidden flex flex-col">
              <div className="aspect-video w-full bg-muted">
                <iframe
                  src={t.embedUrl}
                  title={t.titulo}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
              <CardContent className="flex items-center justify-between gap-2 py-3">
                <span className="font-medium text-sm leading-snug">{t.titulo}</span>
                {isPolitico && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => remover(t.id)}
                    title="Remover tutorial"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
