// Cliente Supabase apontando para o projeto EXTERNO (auto-hospedado pelo usuário).
// Credenciais hardcoded porque o painel Connectors está em loop.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

const SUPABASE_URL = "https://aecwbjydyoxkonqbkfft.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlY3dianlkeW94a29ucWJrZmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTQwMTcsImV4cCI6MjA5MzA5MDAxN30.9Q7U3XiXAkOqd7MvB8gSJjpBdiP9KGxGHL4VAlp3vQw";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  }
});
