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
    const { mensagem, delayMin = 15, delayMax = 30 } = await req.json();

    if (!mensagem || typeof mensagem !== "string" || !mensagem.trim()) {
      return new Response(
        JSON.stringify({ error: "Mensagem é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const uazapiUrl = Deno.env.get("UAZAPI_URL")!;
    const uazapiToken = Deno.env.get("UAZAPI_TOKEN")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all eleitores with phone numbers
    const { data: eleitores, error: dbError } = await supabase
      .from("eleitores")
      .select("telefone")
      .not("telefone", "is", null)
      .neq("telefone", "");

    if (dbError) {
      throw new Error(`Erro ao buscar eleitores: ${dbError.message}`);
    }

    if (!eleitores || eleitores.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum eleitor com telefone cadastrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build messages list for UAZAPI
    const messagesList = eleitores.map((e) => {
      const phone = e.telefone!.replace(/\D/g, "");
      const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
      return {
        number: fullPhone,
        type: "text",
        text: mensagem,
      };
    });

    // Send to UAZAPI
    const uazapiResponse = await fetch(`${uazapiUrl}/sender/advanced`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: uazapiToken,
      },
      body: JSON.stringify({
        delayMin: Number(delayMin),
        delayMax: Number(delayMax),
        info: "Disparo Gabinete",
        messages: messagesList,
      }),
    });

    if (!uazapiResponse.ok) {
      const errorText = await uazapiResponse.text();
      throw new Error(`Erro UAZAPI (${uazapiResponse.status}): ${errorText}`);
    }

    const result = await uazapiResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        totalEnviados: messagesList.length,
        resultado: result,
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
