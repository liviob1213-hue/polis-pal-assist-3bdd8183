CREATE TABLE IF NOT EXISTS public.demanda_eleitores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id uuid NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
  eleitor_id uuid NOT NULL REFERENCES public.eleitores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (demanda_id, eleitor_id)
);

CREATE INDEX IF NOT EXISTS idx_demanda_eleitores_demanda ON public.demanda_eleitores(demanda_id);
CREATE INDEX IF NOT EXISTS idx_demanda_eleitores_eleitor ON public.demanda_eleitores(eleitor_id);

ALTER TABLE public.demanda_eleitores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read demanda_eleitores"
ON public.demanda_eleitores FOR SELECT
USING (true);

CREATE POLICY "Allow public insert demanda_eleitores"
ON public.demanda_eleitores FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public delete demanda_eleitores"
ON public.demanda_eleitores FOR DELETE
USING (true);