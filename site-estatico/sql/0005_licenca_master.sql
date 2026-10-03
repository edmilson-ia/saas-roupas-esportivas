-- Licença por loja + painel do dono do sistema (/master)
-- Pré-requisitos: 0001, 0003 e 0004. Pode rodar mais de uma vez sem quebrar.
--
-- Modelo (igual ao do depósito de bebidas): a trava é decidida DENTRO do banco, a cada pedido,
-- com a hora do servidor. Não existe tarefa agendada que possa falhar.
--   plano 'teste'  : vale até valido_ate (NULL = sem prazo = estado inicial seguro)
--   plano 'mensal' : vale até valido_ate + carencia_dias
--   plano 'isento' : nunca vence
--   bloqueada      : bloqueio manual imediato
-- O dono da loja NÃO consegue estender nem liberar: só o superadmin (funções master_*).

-- 1) Quem é o dono do sistema
create table if not exists public.superadmins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.superadmins enable row level security;
drop policy if exists superadmins_self on public.superadmins;
create policy superadmins_self on public.superadmins for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.superadmins from anon, authenticated;

-- 2) Licença de cada loja (sem policies: ninguém lê nem escreve direto)
create table if not exists public.licencas (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plano text not null default 'teste' check (plano in ('teste', 'mensal', 'isento')),
  valido_ate timestamptz,
  carencia_dias integer not null default 3 check (carencia_dias between 0 and 60),
  bloqueada boolean not null default false,
  bloqueio_motivo text,
  cliente text,
  valor_mensal numeric(10,2) check (valor_mensal is null or valor_mensal >= 0),
  atualizado_em timestamptz not null default now()
);
alter table public.licencas enable row level security;
revoke all on public.licencas from anon, authenticated;

create table if not exists public.licenca_historico (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  acao text not null,
  detalhes jsonb not null default '{}',
  por uuid,
  criado_em timestamptz not null default now()
);
alter table public.licenca_historico enable row level security;
revoke all on public.licenca_historico from anon, authenticated;

-- Lojas que já existem continuam funcionando (isentas) até você iniciar o teste ou a mensalidade
insert into public.licencas (organization_id, plano)
select id, 'isento' from public.organizations
on conflict (organization_id) do nothing;

-- Lojas novas nascem em "teste sem prazo"; você define a data depois
create or replace function public.criar_licenca_padrao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.licencas (organization_id, plano) values (new.id, 'teste') on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_org_created_licenca on public.organizations;
create trigger on_org_created_licenca after insert on public.organizations
  for each row execute function public.criar_licenca_padrao();

-- 3) Funções internas
create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.superadmins where user_id = auth.uid());
$$;

create or replace function public.master_exigir() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'Sem permissão'; end if;
end $$;

-- A loja pode receber pedidos? (sem linha de licença = liberada)
create or replace function public.loja_liberada(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (not l.bloqueada) and (
      l.plano = 'isento'
      or l.valido_ate is null
      or now() <= l.valido_ate + case when l.plano = 'mensal' then make_interval(days => l.carencia_dias) else interval '0' end
    )
    from public.licencas l where l.organization_id = p_org
  ), true);
$$;

-- 4) Estado da PRÓPRIA licença, para o dono da loja ver faixas de aviso (sem motivo, valor ou cliente)
create or replace function public.minha_licenca() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'plano', l.plano,
    'valido_ate', l.valido_ate,
    'dias_restantes', case when l.valido_ate is null then null
                           else ceil(extract(epoch from (l.valido_ate - now())) / 86400)::int end,
    'em_carencia', (l.plano = 'mensal' and l.valido_ate is not null and now() > l.valido_ate
                    and public.loja_liberada(l.organization_id)),
    'bloqueada', l.bloqueada,
    'ativa', public.loja_liberada(l.organization_id)
  )
  from public.licencas l where l.organization_id = auth.uid();
$$;

-- 5) Vitrine pública: agora informa se a loja está recebendo pedidos
create or replace function public.store_catalog(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'store', jsonb_build_object('name', o.name, 'slug', o.slug, 'whatsapp', o.whatsapp),
    'ativa', public.loja_liberada(o.id),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'description', p.description,
        'base_image_url', p.base_image_url, 'available_colors', p.available_colors,
        'available_sizes', p.available_sizes, 'price', p.price
      ) order by p.created_at desc)
      from public.products p
      where p.organization_id = o.id and p.active and p.stock > 0
    ), '[]'::jsonb)
  )
  from public.organizations o
  where o.slug = p_slug;
$$;

-- 6) Criar pedido: igual à 0004, mas recusa quando a loja está pausada
create or replace function public.create_order(p_slug text, p_name text, p_email text, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_order uuid;
  v_total numeric(10,2) := 0;
  it jsonb;
  p record;
  v_qty int;
  v_color text;
  v_num int;
  v_img text;
  v_cd jsonb;
  v_demand record;
begin
  select id into v_org from public.organizations where slug = p_slug;
  if v_org is null then raise exception 'Loja não encontrada'; end if;
  if not public.loja_liberada(v_org) then
    raise exception 'Esta loja está pausada e não está recebendo novos pedidos no momento';
  end if;

  p_name := btrim(coalesce(p_name, ''));
  p_email := btrim(coalesce(p_email, ''));
  if char_length(p_name) < 2 or char_length(p_name) > 120 then raise exception 'Nome inválido'; end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(p_email) > 200 then raise exception 'E-mail inválido'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Carrinho inválido';
  end if;

  for v_demand in
    select (e->>'product_id')::uuid as product_id, sum((e->>'quantity')::int) as qty
    from jsonb_array_elements(p_items) e group by 1
  loop
    if not exists (
      select 1 from public.products
      where id = v_demand.product_id and organization_id = v_org and active and stock >= v_demand.qty
    ) then
      raise exception 'Produto indisponível ou estoque insuficiente';
    end if;
  end loop;

  insert into public.orders (organization_id, customer_name, customer_email, total_price)
  values (v_org, p_name, p_email, 0)
  returning id into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'quantity')::int;
    if v_qty is null or v_qty not between 1 and 100 then raise exception 'Quantidade inválida'; end if;

    select * into p from public.products
     where id = (it->>'product_id')::uuid and organization_id = v_org and active;
    if not found then raise exception 'Produto indisponível'; end if;

    if not (p.available_sizes ? (it->>'size')) then raise exception 'Tamanho indisponível'; end if;

    v_cd := coalesce(it->'customization_data', '{}'::jsonb);
    v_color := v_cd->>'color';
    if v_color is not null and not exists (
      select 1 from jsonb_array_elements(p.available_colors) c
      where (case when jsonb_typeof(c) = 'string' then c #>> '{}' else c->>'name' end) = v_color
    ) then
      raise exception 'Cor indisponível';
    end if;

    v_num := nullif(v_cd->>'number', '')::int;
    if v_num is not null and v_num not between 1 and 99 then raise exception 'Número inválido'; end if;
    if char_length(coalesce(v_cd->>'name', '')) > 20 then raise exception 'Nome da camisa muito longo'; end if;

    v_img := nullif(it->>'customization_image_url', '');
    if v_img is not null and v_img !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/customizations/[0-9a-f-]{36}\.png$' then
      raise exception 'Imagem inválida';
    end if;

    insert into public.order_items (order_id, organization_id, product_id, quantity, size,
                                    customization_data, customization_image_url, price)
    values (v_order, v_org, p.id, v_qty, it->>'size',
            jsonb_strip_nulls(jsonb_build_object(
              'name', nullif(btrim(v_cd->>'name'), ''), 'number', v_num, 'color', v_color,
              'font', left(v_cd->>'font', 40), 'has_logo', (v_cd->>'has_logo')::boolean)),
            v_img, p.price);

    v_total := v_total + p.price * v_qty;
  end loop;

  update public.orders set total_price = v_total where id = v_order;
  return jsonb_build_object('order_id', v_order, 'total', v_total);
end $$;

-- 7) Painel do dono (todas começam com master_exigir)
create or replace function public.master_listar() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.master_exigir();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'organization_id', o.id, 'nome', o.name, 'slug', o.slug, 'email', o.email,
      'whatsapp', o.whatsapp, 'criado_em', o.created_at,
      'plano', coalesce(l.plano, 'isento'), 'valido_ate', l.valido_ate,
      'carencia_dias', coalesce(l.carencia_dias, 3), 'bloqueada', coalesce(l.bloqueada, false),
      'bloqueio_motivo', l.bloqueio_motivo, 'cliente', l.cliente, 'valor_mensal', l.valor_mensal,
      'ativa', public.loja_liberada(o.id),
      'pedidos', (select count(*) from public.orders x where x.organization_id = o.id)
    ) order by o.created_at desc)
    from public.organizations o
    left join public.licencas l on l.organization_id = o.id
  ), '[]'::jsonb);
end $$;

create or replace function public.master_historico(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.master_exigir();
  return coalesce((
    select jsonb_agg(jsonb_build_object('acao', h.acao, 'detalhes', h.detalhes, 'criado_em', h.criado_em)
                     order by h.criado_em desc, h.id desc)
    from (select * from public.licenca_historico where organization_id = p_org
          order by criado_em desc, id desc limit 50) h
  ), '[]'::jsonb);
end $$;

create or replace function public.master_iniciar_teste(p_org uuid, p_dias integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.master_exigir();
  if p_dias is null or p_dias not between 1 and 365 then raise exception 'Dias inválidos (1 a 365)'; end if;
  insert into public.licencas (organization_id) values (p_org) on conflict do nothing;
  update public.licencas
     set plano = 'teste', valido_ate = now() + make_interval(days => p_dias),
         bloqueada = false, bloqueio_motivo = null, atualizado_em = now()
   where organization_id = p_org;
  insert into public.licenca_historico (organization_id, acao, detalhes, por)
  values (p_org, 'teste_iniciado', jsonb_build_object('dias', p_dias), auth.uid());
end $$;

-- Pagamento em dia soma ao vencimento; atrasado conta de hoje. Não mexe no bloqueio manual.
create or replace function public.master_registrar_pagamento(p_org uuid, p_dias integer default 30, p_valor numeric default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.master_exigir();
  if p_dias is null or p_dias not between 1 and 366 then raise exception 'Dias inválidos (1 a 366)'; end if;
  if p_valor is not null and p_valor < 0 then raise exception 'Valor inválido'; end if;
  insert into public.licencas (organization_id) values (p_org) on conflict do nothing;
  update public.licencas
     set plano = 'mensal',
         valido_ate = greatest(coalesce(valido_ate, now()), now()) + make_interval(days => p_dias),
         valor_mensal = coalesce(p_valor, valor_mensal), atualizado_em = now()
   where organization_id = p_org;
  insert into public.licenca_historico (organization_id, acao, detalhes, por)
  values (p_org, 'pagamento', jsonb_build_object('dias', p_dias, 'valor', p_valor), auth.uid());
end $$;

create or replace function public.master_bloquear(p_org uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.master_exigir();
  insert into public.licencas (organization_id) values (p_org) on conflict do nothing;
  update public.licencas
     set bloqueada = true, bloqueio_motivo = left(nullif(btrim(p_motivo), ''), 300), atualizado_em = now()
   where organization_id = p_org;
  insert into public.licenca_historico (organization_id, acao, detalhes, por)
  values (p_org, 'bloqueio', jsonb_build_object('motivo', left(p_motivo, 300)), auth.uid());
end $$;

-- Remove só o bloqueio manual; licença vencida continua travada até pagamento ou novo vencimento
create or replace function public.master_liberar(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.master_exigir();
  update public.licencas set bloqueada = false, bloqueio_motivo = null, atualizado_em = now()
   where organization_id = p_org;
  insert into public.licenca_historico (organization_id, acao, detalhes, por)
  values (p_org, 'liberado', '{}', auth.uid());
end $$;

create or replace function public.master_definir(
  p_org uuid, p_plano text, p_valido_ate timestamptz, p_carencia integer,
  p_cliente text, p_valor numeric
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.master_exigir();
  if p_plano not in ('teste', 'mensal', 'isento') then raise exception 'Plano inválido'; end if;
  if p_carencia is null or p_carencia not between 0 and 60 then raise exception 'Carência inválida (0 a 60)'; end if;
  if p_valor is not null and p_valor < 0 then raise exception 'Valor inválido'; end if;
  insert into public.licencas (organization_id) values (p_org) on conflict do nothing;
  update public.licencas
     set plano = p_plano, valido_ate = p_valido_ate, carencia_dias = p_carencia,
         cliente = left(nullif(btrim(p_cliente), ''), 120), valor_mensal = p_valor, atualizado_em = now()
   where organization_id = p_org;
  insert into public.licenca_historico (organization_id, acao, detalhes, por)
  values (p_org, 'editado', jsonb_build_object('plano', p_plano, 'valido_ate', p_valido_ate,
                                               'carencia_dias', p_carencia, 'valor', p_valor), auth.uid());
end $$;

-- 8) Permissões: nada de função interna para anon; master_* só para logados (e mesmo assim exigem superadmin)
revoke all on function public.is_superadmin() from public;
revoke all on function public.master_exigir() from public;
revoke all on function public.loja_liberada(uuid) from public;
revoke all on function public.criar_licenca_padrao() from public;
revoke all on function public.minha_licenca() from public;
revoke all on function public.store_catalog(text) from public;
revoke all on function public.create_order(text, text, text, jsonb) from public;
revoke all on function public.master_listar() from public;
revoke all on function public.master_historico(uuid) from public;
revoke all on function public.master_iniciar_teste(uuid, integer) from public;
revoke all on function public.master_registrar_pagamento(uuid, integer, numeric) from public;
revoke all on function public.master_bloquear(uuid, text) from public;
revoke all on function public.master_liberar(uuid) from public;
revoke all on function public.master_definir(uuid, text, timestamptz, integer, text, numeric) from public;

grant execute on function public.store_catalog(text) to anon, authenticated;
grant execute on function public.create_order(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.minha_licenca() to authenticated;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.master_listar() to authenticated;
grant execute on function public.master_historico(uuid) to authenticated;
grant execute on function public.master_iniciar_teste(uuid, integer) to authenticated;
grant execute on function public.master_registrar_pagamento(uuid, integer, numeric) to authenticated;
grant execute on function public.master_bloquear(uuid, text) to authenticated;
grant execute on function public.master_liberar(uuid) to authenticated;
grant execute on function public.master_definir(uuid, text, timestamptz, integer, text, numeric) to authenticated;

-- Para criar o dono (rode UMA vez, com o e-mail da sua conta):
--   insert into public.superadmins (user_id) select id from auth.users where email = 'seu@email.com';
