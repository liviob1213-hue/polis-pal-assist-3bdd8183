
CREATE TABLE public.chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  message text NOT NULL,
  context jsonb DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.chat_history
  FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX idx_chat_history_telefone_created ON public.chat_history (telefone, created_at DESC);
