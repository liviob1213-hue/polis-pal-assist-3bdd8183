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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    // === RAG: buscar contexto na base de conhecimento ===
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

    const systemPrompt = `Você é um Assistente Legislativo Especialista de alto nível. Seu papel é ajudar vereadores e equipes de gabinete com:

- Redação de Projetos de Lei (formato padrão da Câmara Municipal)
- Discursos parlamentares para tribuna e plenário
- Indicações, Requerimentos e Moções
- Análise jurídica de proposições
- Estratégias de comunicação política
- Ofícios e documentos oficiais
- Consulta à Lei Orgânica municipal e legislação local

REGRAS DE FORMATAÇÃO:
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

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições da OpenAI excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "Chave da OpenAI inválida. Verifique a configuração." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("OpenAI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço da OpenAI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
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
