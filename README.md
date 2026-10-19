# SaaS Roupas Esportivas

Em resumo: catálogo online de camisas personalizadas. O cliente escolhe o modelo, personaliza nome, número, brasão e cor em um editor 2D e envia o pedido pelo WhatsApp da loja. O lojista gerencia produtos, estoque e pedidos em um painel.

Catálogo online de camisas personalizadas. O cliente escolhe o modelo, personaliza (nome e número nas costas, brasão na frente, cor) em um editor 2D e envia o pedido pelo WhatsApp da loja. O lojista gerencia produtos, estoque e pedidos em um painel.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres, Auth, Storage) · Fabric.js · PWA. Stripe Connect disponível, desligado por padrão.

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do Supabase
npm run dev                  # http://localhost:3000
```

### Banco de dados

Rode, nesta ordem, no SQL Editor do Supabase (os arquivos estão em `supabase/migrations/`):

| Arquivo | Para quê | Obrigatório |
|---|---|---|
| `0001_init.sql` | tabelas, RLS multi-tenant, buckets de Storage, trigger de cadastro | sim |
| `0003_whatsapp.sql` | número de WhatsApp do lojista | sim |
| `0002_payments.sql` | Stripe Connect e estoque atômico | só com `CHECKOUT_MODE=stripe` |

Em desenvolvimento, desligue **Authentication → Sign In / Providers → Email → Confirm email** para testar o cadastro sem e-mail. Em produção, deixe ligado.

### Variáveis de ambiente

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente Supabase (públicas) |
| `SUPABASE_SERVICE_ROLE_KEY` | **somente servidor**: loja pública e checkout |
| `NEXT_PUBLIC_APP_URL` | endereço público do site |
| `CHECKOUT_MODE` | `whatsapp` (padrão) ou `stripe` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PLATFORM_FEE_PERCENT` | só no modo `stripe` |

Nunca faça commit do `.env.local`.

## Estrutura

```
app/
  (auth)/login, signup        cadastro e login do lojista
  dashboard/                  painel: visão geral, produtos, pedidos, configurações
  loja/[slug]/                vitrine pública, produto + editor, carrinho, checkout
  api/auth, merchant, store   rotas de API (validação com zod)
  api/stripe/webhook          webhook do Stripe (modo stripe)
components/ShirtEditor.tsx    editor Fabric.js (abas Frente/Costas)
lib/                          clientes Supabase, validação, helpers de API, Stripe
supabase/migrations/          SQL do banco
public/                       logo, banner e ícones do app (PWA)
```

## Fluxo do pedido (modo WhatsApp)

1. O lojista cadastra o WhatsApp em **Configurações** e os produtos em **Produtos** (uma foto de frente e de costas por cor).
2. O cliente personaliza na vitrine `/loja/<slug>` e clica em **Enviar pedido**.
3. O servidor valida tudo no banco (preço, tamanho, cor, estoque), salva o pedido com a imagem do design e devolve o link `wa.me` com o resumo.
4. O lojista acompanha em **Pedidos** (Novo → Em produção → Enviado). O estoque é ajustado manualmente ao fechar a venda.

## Publicar

Netlify ou Vercel, importando o repositório (o Next.js é detectado sozinho). Cadastre as variáveis de ambiente no painel da hospedagem e, no Supabase, ajuste **Authentication → URL Configuration → Site URL** para o endereço do site.

## Segurança

- RLS ativo em todas as tabelas: cada lojista só acessa os próprios dados.
- Pedidos e itens são criados só pelo servidor (service role), nunca direto pelo navegador.
- O servidor recalcula preço e confere estoque; nada vem do cliente.

## Duas versões do projeto

| Pasta | O que é | Quando usar |
|---|---|---|
| raiz (Next.js) | versão com servidor: rotas `/api`, Stripe Connect opcional | hospedagem com Node (Vercel, VPS) |
| `site-estatico/` (Vite) | versão **sem servidor**: gera a pasta `dist` para arrastar no Netlify Drop | demonstração e hospedagem simples |

A versão estática tem painel do dono do sistema (`/master`) com período de teste, mensalidade, carência e bloqueio por loja. Veja `site-estatico/README.md` e as migrations em `site-estatico/sql/` (`0004` e `0005`).
