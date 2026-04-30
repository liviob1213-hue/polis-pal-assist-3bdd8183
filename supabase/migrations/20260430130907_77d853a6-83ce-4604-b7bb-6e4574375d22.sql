ALTER TABLE public.demandas 
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS tipo text;

CREATE INDEX IF NOT EXISTS idx_demandas_origem ON public.demandas(origem);
CREATE INDEX IF NOT EXISTS idx_demandas_tipo ON public.demandas(tipo);