
-- Tabela de demandas
CREATE TABLE public.demandas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'Em Análise',
  localizacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.demandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read demandas" ON public.demandas FOR SELECT USING (true);
CREATE POLICY "Allow public insert demandas" ON public.demandas FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update demandas" ON public.demandas FOR UPDATE USING (true);
CREATE POLICY "Allow public delete demandas" ON public.demandas FOR DELETE USING (true);

-- Tabela de projetos de lei
CREATE TABLE public.projetos_lei (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  texto_completo TEXT NOT NULL,
  demanda_id UUID REFERENCES public.demandas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projetos_lei ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read projetos_lei" ON public.projetos_lei FOR SELECT USING (true);
CREATE POLICY "Allow public insert projetos_lei" ON public.projetos_lei FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update projetos_lei" ON public.projetos_lei FOR UPDATE USING (true);
CREATE POLICY "Allow public delete projetos_lei" ON public.projetos_lei FOR DELETE USING (true);

-- Tabela de tarefas (kanban)
CREATE TABLE public.tarefas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'Novas Tarefas',
  prazo TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read tarefas" ON public.tarefas FOR SELECT USING (true);
CREATE POLICY "Allow public insert tarefas" ON public.tarefas FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update tarefas" ON public.tarefas FOR UPDATE USING (true);
CREATE POLICY "Allow public delete tarefas" ON public.tarefas FOR DELETE USING (true);

-- Tabela de agenda
CREATE TABLE public.agenda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  tarefa_id UUID REFERENCES public.tarefas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read agenda" ON public.agenda FOR SELECT USING (true);
CREATE POLICY "Allow public insert agenda" ON public.agenda FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update agenda" ON public.agenda FOR UPDATE USING (true);
CREATE POLICY "Allow public delete agenda" ON public.agenda FOR DELETE USING (true);

-- Trigger para updated_at em todas as tabelas
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_demandas_updated_at BEFORE UPDATE ON public.demandas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projetos_lei_updated_at BEFORE UPDATE ON public.projetos_lei FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tarefas_updated_at BEFORE UPDATE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_agenda_updated_at BEFORE UPDATE ON public.agenda FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime para as tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.demandas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tarefas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agenda;
