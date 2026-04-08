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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefone } = await req.json();
    if (!telefone) {
      return new Response(JSON.stringify({ error: "Telefone é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formattedPhone = formatPhoneForUazapi(telefone);
    if (formattedPhone.length < 12) {
      return new Response(JSON.stringify({ error: "Telefone inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Store in DB
    const sb = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
    
    // Invalidate previous codes for this phone
    await sb.from("verification_codes").update({ used: true }).eq("telefone", formattedPhone).eq("used", false);

    const { error: insertErr } = await sb.from("verification_codes").insert({
      telefone: formattedPhone,
      code,
    });
    if (insertErr) throw new Error(`DB error: ${insertErr.message}`);

    // Send code via WhatsApp
    const uazapiUrl = getEnv("UAZAPI_URL");
    const uazapiToken = getEnv("UAZAPI_TOKEN");
    const text = `🔐 *DEMOCRAT.AI - Código de Verificação*\n\nSeu código de verificação é: *${code}*\n\nEste código expira em 10 minutos.\n\n_Não compartilhe este código com ninguém._`;

    const res = await fetch(`${uazapiUrl}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: uazapiToken },
      body: JSON.stringify({ number: formattedPhone, text }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("Uazapi error:", res.status, t);
      throw new Error(`Falha ao enviar código: ${res.status}`);
    }

    return new Response(JSON.stringify({ success: true, phone: formattedPhone }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-otp error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
