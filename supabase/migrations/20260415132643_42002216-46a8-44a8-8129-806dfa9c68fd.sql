
CREATE TABLE public.message_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('disparo_massa', 'tarefa', 'demanda')),
  destinatario_telefone TEXT NOT NULL,
  destinatario_nome TEXT,
  mensagem_original TEXT NOT NULL,
  mensagem_variacao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviando', 'enviado', 'erro')),
  agendado_para TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  enviado_em TIMESTAMP WITH TIME ZONE,
  campanha_id UUID,
  assessor_id UUID,
  referencia_id UUID,
  erro_detalhe TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read message_queue" ON public.message_queue FOR SELECT USING (true);
CREATE POLICY "Allow public insert message_queue" ON public.message_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update message_queue" ON public.message_queue FOR UPDATE USING (true);
CREATE POLICY "Allow public delete message_queue" ON public.message_queue FOR DELETE USING (true);

CREATE INDEX idx_message_queue_status ON public.message_queue (status, agendado_para);
CREATE INDEX idx_message_queue_campanha ON public.message_queue (campanha_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_queue;
