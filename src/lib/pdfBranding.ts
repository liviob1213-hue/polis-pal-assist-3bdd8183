// Branding e helpers para PDFs estilizados Democrat.IA
import jsPDF from "jspdf";
import logoUrl from "@/assets/logo-democratia.png";

export const BRAND = {
  teal: [68, 152, 149] as [number, number, number],
  tealDark: [42, 105, 103] as [number, number, number],
  tealLight: [220, 238, 237] as [number, number, number],
  crimson: [210, 38, 79] as [number, number, number],
  crimsonLight: [251, 224, 232] as [number, number, number],
  ink: [25, 45, 50] as [number, number, number],
  text: [55, 70, 75] as [number, number, number],
  muted: [120, 135, 140] as [number, number, number],
  bg: [248, 250, 250] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

let cachedLogo: string | null = null;
export async function getLogoDataUrl(): Promise<string> {
  if (cachedLogo) return cachedLogo;
  const res = await fetch(logoUrl);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      cachedLogo = reader.result as string;
      resolve(cachedLogo);
    };
    reader.readAsDataURL(blob);
  });
}

export function drawCover(
  doc: jsPDF,
  opts: { titulo: string; subtitulo?: string; logo?: string; etiqueta?: string }
) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Fundo teal
  doc.setFillColor(...BRAND.teal);
  doc.rect(0, 0, w, h, "F");

  // Faixa decorativa crimson na lateral
  doc.setFillColor(...BRAND.crimson);
  doc.rect(0, h - 90, w, 12, "F");

  // Bloco "vidro"
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 255, 255);
  // simulate alpha via GState
  const gs = (doc as any).GState ? new (doc as any).GState({ opacity: 0.08 }) : null;
  if (gs) (doc as any).setGState(gs);
  doc.roundedRect(40, 110, w - 80, h - 240, 16, 16, "F");
  if (gs) (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));

  // Logo
  if (opts.logo) {
    try {
      doc.addImage(opts.logo, "PNG", w / 2 - 50, 150, 100, 100);
    } catch {}
  }

  // Etiqueta (ex: RELATÓRIO)
  if (opts.etiqueta) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BRAND.crimson);
    doc.setFillColor(255, 255, 255);
    const tw = doc.getTextWidth(opts.etiqueta) + 20;
    doc.roundedRect(w / 2 - tw / 2, 270, tw, 22, 11, 11, "F");
    doc.text(opts.etiqueta, w / 2, 285, { align: "center" });
  }

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  const tituloLines = doc.splitTextToSize(opts.titulo, w - 120);
  doc.text(tituloLines, w / 2, 330, { align: "center" });

  // Subtítulo
  if (opts.subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(220, 240, 240);
    const subLines = doc.splitTextToSize(opts.subtitulo, w - 140);
    doc.text(subLines, w / 2, 330 + tituloLines.length * 32 + 12, { align: "center" });
  }

  // Rodapé da capa
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(220, 240, 240);
  doc.text("Democrat.IA  ·  Plataforma de Gestão Parlamentar", w / 2, h - 50, { align: "center" });
  doc.setFontSize(9);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`,
    w / 2,
    h - 32,
    { align: "center" }
  );
}

export function drawHeader(doc: jsPDF, opts: { logo?: string; titulo: string }) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND.teal);
  doc.rect(0, 0, w, 52, "F");
  doc.setFillColor(...BRAND.crimson);
  doc.rect(0, 52, w, 3, "F");

  if (opts.logo) {
    try {
      doc.addImage(opts.logo, "PNG", 24, 8, 36, 36);
    } catch {}
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("DEMOCRAT.IA", 70, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 240, 240);
  doc.text(opts.titulo, 70, 38);
}

export function drawFooter(doc: jsPDF, totalPaginas: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 2; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND.tealLight);
    doc.setLineWidth(0.5);
    doc.line(40, h - 32, w - 40, h - 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text("Democrat.IA — Plataforma de Gestão Parlamentar", 40, h - 18);
    doc.text(`Página ${i} de ${totalPaginas}`, w - 40, h - 18, { align: "right" });
  }
}

export function drawSectionTitle(doc: jsPDF, y: number, num: string, titulo: string): number {
  const w = doc.internal.pageSize.getWidth();
  // Barra colorida à esquerda
  doc.setFillColor(...BRAND.crimson);
  doc.rect(40, y - 12, 4, 22, "F");
  // Número de seção
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.crimson);
  doc.text(num, 54, y);
  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...BRAND.ink);
  doc.text(titulo, 54 + doc.getTextWidth(num) + 10, y);
  // Linha separadora
  doc.setDrawColor(...BRAND.tealLight);
  doc.setLineWidth(0.5);
  doc.line(40, y + 8, w - 40, y + 8);
  return y + 28;
}

export function ensureSpace(doc: jsPDF, y: number, needed: number, headerCb?: () => void): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + needed > h - 50) {
    doc.addPage();
    if (headerCb) headerCb();
    return 80;
  }
  return y;
}
