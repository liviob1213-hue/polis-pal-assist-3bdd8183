
DROP POLICY IF EXISTS "Update demandas by role" ON public.demandas;

CREATE POLICY "Update demandas by role"
  ON public.demandas FOR UPDATE
  USING (
    has_role(auth.uid(), 'politico'::app_role)
    OR (has_role(auth.uid(), 'assessor'::app_role) AND assessor_id = auth.uid())
    OR (has_role(auth.uid(), 'assessor'::app_role) AND assessor_id IS NULL)
  );

-- Ajustar trigger: permitir assessor atualizar APENAS para se auto-atribuir (assessor_id NULL -> próprio id)
CREATE OR REPLACE FUNCTION public.block_assessor_modifying_demanda()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL 
     AND has_role(auth.uid(), 'assessor'::app_role) 
     AND NOT has_role(auth.uid(), 'politico'::app_role) THEN
    
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Assessores não podem excluir demandas';
    END IF;

    IF TG_OP = 'UPDATE' THEN
      -- Permitido: assumir demanda em aberto (assessor_id NULL -> próprio id), sem alterar mais nada
      IF OLD.assessor_id IS NULL 
         AND NEW.assessor_id = auth.uid()
         AND NEW.titulo IS NOT DISTINCT FROM OLD.titulo
         AND NEW.descricao IS NOT DISTINCT FROM OLD.descricao
         AND NEW.localizacao IS NOT DISTINCT FROM OLD.localizacao
         AND NEW.prazo IS NOT DISTINCT FROM OLD.prazo
         AND NEW.eleitor_id IS NOT DISTINCT FROM OLD.eleitor_id
      THEN
        RETURN NEW;
      END IF;

      -- Permitido: mover status (Kanban) das próprias demandas
      IF OLD.assessor_id = auth.uid() 
         AND NEW.assessor_id = OLD.assessor_id
         AND NEW.titulo IS NOT DISTINCT FROM OLD.titulo
         AND NEW.descricao IS NOT DISTINCT FROM OLD.descricao
         AND NEW.localizacao IS NOT DISTINCT FROM OLD.localizacao
         AND NEW.prazo IS NOT DISTINCT FROM OLD.prazo
         AND NEW.eleitor_id IS NOT DISTINCT FROM OLD.eleitor_id
      THEN
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'Assessores não podem editar dados da demanda';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
