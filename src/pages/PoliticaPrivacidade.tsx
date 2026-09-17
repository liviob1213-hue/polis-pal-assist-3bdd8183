import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import logo from "@/assets/logo-democrat-icon.png";

const SECTIONS: { title: string; body?: React.ReactNode; items?: React.ReactNode[] }[] = [
  {
    title: "1. Dados que coletamos",
    items: [
      "Dados de cadastro: nome, e-mail, telefone, CPF/CNPJ.",
      "Dados dos eleitores cadastrados pelo cliente em sua base.",
      "Mensagens trocadas pelo agente de WhatsApp integrado.",
      "Dados de uso da plataforma (logs, métricas e analytics).",
    ],
  },
  {
    title: "2. Como usamos seus dados",
    items: [
      "Operar a plataforma e fornecer as funcionalidades contratadas.",
      "Enviar comunicações relacionadas ao serviço.",
      "Melhorar a segurança, performance e experiência do usuário.",
      "Cumprir obrigações legais e regulatórias.",
    ],
  },
  {
    title: "3. Compartilhamento",
    body: (
      <p>
        Não vendemos dados. Compartilhamos apenas com provedores essenciais à operação
        (hospedagem, processamento de pagamentos, envio de WhatsApp), todos sujeitos a
        contratos de confidencialidade.
      </p>
    ),
  },
  {
    title: "4. Direitos do titular",
    body: (
      <p>
        Você pode, a qualquer momento, solicitar acesso, correção, anonimização ou exclusão
        dos seus dados pessoais, enviando um e-mail para <strong>contato@democrat.ai</strong>.
      </p>
    ),
  },
  {
    title: "5. Segurança",
    body: (
      <p>
        Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo
        criptografia em trânsito (HTTPS), controle de acesso e backups periódicos.
      </p>
    ),
  },
  {
    title: "6. Cookies",
    body: (
      <p>
        Utilizamos cookies essenciais para o funcionamento da plataforma e cookies analíticos
        para entender como ela é utilizada e melhorá-la.
      </p>
    ),
  },
  {
    title: "7. Alterações",
    body: (
      <p>
        Esta política pode ser atualizada. Notificaremos mudanças relevantes pelo e-mail
        cadastrado.
      </p>
    ),
  },
  {
    title: "8. Contato",
    body: (
      <p>
        Encarregado de Dados (DPO): <strong>contato@democrat.ai</strong>
      </p>
    ),
  },
];

const PoliticaPrivacidade = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="DEMOCRAT.AI" className="h-8 w-8" />
            <span className="font-bold tracking-tight">DEMOCRAT.AI</span>
          </Link>
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Política de Privacidade</h1>
            <p className="text-sm text-muted-foreground">Atualizada em 8 de junho de 2026.</p>
          </div>
        </div>

        <p className="mt-8 text-base leading-relaxed text-foreground/80">
          A <strong className="text-foreground">DEMOCRAT.AI</strong> respeita a sua privacidade e está
          comprometida com a proteção dos dados pessoais dos seus usuários, em conformidade com a Lei
          Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg sm:text-xl font-semibold">{section.title}</h2>
              {section.body && (
                <div className="mt-3 text-base leading-relaxed text-foreground/80">{section.body}</div>
              )}
              {section.items && (
                <ul className="mt-3 space-y-2">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex gap-3 text-base leading-relaxed text-foreground/80">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} DEMOCRAT.AI — Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default PoliticaPrivacidade;
