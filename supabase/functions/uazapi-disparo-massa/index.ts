import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mensagem } = await req.json();

    if (!mensagem || typeof mensagem !== "string" || !mensagem.trim()) {
      return new Response(
        JSON.stringify({ error: "Mensagem é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all eleitores with phone numbers
    const { data: eleitores, error: dbError } = await supabase
      .from("eleitores")
      .select("nome, telefone")
      .not("telefone", "is", null)
      .neq("telefone", "");

    if (dbError) throw new Error(`Erro ao buscar eleitores: ${dbError.message}`);

    if (!eleitores || eleitores.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum eleitor com telefone cadastrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a campaign ID
    const campanhaId = crypto.randomUUID();
    const INTERVAL_MINUTES = 4;
    const baseTime = new Date();

    // Create queue entries with 4-minute intervals between each
    const queueEntries = eleitores.map((e, index) => {
      const scheduledTime = new Date(baseTime.getTime() + index * INTERVAL_MINUTES * 60 * 1000);
      return {
        tipo: "disparo_massa" as const,
        destinatario_telefone: e.telefone!,
        destinatario_nome: e.nome || "Eleitor",
        mensagem_original: mensagem.trim(),
        status: "pendente" as const,
        agendado_para: scheduledTime.toISOString(),
        campanha_id: campanhaId,
      };
    });

    // Insert in batches of 100
    for (let i = 0; i < queueEntries.length; i += 100) {
      const batch = queueEntries.slice(i, i + 100);
      const { error: insertErr } = await supabase.from("message_queue").insert(batch);
      if (insertErr) throw new Error(`Erro ao enfileirar: ${insertErr.message}`);
    }

    const lastScheduled = queueEntries[queueEntries.length - 1]?.agendado_para;
    const estimatedEnd = new Date(lastScheduled);
    const durationMin = Math.ceil((estimatedEnd.getTime() - baseTime.getTime()) / 60000);

    return new Response(
      JSON.stringify({
        success: true,
        campanhaId,
        totalEnfileirados: queueEntries.length,
        intervaloMinutos: INTERVAL_MINUTES,
        duracaoEstimadaMinutos: durationMin,
        previsaoTermino: estimatedEnd.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
