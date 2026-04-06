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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const uazapiUrl = Deno.env.get("UAZAPI_URL")!;
    const uazapiToken = Deno.env.get("UAZAPI_TOKEN")!;
    const adminPhone = Deno.env.get("ADMIN_WHATSAPP")!;

    if (!adminPhone) {
      throw new Error("ADMIN_WHATSAPP not configured");
    }

    const sb = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const { data: tarefas, error } = await sb
      .from("tarefas")
      .select("titulo, status, prazo")
      .neq("status", "Finalizadas")
      .or(`prazo.is.null,prazo.lte.${today.toISOString()}`)
      .order("prazo", { ascending: true });

    if (error) throw new Error(`DB error: ${error.message}`);

    if (!tarefas || tarefas.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma tarefa pendente hoje" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const atrasadas = tarefas.filter(
      (t: any) => t.prazo && new Date(t.prazo) < new Date()
    );
    const pendentes = tarefas.filter(
      (t: any) => !t.prazo || new Date(t.prazo) >= new Date()
    );

    let msg = `🔔 *Resumo de Tarefas Pendentes - ${today.toLocaleDateString("pt-BR")}*\n`;

    if (atrasadas.length > 0) {
      msg += `\n⚠️ *ATRASADAS (${atrasadas.length}):*\n`;
      atrasadas.forEach((t: any, i: number) => {
        const prazo = t.prazo
          ? new Date(t.prazo).toLocaleDateString("pt-BR")
          : "sem prazo";
        msg += `${i + 1}. ${t.titulo} (${prazo}) - ${t.status}\n`;
      });
    }

    if (pendentes.length > 0) {
      msg += `\n📋 *PENDENTES (${pendentes.length}):*\n`;
      pendentes.forEach((t: any, i: number) => {
        const prazo = t.prazo
          ? new Date(t.prazo).toLocaleDateString("pt-BR")
          : "sem prazo";
        msg += `${i + 1}. ${t.titulo} (${prazo}) - ${t.status}\n`;
      });
    }

    msg += `\n_Total: ${tarefas.length} tarefa(s) pendente(s)_`;

    // Send via Uazapi
    const fullPhone = adminPhone.replace(/\D/g, "").startsWith("55")
      ? adminPhone.replace(/\D/g, "")
      : `55${adminPhone.replace(/\D/g, "")}`;

    const uazRes = await fetch(`${uazapiUrl}/sendText`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: uazapiToken },
      body: JSON.stringify({ number: fullPhone, text: msg }),
    });

    if (!uazRes.ok) {
      const t = await uazRes.text();
      throw new Error(`Uazapi error ${uazRes.status}: ${t}`);
    }

    return new Response(
      JSON.stringify({ success: true, tarefas: tarefas.length }),
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
