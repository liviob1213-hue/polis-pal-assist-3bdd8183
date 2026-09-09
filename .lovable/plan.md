# Democrat.IA — Versão Lite e Versão Completa

Objetivo: publicar o app na Play Store com duas experiências no mesmo código — **Lite** (plano de R$ 97) e **Completa** (plano de R$ 297) — com telas de venda internas e upgrade via WhatsApp.

## O que cada versão libera

**Lite (liberado)**
- Painel de Controle
- Base de Eleitores
- Mapa de Eleitores
- Aniversários
- Gestão de Demandas
- Configurações (Perfil Parlamentar + Ferramentas liberadas)

**Bloqueado na Lite (mostra tela de venda)**
- Agenda Oficial
- Assistente Legislativo
- Gestão de Tarefas
- Base de Conhecimento
- Histórico de Conversas
- Resumo Mensal
- Assessores
- Google Agenda (dentro de Configurações)

**Completa**: tudo liberado, como hoje.

## Telas de venda internas

Cada função bloqueada abre uma página curta (hero única, sem rolagem longa):
- Título com a dor que a função resolve
- 3 a 4 bullets do que a pessoa ganha ao liberar
- Frase de valor: "Por mais R$ 200,00 você libera tudo isso"
- Botão grande "Liberar agora no WhatsApp" → abre `wa.me/5531984752052` com mensagem pronta citando a função
- Texto de apoio curto, tom de conversão, em português

Cada função tem seu próprio texto (Agenda, Assistente, Tarefas, Base de Conhecimento, Histórico de Conversas, Resumo Mensal, Assessores).

## Configurações na versão Lite

- Perfil Parlamentar: aparece normal
- Ferramentas: itens bloqueados aparecem com cadeado e levam à tela de venda
- Google Agenda: card com cadeado + botão de upgrade
- Notificações: removidas da tela (comportamento fica sempre ativo)
- No fim da tela, um bloco de destaque listando tudo que está travado e o botão de upgrade no WhatsApp

## Menu e navegação

- Menu lateral e barra inferior mostram os itens bloqueados com cadeado (não somem) — clicar leva à tela de venda
- Barra inferior da Lite: Painel, Eleitores, Demandas (centro), Mapa, Aniversários
- Revisão mobile: alvos de toque ≥ 44px, textos e diálogos em tela cheia no celular, área segura inferior respeitada — foco em Play Store

## Upgrade e cobrança

- **Todos os cadastros que já existem hoje ficam como Completa** — ninguém que já usa o sistema perde acesso
- Só novos cadastros que assinarem o plano de R$ 97 entram como Lite
- O botão de upgrade leva ao WhatsApp; após o pagamento do complemento, o plano vira Completo mantendo a data de vencimento já paga
- A automação de pagamentos existente passa a reconhecer os dois planos e a não rebaixar quem já pagou o complemento antes do vencimento

---

## Detalhes técnicos

**Frontend**
- `src/hooks/useAuth.tsx`: derivar `isLite` a partir de `plano` (`bronze` → lite; `prata`/`ouro` → completo) e expor `featureLocked(key)`. Manter `permissions` de assessor como está (assessor herda o tier do político).
- Novo `src/config/planFeatures.ts`: mapa `featureKey → { titulo, subtitulo, bullets[], ctaMsg }` e lista `LITE_ALLOWED`.
- Novo `src/components/UpgradeGate.tsx`: hero de venda reutilizável, lê o mapa acima, botão `https://wa.me/5531984752052?text=...` (usar `wa.me` por causa do CSP do iframe).
- `src/App.tsx`: em `PermissionRoute`, quando a rota estiver travada pelo plano, renderizar `<UpgradeGate feature=... />` dentro do `AppLayout` em vez de `Navigate` + toast. Substituir o `requirePlan` atual do `/assistente` por esse mecanismo e aplicá-lo a `/tarefas`, `/agenda`, `/base-conhecimento`, `/historico-conversas`, `/resumo-mensal`, `/assessores`.
- `src/components/AppSidebar.tsx` e `src/components/MobileBottomNav.tsx`: item travado ganha ícone de cadeado, continua navegável (cai no gate).
- `src/pages/Configuracoes.tsx`: remover bloco de Notificações; `GoogleCalendarConnect` embrulhado em estado travado; adicionar card CTA final listando o que está travado.
- `index.html`: revisar title/description/viewport para o webview da Play Store.

**Backend (Supabase externo — rodar SQL manualmente)**
- `profiles`: adicionar `tier text not null default 'lite'` com check `('lite','completo')`, e `upgrade_pago_em timestamptz`. Backfill: `update public.profiles set tier = 'completo'` para **todas as linhas existentes** (todos os e-mails já cadastrados têm acesso completo). O default `'lite'` vale só para cadastros novos.
- Índice opcional em `profiles(tier)`.
- Nenhuma mudança de RLS necessária (o gate é de produto, não de dados).

**Edge function `kiwify-webhook`**
- `detectPlan` passa a mapear também por valor/oferta: R$ 97 → `bronze` + `tier='lite'`; R$ 297 ou oferta de upgrade → `tier='completo'` (plano `ouro`).
- Em eventos de desativação, rebaixar `tier` para `lite` mas preservar `assinatura_expira_em` já paga.
- Reconhecer um produto "upgrade" separado: quando chegar, apenas eleva `tier` sem alterar a data de vencimento existente.
- O SQL e o código completo da função serão entregues prontos para colar no Supabase externo.
