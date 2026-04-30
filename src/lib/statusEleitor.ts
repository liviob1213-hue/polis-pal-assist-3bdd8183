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

export function getStatusEleitor(value: string | null | undefined): StatusEleitorMeta {
  if (!value) return STATUS_ELEITOR.possivel_eleitor;
  return STATUS_ELEITOR[value as StatusEleitor] || STATUS_ELEITOR.possivel_eleitor;
}
