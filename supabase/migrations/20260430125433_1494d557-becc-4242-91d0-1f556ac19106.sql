ALTER TABLE public.eleitores ADD COLUMN IF NOT EXISTS status_eleitor text NOT NULL DEFAULT 'possivel_eleitor';

CREATE INDEX IF NOT EXISTS idx_eleitores_status_eleitor ON public.eleitores(status_eleitor);