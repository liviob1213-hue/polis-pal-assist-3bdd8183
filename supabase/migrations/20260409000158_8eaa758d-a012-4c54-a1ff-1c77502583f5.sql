
-- Fix profiles RLS: allow politicians to see their assessors' profiles
CREATE POLICY "Politicians can view assessor profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.politician_assessors pa
    WHERE pa.politician_id = auth.uid() AND pa.assessor_id = profiles.user_id
  )
);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
