import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const uazapiUrl = Deno.env.get("UAZAPI_URL")!;
    const uazapiToken = Deno.env.get("UAZAPI_TOKEN")!;

    const sb = createClient(supabaseUrl, supabaseKey);
    const now = new Date();

    // Fetch ALL pending tarefas and demandas (not just overdue)
    const [tarefasRes, demandasRes, profilesRes] = await Promise.all([
      sb.from("tarefas").select("titulo, status, prazo, assessor_id, created_at").neq("status", "Finalizadas"),
      sb.from("demandas").select("titulo, status, prazo, assessor_id, created_at").neq("status", "Resolvido"),
      sb.from("profiles").select("user_id, nome, telefone, role"),
    ]);

    const tarefas = tarefasRes.data || [];
    const demandas = demandasRes.data || [];
    const profiles = profilesRes.data || [];

    const phoneMap: Record<string, string> = {};
    const nameMap: Record<string, string> = {};
    const roleMap: Record<string, string> = {};
    profiles.forEach((p: any) => {
      if (p.telefone) phoneMap[p.user_id] = p.telefone;
      nameMap[p.user_id] = p.nome;
      roleMap[p.user_id] = p.role;
    });

    // Group items by assessor_id (owner)
    const itemsByUser: Record<string, { tarefas: any[], demandas: any[], overdueTarefas: any[], overdueDemandas: any[] }> = {};

    const ensureUser = (userId: string) => {
      if (!itemsByUser[userId]) {
        itemsByUser[userId] = { tarefas: [], demandas: [], overdueTarefas: [], overdueDemandas: [] };
      }
    };

    tarefas.forEach((t: any) => {
      if (!t.assessor_id) return;
      ensureUser(t.assessor_id);
      itemsByUser[t.assessor_id].tarefas.push(t);
      if (t.prazo && new Date(t.prazo) < now) {
        itemsByUser[t.assessor_id].overdueTarefas.push(t);
      }
    });

    demandas.forEach((d: any) => {
      if (!d.assessor_id) return;
      ensureUser(d.assessor_id);
      itemsByUser[d.assessor_id].demandas.push(d);
      if (d.prazo && new Date(d.prazo) < now) {
        itemsByUser[d.assessor_id].overdueDemandas.push(d);
      }
    });

    const sendMessageFn = async (phone: string, text: string) => {
      const fullPhone = formatPhoneForUazapi(phone);
      await fetch(`${uazapiUrl}/send/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: uazapiToken },
        body: JSON.stringify({ number: fullPhone, text }),
      });
    };

    let totalAlerts = 0;

    // Send individual summary to each user (politician or assessor) with pending items
    for (const [userId, items] of Object.entries(itemsByUser)) {
      const phone = phoneMap[userId];
      if (!phone) continue;

      const nome = nameMap[userId] || "Usuário";
      const lines: string[] = [];

      if (items.overdueTarefas.length > 0) {
        lines.push(`🔴 *${items.overdueTarefas.length} tarefa(s) com prazo vencido:*`);
        items.overdueTarefas.forEach((t: any) => {
          const prazoStr = new Date(t.prazo).toLocaleDateString("pt-BR");
          lines.push(`  ⏰ ${t.titulo} (prazo: ${prazoStr})`);
        });
      }

      if (items.overdueDemandas.length > 0) {
        lines.push(`🔴 *${items.overdueDemandas.length} demanda(s) com prazo vencido:*`);
        items.overdueDemandas.forEach((d: any) => {
          const prazoStr = new Date(d.prazo).toLocaleDateString("pt-BR");
          lines.push(`  ⏰ ${d.titulo} (prazo: ${prazoStr})`);
        });
      }

      const pendingTarefas = items.tarefas.filter((t: any) => !items.overdueTarefas.includes(t));
      const pendingDemandas = items.demandas.filter((d: any) => !items.overdueDemandas.includes(d));

      if (pendingTarefas.length > 0) {
        lines.push(`🟡 *${pendingTarefas.length} tarefa(s) pendente(s):*`);
        pendingTarefas.slice(0, 5).forEach((t: any) => {
          const prazoStr = t.prazo ? ` (prazo: ${new Date(t.prazo).toLocaleDateString("pt-BR")})` : "";
          lines.push(`  📌 ${t.titulo} - ${t.status}${prazoStr}`);
        });
        if (pendingTarefas.length > 5) lines.push(`  _...e mais ${pendingTarefas.length - 5}_`);
      }

      if (pendingDemandas.length > 0) {
        lines.push(`🟡 *${pendingDemandas.length} demanda(s) pendente(s):*`);
        pendingDemandas.slice(0, 5).forEach((d: any) => {
          const prazoStr = d.prazo ? ` (prazo: ${new Date(d.prazo).toLocaleDateString("pt-BR")})` : "";
          lines.push(`  📌 ${d.titulo} - ${d.status}${prazoStr}`);
        });
        if (pendingDemandas.length > 5) lines.push(`  _...e mais ${pendingDemandas.length - 5}_`);
      }

      if (lines.length === 0) continue;

      const msg = `📊 *Resumo Diário - ${now.toLocaleDateString("pt-BR")}*\n\nOlá ${nome}!\n\n${lines.join("\n")}\n\n_Atualize os status pelo WhatsApp ou pelo sistema._`;

      try {
        await sendMessageFn(phone, msg);
        totalAlerts++;
      } catch (e) {
        console.error(`Error sending alert to ${userId}:`, e);
      }
    }

    // Send global summary to politicians (overview of ALL items)
    const allOverdueTarefas = tarefas.filter((t: any) => t.prazo && new Date(t.prazo) < now);
    const allOverdueDemandas = demandas.filter((d: any) => d.prazo && new Date(d.prazo) < now);

    const politicians = profiles.filter((p: any) => p.role === "politico" && p.telefone);
    for (const pol of politicians) {
      // Skip if politician already received individual alert above
      const alreadySent = itemsByUser[pol.user_id];

      const summary = `📊 *Visão Geral do Gabinete - ${now.toLocaleDateString("pt-BR")}*\n\n📋 ${tarefas.length} tarefa(s) pendente(s)\n📋 ${demandas.length} demanda(s) pendente(s)\n${allOverdueTarefas.length > 0 ? `⚠️ ${allOverdueTarefas.length} tarefa(s) com prazo vencido\n` : ""}${allOverdueDemandas.length > 0 ? `⚠️ ${allOverdueDemandas.length} demanda(s) com prazo vencido` : "✅ Nenhum prazo vencido"}`;

      try {
        await sendMessageFn(pol.telefone, summary);
      } catch (e) {
        console.error(`Error sending summary to politician:`, e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, pendingTarefas: tarefas.length, pendingDemandas: demandas.length, alertsSent: totalAlerts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("daily-reminder error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
