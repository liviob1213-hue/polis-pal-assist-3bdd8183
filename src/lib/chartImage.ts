// Gera imagens base64 a partir de Chart.js para embutir em PDFs
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

export interface ChartSpec {
  type: "bar" | "doughnut" | "line";
  labels: string[];
  data: number[];
  colors?: string[];
  title?: string;
}

export async function renderChartToDataUrl(spec: ChartSpec, width = 900, height = 480): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // Fundo branco
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Sem contexto canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const palette = spec.colors || [
    "#449895", "#D2264F", "#2A6967", "#F08FA8", "#3A8B88",
    "#E85B7C", "#5BB4B0", "#B91D43", "#85C7C4", "#7E1530",
  ];

  const chart = new Chart(ctx, {
    type: spec.type,
    data: {
      labels: spec.labels,
      datasets: [
        {
          label: spec.title || "",
          data: spec.data,
          backgroundColor: spec.type === "line" ? "rgba(68,152,149,0.2)" : palette,
          borderColor: spec.type === "line" ? "#449895" : palette,
          borderWidth: 2,
          fill: spec.type === "line",
          tension: 0.35,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        legend: { display: spec.type === "doughnut", position: "right", labels: { font: { size: 13 } } },
        title: spec.title
          ? { display: true, text: spec.title, font: { size: 16, weight: "bold" }, color: "#192D32", padding: 12 }
          : { display: false },
      },
      scales:
        spec.type === "doughnut"
          ? {}
          : {
              x: { grid: { display: false }, ticks: { font: { size: 12 }, color: "#374B50" } },
              y: { beginAtZero: true, grid: { color: "#E5EFEE" }, ticks: { font: { size: 12 }, color: "#374B50" } },
            },
    },
  });

  // Espera 1 frame para garantir renderização
  await new Promise((r) => setTimeout(r, 50));
  const url = canvas.toDataURL("image/png");
  chart.destroy();
  return url;
}
