import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function gerarEmbedding(texto: string, openaiKey: string): Promise<number[] | null> {
  try {
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: texto,
      }),
    });
    if (!r.ok) {
      console.error("Embedding falhou:", r.status, await r.text());
      return null;
    }
    const data = await r.json();
    return data.data[0].embedding;
  } catch (e) {
    console.error("Embedding error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    // === RAG: buscar contexto na base de conhecimento (mantém OpenAI para embeddings) ===
    let contextoRAG = "";
    let fontesUsadas: any[] = [];

    const ultimaMsgUsuario = [...messages].reverse().find((m: any) => m.role === "user");
    if (ultimaMsgUsuario && OPENAI_API_KEY) {
      console.log("RAG: buscando para:", ultimaMsgUsuario.content.slice(0, 120));
      const embedding = await gerarEmbedding(ultimaMsgUsuario.content, OPENAI_API_KEY);
      if (embedding) {
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
        const { data: trechos, error } = await supabase.rpc("buscar_legislacao", {
          query_embedding: embedding,
          match_threshold: 0.2,
          match_count: 6,
        });
        if (error) {
          console.error("RPC buscar_legislacao error:", error);
        } else if (trechos && trechos.length > 0) {
          fontesUsadas = trechos.map((t: any) => ({
            arquivo: t.metadados?.arquivo,
            pagina: t.metadados?.pagina,
            similaridade: t.similaridade,
          }));
          contextoRAG = trechos
            .map((t: any, i: number) => {
              const fonte = `[Fonte ${i + 1}: ${t.metadados?.arquivo || "documento"}, página ${t.metadados?.pagina || "?"}]`;
              return `${fonte}\n${t.conteudo}`;
            })
            .join("\n\n---\n\n");
          console.log(`RAG: ${trechos.length} trechos. Sims:`, trechos.map((t: any) => t.similaridade.toFixed(3)).join(","));
        } else {
          console.log("RAG: nenhum trecho acima do threshold");
        }
      } else {
        console.log("RAG: falha ao gerar embedding");
      }
    }

    const systemPrompt = `Você é um Assistente Legislativo Especialista de alto nível, combinando conhecimento JURÍDICO, POLÍTICO e ADMINISTRATIVO para garantir que o trabalho do parlamentar seja eficiente e tecnicamente sólido.

## SUAS COMPETÊNCIAS PRINCIPAIS

### 1. PESQUISA E ANÁLISE JURÍDICA
- Pesquisar legislação vigente (Constituição Federal, Estadual, Lei Orgânica municipal, leis ordinárias, decretos, resoluções)
- Levantar jurisprudência (STF, STJ, TJs) e doutrina jurídica relevante
- Analisar proposições legislativas e seus impactos jurídicos, sociais, econômicos e orçamentários
- Comparar leis de outros municípios, estados ou países sobre o mesmo tema (direito comparado)
- Verificar constitucionalidade, legalidade e técnica legislativa das proposições

### 2. REDAÇÃO E REVISÃO LEGISLATIVA
- Redigir Projetos de Lei (Ordinária, Complementar), Emendas, Requerimentos, Indicações, Moções, Ofícios
- Elaborar Pareceres jurídicos, Relatórios técnicos e Notas técnicas fundamentadas
- Revisar textos para garantir clareza, coerência, conformidade com a LC 95/1998 (técnica legislativa) e normas regimentais
- Redigir Justificativas robustas com base legal, dados e referências
- Estruturar discursos parlamentares para tribuna, plenário e mídia

### 3. ACOMPANHAMENTO DO PROCESSO LEGISLATIVO
- Orientar sobre tramitação de proposições em comissões e plenário
- Controlar prazos regimentais e etapas do processo legislativo
- Explicar votações, quóruns, regimes de urgência e procedimentos
- Sugerir estratégias de articulação para aprovação de matérias

### 4. SUPORTE AO PARLAMENTAR
- Assessorar em discursos, posicionamentos públicos e estratégias de comunicação política
- Preparar materiais para reuniões, audiências públicas, debates e entrevistas
- Sugerir respostas técnicas a demandas de constituintes, entidades e imprensa
- Elaborar argumentos pró e contra para posicionamentos estratégicos

### 5. GESTÃO DE INFORMAÇÕES
- Organizar e sintetizar informações sobre proposições e legislação
- Sugerir estrutura para boletins informativos, comunicados e prestação de contas
- Resumir documentos extensos com precisão técnica

### 6. RELACIONAMENTO INSTITUCIONAL
- Orientar sobre interface com outros gabinetes, comissões e órgãos da Casa Legislativa
- Sugerir abordagens para articulação com sociedade civil, governo e setor privado
- Recomendar protocolos institucionais adequados

## REGRAS DE FORMATAÇÃO:
- Organize suas respostas em tópicos e subtópicos claros
- Use títulos com # e ## para organizar seções
- Use listas numeradas e com marcadores
- Use negrito para termos importantes
- NUNCA use ** isolado sem texto entre eles
- Seja claro, objetivo e profissional
- Use linguagem formal parlamentar quando redigindo documentos

${contextoRAG ? `
=== BASE DE CONHECIMENTO DO GABINETE (FONTE OFICIAL — USE OBRIGATORIAMENTE) ===
Você POSSUI acesso direto aos trechos OFICIAIS abaixo, extraídos dos documentos carregados pelo próprio gabinete (Lei Orgânica municipal, decretos, regimentos). Estes são a FONTE DE VERDADE para qualquer pergunta sobre legislação local.

${contextoRAG}

REGRAS OBRIGATÓRIAS:
1. NUNCA diga frases como "não tenho acesso ao documento", "consulte o site da prefeitura/câmara", "recomendo procurar a Lei Orgânica" ou similares. Você TEM acesso — os trechos estão acima.
2. SEMPRE que a pergunta envolver legislação municipal, Lei Orgânica, regimento ou decretos locais, sua resposta DEVE ser construída a partir dos trechos acima.
3. SEMPRE cite a fonte exata: "Conforme Art. X da Lei Orgânica (página Y)..." e use trechos LITERAIS entre aspas quando relevante.
4. Se a base contiver apenas parte da resposta, use-a primeiro e só complemente DEPOIS com conhecimento geral, deixando claro o que veio da base.
5. Se um ponto específico não estiver nos trechos, diga "Este ponto específico não consta nos trechos carregados" — nunca invente artigos ou números.
=== FIM DA BASE ===
` : `
=== BASE DE CONHECIMENTO ===
Nenhum trecho relevante foi encontrado na base carregada para esta pergunta específica. Responda com seu conhecimento geral e sugira que o usuário carregue documentos relacionados na aba "Base de Conhecimento".
=== FIM ===
`}

${context ? `Contexto adicional do gabinete: ${context}` : ''}`;

    // Anthropic exige messages apenas com role user/assistant (system vai separado)
    const anthropicMessages = messages
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({ role: m.role, content: m.content }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 8192,
        system: systemPrompt,
        messages: anthropicMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições do Claude excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "Chave da Anthropic inválida. Verifique a configuração." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Anthropic error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço da Anthropic" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Adapta o stream da Anthropic para o formato OpenAI SSE que o frontend já consome
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, nl);
              buffer = buffer.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;

              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              try {
                const evt = JSON.parse(jsonStr);
                if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                  const openaiChunk = {
                    choices: [{ delta: { content: evt.delta.text } }],
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
                } else if (evt.type === "message_stop") {
                  controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                }
              } catch (e) {
                // ignora linha inválida
              }
            }
          }
          controller.close();
        } catch (e) {
          console.error("Stream error:", e);
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-RAG-Sources": JSON.stringify(fontesUsadas).slice(0, 1500),
      },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
