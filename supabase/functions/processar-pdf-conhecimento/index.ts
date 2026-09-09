import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const EMBED_BATCH = 64; // embeddings por requisição na OpenAI
const INSERT_BATCH = 100;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function chunkText(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= CHUNK_SIZE) return [cleaned];

  const chunks: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    let end = Math.min(i + CHUNK_SIZE, cleaned.length);
    if (end < cleaned.length) {
      const slice = cleaned.slice(i, end);
      const lastPeriod = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "));
      if (lastPeriod > CHUNK_SIZE * 0.5) end = i + lastPeriod + 1;
    }
    chunks.push(cleaned.slice(i, end).trim());
    const next = end - CHUNK_OVERLAP;
    i = next > i ? next : end;
  }
  return chunks.filter((c) => c.length > 50);
}

async function extrairTextoPDF(buffer: ArrayBuffer): Promise<{ pagina: number; texto: string }[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  const arr = Array.isArray(text) ? text : [String(text)];
  return arr.map((t, i) => ({ pagina: i + 1, texto: t || "" }));
}

async function gerarEmbeddings(textos: string[], openaiKey: string): Promise<number[][]> {
  let ultimaFalha = "";
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: textos }),
    });
    if (r.ok) {
      const data = await r.json();
      return data.data
        .sort((a: any, b: any) => a.index - b.index)
        .map((d: any) => d.embedding as number[]);
    }
    ultimaFalha = `${r.status}: ${(await r.text()).slice(0, 300)}`;
    if (r.status === 401 || r.status === 403) break;
    await new Promise((res) => setTimeout(res, 800 * tentativa));
  }
  throw new Error(`Falha ao gerar embeddings na OpenAI (${ultimaFalha})`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY não configurada nas variáveis da função." }, 500);
    if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "Credenciais do banco não configuradas na função." }, 500);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return json({ error: "Envio inválido: o arquivo não chegou ao servidor." }, 400);
    }

    const file = formData.get("file") as File | null;
    const nomeArquivo = (formData.get("nome") as string) || file?.name || "documento.pdf";
    if (!file) return json({ error: "Arquivo não enviado" }, 400);

    console.log(`Processando ${nomeArquivo} (${file.size} bytes)`);

    const buffer = await file.arrayBuffer();

    let paginas: { pagina: number; texto: string }[];
    try {
      paginas = await extrairTextoPDF(buffer);
    } catch (e) {
      console.error("Erro extraindo PDF:", e);
      return json({ error: "Não foi possível ler este PDF. Ele pode estar protegido por senha ou corrompido." }, 400);
    }

    // monta todos os chunks com a respectiva página
    const registros: { conteudo: string; pagina: number }[] = [];
    for (const pg of paginas) {
      for (const chunk of chunkText(pg.texto)) {
        registros.push({ conteudo: chunk, pagina: pg.pagina });
      }
    }

    console.log(`Páginas: ${paginas.length} | chunks: ${registros.length}`);

    if (registros.length === 0) {
      return json({
        error: "Nenhum texto foi encontrado neste PDF. Se ele for digitalizado (imagem), é preciso um PDF com texto selecionável.",
      }, 400);
    }

    let totalInseridos = 0;
    let pendentes: any[] = [];

    const gravar = async () => {
      if (pendentes.length === 0) return;
      const { error } = await supabase.from("legislacao_conhecimento").insert(pendentes);
      if (error) {
        console.error("Insert error:", error);
        throw new Error(`Erro ao salvar na base: ${error.message}`);
      }
      totalInseridos += pendentes.length;
      pendentes = [];
    };

    for (let i = 0; i < registros.length; i += EMBED_BATCH) {
      const lote = registros.slice(i, i + EMBED_BATCH);
      const embeddings = await gerarEmbeddings(lote.map((r) => r.conteudo), OPENAI_API_KEY);

      lote.forEach((r, idx) => {
        pendentes.push({
          conteudo: r.conteudo,
          metadados: { arquivo: nomeArquivo, pagina: r.pagina, total_paginas: paginas.length },
          embedding: embeddings[idx],
        });
      });

      if (pendentes.length >= INSERT_BATCH) await gravar();
    }
    await gravar();

    return json({
      sucesso: true,
      arquivo: nomeArquivo,
      paginas: paginas.length,
      chunks_gerados: registros.length,
      chunks_inseridos: totalInseridos,
    });
  } catch (e) {
    console.error("processar-pdf-conhecimento error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
