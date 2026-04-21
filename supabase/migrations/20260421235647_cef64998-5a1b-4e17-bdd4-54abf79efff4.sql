
-- 1. Ativar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Criar tabela de conhecimento legislativo
CREATE TABLE IF NOT EXISTS public.legislacao_conhecimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conteudo TEXT NOT NULL,
  metadados JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca rápida por similaridade
CREATE INDEX IF NOT EXISTS idx_legislacao_embedding
  ON public.legislacao_conhecimento
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_legislacao_metadados
  ON public.legislacao_conhecimento USING GIN (metadados);

-- 3. RLS
ALTER TABLE public.legislacao_conhecimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read legislacao"
  ON public.legislacao_conhecimento FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated insert legislacao"
  ON public.legislacao_conhecimento FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Politicians delete legislacao"
  ON public.legislacao_conhecimento FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'politico'::app_role));

-- 4. Função RPC de busca por similaridade
CREATE OR REPLACE FUNCTION public.buscar_legislacao(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 4
)
RETURNS TABLE (
  id UUID,
  conteudo TEXT,
  metadados JSONB,
  similaridade float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lc.id,
    lc.conteudo,
    lc.metadados,
    1 - (lc.embedding <=> query_embedding) AS similaridade
  FROM public.legislacao_conhecimento lc
  WHERE lc.embedding IS NOT NULL
    AND 1 - (lc.embedding <=> query_embedding) > match_threshold
  ORDER BY lc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 5. Bucket privado para PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('legislacao-pdfs', 'legislacao-pdfs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth read legislacao pdfs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'legislacao-pdfs');

CREATE POLICY "Auth upload legislacao pdfs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'legislacao-pdfs');

CREATE POLICY "Auth delete legislacao pdfs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'legislacao-pdfs');
