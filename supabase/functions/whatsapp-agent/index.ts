import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

  let audioBlob: Blob;
  
  if (audioUrl.startsWith("base64:")) {
    const b64 = audioUrl.slice(7);
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    audioBlob = new Blob([bytes], { type: "audio/ogg" });
  } else {
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`Failed to download audio: ${audioRes.status}`);
    audioBlob = await audioRes.blob();
  }

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.ogg");
  formData.append("model", "whisper-1");
  formData.append("language", "pt");

  const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: formData,
  });

  if (!whisperRes.ok) {
    const errText = await whisperRes.text();
    console.error("Whisper error:", whisperRes.status, errText);
    throw new Error(`Whisper API ${whisperRes.status}`);
  }

  const result = await whisperRes.json();
  return result.text || "";
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

async function isAuthorized(phone: string): Promise<boolean> {
  const authorized = await getAuthorizedNumbers();
  return authorized.includes(formatPhoneForUazapi(phone));
}

// ─── Get sender profile and role ────────────────────────────

async function getSenderProfile(phone: string) {
  const sb = supabaseAdmin();
  const formatted = formatPhoneForUazapi(phone);
  const { data } = await sb
    .from("profiles")
    .select("user_id, nome, role")
    .eq("telefone", formatted)
    .single();
  return data;
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
  const res = await fetch(`${url}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify({ number: fullPhone, text }),
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

// ─── AI (Lovable AI Gateway) ────────────────────────────────

async function callAI(systemPrompt: string, userMessage: string, history: Array<{role: string, message: string}> = []): Promise<string> {
  const key = getEnv("LOVABLE_API_KEY");
  const messages: any[] = [{ role: "system", content: systemPrompt }];
  // Add history
  for (const h of history) {
    messages.push({ role: h.role === "assistant" ? "assistant" : "user", content: h.message });
  }
  messages.push({ role: "user", content: userMessage });
  
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("AI error:", res.status, t);
    throw new Error(`AI gateway ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function extractJSON(systemPrompt: string, userMessage: string, history: Array<{role: string, message: string}> = []): Promise<any> {
  const key = getEnv("LOVABLE_API_KEY");
  const messages: any[] = [{ role: "system", content: systemPrompt }];
  for (const h of history) {
    messages.push({ role: h.role === "assistant" ? "assistant" : "user", content: h.message });
  }
  messages.push({ role: "user", content: userMessage });
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      tools: [{
        type: "function",
        function: {
          name: "extract_data",
          description: "Extraia dados estruturados da mensagem",
          parameters: {
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
        },
      }],
      tool_choice: { type: "function", function: { name: "extract_data" } },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("AI extract error:", res.status, t);
    throw new Error(`AI gateway ${res.status}`);
  }
  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call returned");
  return JSON.parse(toolCall.function.arguments);
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
    return `📝 Para cadastrar a demanda *${params.titulo || params.descricao || ""}*, faltam algumas informações:\n\n${missing.map(c => `• ${c.charAt(0).toUpperCase() + c.slice(1)}`).join("\n")}\n\nDeseja adicionar esses dados? Envie as informações ou responda "criar assim mesmo" para cadastrar sem eles.`;
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
            `📋 *Nova demanda atribuída a você!*\n\n📌 ${params.titulo || params.descricao || "Nova demanda"}\n${params.descricao ? `📝 ${params.descricao}` : ""}\n${params.localizacao ? `📍 ${params.localizacao}` : ""}\n${params.prazo ? `📅 Prazo: ${params.prazo}` : ""}\n\n_Atribuída por ${senderProfile.nome}_`,
            "demanda"
          );
          assessorNotification = `\n📨 Notificação enfileirada para o assessor *${assessor.nome}*!`;
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
    assessor_id: assessorId,
    prazo: prazoValue,
  });
  if (error) throw new Error(`DB error: ${error.message}`);
  const prazoStr = prazoValue ? `\n📅 Prazo: ${prazoValue}` : "";
  return `✅ Demanda *${params.titulo || "Nova demanda"}* registrada com status "Em Análise".${prazoStr}${assessorNotification}`;
}

// Map user synonyms to actual DB status values for demanda queries
const DEMANDA_STATUS_SYNONYMS: Record<string, string[]> = {
  "Em Análise": ["em analise", "em análise", "analise", "análise", "aberta", "aberto", "nova", "novas"],
  "Em Andamento": ["em andamento", "andamento", "progresso", "em progresso"],
  "Resolvido": ["resolvido", "resolvida", "resolvidas", "resolvidos", "concluida", "concluída", "concluidas", "concluídas", "finalizada", "finalizadas", "fechada", "fechadas", "pronta", "prontas"],
};

function resolveStatusFilter(raw: string): string | null {
  const needle = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  for (const [dbStatus, synonyms] of Object.entries(DEMANDA_STATUS_SYNONYMS)) {
    if (synonyms.some(s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(needle) || needle.includes(s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
      return dbStatus;
    }
  }
  return raw; // fallback to original
}

async function handleConsultarDemanda(params: any, senderProfile: any): Promise<string> {
  const sb = supabaseAdmin();
  let query = sb.from("demandas").select("*").order("created_at", { ascending: false });
  
  // If assessor, only show their demandas
  if (senderProfile?.role === "assessor") {
    query = query.eq("assessor_id", senderProfile.user_id);
  }
  
  if (params.status_filtro) {
    const resolved = resolveStatusFilter(params.status_filtro);
    query = query.eq("status", resolved);
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

async function handleConcluirDemanda(params: any): Promise<string> {
  const sb = supabaseAdmin();
  const busca = params.busca_texto || params.titulo || "";
  const { data, error: fErr } = await sb.from("demandas").select("id, titulo, status").ilike("titulo", `%${busca}%`).neq("status", "Resolvido").limit(1).single();
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

async function handleMoverDemanda(params: any): Promise<string> {
  const sb = supabaseAdmin();
  const busca = params.busca_texto || params.titulo || "";
  const novoStatus = normalizeDemandaStatus(params.novo_status || "Em Andamento");
  
  // Fuzzy search: get all non-resolved and match in code
  const { data: allDemandas } = await sb.from("demandas").select("id, titulo, status").neq("status", "Resolvido").limit(50);
  if (!allDemandas || allDemandas.length === 0) return `❌ Nenhuma demanda ativa encontrada.`;
  
  const needle = normalizeText(busca);
  const match = allDemandas.find((d: any) => normalizeText(d.titulo).includes(needle));
  if (!match) return `❌ Demanda "${busca}" não encontrada.`;
  
  if (match.status === novoStatus) return `ℹ️ Demanda *${match.titulo}* já está em *${novoStatus}*.`;
  const { error: uErr } = await sb.from("demandas").update({ status: novoStatus }).eq("id", match.id);
  if (uErr) throw new Error(`DB error: ${uErr.message}`);
  return `✅ Demanda *${match.titulo}* movida para *${novoStatus}*!`;
}

async function handleCriarProjetoLei(params: any): Promise<string> {
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
  const prompt = `Você é um Assistente Legislativo Especialista. Gere um Projeto de Lei formal para uma Câmara Municipal com base na demanda abaixo. Use formato oficial: EMENTA, JUSTIFICATIVA, e os ARTIGOS numerados.\nDemanda: ${demandaContext || params.descricao || params.titulo || "demanda geral"}`;
  const textoLei = await callAI(prompt, "Gere o projeto de lei completo.");
  const titulo = params.titulo || `PL - ${params.busca_texto || "Novo Projeto"}`;
  const { error } = await sb.from("projetos_lei").insert({ titulo, texto_completo: textoLei, demanda_id: demandaId });
  if (error) throw new Error(`DB error: ${error.message}`);
  if (textoLei.length > 3500) return `📜 *Projeto de Lei gerado:* ${titulo}\n\n${textoLei.substring(0, 3500)}...\n\n_(Texto completo salvo no sistema)_`;
  return `📜 *Projeto de Lei gerado:* ${titulo}\n\n${textoLei}`;
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
    return `📝 Para criar a tarefa *${titulo}*, faltam algumas informações:\n\n${missing.map(c => `• ${c.charAt(0).toUpperCase() + c.slice(1)}`).join("\n")}\n\nDeseja adicionar? Envie as informações ou responda "criar assim mesmo" para cadastrar sem eles.`;
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
            `✅ *Nova tarefa atribuída a você!*\n\n📌 ${titulo}\n${params.descricao ? `📝 ${params.descricao}` : ""}\n${prazo ? `📅 Prazo: ${new Date(prazo).toLocaleString("pt-BR")}` : ""}\n\n_Atribuída por ${senderProfile.nome}_`,
            "tarefa"
          );
          assessorNotification = `\n📨 Notificação enfileirada para o assessor *${assessor.nome}*!`;
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
  let query = sb.from("tarefas").select("id, titulo, status, assessor_id").limit(50);
  
  // If assessor, only search their tasks
  if (senderProfile?.role === "assessor") {
    query = query.eq("assessor_id", senderProfile.user_id);
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
  
  let query = sb.from("tarefas").select("id, titulo, assessor_id").neq("status", "Finalizadas").limit(50);
  if (senderProfile?.role === "assessor") {
    query = query.eq("assessor_id", senderProfile.user_id);
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

// ─── Main Handler ───────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("📦 Webhook body (full):", JSON.stringify(body).substring(0, 2500));

    let message = extractMessageFromWebhook(body);
    const senderPhone = extractSenderPhone(body);
    const audioUrl = extractAudioUrl(body);

    console.log("📱 Extracted phone:", senderPhone, "📝 Extracted message:", message, "🎤 Audio:", audioUrl ? "yes" : "no");

    // If audio message, transcribe with Whisper
    if (audioUrl && !message) {
      try {
        console.log("🎤 Transcribing audio...");
        message = await transcribeAudio(audioUrl);
        console.log("🎤 Transcribed:", message);
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

    console.log(`📩 Mensagem de ${senderPhone}: ${message}`);

    if (!(await isAuthorized(senderPhone))) {
      console.log(`🚫 Número não autorizado: ${senderPhone}`);
      
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
      console.log("🔗 Merged with pending context:", JSON.stringify(finalExtracted).substring(0, 500));
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
        reply = await handleConcluirDemanda(finalExtracted);
        break;
      case "mover_demanda":
        reply = await handleMoverDemanda(finalExtracted);
        break;
      case "criar_projeto_lei":
        reply = await handleCriarProjetoLei(finalExtracted);
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
          "Você é o assistente do gabinete DEMOCRAT.AI. Responda de forma amigável e útil em português. Seja conciso.",
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
