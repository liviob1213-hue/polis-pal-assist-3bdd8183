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
    const { telefone, code, nome, email, password } = await req.json();

    if (!telefone || !code || !nome || !email || !password) {
      return new Response(JSON.stringify({ error: "Todos os campos são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formattedPhone = formatPhoneForUazapi(telefone);
    const sb = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));

    // Check code
    const { data: codeData, error: codeErr } = await sb
      .from("verification_codes")
      .select("*")
      .eq("telefone", formattedPhone)
      .eq("code", code)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (codeErr || !codeData) {
      return new Response(JSON.stringify({ error: "Código inválido ou expirado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark code as used
    await sb.from("verification_codes").update({ used: true }).eq("id", codeData.id);

    // Create user in Supabase Auth
    const { data: authData, error: authErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, telefone: formattedPhone },
    });

    if (authErr) {
      // If user already exists, try to sign in
      if (authErr.message?.includes("already") || authErr.message?.includes("exists")) {
        return new Response(JSON.stringify({ error: "Este email já está cadastrado. Faça login." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Auth error: ${authErr.message}`);
    }

    // Create profile
    const { error: profileErr } = await sb.from("profiles").insert({
      user_id: authData.user.id,
      nome,
      email,
      telefone: formattedPhone,
      whatsapp_verified: true,
      is_authorized: true,
    });

    if (profileErr) {
      console.error("Profile creation error:", profileErr);
    }

    // Send welcome message via WhatsApp
    const uazapiUrl = getEnv("UAZAPI_URL");
    const uazapiToken = getEnv("UAZAPI_TOKEN");

    const welcomeText = `🎉 *Bem-vindo(a) ao DEMOCRAT.AI, ${nome}!*

✅ Seu cadastro foi concluído com sucesso!

📋 *Seus dados:*
👤 Nome: ${nome}
📧 Email: ${email}
📱 WhatsApp: ${formattedPhone}

━━━━━━━━━━━━━━━━━━━━

🤖 *Guia do Assistente - O que posso fazer por você:*

👥 *1. Gestão de Eleitores*
• "Cadastre o eleitor João, telefone 31999999999, endereço Rua das Flores 100"
• "Quais eleitores tenho em Lagoa Santa?"
• "Eleitores com interesse em saúde"

📋 *2. Gestão de Demandas*
• "Registre uma demanda: buraco na Rua das Flores"
• "Quais demandas estão em aberto?"
• "Mova a demanda do buraco para Em Andamento"
• "Conclua a demanda do buraco na Rua das Flores"

✅ *3. Gestão de Tarefas*
• "Crie a tarefa reunião com o Carlos amanhã às 14h"
• "A reunião com o Carlos está em andamento"
• "Conclua a tarefa reunião com o Carlos"

📜 *4. Projetos de Lei*
• "Crie um projeto de lei sobre acessibilidade"
• "Gere um PL baseado na demanda do buraco"

📢 *5. Disparo em Massa*
• "Envie mensagem para todos: Reunião sexta às 19h"

💡 *Dica:* Basta escrever naturalmente o que precisa! A IA entenderá sua intenção.

━━━━━━━━━━━━━━━━━━━━
_DEMOCRAT.AI - Seu gabinete inteligente_ 🏛️`;

    try {
      await fetch(`${uazapiUrl}/send/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: uazapiToken },
        body: JSON.stringify({ number: formattedPhone, text: welcomeText }),
      });
    } catch (e) {
      console.error("Welcome message error:", e);
    }

    return new Response(JSON.stringify({ success: true, user_id: authData.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("verify-otp error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
