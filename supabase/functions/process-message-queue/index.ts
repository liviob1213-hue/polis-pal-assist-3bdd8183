import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getEnv(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

function formatPhoneForUazapi(phone: string): string {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55")) digits = `55${digits}`;
  if (digits.length === 13 && digits[4] === "9") {
    digits = digits.slice(0, 4) + digits.slice(5);
  }
  return digits;
}

// Generate a humanized variation of a message using AI
async function generateVariation(originalMessage: string, recipientName: string, tipo: string): Promise<string> {
  const key = getEnv("LOVABLE_API_KEY");

  const systemPrompt = `Você é um especialista em comunicação humanizada via WhatsApp. Sua tarefa é reescrever a mensagem abaixo mantendo o SENTIDO COMPLETO mas mudando:
- Estrutura da frase (inverta ordem, use sinônimos)
- Pontuação e emojis (varie entre 😊🙏👋✅📌📋 etc)
- Saudações (Olá, Oi, E aí, Fala, Bom dia/tarde)
- Tom (mais formal ou mais informal, alternando)
- Comprimento (algumas mais curtas, outras mais detalhadas)
- Inclua o nome "${recipientName}" de forma natural quando possível
- NUNCA repita a mensagem original palavra por palavra
- Pareça uma pessoa real digitando, com naturalidade
- Tipo de mensagem: ${tipo}

Retorne APENAS a mensagem reescrita, nada mais.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Mensagem original: "${originalMessage}"` },
        ],
        temperature: 1.2,
      }),
    });
    if (!res.ok) {
      console.error("AI variation error:", res.status);
      return originalMessage;
    }
    const data = await res.json();
    const variation = data.choices?.[0]?.message?.content?.trim();
    return variation || originalMessage;
  } catch (e) {
    console.error("Error generating variation:", e);
    return originalMessage;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const uazapiUrl = getEnv("UAZAPI_URL");
    const uazapiToken = getEnv("UAZAPI_TOKEN");

    const sb = createClient(supabaseUrl, supabaseKey);
    const now = new Date().toISOString();

    // Pick the NEXT pending message that is scheduled for now or earlier
    const { data: messages, error: fetchErr } = await sb
      .from("message_queue")
      .select("*")
      .eq("status", "pendente")
      .lte("agendado_para", now)
      .order("agendado_para", { ascending: true })
      .limit(1);

    if (fetchErr) throw new Error(`DB fetch error: ${fetchErr.message}`);
    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "Nenhuma mensagem na fila" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const msg = messages[0];

    // Mark as "enviando"
    await sb.from("message_queue").update({ status: "enviando" }).eq("id", msg.id);

    // Generate variation if not already generated
    let textToSend = msg.mensagem_variacao;
    if (!textToSend) {
      textToSend = await generateVariation(
        msg.mensagem_original,
        msg.destinatario_nome || "amigo",
        msg.tipo
      );
      await sb.from("message_queue").update({ mensagem_variacao: textToSend }).eq("id", msg.id);
    }

    // Send via UAZAPI
    const fullPhone = formatPhoneForUazapi(msg.destinatario_telefone);
    const uazapiRes = await fetch(`${uazapiUrl}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: uazapiToken },
      body: JSON.stringify({ number: fullPhone, text: textToSend }),
    });

    if (!uazapiRes.ok) {
      const errText = await uazapiRes.text();
      await sb.from("message_queue").update({
        status: "erro",
        erro_detalhe: `UAZAPI ${uazapiRes.status}: ${errText}`,
      }).eq("id", msg.id);
      throw new Error(`UAZAPI error: ${uazapiRes.status}`);
    }

    // Mark as sent
    await sb.from("message_queue").update({
      status: "enviado",
      enviado_em: new Date().toISOString(),
      mensagem_variacao: textToSend,
    }).eq("id", msg.id);

    // Count remaining
    const { count } = await sb
      .from("message_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente")
      .eq("campanha_id", msg.campanha_id);

    return new Response(
      JSON.stringify({
        processed: 1,
        messageId: msg.id,
        remaining: count || 0,
        destinatario: msg.destinatario_nome,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-message-queue error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
