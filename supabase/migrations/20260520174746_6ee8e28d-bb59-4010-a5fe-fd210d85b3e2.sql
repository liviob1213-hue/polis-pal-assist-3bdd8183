CREATE OR REPLACE FUNCTION public.delete_demanda_politico(_demanda_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'politico'::app_role) THEN
    RAISE EXCEPTION 'Apenas políticos podem excluir demandas';
  END IF;

  ALTER TABLE public.demandas DISABLE TRIGGER USER;

  DELETE FROM public.demanda_comentarios WHERE demanda_id = _demanda_id;
  DELETE FROM public.demanda_historico WHERE demanda_id = _demanda_id;
  DELETE FROM public.demanda_eleitores WHERE demanda_id = _demanda_id;
  UPDATE public.tarefas SET demanda_id = NULL WHERE demanda_id = _demanda_id;
  UPDATE public.projetos_lei SET demanda_id = NULL WHERE demanda_id = _demanda_id;
  DELETE FROM public.demandas WHERE id = _demanda_id;

  ALTER TABLE public.demandas ENABLE TRIGGER USER;
EXCEPTION
  WHEN OTHERS THEN
    ALTER TABLE public.demandas ENABLE TRIGGER USER;
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_demanda_politico(uuid) TO authenticated;