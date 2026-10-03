// Teste das migrations 0001, 0003, 0004 e 0005 num Postgres em memória (PGlite), sem tocar no Supabase.
// Como rodar (dentro de site-estatico):
//   npm i --no-save @electric-sql/pglite   (nao altera o package.json)
//   node tests/licenca.pglite.mjs
// Imita auth.users, auth.uid(), storage e os papeis anon/authenticated/service_role do Supabase.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// caminhos relativos a este arquivo (site-estatico/tests/)
const R = fileURLToPath(new URL("../../", import.meta.url));
const db = new PGlite();
const run = (s) => db.exec(s);
let ok = 0, bad = 0;
const check = (nome, cond, extra = "") => {
  cond ? ok++ : bad++;
  console.log((cond ? "OK   " : "FALHA ") + nome + (cond ? "" : "  <-- " + extra));
};
await run(`
 create role anon; create role authenticated; create role service_role;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
 create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
 create table storage.objects(bucket_id text, name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n,'/') $$;
 grant usage on schema public, auth, storage to anon, authenticated, service_role;
 alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
 alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);
await run(readFileSync(R + "supabase/migrations/0001_init.sql", "utf8").replace('create extension if not exists "pgcrypto";', ""));
await run(readFileSync(R + "supabase/migrations/0003_whatsapp.sql", "utf8"));
await run("grant all on all tables in schema public to anon, authenticated, service_role;");
await run(readFileSync(R + "site-estatico/sql/0004_site_estatico.sql", "utf8"));

const OLD = "11111111-1111-1111-1111-111111111111";
const MASTER = "99999999-9999-9999-9999-999999999999";
const OUTRO = "88888888-8888-8888-8888-888888888888";
const NOVA = "77777777-7777-7777-7777-777777777777";
// lojas que já existiam ANTES da 0005
await run(`insert into auth.users(id,email,raw_user_meta_data) values
  ('${OLD}','velha@x.com','{"name":"Loja Velha"}'),('${MASTER}','dono@x.com','{}'),('${OUTRO}','outro@x.com','{}')`);
await run(`update organizations set whatsapp='5521999990000'`);

const m5 = readFileSync(R + "site-estatico/sql/0005_licenca_master.sql", "utf8");
await run(m5);
await run(m5);
check("0005 roda duas vezes (idempotente)", true);
// imita o Supabase: tudo liberado por padrão, depois os revokes da migration já valeram; reaplica os revokes de tabela
await run("grant all on all tables in schema public to anon, authenticated, service_role;");
await run("revoke all on public.licencas, public.licenca_historico from anon, authenticated;");
await run("revoke insert, update, delete on public.superadmins from anon, authenticated;");

const lic = async (org) => (await db.query("select plano, valido_ate, bloqueada from licencas where organization_id=$1", [org])).rows[0];
check("loja antiga virou 'isento' (backfill)", (await lic(OLD)).plano === "isento");
await run(`insert into auth.users(id,email,raw_user_meta_data) values ('${NOVA}','nova@x.com','{"name":"Loja Nova"}')`);
const ln = await lic(NOVA);
check("loja nova nasce em 'teste' sem prazo", ln.plano === "teste" && ln.valido_ate === null);

await run(`insert into superadmins(user_id) values ('${MASTER}')`);
await run(`insert into products(organization_id,name,price,stock,available_colors,available_sizes) values
  ('${NOVA}','Camisa',100,500,'["Azul"]','["M"]'),('${OLD}','Camisa',100,500,'["Azul"]','["M"]')`);
const pidNova = (await db.query("select id from products where organization_id=$1", [NOVA])).rows[0].id;
const slugNova = (await db.query("select slug from organizations where id=$1", [NOVA])).rows[0].slug;
const img = "https://abcdef.supabase.co/storage/v1/object/public/customizations/11111111-2222-3333-4444-555555555555.png";

const as = async (role, sub, fn) => {
  await run(`set role ${role}`);
  await run(`select set_config('request.jwt.claim.sub','${sub || ""}',false)`);
  try { return await fn(); } finally { await run("reset role"); }
};
const tryq = (role, sub, sql, params = []) =>
  as(role, sub, async () => {
    try { return { ok: true, rows: (await db.query(sql, params)).rows }; }
    catch (e) { return { ok: false, msg: e.message }; }
  });
const pedir = (slug = slugNova, pid = pidNova) =>
  tryq("anon", "", "select public.create_order($1,'Joao Silva','joao@x.com',$2::jsonb) as r",
    [slug, JSON.stringify([{ product_id: pid, quantity: 1, size: "M", customization_data: { color: "Azul" }, customization_image_url: img }])]);
const master = (sql, p = []) => tryq("authenticated", MASTER, sql, p);
const DEF = "select public.master_definir($1,$2,$3::timestamptz,$4,null,null)";
const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();

let r = await tryq("anon", "", "select public.master_listar()");
check("anon NAO chama master_listar", !r.ok, r.msg);
r = await tryq("authenticated", OUTRO, "select public.master_listar()");
check("logado sem papel recebe 'Sem permissao'", !r.ok && /Sem permiss/.test(r.msg), r.msg);
r = await tryq("authenticated", NOVA, "select public.master_iniciar_teste($1,1)", [NOVA]);
check("dono da loja NAO estende o proprio teste", !r.ok && /Sem permiss/.test(r.msg), r.msg);
r = await tryq("authenticated", NOVA, "select * from licencas");
check("dono da loja NAO le a tabela licencas", !r.ok, JSON.stringify(r));
r = await tryq("authenticated", NOVA, "update licencas set plano='isento'");
check("dono da loja NAO altera licencas", !r.ok, JSON.stringify(r));
r = await tryq("authenticated", NOVA, "insert into superadmins(user_id) values ($1)", [NOVA]);
check("ninguem vira superadmin pelo cliente", !r.ok, JSON.stringify(r));
r = await tryq("authenticated", MASTER, "select user_id from superadmins");
check("superadmin le a propria linha", r.ok && r.rows.length === 1);
r = await tryq("authenticated", OUTRO, "select user_id from superadmins");
check("nao-master nao ve superadmins", r.ok && r.rows.length === 0);

r = await master("select public.master_listar() as l");
const lista = r.rows?.[0]?.l ?? [];
check("master lista as 4 lojas", lista.length === 4, JSON.stringify(r).slice(0, 100));

r = await pedir(); check("teste sem prazo aceita pedido", r.ok, r.msg);
r = await master("select public.master_iniciar_teste($1,7)", [NOVA]); check("master inicia teste de 7 dias", r.ok, r.msg);
let L = await lic(NOVA);
let d = Math.round((new Date(L.valido_ate) - Date.now()) / 864e5);
check("vencimento ~ 7 dias", d === 7, String(d));
r = await pedir(); check("durante o teste aceita pedido", r.ok, r.msg);
r = await master(DEF, [NOVA, "teste", new Date(Date.now() - 3600e3).toISOString(), 3]);
check("master define teste vencido ha 1h", r.ok, r.msg);
r = await pedir(); check("teste VENCIDO recusa pedido (sem carencia)", !r.ok && /pausada/.test(r.msg), r.msg);
const cat = await tryq("anon", "", "select public.store_catalog($1) as c", [slugNova]);
check("vitrine informa ativa=false", cat.rows[0].c.ativa === false);
check("vitrine continua mostrando os produtos (dados preservados)", cat.rows[0].c.products.length === 1);

r = await master(DEF, [NOVA, "mensal", ago(1), 3]); check("master define mensal vencida ha 1 dia (carencia 3)", r.ok, r.msg);
r = await pedir(); check("mensal dentro da carencia aceita pedido", r.ok, r.msg);
r = await tryq("authenticated", NOVA, "select public.minha_licenca() as m");
check("dono ve 'em_carencia' na propria licenca", r.ok && r.rows[0].m.em_carencia === true && r.rows[0].m.ativa === true, JSON.stringify(r));
r = await master(DEF, [NOVA, "mensal", ago(5), 3]);
r = await pedir(); check("mensal vencida ha 5 dias (alem da carencia) recusa", !r.ok && /pausada/.test(r.msg), r.msg);

r = await master("select public.master_registrar_pagamento($1,30,150)", [NOVA]);
check("master registra pagamento", r.ok, r.msg);
L = await lic(NOVA); d = Math.round((new Date(L.valido_ate) - Date.now()) / 864e5);
check("pagamento ATRASADO conta de hoje (30 dias, nao 25)", d === 30, String(d));
r = await pedir(); check("depois do pagamento volta a aceitar", r.ok, r.msg);
r = await master("select public.master_registrar_pagamento($1,30)", [NOVA]);
L = await lic(NOVA); d = Math.round((new Date(L.valido_ate) - Date.now()) / 864e5);
check("pagamento EM DIA soma ao vencimento (60 dias)", d === 60, String(d));
r = await master("select public.master_registrar_pagamento($1,0)", [NOVA]);
check("pagamento com 0 dias e recusado", !r.ok, r.msg);

r = await master("select public.master_bloquear($1,'inadimplente')", [NOVA]); check("master bloqueia", r.ok, r.msg);
r = await pedir(); check("bloqueada recusa pedido mesmo com licenca em dia", !r.ok, r.msg);
await master("select public.master_registrar_pagamento($1,30)", [NOVA]);
r = await pedir(); check("pagamento NAO remove o bloqueio manual", !r.ok, r.msg);
await master("select public.master_liberar($1)", [NOVA]);
r = await pedir(); check("liberar remove o bloqueio e volta a aceitar", r.ok, r.msg);
await master(DEF, [NOVA, "teste", ago(1), 3]);
await master("select public.master_bloquear($1,'x')", [NOVA]);
await master("select public.master_liberar($1)", [NOVA]);
r = await pedir(); check("liberar NAO ressuscita licenca vencida", !r.ok, r.msg);
await master(DEF, [NOVA, "isento", null, 3]);
r = await pedir(); check("isento nunca vence", r.ok, r.msg);

r = await master(DEF, [NOVA, "gratis", null, 3]); check("plano invalido recusado", !r.ok, r.msg);
r = await master(DEF, [NOVA, "mensal", null, 99]); check("carencia invalida recusada", !r.ok, r.msg);
r = await master("select public.master_iniciar_teste($1,0)", [NOVA]); check("teste com 0 dias recusado", !r.ok, r.msg);

r = await master("select public.master_historico($1) as h", [NOVA]);
check("historico registra as acoes", r.ok && r.rows[0].h.length >= 8, String(r.rows?.[0]?.h?.length));
const n = (await db.query("select count(*)::int n from orders where organization_id=$1", [NOVA])).rows[0].n;
check("pedidos antigos continuam salvos apos as pausas", n >= 5, String(n));
const pidOld = (await db.query("select id from products where organization_id=$1", [OLD])).rows[0].id;
const slugOld = (await db.query("select slug from organizations where id=$1", [OLD])).rows[0].slug;
r = await pedir(slugOld, pidOld); check("loja antiga (isenta) continua aceitando pedidos", r.ok, r.msg);
// ---- 0006: ordem dos produtos na vitrine ----
await run(`insert into products(organization_id,name,price,stock,available_colors,available_sizes,created_at) values
  ('${OLD}','Flamengo preta',100,5,'[]','["M"]', now() - interval '3 days'),
  ('${OLD}','Fluminense',100,5,'[]','["M"]', now() - interval '2 days'),
  ('${OLD}','Flamengo branca',100,5,'[]','["M"]', now() - interval '1 day')`);
const m6 = readFileSync(R + "site-estatico/sql/0006_ordem_produtos.sql", "utf8");
await run(m6);
await run(m6);
check("0006 roda duas vezes (idempotente)", true);
const nomes = async () => (await tryq("anon", "", "select public.store_catalog($1) as c", [slugOld])).rows[0].c.products.map((p) => p.name);
let ordemAtual = await nomes();
const times = (l) => l.filter((n) => /^Flam|^Flu/.test(n));
check("ordem inicial = mais novo primeiro", times(ordemAtual).join("|") === "Flamengo branca|Fluminense|Flamengo preta", ordemAtual.join(" | "));
// o lojista agrupa por time: Flamengo preta, Flamengo branca, Fluminense
await run(`update products set ordem=9 where name='Camisa'`);
await run(`update products set ordem=1 where name='Flamengo preta'; update products set ordem=2 where name='Flamengo branca'; update products set ordem=3 where name='Fluminense'`);
ordemAtual = await nomes();
check("vitrine segue a ordem do lojista (time por time)", ordemAtual.slice(0, 3).join("|") === "Flamengo preta|Flamengo branca|Fluminense" && ordemAtual[3] === "Camisa", ordemAtual.join(" | "));
await run(`insert into products(organization_id,name,price,stock,available_colors,available_sizes) values ('${OLD}','Sem posicao',100,5,'[]','["M"]')`);
ordemAtual = await nomes();
check("produto sem posicao vai para o fim", ordemAtual[ordemAtual.length - 1] === "Sem posicao", ordemAtual.join(" | "));
r = await tryq("anon", "", "select public.store_catalog($1) as c", [slugOld]);
check("0006 mantem 'ativa' e nao expoe e-mail", r.rows[0].c.ativa === true && !JSON.stringify(r.rows[0].c).includes("@"));
console.log(`\n${ok} ok, ${bad} falhas`);
