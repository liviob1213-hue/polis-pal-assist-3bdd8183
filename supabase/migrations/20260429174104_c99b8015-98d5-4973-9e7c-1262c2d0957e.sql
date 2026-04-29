-- 1) Adiciona colunas na profiles para fluxo de aprovação
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS politico_id_solicitado UUID;

-- Para assessores: status inicia como 'pendente'. Políticos sempre 'aprovado'.

-- 2) Trigger: ao criar usuário no auth, cria profile automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
  v_politico UUID;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'politico');
  v_politico := NULLIF(NEW.raw_user_meta_data->>'politico_id_solicitado','')::UUID;
  v_status := CASE WHEN v_role = 'assessor' THEN 'pendente' ELSE 'aprovado' END;

  INSERT INTO public.profiles (user_id, nome, email, telefone, role, status, politico_id_solicitado, is_authorized, whatsapp_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'telefone',''),
    v_role,
    v_status,
    v_politico,
    CASE WHEN v_role = 'politico' THEN true ELSE false END,
    false
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Político ganha role imediatamente. Assessor só após aprovação.
  IF v_role = 'politico' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'politico'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Função para político aprovar assessor
CREATE OR REPLACE FUNCTION public.approve_assessor(_assessor_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'politico'::app_role) THEN
    RAISE EXCEPTION 'Apenas políticos podem aprovar assessores';
  END IF;

  UPDATE public.profiles
    SET status = 'aprovado', is_authorized = true, role = 'assessor', updated_at = now()
    WHERE user_id = _assessor_user_id;

  INSERT INTO public.user_roles (user_id, role) VALUES (_assessor_user_id, 'assessor'::app_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.politician_assessors (politician_id, assessor_id)
  VALUES (auth.uid(), _assessor_user_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- 4) Função para rejeitar
CREATE OR REPLACE FUNCTION public.reject_assessor(_assessor_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'politico'::app_role) THEN
    RAISE EXCEPTION 'Apenas políticos podem rejeitar assessores';
  END IF;
  UPDATE public.profiles
    SET status = 'rejeitado', is_authorized = false, updated_at = now()
    WHERE user_id = _assessor_user_id;
END;
$$;

-- 5) Garantir unique no politician_assessors (caso não exista)
DO $$ BEGIN
  ALTER TABLE public.politician_assessors ADD CONSTRAINT politician_assessors_unique UNIQUE (politician_id, assessor_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- 6) Atualizar política de SELECT em profiles para o político ver pendentes que o solicitaram
DROP POLICY IF EXISTS "Politicians can view assessor profiles" ON public.profiles;
CREATE POLICY "Politicians can view assessor profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM politician_assessors pa WHERE pa.politician_id = auth.uid() AND pa.assessor_id = profiles.user_id)
  OR (has_role(auth.uid(), 'politico'::app_role) AND politico_id_solicitado = auth.uid())
);

-- 7) Listar políticos para o assessor escolher no cadastro (apenas nome, sem dados sensíveis)
CREATE OR REPLACE FUNCTION public.list_politicos()
RETURNS TABLE(user_id UUID, nome TEXT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.nome
  FROM public.profiles p
  WHERE p.role = 'politico'
  ORDER BY p.nome;
$$;