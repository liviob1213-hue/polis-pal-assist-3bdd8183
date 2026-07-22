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

    const [tarefasRes, demandasRes, profilesRes, linksRes] = await Promise.all([
      sb.from("tarefas").select("titulo, status, prazo, assessor_id, criado_por, politician_id, created_at").neq("status", "Finalizadas"),
      sb.from("demandas").select("titulo, status, prazo, assessor_id, criado_por, created_at").neq("status", "Resolvido"),
      sb.from("profiles").select("user_id, nome, telefone, role"),
      sb.from("politician_assessors").select("politician_id, assessor_id"),
    ]);

    const tarefas = tarefasRes.data || [];
    const demandas = demandasRes.data || [];
    const profiles = profilesRes.data || [];
    const links = linksRes.data || [];

    const phoneMap: Record<string, string> = {};
    const nameMap: Record<string, string> = {};
    const roleMap: Record<string, string> = {};
    profiles.forEach((p: any) => {
      if (p.telefone) phoneMap[p.user_id] = p.telefone;
      nameMap[p.user_id] = p.nome;
      roleMap[p.user_id] = p.role;
    });

    // politician_id -> Set<assessor_id>
    const teamByPolitician: Record<string, Set<string>> = {};
    // assessor_id -> politician_id
    const politicianByAssessor: Record<string, string> = {};
    links.forEach((l: any) => {
      if (!teamByPolitician[l.politician_id]) teamByPolitician[l.politician_id] = new Set();
      teamByPolitician[l.politician_id].add(l.assessor_id);
      politicianByAssessor[l.assessor_id] = l.politician_id;
    });

    // Determine the owning politician for any given tarefa/demanda
    const ownerPoliticianTarefa = (t: any): string | null => {
      if (t.politician_id) return t.politician_id;
      if (t.assessor_id && politicianByAssessor[t.assessor_id]) return politicianByAssessor[t.assessor_id];
      if (t.assessor_id && roleMap[t.assessor_id] === "politico") return t.assessor_id;
      if (t.criado_por && roleMap[t.criado_por] === "politico") return t.criado_por;
      if (t.criado_por && politicianByAssessor[t.criado_por]) return politicianByAssessor[t.criado_por];
      return null;
    };
    const ownerPoliticianDemanda = (d: any): string | null => {
      if (d.assessor_id && politicianByAssessor[d.assessor_id]) return politicianByAssessor[d.assessor_id];
      if (d.assessor_id && roleMap[d.assessor_id] === "politico") return d.assessor_id;
      if (d.criado_por && roleMap[d.criado_por] === "politico") return d.criado_por;
      if (d.criado_por && politicianByAssessor[d.criado_por]) return politicianByAssessor[d.criado_por];
      return null;
    };

    // Group items per USER (for individual assessor summaries) and per POLITICIAN (for gabinete overview)
    type Bucket = { tarefas: any[]; demandas: any[]; overdueTarefas: any[]; overdueDemandas: any[] };
    const empty = (): Bucket => ({ tarefas: [], demandas: [], overdueTarefas: [], overdueDemandas: [] });

    const itemsByUser: Record<string, Bucket> = {};
    const itemsByPolitician: Record<string, Bucket> = {};

    const pushTarefa = (map: Record<string, Bucket>, key: string, t: any) => {
      if (!map[key]) map[key] = empty();
      map[key].tarefas.push(t);
      if (t.prazo && new Date(t.prazo) < now) map[key].overdueTarefas.push(t);
    };
    const pushDemanda = (map: Record<string, Bucket>, key: string, d: any) => {
      if (!map[key]) map[key] = empty();
      map[key].demandas.push(d);
      if (d.prazo && new Date(d.prazo) < now) map[key].overdueDemandas.push(d);
    };

    tarefas.forEach((t: any) => {
      if (t.assessor_id) pushTarefa(itemsByUser, t.assessor_id, t);
      const pol = ownerPoliticianTarefa(t);
      if (pol) pushTarefa(itemsByPolitician, pol, t);
    });

    demandas.forEach((d: any) => {
      if (d.assessor_id) pushDemanda(itemsByUser, d.assessor_id, d);
      const pol = ownerPoliticianDemanda(d);
      if (pol) pushDemanda(itemsByPolitician, pol, d);
    });

    const sendMessageFn = async (phone: string, text: string) => {
      const fullPhone = formatPhoneForUazapi(phone);
      await fetch(`${uazapiUrl}/send/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: uazapiToken },
        body: JSON.stringify({ number: fullPhone, text }),
      });
    };

    const buildLines = (items: Bucket): string[] => {
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
      return lines;
    };

    let totalAlerts = 0;

    // Individual assessor summaries (own workload only)
    for (const [userId, items] of Object.entries(itemsByUser)) {
      if (roleMap[userId] === "politico") continue; // politicians handled below
      const phone = phoneMap[userId];
      if (!phone) continue;
      const nome = nameMap[userId] || "Usuário";
      const lines = buildLines(items);
      if (lines.length === 0) continue;
      const msg = `📊 *Resumo Diário - ${now.toLocaleDateString("pt-BR")}*\n\nOlá ${nome}!\n\n${lines.join("\n")}\n\n_Atualize os status pelo WhatsApp ou pelo sistema._`;
      try {
        await sendMessageFn(phone, msg);
        totalAlerts++;
      } catch (e) {
        console.error(`Error sending alert to ${userId}:`, e);
      }
    }

    // Per-politician gabinete summary (SCOPED to their own tenant)
    const politicians = profiles.filter((p: any) => p.role === "politico" && p.telefone);
    for (const pol of politicians) {
      const bucket = itemsByPolitician[pol.user_id] || empty();
      const lines = buildLines(bucket);

      const header = `📊 *Resumo do seu Gabinete - ${now.toLocaleDateString("pt-BR")}*\n\nOlá ${pol.nome || "Político"}!\n\n📋 ${bucket.tarefas.length} tarefa(s) pendente(s)\n📋 ${bucket.demandas.length} demanda(s) pendente(s)`;

      const body = lines.length > 0
        ? `\n\n${lines.join("\n")}`
        : `\n\n✅ Nenhuma pendência no momento.`;

      try {
        await sendMessageFn(pol.telefone, `${header}${body}`);
        totalAlerts++;
      } catch (e) {
        console.error(`Error sending summary to politician ${pol.user_id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, pendingTarefas: tarefas.length, pendingDemandas: demandas.length, alertsSent: totalAlerts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("daily-reminder error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
