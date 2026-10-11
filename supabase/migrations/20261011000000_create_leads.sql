-- Tabela de captura de leads do formulário da página de vendas (Landing).
-- As colunas espelham src/integrations/supabase/types.ts (leads).
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  nome text NOT NULL,
  email text NOT NULL,
  telefone text NOT NULL
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Qualquer visitante (anônimo ou autenticado) pode ENVIAR o formulário.
DROP POLICY IF EXISTS "Qualquer um pode cadastrar lead" ON public.leads;
CREATE POLICY "Qualquer um pode cadastrar lead"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Apenas usuários autenticados podem LER os leads (dados de contato não ficam
-- expostos publicamente). Ajuste conforme quem deve ver os leads no backoffice.
DROP POLICY IF EXISTS "Autenticados leem leads" ON public.leads;
CREATE POLICY "Autenticados leem leads"
ON public.leads
FOR SELECT
TO authenticated
USING (true);
