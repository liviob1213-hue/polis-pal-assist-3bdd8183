// Fluxo OAuth 2.0 do Google Agenda.
// Ações:
//   GET  ?action=start&token=<jwt do usuário logado>   -> redireciona para o consentimento do Google
//   GET  ?code=...&state=<user_id>                     -> callback do Google, salva tokens e volta ao app
//   POST { action: "status" }                          -> informa se o usuário logado está conectado
//   POST { action: "disconnect" }                      -> remove os tokens do usuário logado
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
// Precisa ser EXATAMENTE a mesma URI cadastrada no Google Cloud Console:
// https://<project-ref>.supabase.co/functions/v1/google-auth
const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI")!;
// URL do app para onde o usuário volta depois de autorizar (ex.: https://seuapp.com/configuracoes)
const APP_REDIRECT_URL = Deno.env.get("APP_REDIRECT_URL") ?? "https://polis-pal-assist.lovable.app/configuracoes";

const SCOPE = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

async function getUserFromToken(token: string | null) {
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);

  try {
    function buildAuthUrl(userId: string) {
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", SCOPE);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("include_granted_scopes", "true");
      // state carrega o dono da agenda (político OU assessor — cada um conecta a sua)
      authUrl.searchParams.set("state", userId);
      return authUrl.toString();
    }

    // ---------- 2) Callback do Google ----------
    if (req.method === "GET" && url.searchParams.get("code")) {
      const code = url.searchParams.get("code")!;
      const userId = url.searchParams.get("state");
      if (!userId) return new Response("state ausente", { status: 400, headers: corsHeaders });

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error("Erro ao trocar code por token:", tokenJson);
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: `${APP_REDIRECT_URL}?google=erro` },
        });
      }

      const expiresAt = new Date(Date.now() + (tokenJson.expires_in ?? 3600) * 1000).toISOString();

      // Mantém o refresh_token antigo caso o Google não devolva um novo
      const { data: existing } = await admin
        .from("google_calendar_tokens")
        .select("id, refresh_token")
        .eq("user_id", userId)
        .maybeSingle();

      const payload = {
        user_id: userId,
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token ?? existing?.refresh_token ?? null,
        expires_at: expiresAt,
      };

      const { error } = existing
        ? await admin.from("google_calendar_tokens").update(payload).eq("id", existing.id)
        : await admin.from("google_calendar_tokens").insert(payload);

      if (error) console.error("Erro ao salvar tokens:", error);

      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: `${APP_REDIRECT_URL}?google=${error ? "erro" : "ok"}` },
      });
    }

    // ---------- 3) status / disconnect ----------
    if (req.method === "POST") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const user = await getUserFromToken(authHeader.replace("Bearer ", "") || null);
      if (!user) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json().catch(() => ({}));

      // Início do fluxo: devolve a URL de consentimento do Google (sem redirecionar)
      if (body.action === "start" || body.action === "authorize") {
        return new Response(JSON.stringify({ url: buildAuthUrl(user.id) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.action === "disconnect") {
        await admin.from("google_calendar_tokens").delete().eq("user_id", user.id);
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }


      const { data } = await admin
        .from("google_calendar_tokens")
        .select("expires_at")
        .eq("user_id", user.id)
        .maybeSingle();

      return new Response(JSON.stringify({ connected: !!data, expires_at: data?.expires_at ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Requisição inválida", { status: 400, headers: corsHeaders });
  } catch (e) {
    console.error("google-auth erro:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
