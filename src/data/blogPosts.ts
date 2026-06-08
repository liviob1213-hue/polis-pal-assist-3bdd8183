// Para adicionar um novo artigo, basta criar uma nova entrada neste array.
// O slug é a URL: /blog/seu-slug-aqui
// Conteúdo aceita Markdown (renderizado com react-markdown).

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  cover?: string;
  author: string;
  date: string; // ISO yyyy-mm-dd
  readingTime: string;
  tags: string[];
  content: string; // Markdown
}

export const blogPosts: BlogPost[] = [
  {
    slug: "como-organizar-base-de-eleitores-em-2026",
    title: "Como organizar sua base de eleitores em 2026 (guia completo)",
    excerpt:
      "Aprenda a estruturar sua base de eleitores de forma estratégica, segmentada e pronta para campanhas vencedoras.",
    author: "Equipe DEMOCRAT.AI",
    date: "2026-05-20",
    readingTime: "8 min",
    tags: ["Gestão Política", "CRM Eleitoral"],
    content: `
# Como organizar sua base de eleitores em 2026

Uma base de eleitores bem organizada é o coração de qualquer mandato moderno. Neste guia, mostramos como estruturar a sua usando a metodologia da **DEMOCRAT.AI**.

## 1. Centralize todos os contatos
Use uma única plataforma para registrar nome, telefone, endereço, interesses e histórico de interações.

## 2. Classifique por status
- **Não eleitor**: contato inicial
- **Possível eleitor**: interessado
- **Eleitor**: já apoia
- **Multiplicador**: traz outros eleitores
- **Voluntário**: ajuda ativamente

## 3. Mapeie geograficamente
Saber onde estão seus apoiadores permite ações direcionadas por bairro, rua e região.

## 4. Automatize o relacionamento
WhatsApp, aniversários e demandas devem ser respondidos de forma rápida e personalizada.
`,
  },
  {
    slug: "whatsapp-como-canal-oficial-do-mandato",
    title: "WhatsApp como canal oficial do mandato: boas práticas",
    excerpt:
      "Transforme o WhatsApp em uma ferramenta profissional de atendimento ao eleitor, sem perder a humanização.",
    author: "Equipe DEMOCRAT.AI",
    date: "2026-04-12",
    readingTime: "6 min",
    tags: ["WhatsApp", "Atendimento"],
    content: `
# WhatsApp como canal oficial do mandato

O WhatsApp é hoje o principal ponto de contato entre o político e o eleitor. Veja como profissionalizar esse atendimento.

## Tenha um número oficial
Separe o pessoal do institucional. Use um número exclusivo para o mandato.

## Use um agente inteligente
Com a DEMOCRAT.AI, um agente de IA responde 24h, registra demandas e encaminha para o assessor certo.

## Mensure tudo
Toda conversa vira histórico, toda demanda vira tarefa.
`,
  },
  {
    slug: "ia-na-redacao-de-projetos-de-lei",
    title: "IA na redação de projetos de lei: o futuro já chegou",
    excerpt:
      "Descubra como assistentes legislativos com IA aceleram a produção parlamentar mantendo qualidade jurídica.",
    author: "Equipe DEMOCRAT.AI",
    date: "2026-03-02",
    readingTime: "5 min",
    tags: ["Legislativo", "Inteligência Artificial"],
    content: `
# IA na redação de projetos de lei

A inteligência artificial já é realidade nos gabinetes mais modernos do Brasil.

## O que a IA pode fazer
- Redigir **projetos de lei** com fundamentação
- Elaborar **discursos** parlamentares
- Produzir **indicações** e **requerimentos**
- Analisar juridicamente proposições

## O que ela NÃO substitui
O olhar humano, o contato com o eleitor e a sensibilidade política continuam insubstituíveis.
`,
  },
];
