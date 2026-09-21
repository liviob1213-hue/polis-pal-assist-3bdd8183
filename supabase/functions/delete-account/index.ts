// Exclui definitivamente a conta do usuário autenticado (e seus dados).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Não autenticado" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);

    const uid = userData.user.id;

    // Remove vínculos e dados do usuário
    await admin.from("politician_assessors").delete().eq("assessor_id", uid);
    await admin.from("politician_assessors").delete().eq("politician_id", uid);
    await admin.from("user_roles").delete().eq("user_id", uid);
    await admin.from("profiles").delete().eq("user_id", uid);

    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) return json({ error: delErr.message }, 400);

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Erro inesperado" }, 500);
  }
});
