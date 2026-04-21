ALTER TABLE public.eleitores ADD COLUMN IF NOT EXISTS data_nascimento date;
CREATE INDEX IF NOT EXISTS idx_eleitores_data_nascimento ON public.eleitores(data_nascimento);