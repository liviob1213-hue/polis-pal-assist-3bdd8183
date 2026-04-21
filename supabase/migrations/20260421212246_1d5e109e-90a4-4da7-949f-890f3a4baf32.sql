
-- Adicionar coluna agente_ativo em eleitores
ALTER TABLE public.eleitores 
  ADD COLUMN IF NOT EXISTS agente_ativo boolean NOT NULL DEFAULT false;

-- Vincular demandas a eleitores (origem da demanda)
ALTER TABLE public.demandas 
  ADD COLUMN IF NOT EXISTS eleitor_id uuid REFERENCES public.eleitores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_demandas_eleitor_id ON public.demandas(eleitor_id);
CREATE INDEX IF NOT EXISTS idx_eleitores_agente_ativo ON public.eleitores(agente_ativo) WHERE agente_ativo = true;
