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

// ─── Uazapi ─────────────────────────────────────────────────

async function sendMessage(phone: string, text: string) {
  const url = getEnv("UAZAPI_URL");
  const token = getEnv("UAZAPI_TOKEN");
  const fullPhone = phone.replace(/\D/g, "").startsWith("55")
    ? phone.replace(/\D/g, "")
    : `55${phone.replace(/\D/g, "")}`;

  const res = await fetch(`${url}/sendText`, {
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
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
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
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
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
                  "criar_demanda",
                  "consultar_demanda",
                  "criar_projeto_lei",
                  "criar_tarefa",
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

  const { data, error } = await query.limit(10);
  if (error) throw new Error(`DB error: ${error.message}`);
  if (!data || data.length === 0) return "📋 Nenhuma demanda encontrada.";

  const lines = data.map(
    (d: any, i: number) =>
      `${i + 1}. *${d.titulo}*\n   📍 ${d.localizacao || "Sem local"}\n   📌 Status: ${d.status}`
  );
  return `📋 *Demandas encontradas:*\n\n${lines.join("\n\n")}`;
}

async function handleCriarProjetoLei(params: any): Promise<string> {
  const sb = supabaseAdmin();

  // Buscar demanda relacionada
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

  // WhatsApp has a 4096 char limit per message
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

  // Se tiver data/hora, criar também na agenda
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

    // Uazapi webhook format
    const message = body?.message?.text || body?.text || body?.mensagem || "";
    const senderPhone = body?.message?.from || body?.from || body?.telefone || "";

    if (!message) {
      return new Response(
        JSON.stringify({ status: "ignored", reason: "no message" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📩 Mensagem de ${senderPhone}: ${message}`);

    // Classify intent
    const systemPrompt = `Você é um assistente de gabinete parlamentar. Analise a mensagem do usuário e extraia a intenção e dados relevantes.
Hoje é: ${new Date().toISOString()}

Intenções possíveis:
- cadastrar_eleitor: quando querem cadastrar/registrar um eleitor/cidadão
- criar_demanda: quando querem registrar uma demanda/reclamação/solicitação
- consultar_demanda: quando querem saber status ou listar demandas
- criar_projeto_lei: quando querem gerar um projeto de lei
- criar_tarefa: quando querem criar uma tarefa ou compromisso na agenda
- concluir_tarefa: quando querem finalizar/concluir uma tarefa
- conversa_geral: para qualquer outra coisa`;

    const extracted = await extractJSON(systemPrompt, message);
    console.log("🧠 Intent:", JSON.stringify(extracted));

    let reply: string;

    switch (extracted.intent) {
      case "cadastrar_eleitor":
        reply = await handleCadastrarEleitor(extracted);
        break;
      case "criar_demanda":
        reply = await handleCriarDemanda(extracted);
        break;
      case "consultar_demanda":
        reply = await handleConsultarDemanda(extracted);
        break;
      case "criar_projeto_lei":
        reply = await handleCriarProjetoLei(extracted);
        break;
      case "criar_tarefa":
        reply = await handleCriarTarefa(extracted);
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

    // Enviar resposta via WhatsApp
    if (senderPhone) {
      try {
        await sendMessage(senderPhone, reply);
      } catch (e) {
        console.error("Erro ao enviar WhatsApp:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, intent: extracted.intent, reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("whatsapp-agent error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
