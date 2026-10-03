# Site estático (Vite) — Gold'n Ports

Versão sem servidor do SaaS de camisas personalizadas: gera a pasta `dist`, que pode ser arrastada no Netlify Drop.

## Passo a passo

1. No SQL Editor do Supabase, rode `sql/0004_site_estatico.sql` e depois `sql/0005_licenca_master.sql` (precisam de `0001` e `0003` da pasta `supabase/migrations/` já aplicadas).
   Para criar o dono do sistema, rode uma vez: `insert into public.superadmins (user_id) select id from auth.users where email = 'seu@email.com';`
2. `cp .env.example .env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (somente a chave pública).
3. `npm install` e `npm run build`. A pasta `dist/` está pronta.
4. Arraste a `dist` em https://app.netlify.com/drop.
5. No Supabase, em Authentication → URL Configuration, ponha o endereço do site em Site URL.

Refaça o `npm run build` antes de arrastar de novo (as variáveis entram no build).

## Rotas
`/` · `/entrar` · `/cadastrar` · `/painel` (`/produtos`, `/pedidos`, `/configuracoes`) · `/loja/<slug>` (`/produto/<id>`, `/carrinho`, `/checkout`) · `/master` (só o dono do sistema)

## Segurança
- Só a chave pública (anon) vai no navegador. A service key não é usada.
- Lojista: RLS do Supabase. Loja pública e pedido: funções `store_catalog` e `create_order` (security definer) conferem preço, tamanho, cor e estoque no banco.
- Imagens do design: o navegador envia PNG (até 5 MB, nome UUID) ao bucket `customizations`.

## Diferenças para a versão Next.js
Sem Stripe e sem rotas `/api` (precisam de servidor). Endereços em português (`/painel`, `/entrar`).

## Licença e painel do dono (`/master`)
Cada loja tem uma licença: `teste` (com ou sem prazo), `mensal` (vencimento + carência) ou `isento`. A trava é decidida no banco, a cada pedido, com a hora do servidor (não depende de tarefa agendada). Quando vence ou é bloqueada: a loja para de receber **novos pedidos**; o catálogo, o painel do lojista e todos os dados continuam disponíveis. Só quem está em `superadmins` consegue iniciar teste, registrar pagamento, bloquear, liberar ou editar (funções `master_*`). O dono da loja não consegue estender o próprio prazo.
Lojas que já existiam viram `isento`; lojas novas nascem em `teste` sem prazo.
