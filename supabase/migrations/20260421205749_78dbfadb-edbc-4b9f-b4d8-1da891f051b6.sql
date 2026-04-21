-- Allow authenticated users to read chat history (agent conversations with voters)
CREATE POLICY "Authenticated can read chat_history"
ON public.chat_history
FOR SELECT
TO authenticated
USING (true);

-- Index for faster lookups by phone and time
CREATE INDEX IF NOT EXISTS idx_chat_history_telefone_created ON public.chat_history (telefone, created_at DESC);