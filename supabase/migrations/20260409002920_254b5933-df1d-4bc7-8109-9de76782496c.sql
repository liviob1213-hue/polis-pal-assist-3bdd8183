
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;

ALTER TABLE public.demandas ADD COLUMN IF NOT EXISTS prazo timestamp with time zone DEFAULT NULL;
