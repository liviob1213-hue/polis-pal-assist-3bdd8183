-- Add missing permissions column to politician_assessors
ALTER TABLE public.politician_assessors
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Ensure RLS allows the assessor to read their own permissions row
DROP POLICY IF EXISTS "Assessor reads own link" ON public.politician_assessors;
CREATE POLICY "Assessor reads own link"
ON public.politician_assessors
FOR SELECT
TO authenticated
USING (assessor_id = auth.uid() OR politician_id = auth.uid());