-- Contato do cliente passa a ser o WhatsApp (em vez do e-mail).
-- Pré-requisito: 0005 (e 0006). Pode rodar mais de uma vez sem quebrar.
--
-- ATENÇÃO: a função create_order muda de p_email para p_phone. Rode este SQL e publique o site novo
-- (pasta dist refeita) na mesma hora, senão o checkout do site antigo deixa de funcionar.

alter table public.orders add column if not exists customer_phone varchar;
alter table public.orders alter column customer_email drop not null;  -- pedidos novos não têm e-mail

-- o nome do parâmetro mudou, então é preciso recriar a função
drop function if exists public.create_order(text, text, text, jsonb);

create function public.create_order(p_slug text, p_name text, p_phone text, p_items jsonb)
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
  if char_length(p_name) < 2 or char_length(p_name) > 120 then raise exception 'Nome inválido'; end if;

  -- WhatsApp: só dígitos; 10 ou 11 dígitos ganham o 55 do Brasil
  p_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if char_length(p_phone) in (10, 11) then p_phone := '55' || p_phone; end if;
  if p_phone !~ '^55[0-9]{10,11}$' then raise exception 'WhatsApp inválido (use DDD + número)'; end if;

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

  insert into public.orders (organization_id, customer_name, customer_phone, total_price)
  values (v_org, p_name, p_phone, 0)
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

revoke all on function public.create_order(text, text, text, jsonb) from public;
grant execute on function public.create_order(text, text, text, jsonb) to anon, authenticated;
