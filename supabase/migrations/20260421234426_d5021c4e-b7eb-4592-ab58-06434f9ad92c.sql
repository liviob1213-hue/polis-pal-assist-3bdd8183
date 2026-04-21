CREATE TABLE public.assistente_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sessao_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  conteudo TEXT NOT NULL,
  tipo_documento TEXT DEFAULT 'livre',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.assistente_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assistant history"
  ON public.assistente_historico FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assistant history"
  ON public.assistente_historico FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own assistant history"
  ON public.assistente_historico FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_assistente_historico_user_sessao ON public.assistente_historico(user_id, sessao_id, created_at);
CREATE INDEX idx_assistente_historico_user_created ON public.assistente_historico(user_id, created_at DESC);