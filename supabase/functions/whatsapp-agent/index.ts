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

  // Fetch authorized users from profiles table (registered users)
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

// ─── AI (Lovable AI Gateway) ────────────────────────────────

async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  const key = getEnv("LOVABLE_API_KEY");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("AI error:", res.status, t);
    throw new Error(`AI gateway ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function extractJSON(systemPrompt: string, userMessage: string): Promise<any> {
  const key = getEnv("LOVABLE_API_KEY");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
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
              novo_status: { type: "string", description: "Novo status para mover demanda ou tarefa. Para demandas: Aberto, Em Análise, Em Andamento, Resolvido. Para tarefas: Novas Tarefas, Em Andamento, Finalizadas." },
              busca_texto: { type: "string" },
              data_hora: { type: "string", description: "ISO 8601 datetime" },
              tarefa_busca: { type: "string" },
              mensagem_broadcast: { type: "string" },
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

  if (params.localizacao) {
    query = query.ilike("endereco", `%${params.localizacao}%`);
  }
  if (params.interesse) {
    query = query.ilike("interesse", `%${params.interesse}%`);
  }
  if (params.busca_texto && !params.localizacao && !params.interesse) {
    query = query.or(
      `nome.ilike.%${params.busca_texto}%,endereco.ilike.%${params.busca_texto}%,interesse.ilike.%${params.busca_texto}%`
    );
  }

  const { data, error } = await query.limit(20);
  if (error) throw new Error(`DB error: ${error.message}`);
  if (!data || data.length === 0) {
    const filtro = params.localizacao || params.interesse || params.busca_texto || "";
    return `📋 Nenhum eleitor encontrado${filtro ? ` para "${filtro}"` : ""}.`;
  }

  const lines = data.map(
    (e: any, i: number) =>
      `${i + 1}. *${e.nome}*\n   📍 ${e.endereco || "Sem endereço"}\n   📞 ${e.telefone || "Sem telefone"}\n   🎯 ${e.interesse || "Sem interesse"}`
  );
  const filtroLabel = params.localizacao ? `em ${params.localizacao}` : params.interesse ? `com interesse em ${params.interesse}` : "";
  return `👥 *${data.length} eleitor(es) encontrado(s)${filtroLabel ? ` ${filtroLabel}` : ""}:*\n\n${lines.join("\n\n")}`;
}

async function handleCriarDemanda(params: any): Promise<string> {
  const sb = supabaseAdmin();
  const { error } = await sb.from("demandas").insert({
    titulo: params.titulo || params.descricao || "Nova demanda",
    descricao: params.descricao || null,
    localizacao: params.localizacao || null,
  });
  if (error) throw new Error(`DB error: ${error.message}`);
  return `✅ Demanda *${params.titulo || "Nova demanda"}* registrada com status "Em Análise".`;
}

async function handleConsultarDemanda(params: any): Promise<string> {
  const sb = supabaseAdmin();
  let query = sb.from("demandas").select("*").order("created_at", { ascending: false });

  if (params.status_filtro) {
    query = query.ilike("status", `%${params.status_filtro}%`);
  }
  if (params.busca_texto) {
    query = query.or(
      `titulo.ilike.%${params.busca_texto}%,descricao.ilike.%${params.busca_texto}%`
    );
  }
  if (params.data_hora) {
    const dateStr = params.data_hora.split("T")[0];
    query = query.gte("created_at", `${dateStr}T00:00:00`).lte("created_at", `${dateStr}T23:59:59`);
  }

  const { data, error } = await query.limit(10);
  if (error) throw new Error(`DB error: ${error.message}`);
  if (!data || data.length === 0) return "📋 Nenhuma demanda encontrada.";

  const lines = data.map(
    (d: any, i: number) =>
      `${i + 1}. *${d.titulo}*\n   📍 ${d.localizacao || "Sem local"}\n   📌 Status: ${d.status}`
  );
  return `📋 *Demandas encontradas:*\n\n${lines.join("\n\n")}`;
}

async function handleConcluirDemanda(params: any): Promise<string> {
  const sb = supabaseAdmin();
  const busca = params.busca_texto || params.titulo || "";

  // Search by title text
  const { data, error: fErr } = await sb
    .from("demandas")
    .select("id, titulo, status")
    .ilike("titulo", `%${busca}%`)
    .neq("status", "Resolvido")
    .limit(1)
    .single();

  if (fErr || !data) return `❌ Demanda "${busca}" não encontrada ou já resolvida.`;

  const { error: uErr } = await sb
    .from("demandas")
    .update({ status: "Resolvido" })
    .eq("id", data.id);
  if (uErr) throw new Error(`DB error: ${uErr.message}`);

  return `✅ Demanda *${data.titulo}* marcada como Resolvida!`;
}

async function handleMoverDemanda(params: any): Promise<string> {
  const sb = supabaseAdmin();
  const busca = params.busca_texto || params.titulo || "";
  const novoStatus = params.novo_status || "Em Andamento";

  const { data, error: fErr } = await sb
    .from("demandas")
    .select("id, titulo, status")
    .ilike("titulo", `%${busca}%`)
    .limit(1)
    .single();

  if (fErr || !data) return `❌ Demanda "${busca}" não encontrada.`;

  const { error: uErr } = await sb
    .from("demandas")
    .update({ status: novoStatus })
    .eq("id", data.id);
  if (uErr) throw new Error(`DB error: ${uErr.message}`);

  return `✅ Demanda *${data.titulo}* movida para *${novoStatus}*!`;
}

async function handleCriarProjetoLei(params: any): Promise<string> {
  const sb = supabaseAdmin();
  let demandaContext = "";
  let demandaId: string | null = null;

  if (params.busca_texto) {
    const { data } = await sb
      .from("demandas")
      .select("*")
      .or(`titulo.ilike.%${params.busca_texto}%,descricao.ilike.%${params.busca_texto}%`)
      .limit(1)
      .single();
    if (data) {
      demandaContext = `Título: ${data.titulo}\nDescrição: ${data.descricao}\nLocal: ${data.localizacao}`;
      demandaId = data.id;
    }
  }

  const prompt = `Você é um Assistente Legislativo Especialista. Gere um Projeto de Lei formal para uma Câmara Municipal com base na demanda abaixo. 
Use formato oficial: EMENTA, JUSTIFICATIVA, e os ARTIGOS numerados.
Demanda: ${demandaContext || params.descricao || params.titulo || "demanda geral"}`;

  const textoLei = await callAI(prompt, "Gere o projeto de lei completo.");
  const titulo = params.titulo || `PL - ${params.busca_texto || "Novo Projeto"}`;
  const { error } = await sb.from("projetos_lei").insert({
    titulo,
    texto_completo: textoLei,
    demanda_id: demandaId,
  });
  if (error) throw new Error(`DB error: ${error.message}`);

  if (textoLei.length > 3500) {
    return `📜 *Projeto de Lei gerado:* ${titulo}\n\n${textoLei.substring(0, 3500)}...\n\n_(Texto completo salvo no sistema)_`;
  }
  return `📜 *Projeto de Lei gerado:* ${titulo}\n\n${textoLei}`;
}

async function handleCriarTarefa(params: any): Promise<string> {
  const sb = supabaseAdmin();
  const titulo = params.titulo || params.descricao || "Nova tarefa";
  const prazo = params.data_hora || null;

  const { data: tarefa, error: tErr } = await sb
    .from("tarefas")
    .insert({ titulo, descricao: params.descricao || null, prazo })
    .select("id")
    .single();
  if (tErr) throw new Error(`DB error: ${tErr.message}`);

  if (prazo) {
    await sb.from("agenda").insert({
      titulo,
      descricao: params.descricao || null,
      data_hora: prazo,
      tarefa_id: tarefa.id,
    });
  }

  const prazoStr = prazo ? `\n📅 Prazo: ${new Date(prazo).toLocaleString("pt-BR")}` : "";
  return `✅ Tarefa *${titulo}* criada com sucesso!${prazoStr}\n📌 Status: Novas Tarefas`;
}

async function handleMoverTarefa(params: any): Promise<string> {
  const sb = supabaseAdmin();
  const busca = params.tarefa_busca || params.busca_texto || params.titulo || "";
  const novoStatus = params.novo_status || "Em Andamento";

  const { data, error: fErr } = await sb
    .from("tarefas")
    .select("id, titulo, status")
    .ilike("titulo", `%${busca}%`)
    .limit(1)
    .single();

  if (fErr || !data) return `❌ Tarefa "${busca}" não encontrada.`;

  if (data.status === novoStatus) return `ℹ️ Tarefa *${data.titulo}* já está em *${novoStatus}*.`;

  const { error: uErr } = await sb
    .from("tarefas")
    .update({ status: novoStatus })
    .eq("id", data.id);
  if (uErr) throw new Error(`DB error: ${uErr.message}`);

  return `✅ Tarefa *${data.titulo}* movida de *${data.status}* para *${novoStatus}*!`;
}

async function handleConcluirTarefa(params: any): Promise<string> {
  const sb = supabaseAdmin();
  const busca = params.tarefa_busca || params.titulo || params.busca_texto || "";

  const { data, error: fErr } = await sb
    .from("tarefas")
    .select("id, titulo")
    .ilike("titulo", `%${busca}%`)
    .neq("status", "Finalizadas")
    .limit(1)
    .single();

  if (fErr || !data) return `❌ Tarefa "${busca}" não encontrada ou já finalizada.`;

  const { error: uErr } = await sb
    .from("tarefas")
    .update({ status: "Finalizadas" })
    .eq("id", data.id);
  if (uErr) throw new Error(`DB error: ${uErr.message}`);

  return `✅ Tarefa *${data.titulo}* marcada como Finalizada!`;
}

// ─── Main Handler ───────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("📦 Webhook body (full):", JSON.stringify(body).substring(0, 2500));

    const message = extractMessageFromWebhook(body);
    const senderPhone = extractSenderPhone(body);

    console.log("📱 Extracted phone:", senderPhone, "📝 Extracted message:", message);

    if (!message) {
      return jsonResponse({ status: "ignored", reason: "no message" });
    }

    console.log(`📩 Mensagem de ${senderPhone}: ${message}`);

    if (!(await isAuthorized(senderPhone))) {
      console.log(`🚫 Número não autorizado: ${senderPhone}`);
      return jsonResponse({ status: "unauthorized", phone: senderPhone });
    }

    const systemPrompt = `Você é um assistente de gabinete parlamentar. Analise a mensagem do usuário e extraia a intenção e dados relevantes.
Hoje é: ${new Date().toISOString()}

Intenções possíveis:
- cadastrar_eleitor: quando querem cadastrar/registrar um eleitor/cidadão
- consultar_eleitor: quando querem buscar/listar/consultar eleitores da BASE DE DADOS. Se perguntam "quais eleitores tenho em [cidade]" ou "eleitores com interesse em [tema]", use esta intenção. Extraia a cidade/local no campo "localizacao" e o interesse no campo "interesse".
- criar_demanda: quando querem registrar uma nova demanda/reclamação/solicitação
- consultar_demanda: quando querem saber status ou listar demandas existentes
- concluir_demanda: quando querem marcar uma demanda como resolvida/concluída. Extraia o texto de busca no campo "busca_texto".
- mover_demanda: quando querem alterar o status de uma demanda (mover para outra etapa). Extraia o novo status no campo "novo_status" (opções: Aberto, Em Análise, Em Andamento, Resolvido).
- criar_projeto_lei: quando querem gerar um projeto de lei
- criar_tarefa: quando querem criar uma NOVA tarefa ou compromisso na agenda
- mover_tarefa: quando querem MOVER uma tarefa existente para outro status (ex: "a reunião está em andamento", "mova a tarefa X para em andamento"). NÃO crie uma nova tarefa. Extraia o texto de busca no campo "tarefa_busca" ou "busca_texto" e o novo status no campo "novo_status" (opções: Novas Tarefas, Em Andamento, Finalizadas).
- concluir_tarefa: quando querem FINALIZAR/CONCLUIR uma tarefa existente
- conversa_geral: para qualquer outra coisa

IMPORTANTE: 
- Se o usuário diz que algo "está em andamento" ou "foi concluído" referindo-se a uma tarefa ou demanda EXISTENTE, a intenção é MOVER (mover_tarefa ou mover_demanda), NÃO criar uma nova.
- Se o usuário pergunta sobre eleitores em uma cidade ou por interesse, SEMPRE use consultar_eleitor, NUNCA conversa_geral.
- Se o usuário quer concluir/resolver uma demanda, use concluir_demanda.`;

    const extracted = await extractJSON(systemPrompt, message);
    console.log("🧠 Intent:", JSON.stringify(extracted));

    let reply: string;

    switch (extracted.intent) {
      case "cadastrar_eleitor":
        reply = await handleCadastrarEleitor(extracted);
        break;
      case "consultar_eleitor":
        reply = await handleConsultarEleitor(extracted);
        break;
      case "criar_demanda":
        reply = await handleCriarDemanda(extracted);
        break;
      case "consultar_demanda":
        reply = await handleConsultarDemanda(extracted);
        break;
      case "concluir_demanda":
        reply = await handleConcluirDemanda(extracted);
        break;
      case "mover_demanda":
        reply = await handleMoverDemanda(extracted);
        break;
      case "criar_projeto_lei":
        reply = await handleCriarProjetoLei(extracted);
        break;
      case "criar_tarefa":
        reply = await handleCriarTarefa(extracted);
        break;
      case "mover_tarefa":
        reply = await handleMoverTarefa(extracted);
        break;
      case "concluir_tarefa":
        reply = await handleConcluirTarefa(extracted);
        break;
      default:
        reply = await callAI(
          "Você é o assistente do gabinete DEMOCRAT.AI. Responda de forma amigável e útil em português. Seja conciso.",
          message
        );
    }

    if (senderPhone) {
      try {
        await sendMessage(senderPhone, reply);
      } catch (e) {
        console.error("Erro ao enviar WhatsApp:", e);
      }
    }

    return jsonResponse({ success: true, intent: extracted.intent, reply });
  } catch (error) {
    console.error("whatsapp-agent error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return jsonResponse({ success: false, error: message });
  }
});
