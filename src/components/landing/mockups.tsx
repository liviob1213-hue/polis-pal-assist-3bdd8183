// Mockups de interface usados na página de vendas.
// Substituem os prints de tela: ficam nítidos em qualquer resolução, carregam
// instantaneamente e mostram o produto com dados fictícios realistas.
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  Bot,
  Cake,
  CheckCheck,
  FileDown,
  LayoutDashboard,
  MapPin,
  Search,
  Sparkles,
  Upload,
  Users,
  FileText,
  CheckSquare,
  TrendingUp,
} from "lucide-react";
import mapaBrasil from "@/assets/landing/mapa-brasil.webp";

/* ----------------------------------------------------------------- helpers */

function useCountUp(target: number, start: boolean, duration = 1400) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);
  useEffect(() => {
    if (!start || reduce) {
      if (reduce) setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, start, duration, reduce]);
  return value;
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

function Initials({ name, className = "" }: { name: string; className?: string }) {
  const ini = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return (
    <div
      className={`shrink-0 rounded-full gradient-primary text-primary-foreground font-semibold flex items-center justify-center ${className}`}
    >
      {ini}
    </div>
  );
}

const STATUS = {
  eleitor: { label: "Eleitor", dot: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-700" },
  multiplicador: { label: "Multiplicador", dot: "bg-blue-500", chip: "bg-blue-500/10 text-blue-700" },
  voluntario: { label: "Voluntário", dot: "bg-violet-500", chip: "bg-violet-500/10 text-violet-700" },
  possivel: { label: "Possível eleitor", dot: "bg-amber-400", chip: "bg-amber-400/15 text-amber-700" },
} as const;
type StatusKey = keyof typeof STATUS;

/* ------------------------------------------------------- hero: dashboard */

const chartPoints = [18, 26, 22, 34, 31, 42, 39, 51, 48, 60, 58, 72];

export function HeroDashboard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const eleitores = useCountUp(12480, inView);
  const resolvidas = useCountUp(214, inView);
  const abertas = useCountUp(37, inView);

  const w = 300;
  const h = 90;
  const max = Math.max(...chartPoints);
  const pts = chartPoints.map((v, i) => [(i / (chartPoints.length - 1)) * w, h - (v / max) * (h - 8)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;

  const demandas = [
    { t: "Iluminação — Rua das Acácias", b: "Jd. América", s: "Em andamento", c: "bg-blue-500/10 text-blue-700" },
    { t: "Vaga em creche — CMEI Sol Nascente", b: "Vila Nova", s: "Resolvida", c: "bg-emerald-500/10 text-emerald-700" },
    { t: "Poda de árvore — Praça Central", b: "Centro", s: "Aberta", c: "bg-amber-400/15 text-amber-700" },
  ];

  return (
    <div ref={ref} className="rounded-2xl border border-white/10 bg-card text-card-foreground shadow-2xl shadow-black/40 overflow-hidden">
      {/* browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/60">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <div className="ml-3 flex-1 max-w-[220px] rounded-md bg-background px-3 py-1 text-[10px] text-muted-foreground truncate">
          democrat.ai/painel
        </div>
      </div>

      <div className="flex">
        {/* mini sidebar */}
        <div className="hidden sm:flex flex-col items-center gap-3 py-4 px-2.5 bg-[hsl(var(--sidebar-background))]">
          {[LayoutDashboard, Users, MapPin, Cake, FileText, CheckSquare, Sparkles].map((Icon, i) => (
            <div
              key={i}
              className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                i === 0 ? "bg-white/15 text-white" : "text-white/55"
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>
          ))}
        </div>

        <div className="flex-1 p-4 sm:p-5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold">Painel do mandato</div>
              <div className="text-[11px] text-muted-foreground">Atualizado agora</div>
            </div>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> IA atendendo
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { l: "Eleitores", v: fmt(eleitores), d: "+8%" },
              { l: "Resolvidas/mês", v: fmt(resolvidas), d: "+23%" },
              { l: "Demandas abertas", v: fmt(abertas), d: "−12%" },
            ].map((k) => (
              <div key={k.l} className="rounded-xl border border-border bg-background/60 p-2.5 sm:p-3">
                <div className="text-[10px] text-muted-foreground truncate">{k.l}</div>
                <div className="text-base sm:text-xl font-bold tabular-nums mt-0.5">{k.v}</div>
                <div className="text-[10px] font-semibold text-emerald-600">{k.d}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold">Demandas resolvidas</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-600" /> 12 meses
              </span>
            </div>
            <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full h-16 sm:h-20" preserveAspectRatio="none">
              <defs>
                <linearGradient id="heroArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.path
                d={area}
                fill="url(#heroArea)"
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                transition={{ duration: 0.8, delay: 0.6 }}
              />
              <motion.path
                d={line}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }}
                animate={inView ? { pathLength: 1 } : {}}
                transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
              />
            </svg>
          </div>

          <div className="mt-3 space-y-1.5">
            {demandas.map((d, i) => (
              <motion.div
                key={d.t}
                initial={{ opacity: 0, x: -10 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.5 + i * 0.12 }}
                className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold truncate">{d.t}</div>
                  <div className="text-[10px] text-muted-foreground">{d.b}</div>
                </div>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${d.c}`}>{d.s}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Notificação flutuante do agente de WhatsApp (hero). */
export function FloatingWhatsApp() {
  return (
    <div className="w-64 rounded-2xl border border-border bg-card text-card-foreground p-3.5 shadow-2xl shadow-black/30">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold">Agente IA · WhatsApp</div>
          <div className="text-[10px] text-muted-foreground">agora · 03:12</div>
        </div>
      </div>
      <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">
        Respondeu <b className="text-foreground">Carla M.</b> e registrou a demanda <b className="text-foreground">#482</b> para a
        equipe de infraestrutura.
      </p>
    </div>
  );
}

/** Notificação flutuante de aniversários (hero). */
export function FloatingBirthday() {
  return (
    <div className="w-56 rounded-2xl border border-border bg-card text-card-foreground p-3.5 shadow-2xl shadow-black/30">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-accent/10 text-accent flex items-center justify-center">
          <Cake className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs font-bold">6 aniversariantes hoje</div>
          <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCheck className="h-3 w-3" /> Parabéns enviados
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- features */

// Posições (em %) das cidades no recorte do mapa
const cities: { x: number; y: number; n: number; s: StatusKey }[] = [
  { x: 54.3, y: 71.5, n: 14, s: "eleitor" }, // São Paulo
  { x: 60.6, y: 66.3, n: 9, s: "multiplicador" }, // Rio
  { x: 57.8, y: 59.3, n: 10, s: "eleitor" }, // Belo Horizonte
  { x: 52.8, y: 46.2, n: 6, s: "voluntario" }, // Brasília
  { x: 50.9, y: 77.6, n: 5, s: "possivel" }, // Curitiba
  { x: 64.4, y: 41.2, n: 6, s: "multiplicador" }, // Salvador
  { x: 68.6, y: 23.3, n: 4, s: "eleitor" }, // Recife
  { x: 64.4, y: 12.5, n: 3, s: "possivel" }, // Fortaleza
];

// pseudo-aleatório determinístico: os pontos ficam sempre no mesmo lugar
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const mapDots = (() => {
  const rnd = seeded(42);
  const keys = Object.keys(STATUS) as StatusKey[];
  return cities.flatMap((c, ci) =>
    Array.from({ length: c.n }, (_, i) => ({
      id: `${ci}-${i}`,
      x: c.x + (rnd() - 0.5) * 5,
      y: c.y + (rnd() - 0.5) * 9,
      s: rnd() > 0.45 ? c.s : keys[Math.floor(rnd() * keys.length)],
    })),
  );
})();

/**
 * Preenche o container como um "object-fit: cover", mas mantendo imagem e pins
 * na mesma caixa — assim os pins nunca saem do lugar ao recortar.
 */
export function MapMock() {
  return (
    <div className="relative h-full w-full overflow-hidden [container-type:size]">
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 aspect-[1320/558]"
        style={{ width: "max(100%, calc(100cqh * 1320 / 558))" }}
      >
        <img
          src={mapaBrasil}
          alt="Mapa do Brasil com a distribuição de eleitores por status"
          width={1320}
          height={558}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full"
        />
        {mapDots.map((d, i) => (
        <motion.span
          key={d.id}
          initial={{ opacity: 0, scale: 0 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + i * 0.015, type: "spring", stiffness: 300, damping: 18 }}
          className={`absolute h-2 w-2 sm:h-2.5 sm:w-2.5 -ml-1 -mt-1 rounded-full ring-2 ring-white shadow ${STATUS[d.s].dot}`}
          style={{ left: `${d.x}%`, top: `${d.y}%` }}
          />
        ))}
        {/* pulso em São Paulo */}
        <span className="absolute -ml-3 -mt-3 h-6 w-6 rounded-full bg-emerald-500/40 animate-ping" style={{ left: "54.3%", top: "71.5%" }} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />

      <div className="absolute left-3 bottom-3 rounded-xl bg-card/95 backdrop-blur px-3 py-2 shadow-lg border border-border">
        <div className="text-[10px] text-muted-foreground">Eleitores no mapa</div>
        <div className="text-sm font-bold tabular-nums">12.480</div>
      </div>
      <div className="hidden sm:flex absolute right-3 top-3 flex-col gap-1 rounded-xl bg-card/95 backdrop-blur px-3 py-2 shadow-lg border border-border">
        {(Object.keys(STATUS) as StatusKey[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-[10px]">
            <span className={`h-2 w-2 rounded-full ${STATUS[k].dot}`} /> {STATUS[k].label}
          </span>
        ))}
      </div>
      <span className="absolute right-2 bottom-1 text-[8px] text-black/50">Mapa © Google</span>
    </div>
  );
}

export function WhatsAppMock() {
  const msgs = [
    {
      me: false,
      t: "Bom dia! Tem um buraco enorme na Rua das Acácias, no Jd. América. Já caiu moto lá.",
    },
    {
      me: true,
      t: "Bom dia, Carla! Registrei sua solicitação e encaminhei para a equipe de infraestrutura. Te aviso por aqui assim que houver retorno.",
    },
  ];
  return (
    <div className="h-full flex flex-col bg-[#efeae2]">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#075e54] text-white">
        <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center">
          <Bot className="h-3.5 w-3.5" />
        </div>
        <div className="leading-tight">
          <div className="text-[11px] font-semibold">Gabinete</div>
          <div className="text-[9px] text-white/75">online · atendimento com IA</div>
        </div>
      </div>
      <div className="flex-1 p-3 space-y-2">
        {msgs.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.6 }}
            className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[11px] leading-snug shadow-sm ${
              m.me ? "ml-auto bg-[#d9fdd3] text-neutral-800" : "bg-white text-neutral-800"
            }`}
          >
            {m.t}
            <div className="text-[8px] text-neutral-500 text-right mt-0.5 flex items-center justify-end gap-0.5">
              03:12 {m.me && <CheckCheck className="h-2.5 w-2.5 text-sky-500" />}
            </div>
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1.6 }}
          className="mx-auto w-fit rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-semibold text-[#075e54] shadow-sm"
        >
          Demanda #482 criada · Infraestrutura · Alta
        </motion.div>
      </div>
    </div>
  );
}

export function KanbanMock() {
  const cols = [
    { t: "Aberto", c: "bg-amber-400", n: 12, cards: ["Poda de árvore", "Faixa de pedestre"] },
    { t: "Andamento", c: "bg-blue-500", n: 8, cards: ["Iluminação pública", "Vaga em creche"] },
    { t: "Resolvido", c: "bg-emerald-500", n: 214, cards: ["Tapa-buraco", "Coleta de lixo"] },
  ];
  return (
    <div className="h-full p-3 grid grid-cols-3 gap-2">
      {cols.map((col, ci) => (
        <div key={col.t} className="rounded-lg bg-background/70 p-1.5">
          <div className="flex items-center gap-1 px-1 pb-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${col.c}`} />
            <span className="text-[9px] font-semibold truncate">{col.t}</span>
            <span className="ml-auto text-[9px] text-muted-foreground tabular-nums">{col.n}</span>
          </div>
          <div className="space-y-1.5">
            {col.cards.map((card, i) => (
              <motion.div
                key={card}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + ci * 0.12 + i * 0.08 }}
                className="rounded-md bg-card border border-border p-1.5 shadow-sm"
              >
                <div className={`h-0.5 w-6 rounded-full mb-1 ${col.c}`} />
                <div className="text-[9px] font-semibold leading-tight">{card}</div>
                <div className="text-[8px] text-muted-foreground mt-0.5">Jd. América</div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LegislativoMock() {
  const lines = [92, 100, 85, 97, 64];
  return (
    <div className="h-full p-3 flex items-center justify-center">
      <div className="w-full max-w-[240px] rounded-lg bg-card border border-border shadow-md p-3">
        <div className="flex items-center gap-1.5 text-[9px] font-semibold text-accent">
          <Sparkles className="h-3 w-3" /> Gerado pela IA
        </div>
        <div className="mt-1.5 text-[11px] font-bold">INDICAÇÃO Nº 127/2026</div>
        <div className="text-[9px] text-muted-foreground">Instalação de iluminação pública na Rua das Acácias</div>
        <div className="mt-2.5 space-y-1.5">
          {lines.map((wd, i) => (
            <motion.div
              key={i}
              initial={{ width: 0 }}
              whileInView={{ width: `${wd}%` }}
              viewport={{ once: true }}
              transition={{ delay: 0.25 + i * 0.18, duration: 0.5, ease: "easeOut" }}
              className="h-1.5 rounded-full bg-muted-foreground/20"
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[9px] text-muted-foreground">Pronto em 40s</span>
          <span className="text-[9px] font-semibold px-2 py-1 rounded-md gradient-primary text-primary-foreground flex items-center gap-1">
            <FileDown className="h-3 w-3" /> PDF
          </span>
        </div>
      </div>
    </div>
  );
}

export function AniversariosMock() {
  const people = [
    { n: "João Batista", b: "Centro", sent: true },
    { n: "Ana Paula Rocha", b: "Vila Nova", sent: true },
    { n: "Lúcia Ferreira", b: "Santa Luzia", sent: false },
  ];
  return (
    <div className="h-full p-3 flex flex-col justify-center gap-1.5">
      <div className="text-[10px] font-semibold text-muted-foreground px-1">Hoje · 6 aniversariantes</div>
      {people.map((p, i) => (
        <motion.div
          key={p.n}
          initial={{ opacity: 0, x: 12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + i * 0.1 }}
          className="flex items-center gap-2 rounded-lg bg-card border border-border px-2 py-1.5 shadow-sm"
        >
          <Initials name={p.n} className="h-6 w-6 text-[9px]" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold truncate">{p.n}</div>
            <div className="text-[8px] text-muted-foreground">{p.b}</div>
          </div>
          {p.sent ? (
            <span className="text-[8px] font-semibold text-emerald-600 flex items-center gap-0.5">
              <CheckCheck className="h-3 w-3" /> Enviado
            </span>
          ) : (
            <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500 text-white">Parabenizar</span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

export function EleitoresMock() {
  const rows: { n: string; b: string; s: StatusKey; u: string }[] = [
    { n: "Carla Mendes", b: "Jd. América", s: "multiplicador", u: "hoje" },
    { n: "Pedro Henrique", b: "Centro", s: "eleitor", u: "ontem" },
    { n: "Marcos Vinícius", b: "São José", s: "voluntario", u: "3 dias" },
    { n: "Rita de Cássia", b: "Vila Nova", s: "possivel", u: "1 semana" },
  ];
  return (
    <div className="h-full p-3 flex flex-col">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 rounded-md bg-card border border-border px-2 py-1 text-[10px] text-muted-foreground">
          <Search className="h-3 w-3" /> Buscar eleitor…
        </div>
        <span className="text-[10px] font-semibold px-2 py-1 rounded-md border border-border bg-card flex items-center gap-1">
          <Upload className="h-3 w-3" /> Importar planilha
        </span>
      </div>
      <div className="mt-2 rounded-lg border border-border bg-card overflow-hidden flex-1">
        <div className="grid grid-cols-[1.4fr_1fr_1fr] sm:grid-cols-[1.4fr_1fr_1fr_0.8fr] px-2.5 py-1.5 text-[9px] font-semibold text-muted-foreground border-b border-border bg-muted/50">
          <span>Nome</span>
          <span>Bairro</span>
          <span>Status</span>
          <span className="hidden sm:block">Último contato</span>
        </div>
        {rows.map((r, i) => (
          <motion.div
            key={r.n}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 + i * 0.08 }}
            className="grid grid-cols-[1.4fr_1fr_1fr] sm:grid-cols-[1.4fr_1fr_1fr_0.8fr] items-center px-2.5 py-1.5 text-[10px] border-b border-border last:border-0"
          >
            <span className="flex items-center gap-1.5 font-semibold min-w-0">
              <Initials name={r.n} className="h-5 w-5 text-[8px]" />
              <span className="truncate">{r.n}</span>
            </span>
            <span className="text-muted-foreground truncate">{r.b}</span>
            <span>
              <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${STATUS[r.s].chip}`}>
                {STATUS[r.s].label}
              </span>
            </span>
            <span className="hidden sm:block text-muted-foreground">{r.u}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function AssessoresMock() {
  const team = [
    { n: "Rafael Souza", r: "Atendimento", done: 18, total: 20 },
    { n: "Juliana Alves", r: "Agenda", done: 11, total: 14 },
    { n: "Bruno Lima", r: "Campo", done: 7, total: 12 },
  ];
  return (
    <div className="h-full p-3 flex flex-col justify-center gap-2">
      {team.map((t, i) => (
        <div key={t.n} className="rounded-lg bg-card border border-border px-2.5 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <Initials name={t.n} className="h-6 w-6 text-[9px]" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold truncate">{t.n}</div>
              <div className="text-[8px] text-muted-foreground">{t.r}</div>
            </div>
            <span className="text-[9px] font-semibold tabular-nums">
              {t.done}/{t.total}
            </span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${(t.done / t.total) * 100}%` }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.12, duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full gradient-primary"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
