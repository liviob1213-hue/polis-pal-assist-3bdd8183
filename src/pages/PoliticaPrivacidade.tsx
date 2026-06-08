import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo-democrat-icon.png";

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

      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-16 prose prose-sm sm:prose-base prose-headings:text-foreground prose-p:text-foreground/80 prose-li:text-foreground/80 prose-strong:text-foreground max-w-none">
        <h1>Política de Privacidade</h1>
        <p className="text-muted-foreground">Atualizada em 8 de junho de 2026.</p>

        <p>
          A <strong>DEMOCRAT.AI</strong> respeita a sua privacidade e está comprometida com a
          proteção dos dados pessoais dos seus usuários, em conformidade com a Lei Geral de
          Proteção de Dados (LGPD - Lei nº 13.709/2018).
        </p>

        <h2>1. Dados que coletamos</h2>
        <ul>
          <li>Dados de cadastro: nome, e-mail, telefone, CPF/CNPJ.</li>
          <li>Dados dos eleitores cadastrados pelo cliente em sua base.</li>
          <li>Mensagens trocadas pelo agente de WhatsApp integrado.</li>
          <li>Dados de uso da plataforma (logs, métricas e analytics).</li>
        </ul>

        <h2>2. Como usamos seus dados</h2>
        <ul>
          <li>Operar a plataforma e fornecer as funcionalidades contratadas.</li>
          <li>Enviar comunicações relacionadas ao serviço.</li>
          <li>Melhorar a segurança, performance e experiência do usuário.</li>
          <li>Cumprir obrigações legais e regulatórias.</li>
        </ul>

        <h2>3. Compartilhamento</h2>
        <p>
          Não vendemos dados. Compartilhamos apenas com provedores essenciais à operação
          (hospedagem, processamento de pagamentos, envio de WhatsApp), todos sujeitos a
          contratos de confidencialidade.
        </p>

        <h2>4. Direitos do titular</h2>
        <p>
          Você pode, a qualquer momento, solicitar acesso, correção, anonimização ou exclusão
          dos seus dados pessoais, enviando um e-mail para
          <strong> contato@democrat.ai</strong>.
        </p>

        <h2>5. Segurança</h2>
        <p>
          Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo
          criptografia em trânsito (HTTPS), controle de acesso e backups periódicos.
        </p>

        <h2>6. Cookies</h2>
        <p>
          Utilizamos cookies essenciais para o funcionamento da plataforma e cookies analíticos
          para entender como ela é utilizada e melhorá-la.
        </p>

        <h2>7. Alterações</h2>
        <p>
          Esta política pode ser atualizada. Notificaremos mudanças relevantes pelo e-mail
          cadastrado.
        </p>

        <h2>8. Contato</h2>
        <p>
          Encarregado de Dados (DPO): <strong>contato@democrat.ai</strong>
        </p>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} DEMOCRAT.AI — Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default PoliticaPrivacidade;
