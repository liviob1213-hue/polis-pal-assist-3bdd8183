-- 1) Backfill politician_id em tarefas existentes
UPDATE public.tarefas t
SET politician_id = pa.politician_id
FROM public.politician_assessors pa
WHERE t.assessor_id = pa.assessor_id
  AND t.politician_id IS NULL;

-- 2) Trigger para auto-preencher politician_id em novas tarefas vindas via agente
CREATE OR REPLACE FUNCTION public.set_tarefa_politician_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.politician_id IS NULL AND NEW.assessor_id IS NOT NULL THEN
    SELECT pa.politician_id
      INTO NEW.politician_id
      FROM public.politician_assessors pa
      WHERE pa.assessor_id = NEW.assessor_id
      LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_tarefa_politician_id ON public.tarefas;
CREATE TRIGGER trg_set_tarefa_politician_id
BEFORE INSERT OR UPDATE OF assessor_id ON public.tarefas
FOR EACH ROW
EXECUTE FUNCTION public.set_tarefa_politician_id();

-- 3) RLS: substituir política de SELECT para incluir tarefas dos assessores vinculados ao político
DROP POLICY IF EXISTS "Read tarefas by role" ON public.tarefas;

CREATE POLICY "Read tarefas by role"
ON public.tarefas
FOR SELECT
USING (
  -- Político vê suas tarefas (atribuídas diretamente)
  (has_role(auth.uid(), 'politico'::app_role) AND politician_id = auth.uid())
  OR
  -- Político vê tarefas dos seus assessores (mesmo se politician_id estiver NULL)
  (has_role(auth.uid(), 'politico'::app_role) AND EXISTS (
    SELECT 1 FROM public.politician_assessors pa
    WHERE pa.politician_id = auth.uid()
      AND pa.assessor_id = tarefas.assessor_id
  ))
  OR
  -- Assessor vê apenas tarefas onde ele é o responsável
  (has_role(auth.uid(), 'assessor'::app_role) AND assessor_id = auth.uid())
  OR
  -- Tarefas em aberto (sem responsável) visíveis a todos autenticados do gabinete
  (auth.uid() IS NOT NULL AND assessor_id IS NULL)
);
