// Definição das funções liberadas na versão Lite e o conteúdo das telas de venda.

export const UPGRADE_WHATSAPP = "5531984752052";

// Chaves de função usadas nas rotas travadas
export type LockableFeature =
  | "agenda"
  | "assistente"
  | "tarefas"
  | "base-conhecimento"
  | "historico-conversas"
  | "resumo-mensal"
  | "assessores"
  | "google-agenda";

// Funções liberadas na versão Lite
export const LITE_ALLOWED = [
  "painel",
  "eleitores",
  "mapa-eleitores",
  "aniversarios",
  "demandas",
  "configuracoes",
] as const;

export const LOCKED_ON_LITE: LockableFeature[] = [
  "tarefas",
  "agenda",
  "assistente",
  "base-conhecimento",
  "historico-conversas",
  "resumo-mensal",
  "assessores",
  "google-agenda",
];

export interface FeatureSalesCopy {
  nome: string;
  headline: string;
  sub: string;
  bullets: string[];
}

export const FEATURE_COPY: Record<LockableFeature, FeatureSalesCopy> = {
  agenda: {
    nome: "Agenda Oficial",
    headline: "Seu mandato inteiro em uma agenda só",
    sub: "Pare de perder compromisso em papel, grupo de WhatsApp e print de tela. Tudo do gabinete em um lugar, sincronizado com sua equipe.",
    bullets: [
      "Compromissos do mandato organizados por dia, com lembrete",
      "Delegue eventos para o assessor responsável em 2 toques",
      "Espelhamento automático com o Google Agenda do seu celular",
      "Nunca mais um evento esquecido ou marcado em duplicidade",
    ],
  },
  assistente: {
    nome: "Assistente Legislativo",
    headline: "Projetos de lei prontos em minutos, não em semanas",
    sub: "A inteligência artificial escreve a minuta, a justificativa e a fundamentação legal a partir de uma demanda real do seu eleitor.",
    bullets: [
      "Minutas de projeto de lei, requerimento e indicação em minutos",
      "Justificativa técnica redigida no padrão da Casa Legislativa",
      "Transforme uma demanda do eleitor em proposta com um clique",
      "Produza mais que gabinetes com o dobro da sua equipe",
    ],
  },
  tarefas: {
    nome: "Gestão de Tarefas",
    headline: "Sua equipe sabendo exatamente o que fazer hoje",
    sub: "Quadro de tarefas por assessor, com prazo e status. Você acompanha tudo sem precisar cobrar um por um.",
    bullets: [
      "Quadro visual com o andamento de cada tarefa do gabinete",
      "Delegação direta para cada assessor, com prazo definido",
      "Cobrança automática de tarefas vencidas no WhatsApp",
      "Visão real da produtividade da equipe, todo dia",
    ],
  },
  "base-conhecimento": {
    nome: "Base de Conhecimento",
    headline: "Toda a legislação do seu município na palma da mão",
    sub: "Suba leis, regimentos e documentos e pergunte em linguagem natural. A resposta vem com a fonte.",
    bullets: [
      "Envie PDFs de leis e regimentos e consulte por pergunta",
      "Respostas com base nos seus próprios documentos oficiais",
      "Fim da busca manual em arquivos de centenas de páginas",
      "Segurança para se posicionar em plenário com embasamento",
    ],
  },
  "historico-conversas": {
    nome: "Histórico de Conversas",
    headline: "Cada conversa com o eleitor registrada e pesquisável",
    sub: "Todo atendimento feito pelo agente no WhatsApp fica gravado e ligado ao cadastro do eleitor.",
    bullets: [
      "Histórico completo de atendimento por eleitor",
      "Saiba o que foi prometido e para quem, sem depender da memória",
      "Recupere o contexto antes de qualquer retorno ou visita",
      "Prova de trabalho para prestação de contas do mandato",
    ],
  },
  "resumo-mensal": {
    nome: "Resumo Mensal",
    headline: "A prestação de contas do seu mandato, pronta todo mês",
    sub: "Relatório com números de atendimento, demandas resolvidas e alcance — pronto para mostrar à base.",
    bullets: [
      "Relatório mensal gerado automaticamente com seus dados reais",
      "Gráficos prontos para post, panfleto e prestação de contas",
      "Demandas resolvidas, eleitores atendidos e bairros alcançados",
      "Mostre resultado com número, não com achismo",
    ],
  },
  assessores: {
    nome: "Assessores",
    headline: "Sua equipe trabalhando dentro do sistema, com você no controle",
    sub: "Crie acessos para cada assessor e escolha exatamente o que cada um pode ver e fazer.",
    bullets: [
      "Acesso individual para cada assessor da equipe",
      "Permissão liberada função por função, do seu jeito",
      "Você vê tudo; o assessor vê só o que precisa",
      "Escale o gabinete sem perder o controle dos dados",
    ],
  },
  "google-agenda": {
    nome: "Google Agenda",
    headline: "Sua agenda do gabinete no celular de sempre",
    sub: "Todo compromisso lançado aqui aparece direto no Google Agenda seu e da sua equipe.",
    bullets: [
      "Sincronização automática dos compromissos do mandato",
      "Notificação no celular sem precisar abrir o sistema",
      "Cada assessor recebe só o que é dele",
      "Zero retrabalho de digitar o mesmo evento duas vezes",
    ],
  },
};

export function upgradeWhatsAppLink(featureName?: string) {
  const texto = featureName
    ? `Olá! Quero liberar a versão completa do Democrat.IA (função ${featureName}).`
    : `Olá! Quero liberar a versão completa do Democrat.IA.`;
  return `https://wa.me/${UPGRADE_WHATSAPP}?text=${encodeURIComponent(texto)}`;
}
