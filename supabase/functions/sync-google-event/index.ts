// Espelha compromissos da agenda interna no Google Agenda do DONO do evento.
// O dono é o assessor_id do compromisso (quando o evento foi lançado para um assessor)
// ou o próprio político/criador quando não há assessor vinculado.
//
// POST body:
// {
//   action: "create" | "update" | "delete",
//   agenda_id: "uuid",                 // id do registro em public.agenda (obrigatório)
//   owner_user_id?: "uuid"             // opcional: sobrescreve o dono calculado no servidor
// }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Retorna um access_token válido do dono, renovando via refresh_token se necessário. */
async function getValidAccessToken(ownerId: string): Promise<string | null> {
  const { data: row } = await admin
    .from("google_calendar_tokens")
    .select("id, access_token, refresh_token, expires_at")
    .eq("user_id", ownerId)
    .maybeSingle();

  if (!row) return null;

  const expired = !row.expires_at || new Date(row.expires_at).getTime() - 60_000 < Date.now();
  if (!expired) return row.access_token;
  if (!row.refresh_token) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Falha ao renovar token:", data);
    return null;
  }

  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  await admin
    .from("google_calendar_tokens")
    .update({ access_token: data.access_token, expires_at: expiresAt })
    .eq("id", row.id);

  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) Autentica quem está chamando
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: authData } = await admin.auth.getUser(token);
    const caller = authData?.user;
    if (!caller) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const action: string = body.action;
    const agendaId: string | undefined = body.agenda_id;

    if (!["create", "update", "delete"].includes(action)) return json({ error: "action inválida" }, 400);
    if (!agendaId) return json({ error: "agenda_id é obrigatório" }, 400);

    // 2) Lê o compromisso (para delete o registro pode já ter sido apagado — usa o snapshot enviado)
    const { data: evento } = await admin
      .from("agenda")
      .select("id, titulo, descricao, data_hora, assessor_id, criado_por, google_event_id")
      .eq("id", agendaId)
      .maybeSingle();

    const snapshot = body.evento ?? {};
    const registro = evento ?? snapshot;
    if (!registro || !registro.id) return json({ error: "Compromisso não encontrado" }, 404);

    // 3) ROTEAMENTO: o dono é o assessor vinculado; senão, quem criou; senão, quem chamou.
    const ownerId: string =
      body.owner_user_id ?? registro.assessor_id ?? registro.criado_por ?? caller.id;

    const accessToken = await getValidAccessToken(ownerId);
    if (!accessToken) {
      return json(
        { skipped: true, reason: "Dono do evento não conectou o Google Agenda", owner_user_id: ownerId },
        200,
      );
    }

    const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    const googleEventId: string | null = registro.google_event_id ?? snapshot.google_event_id ?? null;

    // 4) DELETE
    if (action === "delete") {
      if (!googleEventId) return json({ skipped: true, reason: "Evento sem google_event_id" });
      const res = await fetch(`${base}/${googleEventId}`, { method: "DELETE", headers });
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        const detail = await res.text();
        console.error("Google delete falhou:", res.status, detail);
        return json({ error: "Google delete falhou", status: res.status, details: detail }, res.status);
      }
      return json({ ok: true, deleted: googleEventId, owner_user_id: ownerId });
    }

    // 5) CREATE / UPDATE
    const inicio = new Date(registro.data_hora);
    const fim = new Date(inicio.getTime() + 60 * 60 * 1000); // 1h de duração padrão

    const payload = {
      summary: registro.titulo,
      description: registro.descricao ?? "",
      start: { dateTime: inicio.toISOString(), timeZone: "America/Sao_Paulo" },
      end: { dateTime: fim.toISOString(), timeZone: "America/Sao_Paulo" },
      source: { title: "DEMOCRAT.AI", url: "https://polis-pal-assist.lovable.app/agenda" },
    };

    const useUpdate = action === "update" && googleEventId;
    const res = await fetch(useUpdate ? `${base}/${googleEventId}` : base, {
      method: useUpdate ? "PATCH" : "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const gEvent = await res.json();
    if (!res.ok) {
      console.error("Google sync falhou:", res.status, gEvent);
      return json({ error: "Google sync falhou", status: res.status, details: gEvent }, res.status);
    }

    // 6) Guarda o id do evento no Google para futuras edições/exclusões
    if (evento) {
      await admin.from("agenda").update({ google_event_id: gEvent.id }).eq("id", registro.id);
    }

    return json({ ok: true, google_event_id: gEvent.id, owner_user_id: ownerId });
  } catch (e) {
    console.error("sync-google-event erro:", e);
    return json({ error: String(e) }, 500);
  }
});
