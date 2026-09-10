import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Tutorial {
  id: string;
  titulo: string;
  embedUrl: string;
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

      let lista: Tutorial[] = (data as any[]).map((r) => ({
        id: r.id,
        titulo: r.titulo,
        embedUrl: r.embed_url,
      }));

      // Migração automática: envia vídeos antigos do navegador que ainda não estão no banco
      const locais = loadLocal();
      const pendentes = locais.filter(
        (local) => !lista.some(
          (salvo) => salvo.embedUrl === local.embedUrl && salvo.titulo === local.titulo
        )
      );
      if (pendentes.length > 0) {
        const { data: inseridos, error: erroMigracao } = await supabase
          .from("tutoriais" as any)
          .insert(
            pendentes.map((t) => ({ politician_id: owner, titulo: t.titulo, embed_url: t.embedUrl }))
          )
          .select("id, titulo, embed_url");
        if (inseridos) {
          const migrados = (inseridos as any[]).map((r) => ({
            id: r.id,
            titulo: r.titulo,
            embedUrl: r.embed_url,
          }));
          lista = [...lista, ...migrados];
          toast.success("Seus vídeos salvos no navegador foram enviados para o banco de dados.");
        } else if (erroMigracao) {
          console.warn("[Tutoriais] não foi possível migrar vídeos locais:", erroMigracao.message);
          toast.error("Os vídeos deste aparelho ainda não foram enviados ao banco. Verifique as permissões da tabela.");
        }
      }

      setTutoriais(lista);
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, [user]);

  const adicionar = async () => {
    const videoId = parseYoutubeId(link);
    if (!titulo.trim()) {
      toast.error("Informe um título para o tutorial.");
      return;
    }
    if (!videoId) {
      toast.error("Link do YouTube inválido. Cole o link ou o código de incorporação (iframe).");
      return;
    }
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;

    if (!dbOk || !ownerId) {
      const lista = [...tutoriais, { id: crypto.randomUUID(), titulo: titulo.trim(), embedUrl }];
      setTutoriais(lista);
      saveLocal(lista);
    } else {
      const { data, error } = await supabase
        .from("tutoriais" as any)
        .insert({ politician_id: ownerId, titulo: titulo.trim(), embed_url: embedUrl })
        .select("id, titulo, embed_url")
        .single();
      if (error) {
        toast.error("Não foi possível salvar o vídeo: " + error.message);
        return;
      }
      const novo = { id: (data as any).id, titulo: (data as any).titulo, embedUrl: (data as any).embed_url };
      const lista = [...tutoriais, novo];
      setTutoriais(lista);
      saveLocal(lista);
    }

    setTitulo("");
    setLink("");
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
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Adicionar novo vídeo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Título do tutorial"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="sm:flex-1"
            />
            <Input
              placeholder="Link do YouTube ou código do iframe"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="sm:flex-[2]"
            />
            <Button onClick={adicionar} className="gap-2">
              <Plus className="h-4 w-4" /> Adicionar
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
