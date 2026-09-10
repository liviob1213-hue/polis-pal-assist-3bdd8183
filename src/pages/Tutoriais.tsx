import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
      const { data: link } = await supabase
        .from("politician_assessors")
        .select("politician_id")
        .eq("assessor_id", user.id)
        .maybeSingle();
      const owner = ((link as any)?.politician_id as string) || user.id;
      if (!ativo) return;
      setOwnerId(owner);

      const { data, error } = await supabase
        .from("tutoriais" as any)
        .select("id, titulo, embed_url")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

      if (!ativo) return;

      if (error) {
        console.warn("[Tutoriais] tabela indisponível, usando armazenamento local:", error.message);
        setDbOk(false);
        setTutoriais(loadLocal());
        setLoading(false);
        return;
      }

      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }

      const vistos = new Set<string>();
      const lista: Tutorial[] = (data as any[])
        .map((r) => ({ id: r.id, titulo: r.titulo, embedUrl: r.embed_url }))
        .filter((t) => {
          if (vistos.has(t.embedUrl)) return false;
          vistos.add(t.embedUrl);
          return true;
        });

      setTutoriais(lista);
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, [user]);

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
