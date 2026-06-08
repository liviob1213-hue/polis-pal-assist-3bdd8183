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
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

  // Obter o áudio em base64 (Gemini aceita áudio inline)
  let audioB64: string;
  let mimeType = "audio/ogg";

  if (audioUrl.startsWith("base64:")) {
    audioB64 = audioUrl.slice(7);
  } else {
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`Failed to download audio: ${audioRes.status}`);
    const ct = audioRes.headers.get("content-type");
    if (ct && ct.startsWith("audio/")) mimeType = ct.split(";")[0];
    const buf = new Uint8Array(await audioRes.arrayBuffer());
    // Converter para base64 em chunks (evita stack overflow em áudios grandes)
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < buf.length; i += chunkSize) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunkSize));
    }
    audioB64 = btoa(binary);
  }

  // Lovable AI Gateway (Gemini) - transcrição multimodal de áudio
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Você é um transcritor de áudio em português brasileiro. Transcreva LITERALMENTE o conteúdo falado no áudio, sem comentários, sem prefixos, sem aspas. Retorne apenas o texto transcrito.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcreva este áudio em português brasileiro:" },
            {
              type: "input_audio",
              input_audio: { data: audioB64, format: mimeType.includes("mp3") ? "mp3" : "ogg" },
            },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Gemini transcription error:", resp.status, errText);
    if (resp.status === 429) throw new Error("Limite de requisições atingido, tente novamente em alguns instantes.");
    if (resp.status === 402) throw new Error("Créditos da IA esgotados. Adicione créditos em Settings → Workspace → Usage.");
    throw new Error(`Gemini transcription API ${resp.status}`);
  }

  const result = await resp.json();
  const text = result?.choices?.[0]?.message?.content || "";
  return typeof text === "string" ? text.trim() : "";
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
    .select("user_id, nome, role, telefone, is_authorized, whatsapp_verified")
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
      .select("user_id, nome, role, telefone, is_authorized, whatsapp_verified")
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

async function handleEleitorMessage(senderPhone: string, message: string): Promise<boolean> {
  const eleitor = await findEleitorByPhone(senderPhone);
  if (!eleitor) {
    console.log(`ℹ️ Telefone ${senderPhone} não encontrado na base de eleitores.`);
    return false;
  }
  if (!eleitor.agente_ativo) {
    console.log(`💤 Agente desativado para o eleitor ${eleitor.nome}.`);
    return false;
  }

  console.log(`🤖 Atendendo eleitor: ${eleitor.nome}`);
  const sb = supabaseAdmin();

  // Salva mensagem do eleitor no histórico
  await saveChatMessage(senderPhone, "user", message);

  // Busca demandas vinculadas a este eleitor
  const { data: demandas } = await sb
    .from("demandas")
    .select("id, titulo, descricao, status, created_at, prazo")
    .eq("eleitor_id", eleitor.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const demandasContexto = (demandas && demandas.length > 0)
    ? demandas.map((d: any, i: number) => {
        const data = new Date(d.created_at).toLocaleDateString("pt-BR");
        const prazo = d.prazo ? ` | Prazo: ${new Date(d.prazo).toLocaleDateString("pt-BR")}` : "";
        return `${i + 1}. "${d.titulo}" - Status: ${d.status} (registrada em ${data})${prazo}${d.descricao ? `\n   Descrição: ${d.descricao}` : ""}`;
      }).join("\n")
    : "Este eleitor ainda não tem demandas registradas no sistema.";

  // Histórico recente para contexto conversacional
  const history = await getChatHistory(senderPhone, 10);
  const chatMessages = history.slice(0, -1).map((h) => ({ role: h.role, message: h.message }));

  const systemPrompt = `Você é a *assistente virtual do gabinete*, atendendo o(a) eleitor(a) *${eleitor.nome}* pelo WhatsApp.

PERSONALIDADE:
- Acolhedora, educada, calorosa e empática - fale como um atendente humano experiente, NUNCA como um robô.
- Use o nome do eleitor com naturalidade (não em toda mensagem).
- Tom brasileiro, informal-respeitoso. Pode usar "Olá", "Tudo bem?", "Pois não", "Ficamos à disposição".
- Mensagens CURTAS (1 a 4 frases). Evite textão. Use 1 emoji no máximo, com moderação.
- NUNCA diga que é uma IA, robô, bot ou agente automático. Você é "do gabinete".

CAPACIDADES:
- Pode consultar e informar o STATUS das demandas que o eleitor solicitou.
- Pode responder dúvidas gerais sobre o atendimento do gabinete.
- Pode anotar novas reclamações/solicitações (apenas confirme que vai registrar - não invente protocolos).
- NÃO invente status, datas ou prazos. Use SOMENTE os dados abaixo.

DADOS DO ELEITOR:
- Nome: ${eleitor.nome}
- Endereço: ${eleitor.endereco || "não informado"}
- Interesse: ${eleitor.interesse || "não informado"}

DEMANDAS DO ELEITOR (use estes dados ao responder sobre status):
${demandasContexto}

REGRAS:
- Se ele perguntar "como está minha demanda?" / "tem novidade?" → resuma o status das demandas acima de forma humana.
- Se ele tiver MAIS DE UMA demanda e a pergunta for genérica, mencione brevemente cada uma.
- Se ele relatar uma NOVA reclamação/solicitação, agradeça, confirme que vai registrar e que a equipe entrará em contato.
- Se a pergunta fugir totalmente do contexto do gabinete, responda educadamente que vai encaminhar para a equipe.`;

  let reply: string;
  try {
    reply = await callAI(systemPrompt, message, chatMessages);
  } catch (e) {
    console.error("Erro AI eleitor:", e);
    reply = `Olá, ${eleitor.nome.split(" ")[0]}! Recebi sua mensagem e nossa equipe vai te responder em breve. `;
  }

  await saveChatMessage(senderPhone, "assistant", reply);

  try {
    await sendMessage(senderPhone, reply);
  } catch (e) {
    console.error("Erro enviando WhatsApp para eleitor:", e);
  }

  return true;
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

      // ─── Atendimento humanizado ao ELEITOR (se agente_ativo) ───
      try {
        const handled = await handleEleitorMessage(senderPhone, message);
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
