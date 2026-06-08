-- Scope chat_history by politico through eleitores.politico_id
DROP POLICY IF EXISTS "Authenticated can read chat_history" ON public.chat_history;

CREATE POLICY "Politico ve seu proprio historico"
ON public.chat_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.eleitores e
    WHERE regexp_replace(COALESCE(e.telefone, ''), '\D', '', 'g')
        = regexp_replace(COALESCE(chat_history.telefone, ''), '\D', '', 'g')
      AND regexp_replace(COALESCE(e.telefone, ''), '\D', '', 'g') <> ''
      AND (
        e.politico_id = auth.uid()
        OR e.politico_id = public.get_politician_id(auth.uid())
        OR e.criado_por = auth.uid()
      )
  )
);

CREATE INDEX IF NOT EXISTS idx_eleitores_telefone_digits
  ON public.eleitores ((regexp_replace(COALESCE(telefone, ''), '\D', '', 'g')));