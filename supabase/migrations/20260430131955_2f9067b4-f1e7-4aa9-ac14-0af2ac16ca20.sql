ALTER TABLE public.demandas ADD COLUMN IF NOT EXISTS setor text;
CREATE INDEX IF NOT EXISTS idx_demandas_setor ON public.demandas(setor);