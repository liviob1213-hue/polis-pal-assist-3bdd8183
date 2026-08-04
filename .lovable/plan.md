# Democrat Lite — prompt de replicação

Abaixo está o prompt pronto para colar em um projeto novo do Lovable (com Lovable Cloud). Ele reproduz as 4 abas pedidas com os mesmos campos, status, cores e tabelas do sistema atual.

---

## PROMPT (copie tudo a partir daqui)

Crie um SaaS chamado **Democrat Lite**, uma versão enxuta de um sistema de gestão de gabinete político. Use **Lovable Cloud** (banco, auth e edge functions) — crie todas as tabelas, políticas e funções para mim. Idioma: **português do Brasil**. App 100% responsivo (mobile-first) com menu lateral no desktop e bottom nav no mobile.

### Identidade visual
- Paleta: Teal `#449895` (primária), Crimson `#D2264F` (destaque), branco, estilo glassmorphism com cards translúcidos e sombras suaves.
- Todas as cores como tokens semânticos no `index.css` + `tailwind.config.ts` (`primary`, `accent`, `success`, `warning`, `info`, `destructive`). Nunca usar `text-white`/`bg-black` direto nos componentes.
- Animações leves com framer-motion, ícones lucide-react, componentes shadcn/ui.

### Autenticação
- Login e cadastro por e-mail/senha + Google (configure o provider Google).
- Tabela `profiles` (user_id, nome, email, telefone, role, created_at, updated_at) preenchida por trigger `handle_new_user` no signup.
- Tabela `user_roles` separada com enum `app_role` ('politico','assessor') e função `has_role(_user_id, _role)` SECURITY DEFINER. Nunca guardar role no profile como fonte de verdade de permissão.
- **Multi-tenant:** toda tabela de dados tem `politician_id uuid not null default auth.uid()`. RLS: cada usuário só enxerga e altera linhas com `politician_id = auth.uid()`. GRANT para `authenticated` e `service_role` em todas as tabelas do schema public.
- Rotas privadas com guarda de sessão; enquanto carrega mostrar spinner (sem piscar toast de erro).

### Navegação (somente estas 4 abas + Configurações)
1. **Base Eleitoral** `/eleitores`
2. **Aniversários** `/aniversarios`
3. **Demandas** `/demandas`
4. **Mapa** `/mapa-eleitores`
5. Configurações `/configuracoes` (perfil do parlamentar + sair)

### Banco de dados (crie via migration)

**eleitores**: id uuid pk, politician_id, nome text not null, telefone text, email text, endereco text, logradouro, numero, complemento, bairro, cidade, estado, cep, interesse text, status_eleitor text default 'possivel_eleitor', observacoes text, data_nascimento date, latitude double precision, longitude double precision, agente_ativo boolean default true, created_at, updated_at.
- Índices em `politician_id`, `lower(nome)`, `lower(email)`, `telefone`.
- Sem constraint UNIQUE em nome/telefone (importações em massa duplicam).

**demandas**: id uuid pk, politician_id, titulo text not null, descricao text, status text default 'Aberto', prioridade text default 'media', origem text, tipo text, setor text, localizacao text, eleitor_id uuid references eleitores(id), prazo date, criado_por uuid, created_at, updated_at.

**demanda_comentarios**: id, demanda_id (fk cascade), autor_id, autor_nome, texto, created_at.

**demanda_anexos**: id, demanda_id (fk cascade), nome_arquivo, caminho_storage text not null, storage_path text, mime_type text, tamanho bigint, autor_id, autor_nome, created_at.

**demanda_historico**: id, demanda_id (fk cascade), acao text, detalhe text, autor_id, autor_nome, created_at. Trigger que registra mudança de status.

**aniversario_mensagens**: id, politician_id, eleitor_id (fk cascade, unique por eleitor), mensagem text, created_at, updated_at.

Storage: bucket **demanda-anexos** público para leitura, com policies de upload/delete apenas para usuários autenticados donos da demanda; aceitar **qualquer tipo de arquivo** (sem restrição de mime).

Trigger genérica `update_updated_at_column()` em todas as tabelas com `updated_at`. Habilitar realtime em `eleitores`, `demandas`, `demanda_comentarios`.

### Aba 1 — Base Eleitoral (`/eleitores`)
Tabela paginada (50 por página, ordenada por nome A→Z), busca com debounce de 400ms feita **no servidor** (nome, telefone, cidade), contadores no topo.

Formulário de cadastro/edição do eleitor (modal), com exatamente estes campos:
- Nome*, Telefone*, E-mail
- Endereço com **autocomplete do Google Maps** aceitando rua, cidade ou CEP; ao escolher, preenche rua, número, bairro, cidade, estado, CEP. Se o usuário escolher só a cidade ou só o CEP, ainda assim grava o texto completo no campo cidade/endereço.
- Interesse (select): Saúde, Obras, Educação, Segurança, Transporte, Meio Ambiente, Manutenção, Cultura, Social, Esporte, Juventude, Emprego — cada um com cor de badge própria.
- Status do eleitor (select com emoji e cor):
  - ⚫ Não eleitor (`nao_eleitor`), 🟡 Possível eleitor (`possivel_eleitor`, padrão), 🟢 Eleitor (`eleitor`), 🔵 Multiplicador (`multiplicador`), 🟣 Voluntário (`voluntario`).
  - Criar um `src/lib/statusEleitor.ts` com label, emoji, classe de badge, classe do pin e hex de cada status, além de um `normalizeStatusEleitor()` tolerante a acento/maiúscula/espaço.
- Data de nascimento
- Observações (textarea)
- Switch "Agente ativo"
- **Bloco opcional "Criar demanda junto com o eleitor"**: título, descrição, origem, tipo, setor, localização, prazo. Se preenchido, cria a demanda vinculada com status "Em Análise".

Ações por linha: editar, excluir (confirmação), abrir WhatsApp (`https://wa.me/55DDDNUMERO`, sempre com prefixo 55 e sem o 9º dígito extra quando o número vier com 13 dígitos), ver demandas do eleitor, criar nova demanda rápida, mensagens salvas de WhatsApp (templates editáveis em localStorage).

**Importação em massa** por `.xlsx` e `.csv` (biblioteca `xlsx`): reconhecer variações de cabeçalho (nome/contato/telefone/celular/whatsapp/endereço/rua/cidade/logradouro/bairro/cep etc., normalizando acento e caixa), inserir em lotes de 500 com barra de progresso e relatório de "X inseridos / Y com erro". Todo o endereço encontrado, mesmo sendo só o nome da cidade ou só a rua, deve ser consolidado no campo cidade/endereço.

### Aba 2 — Aniversários (`/aniversarios`)
- Lista os eleitores com `data_nascimento`, agrupados/filtráveis por mês, com destaque para "hoje" e "próximos 7 dias".
- Cada card mostra nome, idade que fará, data, telefone e badge de interesse.
- Botão **Editar**: modal para alterar nome e data de nascimento do eleitor.
- Botão **Mensagem**: modal para escrever/editar a mensagem de aniversário personalizada, salva em `aniversario_mensagens`, aceitando o placeholder `{nome}` (substituído pelo nome do eleitor). Mensagem padrão quando não houver personalizada.
- Botão **Enviar no WhatsApp**: abre `wa.me` com a mensagem já preenchida.

### Aba 3 — Demandas (`/demandas`)
Kanban com 5 colunas, arraste entre colunas atualizando o status:
`Aberto` (amarelo), `Em Análise` (azul), `Em Andamento` (roxo/accent), `Recontato` (vermelho), `Resolvido` (verde).

Formulário de demanda (modal responsivo, com scroll interno — nunca estourar a tela em zoom alto):
- Título*, Descrição, Localização
- Eleitor vinculado (busca por nome/telefone)
- Origem: 🏠 Rua, 🏢 Gabinete, 📱 Instagram / TikTok, 💬 WhatsApp, 🤝 Pessoal (contato direto), ✉️ Email
- Tipo: Reclamação, Sugestão, Solicitação, Elogio
- Setor: ⚖️ Jurídico, 📢 Comunicação, 📊 Administrativo
- Prioridade: 🟢 Baixa, 🟡 Média (padrão), 🟠 Alta, 🔴 Urgente — cada uma com badge colorida
- **Prazo de cobrança** por preset: 15 dias, 1 mês (30), 2 meses (60), 3 meses (90) ou data manual no calendário. Mostrar etiqueta visual do prazo no card ("faltam X dias" / "vencida há X dias").
- Regra automática: ao carregar as demandas, toda demanda com prazo vencido que não esteja em "Resolvido" é movida automaticamente para a coluna **Recontato**.
- Datas devem ser tratadas como data local ao meio-dia para não deslocar um dia por fuso horário.

Detalhe da demanda em abas: **Detalhes**, **Comentários** (adicionar/excluir, com autor e data), **Anexos** (upload de qualquer arquivo para o bucket, download e exclusão) e **Histórico** (log de mudanças de status).

Filtros: por status, prioridade, origem, tipo, setor, período e busca por texto. Exclusão de demanda somente para o político, via função RPC `delete_demanda_politico(uuid)` SECURITY DEFINER que limpa comentários, anexos e histórico antes de apagar.

### Aba 4 — Mapa (`/mapa-eleitores`)
- Google Maps carregado de forma assíncrona (`loading=async` + callback), com a chave lida de uma edge function `maps-key` (nunca hardcoded no front).
- Um pin por eleitor com coordenadas, colorido conforme o **status do eleitor** (mesma paleta do `statusEleitor.ts`), com legenda visível.
- Se vários eleitores tiverem exatamente as mesmas coordenadas (ex.: só "Belo Horizonte"), aplicar **jitter em espiral** (pequenos deslocamentos de lat/lng) para os pins não se sobreporem.
- Clique no pin abre card lateral com nome, telefone, endereço, interesse, status e botão de WhatsApp.
- Filtros por status, interesse e cidade + busca com debounce.
- Botão "Geocodificar pendentes": chama uma edge function `geocode` que consulta a Geocoding API e grava `latitude`/`longitude` no eleitor. Trate 403 do Google mostrando mensagem clara ao usuário.

### Edge functions a criar
- `maps-key` — retorna a chave pública do Maps para o front.
- `geocode` — recebe `{ eleitor_id, endereco }`, geocodifica e atualiza o eleitor (usa service role).
Ambas com CORS e tratamento de erro retornando status + corpo do provedor.

### Configurações (`/configuracoes`)
Perfil do parlamentar (nome, partido, cargo, cidade, e-mail oficial, telefone) persistido na tabela `profiles` — os dados devem continuar visíveis após recarregar a página. Botão de sair.

### Qualidade
- Sem dados fictícios/estáticos: todas as listas e contadores vêm do banco.
- React Query para cache e invalidação; toasts de sucesso/erro em toda ação.
- SEO no `index.html`: title "Democrat Lite — Gestão de Base Eleitoral", meta description, H1 único.

---

## Observação
Esse prompt pressupõe Lovable Cloud no projeto novo, então todas as tabelas, RLS, storage e edge functions são criadas automaticamente pelo agente — não é preciso rodar SQL manual.
