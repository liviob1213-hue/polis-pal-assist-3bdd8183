
-- 1. Adicionar colunas de rastreamento
ALTER TABLE public.eleitores 
  ADD COLUMN IF NOT EXISTS criado_por uuid,
  ADD COLUMN IF NOT EXISTS politico_id uuid;

ALTER TABLE public.demandas 
  ADD COLUMN IF NOT EXISTS criado_por uuid;

ALTER TABLE public.tarefas 
  ADD COLUMN IF NOT EXISTS criado_por uuid;

ALTER TABLE public.agenda 
  ADD COLUMN IF NOT EXISTS criado_por uuid;

-- 2. Validação: eleitor exige nome e telefone não-vazios
CREATE OR REPLACE FUNCTION public.validate_eleitor()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nome IS NULL OR length(trim(NEW.nome)) = 0 THEN
    RAISE EXCEPTION 'Nome do eleitor é obrigatório';
  END IF;
  IF NEW.telefone IS NULL OR length(trim(NEW.telefone)) = 0 THEN
    RAISE EXCEPTION 'Telefone do eleitor é obrigatório';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_eleitor_trigger ON public.eleitores;
CREATE TRIGGER validate_eleitor_trigger
  BEFORE INSERT OR UPDATE ON public.eleitores
  FOR EACH ROW EXECUTE FUNCTION public.validate_eleitor();

-- 3. Validação: assessor criando demanda DEVE vincular eleitor
CREATE OR REPLACE FUNCTION public.validate_demanda_assessor()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND has_role(auth.uid(), 'assessor'::app_role) THEN
    IF NEW.eleitor_id IS NULL THEN
      RAISE EXCEPTION 'Assessor deve obrigatoriamente vincular a demanda a um eleitor';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_demanda_assessor_trigger ON public.demandas;
CREATE TRIGGER validate_demanda_assessor_trigger
  BEFORE INSERT ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.validate_demanda_assessor();

-- 4. Bloquear UPDATE e DELETE de demandas por assessores
CREATE OR REPLACE FUNCTION public.block_assessor_modifying_demanda()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL 
     AND has_role(auth.uid(), 'assessor'::app_role) 
     AND NOT has_role(auth.uid(), 'politico'::app_role) THEN
    RAISE EXCEPTION 'Assessores não podem editar ou excluir demandas';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_assessor_update_demanda ON public.demandas;
CREATE TRIGGER block_assessor_update_demanda
  BEFORE UPDATE OR DELETE ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.block_assessor_modifying_demanda();

-- 5. RLS: Eleitores — assessor não pode SELECT (nem os próprios), apenas INSERT
DROP POLICY IF EXISTS "Allow public read eleitores" ON public.eleitores;
DROP POLICY IF EXISTS "Allow public insert eleitores" ON public.eleitores;
DROP POLICY IF EXISTS "Allow public update eleitores" ON public.eleitores;
DROP POLICY IF EXISTS "Allow public delete eleitores" ON public.eleitores;

CREATE POLICY "Politicos veem todos eleitores"
  ON public.eleitores FOR SELECT
  USING (
    has_role(auth.uid(), 'politico'::app_role)
    OR (auth.uid() IS NULL) -- mantém compatibilidade com edge functions/agente WhatsApp
  );

CREATE POLICY "Qualquer autenticado pode inserir eleitor"
  ON public.eleitores FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Politicos podem atualizar eleitores"
  ON public.eleitores FOR UPDATE
  USING (has_role(auth.uid(), 'politico'::app_role) OR auth.uid() IS NULL);

CREATE POLICY "Politicos podem deletar eleitores"
  ON public.eleitores FOR DELETE
  USING (has_role(auth.uid(), 'politico'::app_role) OR auth.uid() IS NULL);
