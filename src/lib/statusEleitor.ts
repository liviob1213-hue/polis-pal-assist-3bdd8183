// Status do eleitor — definição centralizada
export type StatusEleitor =
  | "nao_eleitor"
  | "possivel_eleitor"
  | "eleitor"
  | "multiplicador"
  | "voluntario";

export interface StatusEleitorMeta {
  value: StatusEleitor;
  label: string;
  emoji: string;
  // classes para Badge (bg/text/border tokens semânticos do design system)
  badgeClass: string;
  // classe sólida (bg) para pin no mapa
  pinClass: string;
  // hex aproximado p/ legendas SVG/PDF se necessário
  hex: string;
}

export const STATUS_ELEITOR: Record<StatusEleitor, StatusEleitorMeta> = {
  nao_eleitor: {
    value: "nao_eleitor",
    label: "Não eleitor",
    emoji: "⚫",
    badgeClass: "bg-muted text-foreground border-border",
    pinClass: "bg-foreground",
    hex: "#1f2937",
  },
  possivel_eleitor: {
    value: "possivel_eleitor",
    label: "Possível eleitor",
    emoji: "🟡",
    badgeClass: "bg-warning/15 text-warning border-warning/30",
    pinClass: "bg-warning",
    hex: "#eab308",
  },
  eleitor: {
    value: "eleitor",
    label: "Eleitor",
    emoji: "🟢",
    badgeClass: "bg-success/15 text-success border-success/30",
    pinClass: "bg-success",
    hex: "#16a34a",
  },
  multiplicador: {
    value: "multiplicador",
    label: "Multiplicador",
    emoji: "🔵",
    badgeClass: "bg-info/15 text-info border-info/30",
    pinClass: "bg-info",
    hex: "#2563eb",
  },
  voluntario: {
    value: "voluntario",
    label: "Voluntário",
    emoji: "🟣",
    badgeClass: "bg-accent/20 text-accent-foreground border-accent/40",
    pinClass: "bg-[hsl(280_70%_55%)]",
    hex: "#9333ea",
  },
};

export const STATUS_ELEITOR_LIST: StatusEleitorMeta[] = [
  STATUS_ELEITOR.nao_eleitor,
  STATUS_ELEITOR.possivel_eleitor,
  STATUS_ELEITOR.eleitor,
  STATUS_ELEITOR.multiplicador,
  STATUS_ELEITOR.voluntario,
];

/**
 * Normaliza qualquer variação do status (slug, label, com/sem acento, maiúsculas)
 * para o slug canônico usado nos <Select> e na coluna `status_eleitor` do banco.
 * Aceita: "possivel_eleitor", "Possível eleitor", "POSSIVEL ELEITOR", "possivel eleitor", etc.
 */
export function normalizeStatusEleitor(value: string | null | undefined): StatusEleitor {
  if (!value) return "possivel_eleitor";

  const raw = String(value).trim();

  // 1) Já é um slug válido?
  if (raw in STATUS_ELEITOR) return raw as StatusEleitor;

  // 2) Normalizar: lowercase, remover acentos, trocar espaços/hífens por underscore
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z_]/g, "");

  if (normalized in STATUS_ELEITOR) return normalized as StatusEleitor;

  // 3) Match por label (case/acento-insensitive)
  const byLabel = STATUS_ELEITOR_LIST.find((s) => {
    const labelNorm = s.label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s-]+/g, "_");
    return labelNorm === normalized;
  });
  if (byLabel) return byLabel.value;

  // 4) Heurística por palavra-chave
  if (normalized.includes("nao")) return "nao_eleitor";
  if (normalized.includes("possivel")) return "possivel_eleitor";
  if (normalized.includes("multiplicador")) return "multiplicador";
  if (normalized.includes("voluntario")) return "voluntario";
  if (normalized.includes("eleitor")) return "eleitor";

  return "possivel_eleitor";
}

export function getStatusEleitor(value: string | null | undefined): StatusEleitorMeta {
  return STATUS_ELEITOR[normalizeStatusEleitor(value)];
}
