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

    // All messages start as "pendente" - no fixed time scheduling
    // The process-message-queue function handles the anti-ban logic:
    // - Only sends the next message AFTER the previous recipient replies
    // - Adds a random 8-20 min cooldown after each reply before next send
    const queueEntries = eleitores.map((e) => ({
      tipo: "disparo_massa" as const,
      destinatario_telefone: e.telefone!,
      destinatario_nome: e.nome || "Eleitor",
      mensagem_original: mensagem.trim(),
      status: "pendente" as const,
      agendado_para: new Date().toISOString(),
      campanha_id: campanhaId,
    }));

    // Insert in batches of 100
    for (let i = 0; i < queueEntries.length; i += 100) {
      const batch = queueEntries.slice(i, i + 100);
      const { error: insertErr } = await supabase.from("message_queue").insert(batch);
      if (insertErr) throw new Error(`Erro ao enfileirar: ${insertErr.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        campanhaId,
        totalEnfileirados: queueEntries.length,
        logica: "reply-gated",
        descricao: "Cada mensagem só será enviada após o destinatário anterior responder + delay aleatório de 8-20 min",
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
