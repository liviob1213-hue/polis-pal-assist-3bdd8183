import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getDocument, GlobalWorkerOptions } from "https://esm.sh/pdfjs-dist@4.0.379/legacy/build/pdf.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// pdfjs-dist requires worker source — disable worker for Deno
// @ts-ignore
GlobalWorkerOptions.workerSrc = "";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;

function chunkText(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= CHUNK_SIZE) return [cleaned];

  const chunks: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    let end = Math.min(i + CHUNK_SIZE, cleaned.length);
    // tenta quebrar em fim de frase
    if (end < cleaned.length) {
      const slice = cleaned.slice(i, end);
      const lastPeriod = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "));
      if (lastPeriod > CHUNK_SIZE * 0.5) end = i + lastPeriod + 1;
    }
    chunks.push(cleaned.slice(i, end).trim());
    i = end - CHUNK_OVERLAP;
    if (i < 0) i = 0;
  }
  return chunks.filter((c) => c.length > 50);
}

async function extrairTextoPDF(buffer: ArrayBuffer): Promise<{ pagina: number; texto: string }[]> {
  const loadingTask = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const paginas: { pagina: number; texto: string }[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // @ts-ignore
    const texto = content.items.map((it: any) => it.str).join(" ");
    paginas.push({ pagina: p, texto });
  }
  return paginas;
}

async function gerarEmbedding(texto: string, openaiKey: string): Promise<number[]> {
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
    const t = await r.text();
    throw new Error(`OpenAI embedding error ${r.status}: ${t}`);
  }
  const data = await r.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const nomeArquivo = (formData.get("nome") as string) || file?.name || "documento.pdf";

    if (!file) {
      return new Response(JSON.stringify({ error: "Arquivo não enviado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processando ${nomeArquivo} (${file.size} bytes)`);

    const buffer = await file.arrayBuffer();
    const paginas = await extrairTextoPDF(buffer);
    console.log(`Extraídas ${paginas.length} páginas`);

    let totalChunks = 0;
    let totalInseridos = 0;

    for (const pg of paginas) {
      const chunks = chunkText(pg.texto);
      totalChunks += chunks.length;

      for (const chunk of chunks) {
        try {
          const embedding = await gerarEmbedding(chunk, OPENAI_API_KEY);
          const { error } = await supabase.from("legislacao_conhecimento").insert({
            conteudo: chunk,
            metadados: {
              arquivo: nomeArquivo,
              pagina: pg.pagina,
              total_paginas: paginas.length,
            },
            embedding,
          });
          if (error) console.error("Insert error:", error);
          else totalInseridos++;
        } catch (e) {
          console.error("Chunk error:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        arquivo: nomeArquivo,
        paginas: paginas.length,
        chunks_gerados: totalChunks,
        chunks_inseridos: totalInseridos,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("processar-pdf-conhecimento error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
