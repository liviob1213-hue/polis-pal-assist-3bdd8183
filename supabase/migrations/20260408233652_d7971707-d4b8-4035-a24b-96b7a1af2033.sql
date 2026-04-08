
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('politico', 'assessor');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (true);

-- Politician-Assessor linking table
CREATE TABLE public.politician_assessors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_id UUID NOT NULL,
  assessor_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (politician_id, assessor_id)
);

ALTER TABLE public.politician_assessors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Politicians can view their assessors"
  ON public.politician_assessors FOR SELECT
  USING (
    auth.uid() = politician_id
    OR auth.uid() = assessor_id
  );

CREATE POLICY "Politicians can manage assessors"
  ON public.politician_assessors FOR INSERT
  WITH CHECK (auth.uid() = politician_id);

CREATE POLICY "Politicians can remove assessors"
  ON public.politician_assessors FOR DELETE
  USING (auth.uid() = politician_id);

-- Add assessor_id to demandas, tarefas, agenda
ALTER TABLE public.demandas ADD COLUMN assessor_id UUID;
ALTER TABLE public.tarefas ADD COLUMN assessor_id UUID;
ALTER TABLE public.agenda ADD COLUMN assessor_id UUID;

-- Add role column to profiles for quick access
ALTER TABLE public.profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'politico';

-- Function to get politician_id for an assessor
CREATE OR REPLACE FUNCTION public.get_politician_id(_assessor_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT politician_id FROM public.politician_assessors
  WHERE assessor_id = _assessor_user_id
  LIMIT 1
$$;

-- Update RLS on demandas: politicians see all, assessors see only theirs
DROP POLICY IF EXISTS "Allow public read demandas" ON public.demandas;
CREATE POLICY "Read demandas by role"
  ON public.demandas FOR SELECT
  USING (
    public.has_role(auth.uid(), 'politico')
    OR (public.has_role(auth.uid(), 'assessor') AND assessor_id = auth.uid())
    OR assessor_id IS NULL
  );

DROP POLICY IF EXISTS "Allow public update demandas" ON public.demandas;
CREATE POLICY "Update demandas by role"
  ON public.demandas FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'politico')
    OR (public.has_role(auth.uid(), 'assessor') AND assessor_id = auth.uid())
  );

-- Update RLS on tarefas
DROP POLICY IF EXISTS "Allow public read tarefas" ON public.tarefas;
CREATE POLICY "Read tarefas by role"
  ON public.tarefas FOR SELECT
  USING (
    public.has_role(auth.uid(), 'politico')
    OR (public.has_role(auth.uid(), 'assessor') AND assessor_id = auth.uid())
    OR assessor_id IS NULL
  );

DROP POLICY IF EXISTS "Allow public update tarefas" ON public.tarefas;
CREATE POLICY "Update tarefas by role"
  ON public.tarefas FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'politico')
    OR (public.has_role(auth.uid(), 'assessor') AND assessor_id = auth.uid())
  );

-- Update RLS on agenda
DROP POLICY IF EXISTS "Allow public read agenda" ON public.agenda;
CREATE POLICY "Read agenda by role"
  ON public.agenda FOR SELECT
  USING (
    public.has_role(auth.uid(), 'politico')
    OR (public.has_role(auth.uid(), 'assessor') AND assessor_id = auth.uid())
    OR assessor_id IS NULL
  );

DROP POLICY IF EXISTS "Allow public update agenda" ON public.agenda;
CREATE POLICY "Update agenda by role"
  ON public.agenda FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'politico')
    OR (public.has_role(auth.uid(), 'assessor') AND assessor_id = auth.uid())
  );

-- Enable realtime for new table
ALTER PUBLICATION supabase_realtime ADD TABLE public.politician_assessors;
