import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo-democrat-icon.png";

import f47 from "@/assets/landing/feature-47.png.asset.json";
import f48 from "@/assets/landing/feature-48.png.asset.json";
import f49 from "@/assets/landing/feature-49.png.asset.json";
import f50 from "@/assets/landing/feature-50.png.asset.json";
import f51 from "@/assets/landing/feature-51.png.asset.json";
import f52 from "@/assets/landing/feature-52.png.asset.json";
import f53 from "@/assets/landing/feature-53.png.asset.json";

const LINK_BRONZE = "https://pay.kiwify.com.br/Hb7Uc7I";
const LINK_PRATA = "https://pay.kiwify.com.br/E2UJ6NS";

const features = [
  {
    icon: MapPin,
    title: "Mapa de Eleitores",
    desc: "Visualize geograficamente sua base com pins por status (eleitor, multiplicador, voluntário) e densidade por bairro.",
    img: f47.url,
  },
  {
    icon: Cake,
    title: "Gestão de Aniversários",
    desc: "Nunca perca uma data. Envie mensagens personalizadas no WhatsApp para fortalecer o relacionamento.",
    img: f48.url,
  },
  {
    icon: FileText,
    title: "Gestão de Demandas",
    desc: "Kanban completo com filtros por origem, status, responsável, tipo, setor e prioridade.",
    img: f49.url,
  },
  {
    icon: CheckSquare,
    title: "Gestão de Tarefas",
    desc: "Organize as atividades do gabinete em colunas: pendente, em andamento e concluído.",
    img: f50.url,
  },
  {
    icon: Sparkles,
    title: "Assistente Legislativo IA",
    desc: "Redação de projetos de lei, discursos, indicações, requerimentos e ofícios — tudo com IA e exportação em PDF.",
    img: f51.url,
    premium: true,
  },
  {
    icon: Users,
    title: "Base de Eleitores",
    desc: "CRM completo com classificação por status, interesses, contatos e histórico de interações.",
    img: f52.url,
  },
  {
    icon: UserCheck,
    title: "Gestão de Assessores",
    desc: "Cadastre sua equipe, defina permissões por módulo e acompanhe o desempenho de cada assessor.",
    img: f53.url,
  },
];

const extraFeatures = [
  { icon: Bot, title: "Agente WhatsApp IA", desc: "Atendimento 24h com IA, registro automático de demandas e roteamento para o assessor certo.", premium: true },
  { icon: CalendarDays, title: "Agenda Oficial", desc: "Centralize compromissos, audiências e eventos do mandato em um único lugar." },
  { icon: BookOpen, title: "Base de Conhecimento", desc: "Carregue PDFs e documentos para alimentar a IA com o contexto do seu mandato." },
  { icon: MessageSquare, title: "Histórico de Conversas", desc: "Todas as interações registradas e pesquisáveis." },
  { icon: FileBarChart, title: "Resumo Mensal", desc: "Relatórios automáticos com indicadores de desempenho do mandato." },
  { icon: TrendingUp, title: "Dashboard em Tempo Real", desc: "Métricas ao vivo: eleitores, demandas, tarefas, conversões." },
];

const plans = [
  {
    name: "Bronze",
    tag: "Para começar com profissionalismo",
    price: "R$ 97",
    period: "/mês",
    link: LINK_BRONZE,
    cta: "Começar com Bronze",
    highlight: false,
    items: [
...
      { included: false, label: "Agente IA no WhatsApp 24h" },
    ],
  },
  {
    name: "Prata",
    tag: "A experiência completa DEMOCRAT.AI",
    price: "R$ 147",
    period: "/mês",
    link: LINK_PRATA,
    cta: "Quero o plano Prata",
    highlight: true,
    items: [
      { included: true, label: "Tudo do plano Bronze" },
      { included: true, label: "Assistente Legislativo IA (PL, discursos, ofícios)" },
      { included: true, label: "Agente IA no WhatsApp 24h" },
      { included: true, label: "Roteamento automático de demandas" },
      { included: true, label: "Suporte prioritário" },
      { included: true, label: "Atualizações antecipadas" },
    ],
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

const Landing = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2">
            <img src={logo} alt="DEMOCRAT.AI" className="h-9 w-9" />
            <span className="font-bold tracking-tight text-lg">DEMOCRAT<span className="text-accent">.AI</span></span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="#funcionalidades" className="text-foreground/70 hover:text-foreground transition">Funcionalidades</a>
            <a href="#planos" className="text-foreground/70 hover:text-foreground transition">Planos</a>
            <a href="#depoimentos" className="text-foreground/70 hover:text-foreground transition">Depoimentos</a>
            <Link to="/blog" className="text-foreground/70 hover:text-foreground transition">Blog</Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-foreground/80 hover:text-foreground">Entrar</Link>
            <a
              href="#planos"
              className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition"
            >
              Começar agora
            </a>
          </div>

          <button
            className="md:hidden p-2 -mr-2"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background/95">
            <div className="px-4 py-3 flex flex-col gap-3 text-sm">
              <a href="#funcionalidades" onClick={() => setMobileOpen(false)}>Funcionalidades</a>
              <a href="#planos" onClick={() => setMobileOpen(false)}>Planos</a>
              <a href="#depoimentos" onClick={() => setMobileOpen(false)}>Depoimentos</a>
              <Link to="/blog" onClick={() => setMobileOpen(false)}>Blog</Link>
              <Link to="/login" onClick={() => setMobileOpen(false)}>Entrar</Link>
              <a
                href="#planos"
                onClick={() => setMobileOpen(false)}
                className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-center font-semibold"
              >
                Começar agora
              </a>
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="top" className="relative">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-1/3 -right-32 w-[500px] h-[500px] rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 pt-12 pb-16 sm:pt-20 sm:pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-medium mb-6"
          >
            <Sparkles className="h-3.5 w-3.5" />
            A plataforma de gestão política nº 1 do Brasil
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]"
          >
            Transforme seu mandato com{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              inteligência artificial
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-6 text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            CRM eleitoral, mapa interativo, gestão de demandas, agente IA no WhatsApp e assistente
            legislativo — tudo em uma plataforma feita para políticos brasileiros.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center"
          >
            <a
              href="#planos"
              className="w-full sm:w-auto px-8 py-4 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-[var(--shadow-lg)] hover:scale-105 transition inline-flex items-center justify-center gap-2"
            >
              Quero transformar meu mandato <ArrowRight className="h-5 w-5" />
            </a>
            <a
              href="#funcionalidades"
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-border bg-card hover:bg-secondary transition font-semibold"
            >
              Ver funcionalidades
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
          >
            <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-primary" /> LGPD-compliant</span>
            <span className="flex items-center gap-1"><Zap className="h-4 w-4 text-primary" /> Setup em 5 minutos</span>
            <span className="flex items-center gap-1"><Smartphone className="h-4 w-4 text-primary" /> 100% mobile</span>
          </motion.div>

          {/* Hero preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-12 sm:mt-16 mx-auto max-w-5xl"
          >
            <div className="rounded-2xl overflow-hidden border border-border shadow-[var(--shadow-lg)] bg-card">
              <img src={f47.url} alt="Mapa de Eleitores DEMOCRAT.AI" className="w-full h-auto" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-border bg-card/40">
        <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { n: "+10mil", l: "Eleitores gerenciados" },
            { n: "+500", l: "Mandatos atendidos" },
            { n: "24h", l: "Atendimento IA" },
            { n: "98%", l: "Satisfação" },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-2xl sm:text-4xl font-bold text-primary">{s.n}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES com efeito scroll/hover */}
      <section id="funcionalidades" className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Tudo o que seu mandato precisa
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Uma plataforma completa, pensada para o dia a dia de políticos e gabinetes que querem
            resultados de verdade.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.55, delay: (i % 3) * 0.08 }}
                className="group relative rounded-2xl overflow-hidden border border-border bg-card hover:shadow-[var(--shadow-lg)] transition-all"
              >
                {/* image revealed on hover */}
                <div className="relative h-52 overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
                  <img
                    src={f.img}
                    alt={f.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover object-top opacity-0 scale-105 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500"
                  />
                  <div className="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition">
                    <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center shadow-[var(--shadow-md)]">
                      <Icon className="h-8 w-8 text-primary-foreground" />
                    </div>
                  </div>
                  {f.premium && (
                    <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider bg-accent text-accent-foreground px-2 py-0.5 rounded-full font-semibold">
                      Plano Prata
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-lg">{f.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{f.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Extra features */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {extraFeatures.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="p-5 rounded-xl border border-border bg-card/60 hover:bg-card transition"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      {f.title}
                      {f.premium && (
                        <span className="text-[9px] uppercase tracking-wider bg-accent/15 text-accent px-1.5 py-0.5 rounded">
                          Prata
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">Escolha seu plano</h2>
          <p className="mt-4 text-muted-foreground">
            Comece com o Bronze ou tenha a experiência completa com o Prata.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative rounded-2xl p-7 border transition ${
                plan.highlight
                  ? "border-accent bg-gradient-to-br from-card to-primary/5 shadow-[var(--shadow-lg)] md:scale-105"
                  : "border-border bg-card"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Mais escolhido
                </span>
              )}

              <h3 className="text-2xl font-bold">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{plan.tag}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl sm:text-5xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>

              <a
                href={plan.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-6 block text-center px-6 py-3 rounded-xl font-semibold transition ${
                  plan.highlight
                    ? "gradient-accent text-accent-foreground hover:opacity-90 shadow-[var(--shadow-md)]"
                    : "gradient-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                {plan.cta}
              </a>

              <ul className="mt-6 space-y-2.5">
                {plan.items.map((it) => (
                  <li key={it.label} className="flex items-start gap-2 text-sm">
                    {it.included ? (
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                    )}
                    <span className={it.included ? "" : "text-muted-foreground/60 line-through"}>
                      {it.label}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Pagamento seguro via Kiwify · Cancele quando quiser · Sem fidelidade
        </p>
      </section>

      {/* DEPOIMENTOS */}
      <section id="depoimentos" className="bg-card/40 border-y border-border py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">Quem usa, recomenda</h2>
            <p className="mt-4 text-muted-foreground">
              Mandatos de todo o Brasil já transformaram sua gestão com a DEMOCRAT.AI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="p-6 rounded-2xl border border-border bg-card"
              >
                <div className="flex gap-1 text-accent mb-3">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <Star key={k} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed">"{t.text}"</p>
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="max-w-5xl mx-auto px-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl gradient-primary p-10 sm:p-16 text-primary-foreground shadow-[var(--shadow-lg)]"
        >
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Seu mandato merece uma plataforma à altura
          </h2>
          <p className="mt-4 text-primary-foreground/90 max-w-2xl mx-auto">
            Comece hoje. Em 5 minutos você já está organizando demandas, eleitores e tarefas com
            inteligência artificial.
          </p>
          <a
            href="#planos"
            className="inline-flex items-center gap-2 mt-8 px-8 py-4 rounded-xl bg-accent text-accent-foreground font-bold hover:scale-105 transition"
          >
            Escolher meu plano <ArrowRight className="h-5 w-5" />
          </a>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-card/40">
        <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <img src={logo} alt="DEMOCRAT.AI" className="h-8 w-8" />
              <span className="font-bold">DEMOCRAT.AI</span>
            </div>
            <p className="mt-3 text-muted-foreground max-w-xs text-xs">
              Plataforma inteligente de gestão política e relacionamento com eleitores.
            </p>
          </div>

          <div>
            <div className="font-semibold mb-3">Produto</div>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="#funcionalidades" className="hover:text-foreground">Funcionalidades</a></li>
              <li><a href="#planos" className="hover:text-foreground">Planos</a></li>
              <li><Link to="/login" className="hover:text-foreground">Entrar</Link></li>
            </ul>
          </div>

          <div>
            <div className="font-semibold mb-3">Empresa</div>
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
    </div>
  );
};

export default Landing;
