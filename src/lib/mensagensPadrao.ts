// Mensagens padronizadas (globais) usadas no WhatsApp de eleitores e aniversários.
// Ficam salvas no localStorage para que todos os eleitores recebam a mesma base de mensagem.

export const KEY_MSG_PADRAO_WHATSAPP = "mensagem_padrao_whatsapp";
export const KEY_MSG_PADRAO_ANIVERSARIO = "mensagem_padrao_aniversario";

export const MSG_PADRAO_WHATSAPP_DEFAULT =
  "Olá, {primeiro_nome}! Tudo bem? Aqui é do gabinete. Estamos à disposição para ajudar no que precisar. 🙌";

export const MSG_PADRAO_ANIVERSARIO_DEFAULT =
  "🎉 Olá, {primeiro_nome}! Hoje é um dia muito especial — seu aniversário! 🎂\n\nDesejo a você muita saúde, paz, alegria e realizações. Que este novo ciclo seja repleto de conquistas e momentos felizes ao lado de quem você ama.\n\nUm forte abraço! 🥳🎁";

export function getMensagemPadrao(key: string, fallback: string): string {
  try {
    const v = localStorage.getItem(key);
    return v && v.trim() ? v : fallback;
  } catch {
    return fallback;
  }
}

export function setMensagemPadrao(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Substitui as chaves {nome}, {primeiro_nome} e {cidade} no texto. */
export function aplicarVariaveis(
  text: string,
  dados: { nome?: string | null; cidade?: string | null },
): string {
  const nome = (dados.nome || "").trim();
  const primeiro = nome.split(" ")[0] || "";
  return text
    .replace(/\{primeiro_nome\}/g, primeiro)
    .replace(/\{nome\}/g, nome)
    .replace(/\{cidade\}/g, (dados.cidade || "").trim());
}
