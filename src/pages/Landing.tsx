import { Link } from "react-router-dom";
import { AnimatePresence, motion, MotionConfig, type Variants } from "framer-motion";
import {
  Users,
  MapPin,
  Cake,
  FileText,
  CheckSquare,
  CalendarDays,
  Sparkles,
  BookOpen,
  MessageSquare,
  FileBarChart,
  UserCheck,
  Bot,
  Check,
  X,
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  Star,
  Menu,
  Smartphone,
  Lock,
  Inbox,
  MapPinOff,
  Clock,
  UserX,
  Rocket,
  Upload,
  Quote,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import logo from "@/assets/landing/logo-mark.webp";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  HeroDashboard,
  FloatingWhatsApp,
  FloatingBirthday,
  MapMock,
  WhatsAppMock,
  KanbanMock,
  LegislativoMock,
  AniversariosMock,
  EleitoresMock,
  AssessoresMock,
} from "@/components/landing/mockups";

// Fundo escuro da marca (teal profundo), usado no hero e no CTA final
const DARK = "bg-[hsl(178,45%,9%)]";
const EASE = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ dados */

const pains = [
  {
    icon: MessageSquare,
    title: "WhatsApp lotado",
    desc: "Centenas de mensagens sem resposta no celular do gabinete. Cada uma é um eleitor esperando — e reparando.",
  },
  {
    icon: Inbox,
    title: "Demandas que somem",
    desc: "Pedidos anotados no papel, numa planilha ou na memória do assessor. Quando o eleitor cobra, ninguém sabe em que pé está.",
  },
  {
    icon: MapPinOff,
    title: "Base no escuro",
    desc: "Você não sabe com precisão quais bairros te apoiam — nem onde está perdendo força.",
  },
  {
    icon: Cake,
    title: "Datas esquecidas",
    desc: "O aniversário da liderança passou e ninguém do gabinete lembrou. Ela lembrou.",
  },
  {
    icon: Clock,
    title: "Horas no Word",
    desc: "Indicações, requerimentos e ofícios escritos do zero, toda semana, tirando tempo da rua.",
  },
  {
    icon: UserX,
    title: "Equipe sem controle",
    desc: "Você não sabe o que cada assessor fez hoje, nem o que ficou parado esperando alguém.",
  },
];

type Feature = {
  icon: typeof MapPin;
  kicker: string;
  title: string;
  desc: string;
  visual: ReactNode;
  span: string;
  visualH: string;
  premium?: boolean;
};

const features: Feature[] = [
  {
    icon: MapPin,
    kicker: "Mapa de Eleitores",
    title: "Saiba onde está sua força — e onde você está perdendo voto",
    desc: "Cada eleitor vira um ponto no mapa, colorido por status. Descubra os bairros que te apoiam e os que precisam da sua presença.",
    visual: <MapMock />,
    span: "md:col-span-2",
    visualH: "h-60 sm:h-80",
  },
  {
    icon: Bot,
    kicker: "Agente IA no WhatsApp",
    title: "Seu gabinete atendendo às 3 da manhã",
    desc: "A IA responde o eleitor, registra a demanda e encaminha para o assessor certo — sem ninguém digitar nada.",
    visual: <WhatsAppMock />,
    span: "",
    visualH: "h-60 sm:h-80",
    premium: true,
  },
  {
    icon: FileText,
    kicker: "Gestão de Demandas",
    title: "Nenhum pedido esquecido",
    desc: "Kanban com origem, setor, responsável e prioridade. Você vê o que está parado e cobra quem precisa.",
    visual: <KanbanMock />,
    span: "",
    visualH: "h-52",
  },
  {
    icon: Sparkles,
    kicker: "Assistente Legislativo IA",
    title: "Do rascunho ao PDF em minutos",
    desc: "IA especializada em redação parlamentar: projetos de lei, indicações, requerimentos, ofícios e discursos.",
    visual: <LegislativoMock />,
    span: "",
    visualH: "h-52",
    premium: true,
  },
  {
    icon: Cake,
    kicker: "Gestão de Aniversários",
    title: "Lembrado no dia certo",
    desc: "Lista diária de aniversariantes com mensagem pronta para enviar no WhatsApp em um clique.",
    visual: <AniversariosMock />,
    span: "",
    visualH: "h-52",
  },
  {
    icon: Users,
    kicker: "Base de Eleitores",
    title: "Sua base inteira, organizada e pesquisável",
    desc: "CRM com status (eleitor, multiplicador, voluntário), interesses, contatos e histórico. Importe sua planilha em segundos.",
    visual: <EleitoresMock />,
    span: "lg:col-span-2",
    visualH: "h-56",
  },
  {
    icon: UserCheck,
    kicker: "Gestão de Assessores",
    title: "Equipe produzindo, você no controle",
    desc: "Acesso individual com permissão por módulo. Você vê tudo; cada assessor vê só o que precisa.",
    visual: <AssessoresMock />,
    span: "",
    visualH: "h-56",
  },
];

const extraFeatures = [
  { icon: CheckSquare, title: "Gestão de Tarefas", desc: "Quadro por assessor, com prazo e status." },
  { icon: CalendarDays, title: "Agenda Oficial", desc: "Compromissos do mandato sincronizados com o Google Agenda." },
  { icon: BookOpen, title: "Base de Conhecimento", desc: "Suba leis e regimentos e pergunte em linguagem natural." },
  { icon: MessageSquare, title: "Histórico de Conversas", desc: "Todo atendimento registrado e ligado ao eleitor." },
  { icon: FileBarChart, title: "Resumo Mensal", desc: "Prestação de contas pronta, com números reais." },
  { icon: TrendingUp, title: "Painel em Tempo Real", desc: "Eleitores, demandas e tarefas num só lugar." },
];

const steps = [
  {
    icon: Rocket,
    title: "Escolha seu plano",
    desc: "O acesso é liberado assim que o pagamento é confirmado. Sem instalação, sem contrato.",
  },
  {
    icon: Upload,
    title: "Traga sua base e sua equipe",
    desc: "Importe a planilha de eleitores (Excel ou CSV) e crie o acesso de cada assessor.",
  },
  {
    icon: Bot,
    title: "Deixe o sistema trabalhar",
    desc: "Demandas organizadas, aniversários em dia e — no Prata — a IA atendendo o WhatsApp 24h.",
  },
];

const testimonials = [
  {
    name: "Vereador R. Souza",
    role: "Câmara Municipal — interior de SP",
    text: "Triplicamos a velocidade de resposta às demandas dos eleitores. O agente de WhatsApp mudou nosso gabinete.",
  },
  {
    name: "Deputada A. Lima",
    role: "Assembleia Legislativa",
    text: "O Assistente Legislativo me economiza horas por semana na redação de projetos e discursos.",
  },
  {
    name: "Chefe de Gabinete M. Costa",
    role: "Câmara Federal",
    text: "Pela primeira vez temos visão real do mandato em tempo real. Organização completa.",
  },
];

const faqs = [
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. O DEMOCRAT.AI funciona direto no navegador, no computador e no celular. Você entra com seu login e já começa a usar.",
  },
  {
    q: "Já tenho meus eleitores numa planilha. Perco esse trabalho?",
    a: "Não. Você importa sua planilha (Excel ou CSV) para a Base de Eleitores e todos os contatos passam a aparecer no CRM, no mapa e na lista de aniversários.",
  },
  {
    q: "Minha equipe consegue usar?",
    a: "Sim. Você cria o acesso de cada assessor e escolhe, módulo por módulo, o que cada um pode ver e fazer.",
  },
  {
    q: "Como funciona o agente de IA no WhatsApp?",
    a: "Disponível no plano Prata. O agente responde os eleitores no WhatsApp do gabinete, registra cada pedido como demanda e encaminha para o responsável. Todas as conversas ficam salvas no histórico.",
  },
  {
    q: "Qual a diferença entre o Bronze e o Prata?",
    a: "O Bronze traz toda a gestão do mandato: eleitores, mapa, demandas, tarefas, agenda, aniversários e equipe. O Prata adiciona a inteligência artificial: o Assistente Legislativo e o Agente de WhatsApp 24h.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Pode. Não há fidelidade nem multa. E você tem 7 dias de garantia: se não fizer sentido para o seu gabinete, pede o reembolso integral.",
  },
];

/* ------------------------------------------------------------- animações */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={fadeUp}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeader({ eyebrow, title, sub, dark = false }: { eyebrow: string; title: ReactNode; sub?: ReactNode; dark?: boolean }) {
  return (
    <Reveal className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
      <span
        className={`inline-block text-xs font-bold uppercase tracking-[0.18em] ${dark ? "text-[hsl(178,50%,65%)]" : "text-primary"}`}
      >
        {eyebrow}
      </span>
      <h2 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] text-balance">{title}</h2>
      {sub && <p className={`mt-4 text-base sm:text-lg ${dark ? "text-white/70" : "text-muted-foreground"}`}>{sub}</p>}
    </Reveal>
  );
}

function PrimaryCTA({ children, href = "#cadastro", className = "" }: { children: ReactNode; href?: string; className?: string }) {
  return (
    <a
      href={href}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-7 py-4 font-bold text-accent-foreground shadow-[0_12px_40px_-12px_hsl(346,70%,49%)] transition hover:bg-[hsl(346,70%,44%)] hover:shadow-[0_16px_48px_-12px_hsl(346,70%,49%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${className}`}
    >
      {children}
      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
    </a>
  );
}

/* ----------------------------------------------------------------- página */

const Landing = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const cadastroRef = useRef<HTMLElement>(null);
  const cadastroVisible = useRef(false);

  // Formulário de captura de leads (grava na tabela `leads` do Supabase)
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [status, setStatus] = useState<"idle" | "enviando" | "sucesso" | "erro">("idle");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("enviando");
    const { error } = await supabase.from("leads").insert({ nome, email, telefone });
    if (error) {
      setStatus("erro");
      return;
    }
    setNome("");
    setEmail("");
    setTelefone("");
    setStatus("sucesso");
  };

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      setShowStickyCta(y > window.innerHeight * 0.9 && !cadastroVisible.current);
    };
    const io = new IntersectionObserver(([e]) => {
      cadastroVisible.current = e.isIntersecting;
      onScroll();
    });
    if (cadastroRef.current) io.observe(cadastroRef.current);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  const headerSolid = scrolled || mobileOpen;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
        {/* HEADER */}
        <header
          className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
            headerSolid ? "bg-background/90 backdrop-blur-lg border-b border-border text-foreground" : "bg-transparent text-white"
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <a href="#top" className="flex items-center gap-2.5">
              <img src={logo} alt="" width={36} height={36} className="h-9 w-9" />
              <span className="font-extrabold tracking-tight text-lg">
                DEMOCRAT<span className="text-accent">.AI</span>
              </span>
            </a>

            <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
              {[
                ["#funcionalidades", "Funcionalidades"],
                ["#como-funciona", "Como funciona"],
                ["#cadastro", "Começar"],
                ["#faq", "Dúvidas"],
              ].map(([href, label]) => (
                <a key={href} href={href} className="opacity-75 hover:opacity-100 transition">
                  {label}
                </a>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <Link to="/login" className="text-sm font-semibold opacity-80 hover:opacity-100 transition">
                Entrar
              </Link>
              <a
                href="#cadastro"
                className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-bold hover:bg-[hsl(346,70%,44%)] transition"
              >
                Começar agora
              </a>
            </div>

            <button className="md:hidden p-2 -mr-2" onClick={() => setMobileOpen((v) => !v)} aria-label="Abrir menu" aria-expanded={mobileOpen}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="md:hidden overflow-hidden border-t border-border bg-background"
              >
                <div className="px-4 py-4 flex flex-col gap-1 text-sm font-medium">
                  {[
                    ["#funcionalidades", "Funcionalidades"],
                    ["#como-funciona", "Como funciona"],
                    ["#cadastro", "Começar"],
                    ["#faq", "Dúvidas"],
                  ].map(([href, label]) => (
                    <a key={href} href={href} onClick={() => setMobileOpen(false)} className="py-2.5">
                      {label}
                    </a>
                  ))}
                  <Link to="/blog" onClick={() => setMobileOpen(false)} className="py-2.5">
                    Blog
                  </Link>
                  <Link to="/login" onClick={() => setMobileOpen(false)} className="py-2.5">
                    Entrar
                  </Link>
                  <a
                    href="#cadastro"
                    onClick={() => setMobileOpen(false)}
                    className="mt-2 px-4 py-3 rounded-xl bg-accent text-accent-foreground text-center font-bold"
                  >
                    Começar agora
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* HERO */}
        <section id="top" className={`relative overflow-hidden ${DARK} text-white`}>
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                backgroundSize: "56px 56px",
                maskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, black 30%, transparent 100%)",
                WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, black 30%, transparent 100%)",
              }}
            />
            <div className="absolute -top-48 -left-40 h-[640px] w-[640px] rounded-full bg-primary/40 blur-[120px]" />
            <div className="absolute top-1/3 -right-40 h-[520px] w-[520px] rounded-full bg-accent/25 blur-[120px]" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 pt-28 sm:pt-36 pb-20 lg:pb-28 grid lg:grid-cols-[1.05fr_1fr] gap-14 lg:gap-12 items-center">
            <div className="text-center lg:text-left">
              <div
                className="animate-fade-up motion-reduce:animate-none inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/85 backdrop-blur"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Gestão de mandato com IA<span className="hidden sm:inline"> · vereadores, deputados e prefeitos</span>
              </div>

              <h1
                className="animate-fade-up motion-reduce:animate-none [animation-delay:90ms] mt-6 text-[2.5rem] leading-[1.05] sm:text-6xl lg:text-[4.25rem] font-extrabold tracking-tight text-balance"
              >
                Cada mensagem sem resposta é{" "}
                <span className="bg-gradient-to-r from-[hsl(346,90%,68%)] to-[hsl(18,95%,66%)] bg-clip-text text-transparent">
                  um voto a menos
                </span>{" "}
                em outubro.
              </h1>

              <p className="animate-fade-up motion-reduce:animate-none [animation-delay:180ms] mt-6 text-lg sm:text-xl text-white/75 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                O DEMOCRAT.AI organiza eleitores, demandas e equipe em um só painel — e coloca uma inteligência
                artificial para atender o WhatsApp do seu gabinete <b className="text-white font-semibold">24 horas por dia</b>.
              </p>

              <div className="animate-fade-up motion-reduce:animate-none [animation-delay:270ms] mt-9 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <PrimaryCTA className="w-full sm:w-auto text-base">Quero organizar meu mandato</PrimaryCTA>
                <a
                  href="#funcionalidades"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-7 py-4 font-semibold text-white backdrop-blur transition hover:bg-white/10"
                >
                  Ver a plataforma por dentro
                </a>
              </div>

              <ul
                className="animate-fade-up motion-reduce:animate-none [animation-delay:360ms] mt-8 grid grid-cols-2 gap-x-6 gap-y-3 max-w-sm sm:max-w-md mx-auto lg:mx-0 text-sm text-white/70"
              >
                {[
                  [ShieldCheck, "Garantia de 7 dias"],
                  [Zap, "Demonstração gratuita"],
                  [Smartphone, "Funciona no celular"],
                  [Lock, "Sem fidelidade"],
                ].map(([Icon, label]) => {
                  const I = Icon as typeof ShieldCheck;
                  return (
                    <li key={label as string} className="flex items-center gap-2 whitespace-nowrap">
                      <I className="h-4 w-4 text-[hsl(178,55%,62%)]" /> {label as string}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* composição visual */}
            <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
              <div className="animate-tilt-in motion-reduce:animate-none [animation-delay:250ms]">
                <HeroDashboard />
              </div>

              <motion.div
                initial={{ opacity: 0, x: -40, y: 10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.9 }}
                className="hidden sm:block absolute -left-6 lg:-left-20 -top-10 z-10"
              >
                <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
                  <FloatingWhatsApp />
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 40, y: 10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.8, ease: EASE, delay: 1.15 }}
                className="hidden sm:block absolute -right-4 lg:-right-8 -bottom-8 z-10"
              >
                <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}>
                  <FloatingBirthday />
                </motion.div>
              </motion.div>
            </div>
          </div>

          {/* público */}
          <div className="relative border-t border-white/10">
            <div className="max-w-7xl mx-auto px-4 py-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-white/55">
              <span className="text-white/80 font-semibold">Feito para</span>
              {["Vereadores", "Deputados estaduais", "Deputados federais", "Prefeitos", "Chefes de gabinete"].map((r) => (
                <span key={r}>{r}</span>
              ))}
            </div>
          </div>
        </section>

        {/* DOR */}
        <section className="max-w-7xl mx-auto px-4 py-20 sm:py-28">
          <SectionHeader
            eyebrow="Você se identifica?"
            title={
              <>
                Seu gabinete trabalha muito.
                <br className="hidden sm:block" /> Mas o eleitor sente isso?
              </>
            }
            sub="Se pelo menos uma dessas situações acontece no seu mandato, você está deixando votos na mesa."
          />

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            variants={stagger}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {pains.map((p) => {
              const Icon = p.icon;
              return (
                <motion.div
                  key={p.title}
                  variants={fadeUp}
                  className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
                >
                  <div className="h-11 w-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-bold text-lg">{p.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>

          <Reveal className="mt-16 sm:mt-20 max-w-4xl mx-auto text-center">
            <Quote className="mx-auto h-8 w-8 text-primary/30" />
            <p className="mt-4 text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight text-balance">
              O eleitor não lembra do projeto que você protocolou.{" "}
              <span className="text-primary">Ele lembra se foi atendido quando precisou.</span>
            </p>
            <p className="mt-6 text-muted-foreground text-lg">
              Não é falta de trabalho. É falta de sistema. <b className="text-foreground">O DEMOCRAT.AI é esse sistema.</b>
            </p>
          </Reveal>
        </section>

        {/* FUNCIONALIDADES */}
        <section id="funcionalidades" className="scroll-mt-16 bg-secondary/50 border-y border-border">
          <div className="max-w-7xl mx-auto px-4 py-20 sm:py-28">
            <SectionHeader
              eyebrow="A solução"
              title="Tudo que o seu mandato precisa, em um só lugar"
              sub="Pare de alternar entre WhatsApp, planilha, caderno e Word. Cada parte do gabinete conectada — e você enxergando tudo."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.article
                    key={f.kicker}
                    initial={{ opacity: 0, y: 56, scale: 0.96, filter: "blur(8px)" }}
                    whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ type: "spring", stiffness: 70, damping: 17, mass: 0.9, delay: (i % 3) * 0.1 }}
                    whileHover={{ y: -6 }}
                    className={`group flex flex-col rounded-3xl border border-border bg-card overflow-hidden shadow-[var(--shadow-card)] transition-[box-shadow,border-color] duration-300 hover:border-primary/40 hover:shadow-[0_24px_48px_-20px_hsl(178,38%,30%,0.35)] ${f.span}`}
                  >
                    <div className={`relative overflow-hidden border-b border-border bg-gradient-to-br from-secondary to-muted ${f.visualH}`}>
                      <div className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.03]">{f.visual}</div>
                      {f.premium && (
                        <span className="absolute top-3 right-3 z-10 text-[10px] uppercase tracking-wider bg-accent text-accent-foreground px-2.5 py-1 rounded-full font-bold shadow">
                          Plano Prata
                        </span>
                      )}
                    </div>
                    <div className="p-6 sm:p-7">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                        <Icon className="h-4 w-4" /> {f.kicker}
                      </div>
                      <h3 className="mt-2.5 text-xl font-extrabold tracking-tight leading-snug">{f.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                    </div>
                  </motion.article>
                );
              })}
            </div>

            {/* demais funcionalidades */}
            <Reveal className="mt-14 text-center">
              <h3 className="text-lg font-bold">E ainda:</h3>
            </Reveal>
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={stagger}
              className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            >
              {extraFeatures.map((f) => {
                const Icon = f.icon;
                return (
                  <motion.div
                    key={f.title}
                    variants={fadeUp}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{f.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="scroll-mt-16 max-w-6xl mx-auto px-4 py-20 sm:py-28">
          <SectionHeader eyebrow="Como funciona" title="Do zero ao gabinete organizado no mesmo dia" />

          <motion.ol
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
            className="relative grid gap-6 md:grid-cols-3"
          >
            <div aria-hidden className="hidden md:block absolute top-7 left-[16%] right-[16%] h-px bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0" />
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.li key={s.title} variants={fadeUp} className="relative text-center px-4">
                  <div className="relative mx-auto h-14 w-14 rounded-2xl gradient-primary text-primary-foreground flex items-center justify-center shadow-[var(--shadow-lg)]">
                    <Icon className="h-6 w-6" />
                    <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center ring-4 ring-background">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </motion.li>
              );
            })}
          </motion.ol>

          <Reveal className="mt-14 text-center">
            <PrimaryCTA>Quero começar hoje</PrimaryCTA>
          </Reveal>
        </section>

        {/* PLANOS */}
        <section id="cadastro" ref={cadastroRef} className={`scroll-mt-16 relative overflow-hidden ${DARK} text-white`}>
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 left-1/4 h-[460px] w-[460px] rounded-full bg-primary/35 blur-[120px]" />
            <div className="absolute -bottom-32 right-1/4 h-[420px] w-[420px] rounded-full bg-accent/25 blur-[120px]" />
          </div>

          <div className="relative max-w-6xl mx-auto px-4 py-20 sm:py-28 grid lg:grid-cols-[1fr_0.9fr] gap-12 lg:gap-16 items-center">
            {/* argumento */}
            <Reveal>
              <span className="inline-block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(178,50%,65%)]">
                Comece agora
              </span>
              <h2 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] text-balance">
                Dê o primeiro passo para organizar seu mandato
              </h2>
              <p className="mt-4 text-white/70 text-lg leading-relaxed">
                Deixe seus dados e nossa equipe entra em contato para liberar seu acesso e mostrar a plataforma
                funcionando com a realidade do seu gabinete.
              </p>

              <ul className="mt-8 space-y-3">
                {[
                  "Demonstração guiada, sem compromisso",
                  "Ajuda para importar sua base de eleitores",
                  "Garantia de 7 dias após a contratação",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/85">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-[hsl(178,55%,62%)]/20 text-[hsl(178,55%,62%)] flex items-center justify-center">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>

            {/* formulário */}
            <Reveal delay={0.1}>
              <div className="rounded-3xl bg-card text-card-foreground p-6 sm:p-8 shadow-[0_30px_60px_-25px_hsl(178,45%,9%,0.7)] border border-white/10">
                {status === "sucesso" ? (
                  <div className="py-10 text-center">
                    <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h3 className="mt-5 text-xl font-extrabold">Recebemos seu contato!</h3>
                    <p className="mt-2 text-muted-foreground">
                      Em breve nossa equipe fala com você no WhatsApp ou e-mail informado. Fique de olho.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStatus("idle")}
                      className="mt-6 text-sm font-semibold text-primary hover:underline"
                    >
                      Enviar outro contato
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <h3 className="text-xl font-extrabold">Quero conhecer a plataforma</h3>
                      <p className="text-sm text-muted-foreground mt-1">Leva menos de 30 segundos.</p>
                    </div>

                    <div>
                      <label htmlFor="lead-nome" className="block text-sm font-semibold mb-1.5">
                        Nome completo
                      </label>
                      <input
                        id="lead-nome"
                        type="text"
                        required
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Seu nome"
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label htmlFor="lead-email" className="block text-sm font-semibold mb-1.5">
                        E-mail
                      </label>
                      <input
                        id="lead-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="voce@exemplo.com"
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label htmlFor="lead-telefone" className="block text-sm font-semibold mb-1.5">
                        WhatsApp
                      </label>
                      <input
                        id="lead-telefone"
                        type="tel"
                        required
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={status === "enviando"}
                      className="group w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-4 font-bold text-accent-foreground shadow-[0_12px_40px_-12px_hsl(346,70%,49%)] transition hover:bg-[hsl(346,70%,44%)] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {status === "enviando" ? "Enviando..." : "Quero começar"}
                      {status !== "enviando" && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />}
                    </button>

                    {status === "erro" && (
                      <p className="text-sm text-destructive text-center">
                        Não foi possível enviar agora. Tente novamente em instantes.
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground text-center">
                      Seus dados são usados apenas para contato. Nada de spam.
                    </p>
                  </form>
                )}
              </div>
            </Reveal>
          </div>
        </section>

        {/* DEPOIMENTOS */}
        <section id="depoimentos" className="max-w-6xl mx-auto px-4 py-20 sm:py-28">
          <SectionHeader eyebrow="Depoimentos" title="Quem já organizou o mandato" />

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
          >
            {testimonials.map((t) => (
              <motion.figure
                key={t.name}
                variants={fadeUp}
                className="flex flex-col p-7 rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]"
              >
                <div className="flex gap-0.5 text-amber-400">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <Star key={k} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 leading-relaxed">“{t.text}”</blockquote>
                <figcaption className="mt-6 pt-5 border-t border-border flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full gradient-primary text-primary-foreground font-bold flex items-center justify-center">
                    {t.name.split(" ").slice(-1)[0][0]}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </motion.div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-16 bg-secondary/50 border-y border-border">
          <div className="max-w-3xl mx-auto px-4 py-20 sm:py-28">
            <SectionHeader eyebrow="Dúvidas" title="Perguntas frequentes" />
            <Reveal>
              <Accordion type="single" collapsible className="rounded-2xl border border-border bg-card px-5 sm:px-7">
                {faqs.map((f, i) => (
                  <AccordionItem key={f.q} value={`f${i}`} className="last:border-0">
                    <AccordionTrigger className="text-left font-bold hover:no-underline py-5">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed text-[15px]">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="px-4 py-20 sm:py-28">
          <Reveal className="max-w-5xl mx-auto">
            <div className={`relative overflow-hidden rounded-[2rem] ${DARK} text-white px-6 py-14 sm:p-20 text-center`}>
              <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full bg-primary/40 blur-[110px]" />
              <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-20 h-[360px] w-[360px] rounded-full bg-accent/30 blur-[110px]" />
              <div className="relative">
                <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] text-balance">
                  Outubro chega para todo mundo.
                  <br />
                  <span className="text-[hsl(178,55%,62%)]">A diferença é quem chega organizado.</span>
                </h2>
                <p className="mt-6 text-white/75 text-lg max-w-2xl mx-auto">
                  Comece hoje e, em poucos minutos, seu gabinete já está registrando demandas, cuidando da base e
                  respondendo eleitores com inteligência artificial.
                </p>
                <PrimaryCTA className="mt-10 text-base">Quero organizar meu mandato agora</PrimaryCTA>
                <p className="mt-5 text-sm text-white/55">Preencha em 30 segundos · Nossa equipe entra em contato · Garantia de 7 dias</p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-border bg-card/40 pb-20 md:pb-0">
          <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
            <div className="col-span-2">
              <div className="flex items-center gap-2">
                <img src={logo} alt="" width={32} height={32} loading="lazy" className="h-8 w-8" />
                <span className="font-extrabold">DEMOCRAT.AI</span>
              </div>
              <p className="mt-3 text-muted-foreground max-w-xs text-sm">
                Plataforma inteligente de gestão de mandato e relacionamento com eleitores.
              </p>
            </div>

            <div>
              <div className="font-bold mb-3">Produto</div>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#funcionalidades" className="hover:text-foreground">Funcionalidades</a></li>
                <li><a href="#cadastro" className="hover:text-foreground">Começar</a></li>
                <li><Link to="/login" className="hover:text-foreground">Entrar</Link></li>
              </ul>
            </div>

            <div>
              <div className="font-bold mb-3">Empresa</div>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="/blog" className="hover:text-foreground">Blog</Link></li>
                <li><Link to="/politica-privacidade" className="hover:text-foreground">Política de Privacidade</Link></li>
                <li><a href="mailto:contato@democrat.ai" className="hover:text-foreground">Contato</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} DEMOCRAT.AI — Todos os direitos reservados.
          </div>
        </footer>

        {/* CTA fixo no mobile */}
        <AnimatePresence>
          {showStickyCta && !mobileOpen && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]"
            >
              <a
                href="#cadastro"
                className="flex items-center justify-between gap-3 rounded-xl bg-accent px-5 py-3.5 text-accent-foreground font-bold shadow-[0_12px_40px_-12px_hsl(346,70%,49%)]"
              >
                <span className="whitespace-nowrap">Organizar meu mandato</span>
                <span className="flex items-center gap-1 text-sm font-semibold opacity-90 whitespace-nowrap">
                  Começar <ArrowRight className="h-4 w-4" />
                </span>
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
};

export default Landing;
