import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Tutorial {
  id: string;
  titulo: string;
  embedUrl: string;
}

const STORAGE_KEY = "tutoriais_youtube";

// Extrai o ID do vídeo de várias formas de link do YouTube
function parseYoutubeId(input: string): string | null {
  const embedMatch = input.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})/);
  if (embedMatch) return embedMatch[1];
  const watchMatch = input.match(/[?&]v=([\w-]{6,})/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = input.match(/youtu\.be\/([\w-]{6,})/);
  if (shortMatch) return shortMatch[1];
  if (/^[\w-]{11}$/.test(input.trim())) return input.trim();
  return null;
}

function loadTutoriais(): Tutorial[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  // Tutoriais padrão exibidos na primeira visita
  return [
    { id: "1", titulo: "Bem-vindo ao Democrat.IA", embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
  ];
}

export default function Tutoriais() {
  const { role } = useAuth();
  const isPolitico = role === "politico";
  const [tutoriais, setTutoriais] = useState<Tutorial[]>(loadTutoriais);
  const [titulo, setTitulo] = useState("");
  const [link, setLink] = useState("");

  const salvar = (lista: Tutorial[]) => {
    setTutoriais(lista);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  };

  const adicionar = () => {
    const videoId = parseYoutubeId(link);
    if (!titulo.trim()) {
      toast.error("Informe um título para o tutorial.");
      return;
    }
    if (!videoId) {
      toast.error("Link do YouTube inválido. Cole o link ou o código de incorporação (iframe).");
      return;
    }
    salvar([
      ...tutoriais,
      { id: crypto.randomUUID(), titulo: titulo.trim(), embedUrl: `https://www.youtube.com/embed/${videoId}` },
    ]);
    setTitulo("");
    setLink("");
    toast.success("Tutorial adicionado!");
  };

  const remover = (id: string) => {
    salvar(tutoriais.filter((t) => t.id !== id));
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

      {tutoriais.length === 0 ? (
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
