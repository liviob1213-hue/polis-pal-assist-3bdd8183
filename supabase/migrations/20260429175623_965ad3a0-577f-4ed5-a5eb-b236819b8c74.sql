-- Permitir assessor ver eleitores que ele mesmo criou (necessário para retorno do INSERT e listagem)
CREATE POLICY "Assessor pode ver eleitores que criou"
ON public.eleitores
FOR SELECT
TO authenticated
USING (criado_por = auth.uid());