import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json; charset=utf-8",
};

// Gera todas as variações plausíveis de um telefone BR (com/sem 55, com/sem 9 extra)
function phoneVariants(phone: string): string[] {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return [];
  const set = new Set<string>();
  set.add(digits);

  // Sem o 55 inicial
  let local = digits;
  if (local.startsWith("55") && local.length >= 12) local = local.slice(2);
  set.add(local);

  // Com 55 forçado
  set.add(`55${local}`);

  // Local com e sem o 9 (apenas celular: DDD + 9XXXXXXXX)
  if (local.length === 11 && local[2] === "9") {
    const sem9 = local.slice(0, 2) + local.slice(3);
    set.add(sem9);
    set.add(`55${sem9}`);
  } else if (local.length === 10) {
    const com9 = local.slice(0, 2) + "9" + local.slice(2);
    set.add(com9);
    set.add(`55${com9}`);
  }

  return [...set].filter(Boolean);
}

// ─── Helpers ────────────────────────────────────────────────

function getEnv(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

function supabaseAdmin() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

// ─── Formatação de telefone para Uazapi ─────────────────────

function formatPhoneForUazapi(phone: string): string {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55")) digits = `55${digits}`;
  if (digits.length === 13 && digits[4] === "9") {
    digits = digits.slice(0, 4) + digits.slice(5);
  }
  return digits;
}

function sanitizeTextForUazapi(text: string): string {
  // Mantém emojis intactos. Apenas normaliza para NFC (codificação correta) e
  // limpa espaços/quebras excessivas. NÃO remove emojis nem variation selectors.
  return String(text || "")
    .normalize("NFC")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stringifyJsonAscii(payload: unknown): string {
  // Envia JSON como ASCII puro: acentos/emojis viram escapes \uXXXX.
  // A Uazapi decodifica os escapes ao ler o JSON, evitando mojibake no transporte/copia.
  return JSON.stringify(payload).replace(/[\u007f-\uffff]/g, (char) => {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}

function extractMessageFromWebhook(body: any): string {
  const candidates = [
    body?.message?.content,
    body?.message?.message?.conversation,
    body?.message?.message?.extendedTextMessage?.text,
    body?.message?.body,
    body?.message?.text,
    body?.text?.message,
    body?.text,
    body?.chat?.wa_lastMessageTextVote,
    body?.mensagem,
    body?.body,
  ];
  const message = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return typeof message === "string" ? message.trim() : "";
}

function extractAudioUrl(body: any): string | null {
  // UAZAPI audio message formats
  const candidates = [
    body?.message?.message?.audioMessage?.url,
    body?.message?.mediaUrl,
    body?.message?.media?.url,
    body?.message?.message?.documentMessage?.url,
    body?.mediaUrl,
    body?.media?.url,
    body?.audio?.url,
    body?.message?.audio?.url,
  ];
  const url = candidates.find((v) => typeof v === "string" && v.startsWith("http"));
  if (url) return url;
  
  // Check if it's an audio message type
  const msgType = body?.message?.messageType || body?.message?.type || body?.messageType || "";
  const isAudio = msgType === "audioMessage" || msgType === "audio" || msgType === "ptt";
  if (isAudio) {
    // Try base64 audio
    const b64 = body?.message?.message?.audioMessage?.base64 || body?.message?.base64 || body?.base64;
    if (b64) return `base64:${b64}`;
  }
  return null;
}

async function transcribeAudio(audioUrl: string): Promise<string> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

  // Baixar/decodificar o áudio
  let audioBytes: Uint8Array;
  let mimeType = "audio/ogg";
  let filename = "audio.ogg";

  if (audioUrl.startsWith("base64:")) {
    const b64 = audioUrl.slice(7);
    const bin = atob(b64);
    audioBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) audioBytes[i] = bin.charCodeAt(i);
  } else {
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`Failed to download audio: ${audioRes.status}`);
    const ct = audioRes.headers.get("content-type");
    if (ct && ct.startsWith("audio/")) mimeType = ct.split(";")[0];
    audioBytes = new Uint8Array(await audioRes.arrayBuffer());
  }

  // Ajusta extensão pelo mime
  if (mimeType.includes("mp3") || mimeType.includes("mpeg")) filename = "audio.mp3";
  else if (mimeType.includes("m4a") || mimeType.includes("mp4")) filename = "audio.m4a";
  else if (mimeType.includes("wav")) filename = "audio.wav";
  else if (mimeType.includes("webm")) filename = "audio.webm";
  else { filename = "audio.ogg"; mimeType = "audio/ogg"; }

  const form = new FormData();
  form.append("file", new Blob([audioBytes], { type: mimeType }), filename);
  form.append("model", "whisper-1");
  form.append("language", "pt");
  form.append("response_format", "text");

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: form,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Whisper transcription error:", resp.status, errText);
    if (resp.status === 429) throw new Error("Limite de requisições atingido, tente novamente em alguns instantes.");
    if (resp.status === 401) throw new Error("OPENAI_API_KEY inválida.");
    throw new Error(`Whisper API ${resp.status}`);
  }

  const text = await resp.text();
  return (text || "").trim();
}

function extractSenderPhone(body: any): string {
  const candidates = [
    body?.message?.chatid,
    body?.chat?.wa_chatid,
    body?.message?.key?.remoteJid,
    body?.key?.remoteJid,
    body?.chat?.phone,
    body?.message?.from,
    body?.from,
    body?.sender,
    body?.phone,
    body?.number,
    body?.telefone,
    body?.chat?.wa_fastid?.split?.(":")?.[1],
    body?.chat?.id,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const digits = String(candidate).replace(/\D/g, "");
    if (digits.length >= 10) return formatPhoneForUazapi(digits);
  }
  return "";
}

// ─── Números autorizados ────────────────────────────────────

async function getAuthorizedNumbers(): Promise<string[]> {
  const all: string[] = [];
  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("profiles")
      .select("telefone")
      .eq("is_authorized", true)
      .eq("whatsapp_verified", true);
    if (data) {
      for (const p of data) {
        if (p.telefone) all.push(formatPhoneForUazapi(p.telefone));
      }
    }
  } catch (e) {
    console.error("Error fetching authorized numbers:", e);
  }
  return [...new Set(all.filter(Boolean))];
}

// Busca profile por telefone tentando múltiplas variações + fallback LIKE pelos últimos 8 dígitos
async function findProfileByPhone(phone: string) {
  const sb = supabaseAdmin();
  const variants = phoneVariants(phone);
  console.log(`🔍 findProfileByPhone - input: "${phone}" | variantes: ${JSON.stringify(variants)}`);
  if (variants.length === 0) return null;

  // 1) Match exato em qualquer variação (sem filtros restritivos - basta existir o profile com role)
  const { data: exact, error: exactErr } = await sb
    .from("profiles")
    .select("user_id, nome, role, telefone, is_authorized, whatsapp_verified, plano, assinatura_status")
    .in("telefone", variants)
    .limit(1);
  if (exactErr) console.error("findProfileByPhone exact error:", exactErr);
  if (exact && exact.length > 0) {
    console.log(`✅ Profile encontrado (exato): ${exact[0].nome} | role=${exact[0].role} | tel=${exact[0].telefone}`);
    return exact[0];
  }

  // 2) Fallback: LIKE pelos últimos 8 dígitos (núcleo do número, sem DDD nem 9 nem 55)
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length >= 8) {
    const tail = digits.slice(-8);
    const { data: fuzzy, error: fuzzyErr } = await sb
      .from("profiles")
      .select("user_id, nome, role, telefone, is_authorized, whatsapp_verified, plano, assinatura_status")
      .ilike("telefone", `%${tail}%`)
      .limit(1);
    if (fuzzyErr) console.error("findProfileByPhone fuzzy error:", fuzzyErr);
    if (fuzzy && fuzzy.length > 0) {
      console.log(`✅ Profile encontrado (fuzzy ...${tail}): ${fuzzy[0].nome} | role=${fuzzy[0].role} | tel=${fuzzy[0].telefone}`);
      return fuzzy[0];
    }
  }

  console.log(`❌ Nenhum profile encontrado para "${phone}". Variantes testadas: ${JSON.stringify(variants)}`);
  return null;
}

// Retorna o plano efetivo do remetente. Assessor herda o plano do político vinculado.
async function getEffectivePlan(profile: any): Promise<"bronze" | "prata" | "ouro"> {
  if (!profile) return "ouro";
  if (profile.role === "politico") return (profile.plano as any) || "ouro";
  if (profile.role === "assessor") {
    const sb = supabaseAdmin();
    const { data: link } = await sb
      .from("politician_assessors")
      .select("politician_id")
      .eq("assessor_id", profile.user_id)
      .maybeSingle();
    if (!link?.politician_id) return "ouro";
    const { data: pol } = await sb
      .from("profiles")
      .select("plano")
      .eq("user_id", link.politician_id)
      .maybeSingle();
    return ((pol as any)?.plano as any) || "ouro";
  }
  return "ouro";
}

async function isAuthorized(phone: string): Promise<boolean> {
  const profile = await findProfileByPhone(phone);
  if (!profile) return false;
  // Autorizado se for político ou assessor - não exigimos is_authorized/whatsapp_verified aqui,
  // pois o webhook do WhatsApp não tem como "verificar" o número novamente.
  return profile.role === "politico" || profile.role === "assessor";
}

// ─── Get sender profile and role ────────────────────────────

async function getSenderProfile(phone: string) {
  const profile = await findProfileByPhone(phone);
  if (!profile) return null;
  return { user_id: profile.user_id, nome: profile.nome, role: profile.role };
}

// ─── Get allowed user IDs for a politician scope ────────────
// Returns the politician's user_id + all his assessors' user_ids.
// Used to filter demandas/tarefas so each politician sees only his own scope.
async function getPoliticianScopeUserIds(politicianUserId: string): Promise<string[]> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("politician_assessors")
    .select("assessor_id")
    .eq("politician_id", politicianUserId);
  const ids = new Set<string>([politicianUserId]);
  (data || []).forEach((r: any) => r.assessor_id && ids.add(r.assessor_id));
  return [...ids];
}

// ─── Find assessor by name ──────────────────────────────────

async function findAssessorByName(name: string, politicianId: string) {
  const sb = supabaseAdmin();
  const { data: links } = await sb
    .from("politician_assessors")
    .select("assessor_id")
    .eq("politician_id", politicianId);
  
  if (!links || links.length === 0) return null;
  
  const assessorIds = links.map((l: any) => l.assessor_id);
  
  const { data: profiles } = await sb
    .from("profiles")
    .select("user_id, nome, telefone")
    .in("user_id", assessorIds);
  
  if (!profiles || profiles.length === 0) return null;
  
  // Fuzzy match: normalize accents and case
  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const needle = normalize(name);
  const match = profiles.find((p: any) => normalize(p.nome).includes(needle));
  return match || null;
}


// ─── Uazapi ─────────────────────────────────────────────────

async function sendMessage(phone: string, text: string) {
  const url = getEnv("UAZAPI_URL");
  const token = getEnv("UAZAPI_TOKEN");
  const fullPhone = formatPhoneForUazapi(phone);
  const safeText = sanitizeTextForUazapi(text);

  const res = await fetch(`${url}/send/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Accept": "application/json; charset=utf-8",
      token,
    },
    body: stringifyJsonAscii({ number: fullPhone, text: safeText }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("Uazapi error:", res.status, t);
    throw new Error(`Uazapi ${res.status}`);
  }
  return res.json();
}

// ─── Queue notification with AI variation (5-min intervals) ──

async function queueAssessorNotification(
  phone: string,
  nome: string,
  mensagemOriginal: string,
  tipo: "tarefa" | "demanda",
  referenciaId?: string
) {
  const sb = supabaseAdmin();
  
  // Find latest queued message for assessor notifications to calculate next slot
  const { data: lastQueued } = await sb
    .from("message_queue")
    .select("agendado_para")
    .in("tipo", ["tarefa", "demanda"])
    .in("status", ["pendente", "enviando"])
    .order("agendado_para", { ascending: false })
    .limit(1);
  
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  const now = new Date();
  let scheduledTime = now;
  
  if (lastQueued && lastQueued.length > 0) {
    const lastTime = new Date(lastQueued[0].agendado_para);
    if (lastTime.getTime() > now.getTime()) {
      scheduledTime = new Date(lastTime.getTime() + INTERVAL_MS);
    } else {
      scheduledTime = new Date(now.getTime() + INTERVAL_MS);
    }
  }

  await sb.from("message_queue").insert({
    tipo,
    destinatario_telefone: phone,
    destinatario_nome: nome,
    mensagem_original: mensagemOriginal,
    status: "pendente",
    agendado_para: scheduledTime.toISOString(),
    referencia_id: referenciaId || null,
  });
  
  console.log(`📋 Queued ${tipo} notification for ${nome} at ${scheduledTime.toISOString()}`);
}

// ─── Chat History ───────────────────────────────────────────

async function getChatHistory(phone: string, limit = 10): Promise<Array<{role: string, message: string, context: any}>> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("chat_history")
    .select("role, message, context")
    .eq("telefone", phone)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []).reverse();
}

async function saveChatMessage(phone: string, role: string, message: string, context: any = null) {
  const sb = supabaseAdmin();
  await sb.from("chat_history").insert({ telefone: phone, role, message, context });
  // Clean old messages (keep last 30)
  const { data: old } = await sb
    .from("chat_history")
    .select("id")
    .eq("telefone", phone)
    .order("created_at", { ascending: false })
    .range(30, 100);
  if (old && old.length > 0) {
    await sb.from("chat_history").delete().in("id", old.map((o: any) => o.id));
  }
}

async function getPendingContext(phone: string): Promise<any | null> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("chat_history")
    .select("context")
    .eq("telefone", phone)
    .eq("role", "assistant")
    .not("context", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (data && data.length > 0 && data[0].context?.pending) {
    return data[0].context;
  }
  return null;
}

// ─── AI (Anthropic Claude) ──────────────────────────────────

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

async function callAI(systemPrompt: string, userMessage: string, history: Array<{role: string, message: string}> = [], maxTokens: number = 4096): Promise<string> {
  const key = getEnv("ANTHROPIC_API_KEY");
  const messages: any[] = [];
  for (const h of history) {
    messages.push({ role: h.role === "assistant" ? "assistant" : "user", content: h.message });
  }
  messages.push({ role: "user", content: userMessage });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("Claude AI error:", res.status, t);
    throw new Error(`Claude ${res.status}`);
  }
  const data = await res.json();
  const textBlock = (data.content || []).find((b: any) => b.type === "text");
  return textBlock?.text ?? "";
}

async function extractJSON(systemPrompt: string, userMessage: string, history: Array<{role: string, message: string}> = []): Promise<any> {
  const key = getEnv("ANTHROPIC_API_KEY");
  const messages: any[] = [];
  for (const h of history) {
    messages.push({ role: h.role === "assistant" ? "assistant" : "user", content: h.message });
  }
  messages.push({ role: "user", content: userMessage });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tool_choice: { type: "tool", name: "extract_data" },
      tools: [{
        name: "extract_data",
        description: "Extraia dados estruturados da mensagem do usuário",
        input_schema: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: [
                "cadastrar_eleitor",
                "consultar_eleitor",
                "criar_demanda",
                "consultar_demanda",
                "concluir_demanda",
                "mover_demanda",
                "criar_projeto_lei",
                "criar_tarefa",
                "mover_tarefa",
                "concluir_tarefa",
                "disparo_massa",
                "conversa_geral",
              ],
            },
            nome: { type: "string" },
            telefone: { type: "string" },
            endereco: { type: "string" },
            interesse: { type: "string" },
            titulo: { type: "string" },
            descricao: { type: "string" },
            localizacao: { type: "string" },
            status_filtro: { type: "string" },
            novo_status: { type: "string", description: "Novo status para mover demanda ou tarefa." },
            busca_texto: { type: "string" },
            data_hora: { type: "string", description: "ISO 8601 datetime para prazo" },
            prazo: { type: "string", description: "Prazo/deadline em ISO 8601. Ex: '2026-04-15'" },
            tarefa_busca: { type: "string" },
            mensagem_broadcast: { type: "string" },
            assessor_nome: { type: "string", description: "Nome do assessor para atribuir a demanda/tarefa." },
            campos_faltantes: { type: "array", items: { type: "string" }, description: "Lista de campos que o usuário NÃO forneceu e são importantes" },
          },
          required: ["intent"],
        },
      }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("Claude extract error:", res.status, t);
    throw new Error(`Claude ${res.status}`);
  }
  const data = await res.json();
  const toolUse = (data.content || []).find((b: any) => b.type === "tool_use");
  if (!toolUse) throw new Error("No tool_use block returned by Claude");
  return toolUse.input;
}

// ─── Fuzzy search helper (accent-insensitive) ───────────────

function normalizeText(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// ─── Intent Handlers ────────────────────────────────────────

async function handleCadastrarEleitor(params: any): Promise<string> {
  const sb = supabaseAdmin();
  const { error } = await sb.from("eleitores").insert({
    nome: params.nome || "Sem nome",
    telefone: params.telefone || null,
    endereco: params.endereco || null,
    interesse: params.interesse || null,
  });
  if (error) throw new Error(`DB error: ${error.message}`);
  return `✅ Eleitor *${params.nome}* cadastrado com sucesso!`;
}

async function handleConsultarEleitor(params: any): Promise<string> {
  const sb = supabaseAdmin();
  let query = sb.from("eleitores").select("*").order("nome", { ascending: true });
  if (params.localizacao) query = query.ilike("endereco", `%${params.localizacao}%`);
  if (params.interesse) query = query.ilike("interesse", `%${params.interesse}%`);
  if (params.busca_texto && !params.localizacao && !params.interesse) {
    query = query.or(`nome.ilike.%${params.busca_texto}%,endereco.ilike.%${params.busca_texto}%,interesse.ilike.%${params.busca_texto}%`);
  }
  const { data, error } = await query.limit(20);
  if (error) throw new Error(`DB error: ${error.message}`);
  if (!data || data.length === 0) return `📋 Nenhum eleitor encontrado.`;
  const lines = data.map((e: any, i: number) => `${i + 1}. *${e.nome}*\n   📍 ${e.endereco || "Sem endereço"}\n   📞 ${e.telefone || "Sem telefone"}\n   🎯 ${e.interesse || "Sem interesse"}`);
  return `👥 *${data.length} eleitor(es) encontrado(s):*\n\n${lines.join("\n\n")}`;
}

async function handleCriarDemanda(params: any, senderProfile: any): Promise<string> {
  const sb = supabaseAdmin();
  
  // Check for missing important fields and ask
  const missing: string[] = [];
  if (!params.descricao && !params.titulo) missing.push("descrição");
  if (!params.localizacao) missing.push("localização");
  if (!params.prazo && !params.data_hora) missing.push("prazo");
  
  if (missing.length > 0 && params.campos_faltantes && params.campos_faltantes.length > 0) {
    // The AI detected missing fields - ask the user
    const camposTexto = missing.join(", ");
    return `ℹ️ Para cadastrar a demanda *${params.titulo || params.descricao || ""}*, faltam algumas informações:\n\n${missing.map(c => `• ${c.charAt(0).toUpperCase() + c.slice(1)}`).join("\n")}\n\nDeseja adicionar esses dados? Envie as informações ou responda "criar assim mesmo" para cadastrar sem eles.`;
  }
  
  let assessorId: string | null = null;
  let assessorNotification = "";

  if (params.assessor_nome && senderProfile?.role === "politico") {
    // Check if assigning to self
    const selfNames = ["eu", "mim", "eu mesmo", "pra mim", "para mim", "meu", "si mesmo", "próprio", "proprio"];
    const isSelfAssign = selfNames.some(s => normalizeText(params.assessor_nome).includes(s));
    
    if (isSelfAssign) {
      assessorId = senderProfile.user_id;
      assessorNotification = `\n📌 Atribuída a você mesmo.`;
    } else {
      const assessor = await findAssessorByName(params.assessor_nome, senderProfile.user_id);
      if (assessor) {
        assessorId = assessor.user_id;
        try {
          await queueAssessorNotification(
            assessor.telefone,
            assessor.nome,
            `📋 *Nova demanda atribuída a você!*\n\n📌 ${params.titulo || params.descricao || "Nova demanda"}\n${params.descricao ? `ℹ️ ${params.descricao}` : ""}\n${params.localizacao ? `📍 ${params.localizacao}` : ""}\n${params.prazo ? `📅 Prazo: ${params.prazo}` : ""}\n\n_Atribuída por ${senderProfile.nome}_\n\n⚠️ *Por favor, confirme o recebimento respondendo: você consegue assumir essa demanda?*`,
            "demanda"
          );
          assessorNotification = `\n💬 Notificação enfileirada para o assessor *${assessor.nome}*!`;
        } catch (e) {
          console.error("Error queuing assessor notification:", e);
        }
      } else {
        return `❌ Assessor "${params.assessor_nome}" não encontrado entre seus assessores cadastrados.`;
      }
    }
  }

  // Politician without assessor_nome → assign to self
  if (senderProfile?.role === "politico" && !assessorId && !params.assessor_nome) {
    assessorId = senderProfile.user_id;
  }

  if (senderProfile?.role === "assessor" && !assessorId) {
    assessorId = senderProfile.user_id;
  }

  const prazoValue = params.prazo || params.data_hora || null;

  const { error } = await sb.from("demandas").insert({
    titulo: params.titulo || params.descricao || "Nova demanda",
    descricao: params.descricao || null,
    localizacao: params.localizacao || null,
    status: "Em Análise",
    assessor_id: assessorId,
    criado_por: senderProfile?.user_id ?? assessorId,
    prazo: prazoValue,
  });
  if (error) throw new Error(`DB error: ${error.message}`);
  const prazoStr = prazoValue ? `\n📅 Prazo: ${prazoValue}` : "";
  return `✅ Demanda *${params.titulo || "Nova demanda"}* registrada com status "Em Análise".${prazoStr}${assessorNotification}`;
}

// Map user synonyms to real DB status variants for demanda queries.
// Returns multiple possible values because older records may have been saved
// as "Aberto" while newer records use "Em Análise".
const DEMANDA_STATUS_SYNONYMS: Record<string, string[]> = {
  analise: ["Em Análise", "Em análise", "Em Analise", "Em analise", "em análise", "em analise", "Análise", "Analise", "Aberto", "Aberta", "aberto", "aberta", "Pendente", "pendente"],
  andamento: ["Em Andamento", "em andamento", "Andamento", "andamento"],
  resolvido: ["Resolvido", "Resolvida", "resolvido", "resolvida", "Finalizado", "Finalizada"],
};

function resolveStatusFilter(raw: string): string[] {
  const needle = normalizeText(raw);
  if (["em analise", "analise", "analisando", "aberto", "aberta", "nova", "novas", "pendente"].some((s) => needle.includes(s))) {
    return DEMANDA_STATUS_SYNONYMS.analise;
  }
  if (["em andamento", "andamento", "progresso"].some((s) => needle.includes(s))) {
    return DEMANDA_STATUS_SYNONYMS.andamento;
  }
  if (["resolvido", "resolvida", "concluido", "concluida", "finalizado", "finalizada", "fechado", "fechada"].some((s) => needle.includes(s))) {
    return DEMANDA_STATUS_SYNONYMS.resolvido;
  }
  return [raw, normalizeText(raw)];
}

async function handleConsultarDemanda(params: any, senderProfile: any): Promise<string> {
  const sb = supabaseAdmin();
  let query = sb.from("demandas").select("*").order("created_at", { ascending: false });
  
  // SCOPE: assessor sees only own; politico sees only his scope (himself + his assessors)
  if (senderProfile?.role === "assessor") {
    query = query.eq("assessor_id", senderProfile.user_id);
  } else if (senderProfile?.role === "politico") {
    const scope = await getPoliticianScopeUserIds(senderProfile.user_id);
    const scopeCsv = scope.map((id) => `"${id}"`).join(",");
    query = query.or(`assessor_id.in.(${scopeCsv}),criado_por.in.(${scopeCsv})`);
  }
  
  if (params.status_filtro) {
    const resolved = resolveStatusFilter(params.status_filtro);
    query = query.in("status", resolved);
  }
  if (params.busca_texto) query = query.or(`titulo.ilike.%${params.busca_texto}%,descricao.ilike.%${params.busca_texto}%`);
  const { data, error } = await query.limit(10);
  if (error) throw new Error(`DB error: ${error.message}`);
  if (!data || data.length === 0) return "📋 Nenhuma demanda encontrada com esse filtro.";
  const lines = data.map((d: any, i: number) => {
    const prazoInfo = d.prazo ? `\n   📅 Prazo: ${new Date(d.prazo).toLocaleDateString("pt-BR")}` : "";
    return `${i + 1}. *${d.titulo}*\n   📍 ${d.localizacao || "Sem local"}\n   📌 Status: ${d.status}${prazoInfo}`;
  });
  return `📋 *${data.length} demanda(s) encontrada(s):*\n\n${lines.join("\n\n")}`;
}

  
  if (params.status_filtro) {
    const resolved = resolveStatusFilter(params.status_filtro);
    query = query.in("status", resolved);
  }
  if (params.busca_texto) query = query.or(`titulo.ilike.%${params.busca_texto}%,descricao.ilike.%${params.busca_texto}%`);
  const { data, error } = await query.limit(10);
  if (error) throw new Error(`DB error: ${error.message}`);
  if (!data || data.length === 0) return "📋 Nenhuma demanda encontrada com esse filtro.";
  const lines = data.map((d: any, i: number) => {
    const prazoInfo = d.prazo ? `\n   📅 Prazo: ${new Date(d.prazo).toLocaleDateString("pt-BR")}` : "";
    return `${i + 1}. *${d.titulo}*\n   📍 ${d.localizacao || "Sem local"}\n   📌 Status: ${d.status}${prazoInfo}`;
  });
  return `📋 *${data.length} demanda(s) encontrada(s):*\n\n${lines.join("\n\n")}`;
}

async function handleConcluirDemanda(params: any, senderProfile: any): Promise<string> {
  const sb = supabaseAdmin();
  const busca = params.busca_texto || params.titulo || "";
  let q = sb.from("demandas").select("id, titulo, status, assessor_id, criado_por").ilike("titulo", `%${busca}%`).neq("status", "Resolvido");
  if (senderProfile?.role === "assessor") {
    q = q.eq("assessor_id", senderProfile.user_id);
  } else if (senderProfile?.role === "politico") {
    const scope = await getPoliticianScopeUserIds(senderProfile.user_id);
    const csv = scope.map((id) => `"${id}"`).join(",");
    q = q.or(`assessor_id.in.(${csv}),criado_por.in.(${csv})`);
  }
  const { data, error: fErr } = await q.limit(1).maybeSingle();
  if (fErr || !data) return `❌ Demanda "${busca}" não encontrada ou já resolvida.`;
  const { error: uErr } = await sb.from("demandas").update({ status: "Resolvido" }).eq("id", data.id);
  if (uErr) throw new Error(`DB error: ${uErr.message}`);
  return `✅ Demanda *${data.titulo}* marcada como Resolvida!`;
}


// ─── Status normalization ────────────────────────────────────

const DEMANDA_STATUS_MAP: Record<string, string> = {
  "aberto": "Aberto",
  "em análise": "Em Análise",
  "em analise": "Em Análise",
  "em andamento": "Em Andamento",
  "resolvido": "Resolvido",
  "resolvida": "Resolvido",
};

const TAREFA_STATUS_MAP: Record<string, string> = {
  "novas tarefas": "Novas Tarefas",
  "nova tarefa": "Novas Tarefas",
  "em andamento": "Em Andamento",
  "finalizadas": "Finalizadas",
  "finalizada": "Finalizadas",
  "concluída": "Finalizadas",
  "concluida": "Finalizadas",
};

function normalizeDemandaStatus(raw: string): string {
  return DEMANDA_STATUS_MAP[raw.toLowerCase().trim()] || raw;
}

function normalizeTarefaStatus(raw: string): string {
  return TAREFA_STATUS_MAP[raw.toLowerCase().trim()] || raw;
}

async function handleMoverDemanda(params: any, senderProfile: any): Promise<string> {
  const sb = supabaseAdmin();
  const busca = params.busca_texto || params.titulo || "";
  const novoStatus = normalizeDemandaStatus(params.novo_status || "Em Andamento");
  
  // Fuzzy search: get all non-resolved (within scope) and match in code
  let q = sb.from("demandas").select("id, titulo, status, assessor_id, criado_por").neq("status", "Resolvido").limit(50);
  if (senderProfile?.role === "assessor") {
    q = q.eq("assessor_id", senderProfile.user_id);
  } else if (senderProfile?.role === "politico") {
    const scope = await getPoliticianScopeUserIds(senderProfile.user_id);
    const csv = scope.map((id) => `"${id}"`).join(",");
    q = q.or(`assessor_id.in.(${csv}),criado_por.in.(${csv})`);
  }
  const { data: allDemandas } = await q;
  if (!allDemandas || allDemandas.length === 0) return `❌ Nenhuma demanda ativa encontrada.`;
  
  const needle = normalizeText(busca);
  const match = allDemandas.find((d: any) => normalizeText(d.titulo).includes(needle));
  if (!match) return `❌ Demanda "${busca}" não encontrada.`;
  
  if (match.status === novoStatus) return `ℹ️ Demanda *${match.titulo}* já está em *${novoStatus}*.`;
  const { error: uErr } = await sb.from("demandas").update({ status: novoStatus }).eq("id", match.id);
  if (uErr) throw new Error(`DB error: ${uErr.message}`);
  return `✅ Demanda *${match.titulo}* movida para *${novoStatus}*!`;
}


async function handleCriarProjetoLei(params: any, senderPhone?: string): Promise<string> {
  const sb = supabaseAdmin();
  let demandaContext = "";
  let demandaId: string | null = null;
  if (params.busca_texto) {
    const { data } = await sb.from("demandas").select("*").or(`titulo.ilike.%${params.busca_texto}%,descricao.ilike.%${params.busca_texto}%`).limit(1).single();
    if (data) {
      demandaContext = `Título: ${data.titulo}\nDescrição: ${data.descricao}\nLocal: ${data.localizacao}`;
      demandaId = data.id;
    }
  }
  const prompt = `Você é um *Assistente Legislativo Especialista*. Gere um *Projeto de Lei* formal e COMPLETO para uma Câmara Municipal com base na demanda abaixo.

Use formato oficial e a *formatação do WhatsApp* (asteriscos para negrito, sem markdown). Estruture com:
*EMENTA*, *JUSTIFICATIVA* e os *ARTIGOS* numerados (Art. 1º, Art. 2º...).

Use emojis com moderação nos cabeçalhos (📜 ⚖️ 📌). Não corte o texto.

Demanda: ${demandaContext || params.descricao || params.titulo || "demanda geral"}`;
  // 8192 tokens para garantir que o PL gigante não seja cortado
  const textoLei = await callAI(prompt, "Gere o projeto de lei completo, sem omitir nenhuma parte.", [], 8192);
  const titulo = params.titulo || `PL - ${params.busca_texto || "Novo Projeto"}`;
  const { error } = await sb.from("projetos_lei").insert({ titulo, texto_completo: textoLei, demanda_id: demandaId });
  if (error) throw new Error(`DB error: ${error.message}`);

  const cabecalho = `📜 *Projeto de Lei gerado:* ${titulo}\n\n`;
  const fullText = cabecalho + textoLei;

  // WhatsApp tem limite ~4096 chars. Se o PL for maior, enviamos em partes.
  const LIMITE = 3800;
  if (fullText.length <= LIMITE) {
    return fullText;
  }

  // Quebra em partes e envia as adicionais já aqui (a primeira é retornada normalmente)
  if (senderPhone) {
    const partes: string[] = [];
    let resto = fullText;
    let n = 1;
    while (resto.length > LIMITE) {
      // tenta quebrar em uma quebra de linha próxima
      let corte = resto.lastIndexOf("\n", LIMITE);
      if (corte < LIMITE * 0.6) corte = LIMITE;
      partes.push(resto.slice(0, corte));
      resto = resto.slice(corte).trimStart();
      n++;
    }
    if (resto.length > 0) partes.push(resto);

    // Envia da parte 2 em diante
    for (let i = 1; i < partes.length; i++) {
      try {
        await sendMessage(senderPhone, `📜 *Continuação (${i + 1}/${partes.length}):*\n\n${partes[i]}`);
      } catch (e) {
        console.error("Erro enviando parte do PL:", e);
      }
    }
    return `${partes[0]}\n\n_📄 Continua nas próximas mensagens (${partes.length} partes no total)..._`;
  }

  return fullText.slice(0, LIMITE) + "\n\n_(Texto completo salvo no sistema)_";
}

async function handleCriarTarefa(params: any, senderProfile: any): Promise<string> {
  const sb = supabaseAdmin();
  const titulo = params.titulo || params.descricao || "Nova tarefa";
  const prazo = params.prazo || params.data_hora || null;
  let assessorId: string | null = null;
  let assessorNotification = "";

  // Check for missing important fields
  const missing: string[] = [];
  if (!params.descricao) missing.push("descrição");
  if (!prazo) missing.push("prazo");
  
  if (missing.length > 0 && params.campos_faltantes && params.campos_faltantes.length > 0) {
    const camposTexto = missing.join(", ");
    return `ℹ️ Para criar a tarefa *${titulo}*, faltam algumas informações:\n\n${missing.map(c => `• ${c.charAt(0).toUpperCase() + c.slice(1)}`).join("\n")}\n\nDeseja adicionar? Envie as informações ou responda "criar assim mesmo" para cadastrar sem eles.`;
  }

  if (params.assessor_nome && senderProfile?.role === "politico") {
    const selfNames = ["eu", "mim", "eu mesmo", "pra mim", "para mim", "meu", "si mesmo", "próprio", "proprio"];
    const isSelfAssign = selfNames.some(s => normalizeText(params.assessor_nome).includes(s));
    
    if (isSelfAssign) {
      assessorId = senderProfile.user_id;
      assessorNotification = `\n📌 Atribuída a você mesmo.`;
    } else {
      const assessor = await findAssessorByName(params.assessor_nome, senderProfile.user_id);
      if (assessor) {
        assessorId = assessor.user_id;
        try {
          await queueAssessorNotification(
            assessor.telefone,
            assessor.nome,
            `✅ *Nova tarefa atribuída a você!*\n\n📌 ${titulo}\n${params.descricao ? `ℹ️ ${params.descricao}` : ""}\n${prazo ? `📅 Prazo: ${new Date(prazo).toLocaleString("pt-BR")}` : ""}\n\n_Atribuída por ${senderProfile.nome}_\n\n⚠️ *Por favor, confirme o recebimento respondendo: você consegue realizar essa tarefa no prazo?*`,
            "tarefa"
          );
          assessorNotification = `\n💬 Notificação enfileirada para o assessor *${assessor.nome}*!`;
        } catch (e) {
          console.error("Error queuing assessor notification:", e);
        }
      } else {
        return `❌ Assessor "${params.assessor_nome}" não encontrado entre seus assessores cadastrados.`;
      }
    }
  }

  // Politician without assessor_nome → assign to self
  if (senderProfile?.role === "politico" && !assessorId && !params.assessor_nome) {
    assessorId = senderProfile.user_id;
  }

  if (senderProfile?.role === "assessor" && !assessorId) {
    assessorId = senderProfile.user_id;
  }

  const { data: tarefa, error: tErr } = await sb
    .from("tarefas")
    .insert({ titulo, descricao: params.descricao || null, prazo, assessor_id: assessorId })
    .select("id")
    .single();
  if (tErr) throw new Error(`DB error: ${tErr.message}`);

  if (prazo) {
    await sb.from("agenda").insert({
      titulo,
      descricao: params.descricao || null,
      data_hora: prazo,
      tarefa_id: tarefa.id,
      assessor_id: assessorId,
    });
  }

  const prazoStr = prazo ? `\n📅 Prazo: ${new Date(prazo).toLocaleString("pt-BR")}` : "";
  return `✅ Tarefa *${titulo}* criada com sucesso!${prazoStr}\n📌 Status: Novas Tarefas${assessorNotification}`;
}

async function handleMoverTarefa(params: any, senderProfile: any): Promise<string> {
  const sb = supabaseAdmin();
  const busca = params.tarefa_busca || params.busca_texto || params.titulo || "";
  const novoStatus = normalizeTarefaStatus(params.novo_status || "Em Andamento");
  
  // Fuzzy accent-insensitive search: get all tasks and match in code
  let query = sb.from("tarefas").select("id, titulo, status, assessor_id, politician_id, criado_por").limit(50);
  
  // SCOPE
  if (senderProfile?.role === "assessor") {
    query = query.eq("assessor_id", senderProfile.user_id);
  } else if (senderProfile?.role === "politico") {
    const scope = await getPoliticianScopeUserIds(senderProfile.user_id);
    const csv = scope.map((id) => `"${id}"`).join(",");
    query = query.or(`politician_id.eq.${senderProfile.user_id},assessor_id.in.(${csv}),criado_por.in.(${csv})`);
  }

  
  const { data: allTarefas } = await query;
  if (!allTarefas || allTarefas.length === 0) return `❌ Nenhuma tarefa encontrada.`;
  
  const needle = normalizeText(busca);
  console.log(`🔍 Searching tasks: needle="${needle}", tasks=${allTarefas.map((t: any) => `"${t.titulo}"`).join(", ")}`);
  
  const match = allTarefas.find((t: any) => normalizeText(t.titulo).includes(needle));
  if (!match) return `❌ Tarefa "${busca}" não encontrada. Tarefas disponíveis:\n${allTarefas.map((t: any) => `• ${t.titulo} (${t.status})`).join("\n")}`;
  
  if (match.status === novoStatus) return `ℹ️ Tarefa *${match.titulo}* já está em *${novoStatus}*.`;
  const { error: uErr } = await sb.from("tarefas").update({ status: novoStatus }).eq("id", match.id);
  if (uErr) throw new Error(`DB error: ${uErr.message}`);
  return `✅ Tarefa *${match.titulo}* movida de *${match.status}* para *${novoStatus}*!`;
}

async function handleConcluirTarefa(params: any, senderProfile: any): Promise<string> {
  const sb = supabaseAdmin();
  const busca = params.tarefa_busca || params.titulo || params.busca_texto || "";
  
  let query = sb.from("tarefas").select("id, titulo, assessor_id, politician_id, criado_por").neq("status", "Finalizadas").limit(50);
  if (senderProfile?.role === "assessor") {
    query = query.eq("assessor_id", senderProfile.user_id);
  } else if (senderProfile?.role === "politico") {
    const scope = await getPoliticianScopeUserIds(senderProfile.user_id);
    const csv = scope.map((id) => `"${id}"`).join(",");
    query = query.or(`politician_id.eq.${senderProfile.user_id},assessor_id.in.(${csv}),criado_por.in.(${csv})`);
  }

  
  const { data: allTarefas } = await query;
  if (!allTarefas || allTarefas.length === 0) return `❌ Nenhuma tarefa ativa encontrada.`;
  
  const needle = normalizeText(busca);
  const match = allTarefas.find((t: any) => normalizeText(t.titulo).includes(needle));
  if (!match) return `❌ Tarefa "${busca}" não encontrada ou já finalizada.`;
  
  const { error: uErr } = await sb.from("tarefas").update({ status: "Finalizadas" }).eq("id", match.id);
  if (uErr) throw new Error(`DB error: ${uErr.message}`);
  return `✅ Tarefa *${match.titulo}* marcada como Finalizada!`;
}

// ─── Atendimento humanizado a ELEITORES (não autorizados) ───

async function findEleitorByPhone(phone: string) {
  const sb = supabaseAdmin();
  const formatted = formatPhoneForUazapi(phone);
  // tenta variações: com/sem 9
  const variants = new Set<string>([formatted]);
  if (formatted.length === 12) variants.add(formatted.slice(0, 4) + "9" + formatted.slice(4));
  if (formatted.length === 13 && formatted[4] === "9") variants.add(formatted.slice(0, 4) + formatted.slice(5));
  // também sem o 55 inicial
  for (const v of [...variants]) {
    if (v.startsWith("55")) variants.add(v.slice(2));
  }
  const { data } = await sb
    .from("eleitores")
    .select("id, nome, telefone, endereco, interesse, agente_ativo")
    .limit(200);
  if (!data) return null;
  const match = data.find((e: any) => {
    const eDigits = String(e.telefone || "").replace(/\D/g, "");
    if (!eDigits) return false;
    return [...variants].some((v) => v.endsWith(eDigits) || eDigits.endsWith(v));
  });
  return match || null;
}

// Pega o contexto do fluxo de eleitor da última mensagem do assistente
async function getEleitorFlowContext(phone: string): Promise<any | null> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("chat_history")
    .select("context")
    .eq("telefone", phone)
    .eq("role", "assistant")
    .not("context", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (data && data.length > 0 && data[0].context?.eleitor_flow) {
    return data[0].context.eleitor_flow;
  }
  return null;
}

// Escolhe o político dono do atendimento (para tenancy).
// Se houver apenas 1 político no sistema, usa ele. Caso contrário, retorna null.
async function pickDefaultPoliticoId(): Promise<string | null> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("profiles")
    .select("user_id")
    .eq("role", "politico")
    .limit(2);
  if (!data || data.length === 0) return null;
  return data[0].user_id;
}

// Fluxo unificado: registra demanda para eleitor já cadastrado,
// ou faz onboarding + cadastra demanda para eleitor novo.
async function handleEleitorConversation(senderPhone: string, message: string): Promise<boolean> {
  const sb = supabaseAdmin();
  const eleitor = await findEleitorByPhone(senderPhone);
  const flow = await getEleitorFlowContext(senderPhone);

  await saveChatMessage(senderPhone, "user", message);

  const send = async (text: string, ctx: any = null) => {
    await saveChatMessage(senderPhone, "assistant", text, ctx);
    try {
      await sendMessage(senderPhone, text);
    } catch (e) {
      console.error("Erro enviando WhatsApp eleitor:", e);
    }
  };

  const msgLower = message.trim().toLowerCase();
  const isYes = /^(sim|s|confirmo|confirmar|ok|pode|isso|correto|certo|beleza|blz|👍)/i.test(msgLower);

  // ─── ELEITOR JÁ CADASTRADO ────────────────────────────────
  if (eleitor) {
    if (eleitor.agente_ativo === false) {
      console.log(`💤 Agente desativado para o eleitor ${eleitor.nome}.`);
      return false;
    }

    // Início do atendimento
    if (!flow || !flow.step) {
      await send(
        `Olá, ${eleitor.nome.split(" ")[0]}! 👋 Aqui é do gabinete pelo WhatsApp.\n\nVocê gostaria de *registrar uma nova demanda* ou saber o *status* das suas demandas anteriores?\n\nSe for uma demanda nova, me conte brevemente o que você precisa.`,
        { eleitor_flow: { step: "await_demanda", eleitor_id: eleitor.id } },
      );
      return true;
    }

    if (flow.step === "await_demanda") {
      // Quer só status?
      if (/status|andament|como.*(est|vai)|novidade|minhas demand/.test(msgLower)) {
        const { data: demandas } = await sb
          .from("demandas")
          .select("titulo,status,created_at,prazo")
          .eq("eleitor_id", eleitor.id)
          .order("created_at", { ascending: false })
          .limit(10);
        if (!demandas || demandas.length === 0) {
          await send(
            "📋 Ainda não temos nenhuma demanda registrada em seu nome.\n\nSe quiser abrir uma agora, é só me contar o que precisa.",
            { eleitor_flow: { step: "await_demanda", eleitor_id: eleitor.id } },
          );
        } else {
          const lines = demandas
            .map((d: any, i: number) => {
              const dt = new Date(d.created_at).toLocaleDateString("pt-BR");
              return `${i + 1}. *${d.titulo}* — ${d.status} (${dt})`;
            })
            .join("\n");
          await send(
            `📋 *Suas demandas:*\n\n${lines}\n\nDeseja registrar uma nova? É só me contar. 🙂`,
            { eleitor_flow: { step: "await_demanda", eleitor_id: eleitor.id } },
          );
        }
        return true;
      }

      // Trata a mensagem como o texto da demanda
      await send(
        `Perfeito! Confirmando, você quer registrar esta demanda:\n\n"${message}"\n\nEstá correto? Responda *sim* para confirmar, ou envie o texto corrigido.`,
        { eleitor_flow: { step: "confirm_demanda", eleitor_id: eleitor.id, demanda_texto: message } },
      );
      return true;
    }

    if (flow.step === "confirm_demanda") {
      if (isYes) {
        const texto: string = flow.demanda_texto || message;
        const titulo = texto.slice(0, 80);
        const politicoId = (eleitor as any).politico_id || (await pickDefaultPoliticoId());
        const { error } = await sb.from("demandas").insert({
          titulo,
          descricao: texto,
          status: "Em Análise",
          eleitor_id: eleitor.id,
          origem: "whatsapp_eleitor",
          criado_por: politicoId,
        });
        if (error) {
          console.error("insert demanda eleitor:", error);
          await send(
            "Tive um problema ao registrar sua demanda agora. Nossa equipe vai te contatar em breve. 🙏",
            null,
          );
        } else {
          await send(
            `✅ Sua demanda foi registrada com sucesso!\n\nNossa equipe vai analisar e retornar em breve. Muito obrigado, ${eleitor.nome.split(" ")[0]}! 🙌`,
            null,
          );
        }
        return true;
      }
      // Correção: usa o novo texto
      await send(
        `Anotado! Vou considerar a versão atualizada:\n\n"${message}"\n\nResponda *sim* para registrar.`,
        { eleitor_flow: { step: "confirm_demanda", eleitor_id: eleitor.id, demanda_texto: message } },
      );
      return true;
    }

    return false;
  }

  // ─── ELEITOR NÃO CADASTRADO — ONBOARDING ──────────────────
  if (!flow || !flow.step) {
    await send(
      `Olá! 👋 Aqui é do gabinete pelo WhatsApp.\n\nNotei que você ainda não é cadastrado(a) na nossa base. Vou fazer um cadastro rapidinho para poder te atender melhor.\n\nPara começar, qual é o seu *nome completo*?`,
      { eleitor_flow: { step: "onb_nome", data: {} } },
    );
    return true;
  }

  const data = flow.data || {};

  if (flow.step === "onb_nome") {
    data.nome = message.trim();
    await send(
      `Prazer em conhecer, ${data.nome.split(" ")[0]}! 🙂\n\nEm qual *cidade* você mora?`,
      { eleitor_flow: { step: "onb_cidade", data } },
    );
    return true;
  }

  if (flow.step === "onb_cidade") {
    data.cidade = message.trim();
    await send(
      `Ótimo! Qual o seu principal *interesse* ou área de preocupação?\n\nEx: Saúde, Educação, Segurança, Infraestrutura, Outro`,
      { eleitor_flow: { step: "onb_interesse", data } },
    );
    return true;
  }

  if (flow.step === "onb_interesse") {
    data.interesse = message.trim();
    await send(
      `Perfeito! Agora me conte: qual *demanda ou solicitação* você gostaria de registrar? Descreva com o máximo de detalhes que puder. 📋`,
      { eleitor_flow: { step: "onb_demanda", data } },
    );
    return true;
  }

  if (flow.step === "onb_demanda") {
    data.demanda_texto = message.trim();
    await send(
      `Confirmando seu cadastro e demanda:\n\n👤 Nome: *${data.nome}*\n📍 Cidade: *${data.cidade}*\n🎯 Interesse: *${data.interesse}*\n📋 Demanda: "${data.demanda_texto}"\n\nEstá tudo certo? Responda *sim* para finalizar o cadastro.`,
      { eleitor_flow: { step: "onb_confirm", data } },
    );
    return true;
  }

  if (flow.step === "onb_confirm") {
    if (isYes) {
      const politicoId = await pickDefaultPoliticoId();
      const { data: novoEleitor, error: eErr } = await sb
        .from("eleitores")
        .insert({
          nome: data.nome,
          telefone: formatPhoneForUazapi(senderPhone),
          cidade: data.cidade,
          interesse: data.interesse,
          politico_id: politicoId,
          criado_por: politicoId,
          agente_ativo: true,
        })
        .select("id")
        .single();
      if (eErr) {
        console.error("insert eleitor:", eErr);
        await send(
          "Tive um problema ao concluir seu cadastro agora. Nossa equipe vai te contatar em breve. 🙏",
          null,
        );
        return true;
      }
      const titulo = data.demanda_texto.slice(0, 80);
      const { error: dErr } = await sb.from("demandas").insert({
        titulo,
        descricao: data.demanda_texto,
        status: "Em Análise",
        eleitor_id: novoEleitor.id,
        origem: "whatsapp_eleitor",
        criado_por: politicoId,
      });
      if (dErr) console.error("insert demanda onboarding:", dErr);
      await send(
        `✅ Cadastro concluído e demanda registrada!\n\nNossa equipe vai analisar e retornar em breve. Muito obrigado, ${data.nome.split(" ")[0]}! 🙌`,
        null,
      );
      return true;
    }
    // Não confirmou: interpreta como correção da demanda
    data.demanda_texto = message.trim();
    await send(
      `Atualizei a demanda para:\n\n"${data.demanda_texto}"\n\nAgora responda *sim* para confirmar o cadastro.`,
      { eleitor_flow: { step: "onb_confirm", data } },
    );
    return true;
  }

  return false;
}

// ─── Main Handler ───────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("🔔 Webhook body (full):", JSON.stringify(body).substring(0, 2500));

    let message = extractMessageFromWebhook(body);
    const senderPhone = extractSenderPhone(body);
    const audioUrl = extractAudioUrl(body);

    console.log("📱 Extracted phone:", senderPhone, "ℹ️ Extracted message:", message, "🎙️ Audio:", audioUrl ? "yes" : "no");

    // If audio message, transcribe with Whisper
    if (audioUrl && !message) {
      try {
        console.log("🎙️ Transcribing audio...");
        message = await transcribeAudio(audioUrl);
        console.log("🎙️ Transcribed:", message);
      } catch (e) {
        console.error("Audio transcription error:", e);
        if (senderPhone && (await isAuthorized(senderPhone))) {
          await sendMessage(senderPhone, "❌ Não consegui entender o áudio. Tente enviar como texto ou gravar novamente.");
        }
        return jsonResponse({ status: "audio_error", error: e.message });
      }
    }

    if (!message) {
      return jsonResponse({ status: "ignored", reason: "no message" });
    }

    console.log(`💬 Mensagem de ${senderPhone}: ${message}`);

    if (!(await isAuthorized(senderPhone))) {
      console.log(`🚫 Número não autorizado (não é político/assessor): ${senderPhone}`);

      // ─── Atendimento humanizado ao ELEITOR (cadastrado ou não) ───
      try {
        const handled = await handleEleitorConversation(senderPhone, message);
        if (handled) {
          return jsonResponse({ status: "eleitor_atendido", phone: senderPhone });
        }
      } catch (e) {
        console.error("Erro ao atender eleitor:", e);
      }

      // ANTI-BAN: Mark message_queue entry as replied when an eleitor responds
      // This allows the next message in the campaign to be sent
      try {
        const sb = supabaseAdmin();
        const formattedPhone = formatPhoneForUazapi(senderPhone);
        // Find the most recent "enviado" message to this phone that hasn't been replied to
        const { data: queueMsg } = await sb
          .from("message_queue")
          .select("id, destinatario_nome, campanha_id")
          .eq("destinatario_telefone", formattedPhone)
          .eq("status", "enviado")
          .is("respondido_em", null)
          .order("enviado_em", { ascending: false })
          .limit(1);
        
        if (queueMsg && queueMsg.length > 0) {
          await sb.from("message_queue").update({
            respondido_em: new Date().toISOString(),
          }).eq("id", queueMsg[0].id);
          console.log(`✅ Eleitor ${queueMsg[0].destinatario_nome} respondeu! Campanha ${queueMsg[0].campanha_id} desbloqueada.`);
        }

        // Also try matching without the 9th digit (phone stored differently)
        const phoneWith9 = formattedPhone.length === 12 
          ? formattedPhone.slice(0, 4) + "9" + formattedPhone.slice(4) 
          : formattedPhone;
        if (phoneWith9 !== formattedPhone) {
          const { data: queueMsg2 } = await sb
            .from("message_queue")
            .select("id, destinatario_nome, campanha_id")
            .eq("destinatario_telefone", phoneWith9)
            .eq("status", "enviado")
            .is("respondido_em", null)
            .order("enviado_em", { ascending: false })
            .limit(1);
          if (queueMsg2 && queueMsg2.length > 0) {
            await sb.from("message_queue").update({
              respondido_em: new Date().toISOString(),
            }).eq("id", queueMsg2[0].id);
            console.log(`✅ Eleitor ${queueMsg2[0].destinatario_nome} respondeu (alt phone)!`);
          }
        }
      } catch (e) {
        console.error("Error marking queue reply:", e);
      }
      
      return jsonResponse({ status: "unauthorized", phone: senderPhone });
    }

    // Save user message to history
    await saveChatMessage(senderPhone, "user", message);

    // Bloqueio por plano: usuário no plano Bronze não acessa o agente do WhatsApp
    const senderProfileRaw = await findProfileByPhone(senderPhone);
    const effectivePlan = await getEffectivePlan(senderProfileRaw);
    if (effectivePlan === "bronze") {
      console.log(`🚫 Plano Bronze — agente do WhatsApp bloqueado para ${senderPhone}`);
      await sendMessage(
        senderPhone,
        "🔒 O Agente do WhatsApp está disponível apenas nos planos *Prata* e *Ouro*.\n\nFaça upgrade do seu plano para liberar este recurso.",
      );
      return jsonResponse({ status: "plan_blocked", plan: "bronze" });
    }

    // Get chat history and pending context
    const history = await getChatHistory(senderPhone, 10);
    const pendingCtx = await getPendingContext(senderPhone);
    
    console.log("📜 History length:", history.length, "Pending context:", pendingCtx ? JSON.stringify(pendingCtx).substring(0, 200) : "none");

    const senderProfile = await getSenderProfile(senderPhone);
    const isAssessor = senderProfile?.role === "assessor";

    // Build conversation history for AI
    const chatMessages = history.slice(0, -1).map(h => ({ role: h.role, message: h.message }));

    // Build context instruction if there's a pending operation
    let pendingInstruction = "";
    if (pendingCtx?.pending) {
      const p = pendingCtx;
      pendingInstruction = `
CONTEXTO PENDENTE: O assistente estava no meio de uma operação "${p.pendingIntent}" com os seguintes dados já coletados:
${JSON.stringify(p.pendingData, null, 2)}
Campos que faltavam: ${(p.pendingMissing || []).join(", ")}

A mensagem atual do usuário provavelmente é uma RESPOSTA com os dados faltantes. 
- Se a resposta contém os dados faltantes, use a MESMA intenção "${p.pendingIntent}" e COMBINE os dados anteriores com os novos.
- Se o usuário diz "criar assim mesmo" ou "sem prazo" ou "não precisa", use a mesma intenção mas NÃO preencha campos_faltantes.
- NÃO crie uma nova demanda/tarefa separada, é a CONTINUAÇÃO da mesma operação.`;
    }

    const systemPrompt = `Você é um assistente de gabinete parlamentar. Analise a mensagem do usuário e extraia a intenção e dados relevantes.
Hoje é: ${new Date().toISOString()}
O remetente é um ${isAssessor ? "ASSESSOR" : "POLÍTICO"} chamado ${senderProfile?.nome || "desconhecido"}.
${pendingInstruction}

Intenções possíveis:
- cadastrar_eleitor: quando querem cadastrar/registrar um eleitor/cidadão
- consultar_eleitor: quando querem buscar/listar/consultar eleitores da BASE DE DADOS
- criar_demanda: quando querem registrar uma nova demanda/reclamação/solicitação. Se a mensagem diz "demanda para [nome]" extraia o nome do assessor no campo "assessor_nome".
- consultar_demanda: quando querem saber status ou listar demandas existentes
- concluir_demanda: quando querem marcar uma demanda como resolvida/concluída
- mover_demanda: quando querem alterar o status de uma demanda
- criar_projeto_lei: quando querem gerar um projeto de lei
- criar_tarefa: quando querem criar uma NOVA tarefa. Se a mensagem diz "tarefa para [nome]" extraia o nome do assessor no campo "assessor_nome".
- mover_tarefa: quando querem MOVER uma tarefa existente para outro status
- concluir_tarefa: quando querem FINALIZAR/CONCLUIR uma tarefa existente
- conversa_geral: para qualquer outra coisa

IMPORTANTE:
- Se o usuário diz "demanda para João: ..." ou "tarefa para Maria: ...", extraia o nome (João/Maria) no campo "assessor_nome" para atribuição.
- Se o usuário NÃO menciona nenhum nome de assessor e simplesmente pede para criar demanda/tarefa, NÃO preencha assessor_nome. A demanda/tarefa será automaticamente atribuída a ele mesmo.
- Se o usuário diz "pra mim", "para mim mesmo", "eu mesmo", extraia assessor_nome como "eu mesmo".
- ${isAssessor ? "Como assessor, ele só pode criar demandas e tarefas para si mesmo. Não pode atribuir a outros." : "Como político, ele pode atribuir demandas e tarefas a assessores pelo nome, ou criar para si mesmo (sem nome = para si)."}
- Se o usuário diz que algo "está em andamento" ou "foi concluído" referindo-se a uma tarefa ou demanda EXISTENTE, a intenção é MOVER (mover_tarefa ou mover_demanda), NÃO criar uma nova. 
- EXEMPLOS DE MOVER: "relatorio da semana em andamento" = mover_tarefa, "tapar buracos resolvido" = concluir_demanda
- Se o usuário pergunta sobre eleitores em uma cidade ou por interesse, SEMPRE use consultar_eleitor.
- Para criar_demanda: os campos importantes são titulo, descricao, localizacao e prazo. Se FALTAREM campos, preencha "campos_faltantes" com os nomes dos campos que faltam.
- Para criar_tarefa: os campos importantes são titulo, descricao e prazo. Se FALTAREM campos, preencha "campos_faltantes".
- Se o usuário responder "criar assim mesmo" ou similar, NÃO preencha campos_faltantes (deixe vazio) para que o cadastro prossiga.`;

    const extracted = await extractJSON(systemPrompt, message, chatMessages);
    
    // If there's pending context and the AI returned the same intent, merge data
    let finalExtracted = extracted;
    if (pendingCtx?.pending && extracted.intent === pendingCtx.pendingIntent) {
      const merged = { ...pendingCtx.pendingData, ...extracted };
      // Keep non-empty values from pending data if new extraction is empty
      for (const [key, value] of Object.entries(pendingCtx.pendingData)) {
        if (value && !merged[key]) {
          merged[key] = value;
        }
      }
      merged.intent = extracted.intent;
      // If user provided the missing fields, clear campos_faltantes
      if (!extracted.campos_faltantes || extracted.campos_faltantes.length === 0) {
        merged.campos_faltantes = [];
      }
      finalExtracted = merged;
      console.log("🔀 Merged with pending context:", JSON.stringify(finalExtracted).substring(0, 500));
    }
    
    console.log("🧠 Intent:", JSON.stringify(finalExtracted));

    let reply: string;

    switch (finalExtracted.intent) {
      case "cadastrar_eleitor":
        reply = await handleCadastrarEleitor(finalExtracted);
        break;
      case "consultar_eleitor":
        reply = await handleConsultarEleitor(finalExtracted);
        break;
      case "criar_demanda":
        reply = await handleCriarDemanda(finalExtracted, senderProfile);
        break;
      case "consultar_demanda":
        reply = await handleConsultarDemanda(finalExtracted, senderProfile);
        break;
      case "concluir_demanda":
        reply = await handleConcluirDemanda(finalExtracted, senderProfile);
        break;
      case "mover_demanda":
        reply = await handleMoverDemanda(finalExtracted, senderProfile);
        break;
      case "criar_projeto_lei":
        reply = await handleCriarProjetoLei(finalExtracted, senderPhone);
        break;
      case "criar_tarefa":
        reply = await handleCriarTarefa(finalExtracted, senderProfile);
        break;
      case "mover_tarefa":
        reply = await handleMoverTarefa(finalExtracted, senderProfile);
        break;
      case "concluir_tarefa":
        reply = await handleConcluirTarefa(finalExtracted, senderProfile);
        break;
      default:
        reply = await callAI(
          "Você é o assistente do gabinete *DEMOCRAT.AI* no WhatsApp. Responda em português brasileiro, de forma amigável, calorosa e útil. Seja conciso. Use *negrito do WhatsApp* (asteriscos) para destacar nomes, status e títulos. Use emojis com frequência (✅ 📋 👥 📜 ⚠️ 📍 📞 📅 💬 📌 ℹ️) para tornar a resposta visualmente rica. NUNCA use markdown ** (dois asteriscos) — apenas *um* asterisco para negrito.",
          message,
          chatMessages
        );
    }

    // Determine if this reply is asking for missing fields (pending operation)
    const isPending = reply.includes("faltam algumas informações") || reply.includes("Deseja adicionar");
    const contextToSave = isPending ? {
      pending: true,
      pendingIntent: finalExtracted.intent,
      pendingData: finalExtracted,
      pendingMissing: finalExtracted.campos_faltantes || [],
    } : null;

    // Save assistant reply to history
    await saveChatMessage(senderPhone, "assistant", reply, contextToSave);

    if (senderPhone) {
      try {
        await sendMessage(senderPhone, reply);
      } catch (e) {
        console.error("Erro ao enviar WhatsApp:", e);
      }
    }

    return jsonResponse({ success: true, intent: finalExtracted.intent, reply });
  } catch (error) {
    console.error("whatsapp-agent error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return jsonResponse({ success: false, error: message });
  }
});
