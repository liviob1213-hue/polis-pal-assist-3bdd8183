// Kiwify webhook — controla acesso recorrente (compra ativa, cancelamento/refund/atraso desativa)
// URL: https://aecwbjydyoxkonqbkfft.supabase.co/functions/v1/kiwify-webhook
//
// Configure na Kiwify:
//   1. Painel Kiwify -> Apps -> Webhooks -> "Adicionar webhook"
//   2. URL: a URL acima
//   3. Eventos: marcar TODOS de pedido e assinatura
//   4. Copiar o "Token de segurança" gerado e salvar como secret KIWIFY_WEBHOOK_TOKEN
//
// Mapeamento de planos (por nome do produto/oferta na Kiwify, contém):
//   "bronze"  -> sem agente legislativo e sem agente WhatsApp
//   "prata"   -> tudo liberado
//   "ouro"    -> tudo liberado
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getEnv(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

function sb() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

// HMAC-SHA1 do raw body usando o token configurado na Kiwify
function verifySignature(rawBody: string, signature: string | null): boolean {
  const token = Deno.env.get("KIWIFY_WEBHOOK_TOKEN");
  if (!token) {
    console.warn("⚠️ KIWIFY_WEBHOOK_TOKEN não configurado — pulando verificação");
    return true;
  }
  if (!signature) return false;
  const expected = createHmac("sha1", token).update(rawBody).digest("hex");
  return expected === signature;
}

function detectPlan(productName?: string, planName?: string): "bronze" | "prata" | "ouro" {
  const s = `${productName || ""} ${planName || ""}`.toLowerCase();
  if (s.includes("bronze")) return "bronze";
  if (s.includes("prata") || s.includes("silver")) return "prata";
  if (s.includes("ouro") || s.includes("gold")) return "ouro";
  // Sem keyword reconhecida: assume plano mais alto (acesso completo)
  return "ouro";
}

// Eventos da Kiwify que ATIVAM acesso
const ACTIVATING_EVENTS = new Set([
  "order_approved",
  "order_paid",
  "subscription_renewed",
  "subscription_approved",
  "subscription_reactivated",
]);

// Eventos que REVOGAM acesso (bronze = sem agente legislativo nem WhatsApp)
const DEACTIVATING_EVENTS = new Set([
  "order_refunded",
  "order_chargeback",
  "subscription_canceled",
  "subscription_late",
  "subscription_expired",
  "pix_created", // pagamento ainda não confirmado
  "billet_created",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = new URL(req.url);
  const signature = url.searchParams.get("signature");
  const rawBody = await req.text();

  if (!verifySignature(rawBody, signature)) {
    console.error("❌ Assinatura inválida");
    return json({ error: "invalid signature" }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const eventType: string =
    payload.webhook_event_type || payload.event || payload.order_status || "unknown";

  const customerEmail: string | undefined =
    payload.Customer?.email || payload.customer?.email || payload.email;

  const subscriptionId: string | undefined =
    payload.Subscription?.id || payload.subscription_id || payload.subscription?.id;

  const orderId: string | undefined = payload.order_id || payload.Order?.id;

  const productName: string | undefined =
    payload.Product?.product_name || payload.product_name || payload.product?.name;
  const planName: string | undefined =
    payload.Subscription?.plan?.name || payload.plan?.name || payload.subscription?.plan?.name;

  const supabase = sb();

  // Log do evento
  const { data: logRow } = await supabase
    .from("kiwify_webhook_logs")
    .insert({
      event_type: eventType,
      order_id: orderId,
      subscription_id: subscriptionId,
      customer_email: customerEmail,
      product_name: productName,
      plan_name: planName,
      payload,
    })
    .select("id")
    .single();
  const logId = logRow?.id;

  const finishLog = async (matched_user_id: string | null, error?: string) => {
    if (!logId) return;
    await supabase
      .from("kiwify_webhook_logs")
      .update({ processed: !error, matched_user_id, error: error || null })
      .eq("id", logId);
  };

  if (!customerEmail) {
    await finishLog(null, "sem e-mail do cliente");
    return json({ status: "ignored", reason: "no customer email" });
  }

  // Encontra o profile por e-mail (case-insensitive)
  const emailLower = customerEmail.toLowerCase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, email, role")
    .or(`email.ilike.${emailLower},kiwify_customer_email.ilike.${emailLower}`)
    .maybeSingle();

  if (!profile) {
    await finishLog(null, `nenhum cadastro com e-mail ${customerEmail}`);
    return json({
      status: "no_match",
      message: `Nenhum político cadastrado com o e-mail ${customerEmail}. Peça para o cliente se cadastrar primeiro com o mesmo e-mail da compra.`,
    });
  }

  const plano = detectPlan(productName, planName);
  let status: "ativa" | "cancelada" | "atrasada" = "ativa";
  let finalPlano = plano;
  let expiraEm: string | null = null;

  if (DEACTIVATING_EVENTS.has(eventType)) {
    // Cancelamento/refund/atraso → rebaixa para bronze (perde agente legislativo + WhatsApp)
    finalPlano = "bronze";
    status =
      eventType === "subscription_late"
        ? "atrasada"
        : eventType === "subscription_expired"
        ? "cancelada"
        : "cancelada";
  } else if (ACTIVATING_EVENTS.has(eventType)) {
    status = "ativa";
    // Renovação: estende validade em ~31 dias
    const next = new Date();
    next.setDate(next.getDate() + 31);
    expiraEm = next.toISOString();
  } else {
    // Evento desconhecido: só registra
    await finishLog(profile.user_id);
    return json({ status: "logged", event: eventType });
  }

  const updates: Record<string, unknown> = {
    plano: finalPlano,
    assinatura_status: status,
    kiwify_customer_email: customerEmail,
  };
  if (subscriptionId) updates.kiwify_subscription_id = subscriptionId;
  if (expiraEm) updates.assinatura_expira_em = expiraEm;

  const { error: upErr } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", profile.user_id);

  if (upErr) {
    console.error("Erro ao atualizar profile:", upErr);
    await finishLog(profile.user_id, upErr.message);
    return json({ error: upErr.message }, 500);
  }

  await finishLog(profile.user_id);

  console.log(
    `✅ Kiwify ${eventType} → ${customerEmail} agora é plano=${finalPlano} status=${status}`,
  );

  return json({
    status: "ok",
    event: eventType,
    user_id: profile.user_id,
    plano: finalPlano,
    assinatura_status: status,
  });
});
