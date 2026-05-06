// Utilitários para garantir UTF-8 consistente em campos de texto.
// Corrige mojibake (sequências Latin-1 mal interpretadas como UTF-8)
// e normaliza para NFC (forma canônica composta).

const MOJIBAKE_HINTS = /Ã.|Â.|â€/;

/**
 * Tenta reverter mojibake clássico do tipo "Em AnÃ¡lise" -> "Em Análise".
 * Quando o texto foi salvo como UTF-8 mas lido como Latin-1 (ou vice-versa).
 */
export function fixMojibake(input: string): string {
  if (!input || !MOJIBAKE_HINTS.test(input)) return input;
  try {
    const bytes = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) bytes[i] = input.charCodeAt(i) & 0xff;
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    // Se o decodificado ainda parecer mojibake, mantém original
    return MOJIBAKE_HINTS.test(decoded) ? input : decoded;
  } catch {
    return input;
  }
}

/** Normaliza texto: corrige mojibake + NFC (acentos compostos). */
export function normalizeText(value: unknown): string {
  if (typeof value !== "string") return value as any;
  return fixMojibake(value).normalize("NFC");
}

/** Normaliza recursivamente todos os campos string de um objeto. */
export function normalizePayload<T>(obj: T): T {
  if (obj == null) return obj;
  if (typeof obj === "string") return normalizeText(obj) as any;
  if (Array.isArray(obj)) return obj.map(normalizePayload) as any;
  if (typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj as any)) out[k] = normalizePayload(v);
    return out;
  }
  return obj;
}
