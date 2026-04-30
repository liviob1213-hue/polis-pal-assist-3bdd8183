ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS demanda_id uuid,
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS setor text;

CREATE INDEX IF NOT EXISTS idx_tarefas_demanda_id ON public.tarefas(demanda_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_tipo ON public.tarefas(tipo);
CREATE INDEX IF NOT EXISTS idx_tarefas_setor ON public.tarefas(setor);