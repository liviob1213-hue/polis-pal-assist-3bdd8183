# Página de acesso exclusiva da Marta Murta

Criar uma página em `/martamurta` com entrada por e-mail e senha, apenas para a conta `martacmurta1@gmail.com`. Todo o resto do sistema continua entrando por link no e-mail (exigência da Apple).

## Como vai funcionar

- Nova página em `/martamurta`, fora do menu e sem link visível em nenhum lugar.
- Formulário simples: e-mail, senha e botão "Entrar", no mesmo visual da tela de login atual (logo, cartão branco, cores da marca).
- Se o e-mail digitado for diferente do da Marta, a página avisa que aquele acesso não é permitido e não tenta entrar.
- Com e-mail e senha corretos, ela cai direto no painel normal, com as mesmas permissões de hoje.
- Se ela já estiver conectada, a página manda direto para o painel.
- A senha atual dela não é alterada em nenhum momento.
- Link discreto "Esqueci a senha" não será incluído, para não criar outra porta de entrada. Se quiser, adiciono depois.

## Detalhes técnicos

- Novo arquivo `src/pages/MartaMurta.tsx` usando `supabase.auth.signInWithPassword`, com constante `MARTA_EMAIL = "martacmurta1@gmail.com"` comparada em minúsculas antes da chamada.
- Rota pública `/martamurta` em `src/App.tsx` (sem `PublicRoute`, com redirecionamento próprio para `/painel` quando já houver sessão), seguindo o padrão já usado em `/acesso-webhook`.
- Nenhuma alteração em `Login.tsx`, `useAuth.tsx` ou nas demais rotas.
- Acrescentar `/martamurta` ao `robots.txt` como bloqueado, para não ser indexado.

## Do seu lado (Supabase externo)

1. Em Authentication → Providers → Email: manter o provedor Email ativado (ele já é o mesmo usado pelo link mágico). Nenhuma opção extra precisa ser ligada para senha funcionar.
2. Script SQL opcional, só para garantir que a conta dela tem identidade de e-mail e está confirmada (não toca na senha):

```sql
-- confirma o e-mail e normaliza tokens (não altera a senha)
update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now()),
       confirmation_token = coalesce(confirmation_token, ''),
       recovery_token     = coalesce(recovery_token, ''),
       email_change_token_new = coalesce(email_change_token_new, ''),
       email_change          = coalesce(email_change, ''),
       email_change_token_current = coalesce(email_change_token_current, '')
 where lower(email) = 'martacmurta1@gmail.com';

-- cria a identidade de e-mail caso ela não exista
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email),
       'email', u.id::text, now(), now(), now()
  from auth.users u
 where lower(u.email) = 'martacmurta1@gmail.com'
   and not exists (
     select 1 from auth.identities i
      where i.user_id = u.id and i.provider = 'email'
   );
```

Se ela entrar normalmente com a senha, esse script nem é necessário.
