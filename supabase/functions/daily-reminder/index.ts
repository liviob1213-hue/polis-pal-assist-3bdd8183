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

    // Fetch overdue tarefas and demandas
    const [tarefasRes, demandasRes, profilesRes] = await Promise.all([
      sb.from("tarefas").select("titulo, status, prazo, assessor_id").neq("status", "Finalizadas").not("prazo", "is", null),
      sb.from("demandas").select("titulo, status, prazo, assessor_id").neq("status", "Resolvido").not("prazo", "is", null),
      sb.from("profiles").select("user_id, nome, telefone, role"),
    ]);

    const tarefas = tarefasRes.data || [];
    const demandas = demandasRes.data || [];
    const profiles = profilesRes.data || [];

    const phoneMap: Record<string, string> = {};
    const nameMap: Record<string, string> = {};
    profiles.forEach((p: any) => {
      if (p.telefone) phoneMap[p.user_id] = p.telefone;
      nameMap[p.user_id] = p.nome;
    });

    // Find overdue items
    const overdueTarefas = tarefas.filter((t: any) => t.prazo && new Date(t.prazo) < now);
    const overdueDemandas = demandas.filter((d: any) => d.prazo && new Date(d.prazo) < now);

    // Group overdue items by assessor
    const alertsByUser: Record<string, string[]> = {};
    
    const addAlert = (userId: string | null, msg: string) => {
      const key = userId || "admin";
      if (!alertsByUser[key]) alertsByUser[key] = [];
      alertsByUser[key].push(msg);
    };

    overdueTarefas.forEach((t: any) => {
      const prazoStr = new Date(t.prazo).toLocaleDateString("pt-BR");
      addAlert(t.assessor_id, `⏰ Tarefa *${t.titulo}* está com prazo vencido (${prazoStr}) - Status: ${t.status}`);
    });

    overdueDemandas.forEach((d: any) => {
      const prazoStr = new Date(d.prazo).toLocaleDateString("pt-BR");
      addAlert(d.assessor_id, `⏰ Demanda *${d.titulo}* está com prazo vencido (${prazoStr}) - Status: ${d.status}`);
    });

    // Send alerts to each user
    const sendMessage = async (phone: string, text: string) => {
      const fullPhone = formatPhoneForUazapi(phone);
      await fetch(`${uazapiUrl}/send/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: uazapiToken },
        body: JSON.stringify({ number: fullPhone, text }),
      });
    };

    let totalAlerts = 0;

    for (const [userId, alerts] of Object.entries(alertsByUser)) {
      if (alerts.length === 0) continue;
      
      const phone = userId === "admin" ? null : phoneMap[userId];
      if (!phone) continue;

      const nome = nameMap[userId] || "Usuário";
      const msg = `🚨 *Alerta de Prazos Vencidos*\n\nOlá ${nome}, você tem ${alerts.length} item(ns) com prazo vencido:\n\n${alerts.join("\n\n")}\n\n_Por favor, atualize o status ou solicite uma extensão de prazo._`;
      
      try {
        await sendMessage(phone, msg);
        totalAlerts++;
      } catch (e) {
        console.error(`Error sending alert to ${userId}:`, e);
      }
    }

    // Also send summary to all politicians
    if (overdueTarefas.length > 0 || overdueDemandas.length > 0) {
      const politicians = profiles.filter((p: any) => p.role === "politico" && p.telefone);
      for (const pol of politicians) {
        const summary = `📊 *Resumo Diário - ${now.toLocaleDateString("pt-BR")}*\n\n⚠️ ${overdueTarefas.length} tarefa(s) com prazo vencido\n⚠️ ${overdueDemandas.length} demanda(s) com prazo vencido\n\n_Total pendente: ${tarefas.length} tarefas, ${demandas.length} demandas_`;
        try {
          await sendMessage(pol.telefone, summary);
        } catch (e) {
          console.error(`Error sending summary to politician:`, e);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, overdueTarefas: overdueTarefas.length, overdueDemandas: overdueDemandas.length, alertsSent: totalAlerts }),
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
