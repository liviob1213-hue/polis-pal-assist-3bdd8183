
-- Create eleitores table
CREATE TABLE public.eleitores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  endereco TEXT,
  telefone TEXT,
  interesse TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.eleitores ENABLE ROW LEVEL SECURITY;

-- Public read/write for now (no auth yet)
CREATE POLICY "Allow public read eleitores"
ON public.eleitores FOR SELECT
USING (true);

CREATE POLICY "Allow public insert eleitores"
ON public.eleitores FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update eleitores"
ON public.eleitores FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete eleitores"
ON public.eleitores FOR DELETE
USING (true);
