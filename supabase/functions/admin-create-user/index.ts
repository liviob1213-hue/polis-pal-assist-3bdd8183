// Edge function para o painel /admin criar contas de político ou assessor.
// Requer JWT do usuário chamador (deve ser role 'politico').
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autenticado: sem token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado", detail: userErr?.message }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "politico")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Apenas políticos podem usar esta função" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { nome, email, telefone, senha, role } = await req.json();
    if (!nome || !email || !senha || !role) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (role !== "politico" && role !== "assessor") {
      return new Response(JSON.stringify({ error: "Role inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cria usuário já confirmado
    let newId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, telefone: telefone || "", role },
    });
    if (createErr || !created?.user) {
      const msg = (createErr?.message || "").toLowerCase();
      const alreadyExists = msg.includes("already") || msg.includes("registered") || msg.includes("exists");
      if (!alreadyExists) {
        return new Response(JSON.stringify({ error: createErr?.message || "Erro ao criar usuário" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Busca usuário existente por email e atualiza senha/metadata
      let existing: any = null;
      let page = 1;
      while (page <= 20 && !existing) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (listErr) break;
        existing = list.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
        if (!list.users.length || list.users.length < 200) break;
        page++;
      }
      if (!existing) {
        return new Response(JSON.stringify({ error: "Email já cadastrado mas não foi possível localizar o usuário" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      newId = existing.id;
      await admin.auth.admin.updateUserById(newId, {
        password: senha,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata || {}), nome, telefone: telefone || "", role },
      });
    } else {
      newId = created.user.id;
    }

    // Profile
    await admin.from("profiles").upsert({
      user_id: newId,
      nome,
      email,
      telefone: telefone || "",
      role,
      status: "aprovado",
      is_authorized: true,
      whatsapp_verified: false,
    }, { onConflict: "user_id" });

    // user_roles
    await admin.from("user_roles").upsert({ user_id: newId, role }, { onConflict: "user_id,role" });

    // Se for assessor, vincula ao político criador
    if (role === "assessor") {
      await admin.from("politician_assessors").upsert({
        politician_id: userData.user.id,
        assessor_id: newId,
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: newId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
