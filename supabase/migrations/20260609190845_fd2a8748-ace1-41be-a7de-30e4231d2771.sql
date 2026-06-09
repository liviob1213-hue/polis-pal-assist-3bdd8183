ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plano text NOT NULL DEFAULT 'ouro',
  ADD COLUMN IF NOT EXISTS assinatura_status text NOT NULL DEFAULT 'ativa',
  ADD COLUMN IF NOT EXISTS assinatura_expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS kiwify_subscription_id text,
  ADD COLUMN IF NOT EXISTS kiwify_customer_email text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_plano_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_plano_check
      CHECK (plano IN ('bronze','prata','ouro'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_kiwify_email
  ON public.profiles ((lower(kiwify_customer_email)));

CREATE INDEX IF NOT EXISTS idx_profiles_email_lower
  ON public.profiles ((lower(email)));

CREATE TABLE IF NOT EXISTS public.kiwify_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text,
  order_id text,
  subscription_id text,
  customer_email text,
  product_name text,
  plan_name text,
  payload jsonb NOT NULL,
  matched_user_id uuid,
  processed boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kiwify_webhook_logs TO authenticated;
GRANT ALL ON public.kiwify_webhook_logs TO service_role;

ALTER TABLE public.kiwify_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Politico ve logs kiwify" ON public.kiwify_webhook_logs;
CREATE POLICY "Politico ve logs kiwify"
ON public.kiwify_webhook_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'politico'::app_role));