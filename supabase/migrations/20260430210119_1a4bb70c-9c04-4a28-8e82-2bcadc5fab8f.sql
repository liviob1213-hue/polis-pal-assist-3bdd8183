-- 1) Adicionar coluna politician_id
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS politician_id uuid;

-- 2) Backfill: tentar deduzir o politician_id a partir do assessor_id ou do criador
UPDATE public.tarefas t
SET politician_id = pa.politician_id
FROM public.politician_assessors pa
WHERE t.politician_id IS NULL
  AND t.assessor_id IS NOT NULL
  AND pa.assessor_id = t.assessor_id;

UPDATE public.tarefas t
SET politician_id = t.criado_por
FROM public.user_roles ur
WHERE t.politician_id IS NULL
  AND t.criado_por IS NOT NULL
  AND ur.user_id = t.criado_por
  AND ur.role = 'politico';

-- 3) Padronizar status
UPDATE public.tarefas SET status = 'Pendente' WHERE status IN ('Novas Tarefas', 'Aberto', 'Nova', 'Novas');
UPDATE public.tarefas SET status = 'Concluído' WHERE status IN ('Finalizadas', 'Finalizada', 'Resolvido', 'Concluido');

-- 4) Default do status
ALTER TABLE public.tarefas ALTER COLUMN status SET DEFAULT 'Pendente';

-- 5) Índices
CREATE INDEX IF NOT EXISTS idx_tarefas_politician_id ON public.tarefas(politician_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_assessor_id ON public.tarefas(assessor_id);