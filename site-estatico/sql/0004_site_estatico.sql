-- Site estático: sem servidor, as regras de loja pública e pedido ficam no banco.
-- Pré-requisitos: 0001_init.sql e 0003_whatsapp.sql já rodadas. (0002 NÃO é usada: Stripe foi removido.)
-- Pode rodar mais de uma vez sem quebrar.

-- 1) Vitrine pública: devolve só dados públicos da loja (nunca e-mail) e os produtos à venda
create or replace function public.store_catalog(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'store', jsonb_build_object('name', o.name, 'slug', o.slug, 'whatsapp', o.whatsapp),
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

-- 2) Criar pedido: tudo é conferido aqui (preço, tamanho, cor, estoque); nada vem do navegador
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

  p_name := btrim(coalesce(p_name, ''));
  p_email := btrim(coalesce(p_email, ''));
  if char_length(p_name) < 2 or char_length(p_name) > 120 then raise exception 'Nome inválido'; end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(p_email) > 200 then raise exception 'E-mail inválido'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Carrinho inválido';
  end if;

  -- estoque: soma por produto (o mesmo produto pode aparecer em várias linhas)
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

    -- só aceita imagens enviadas por este app para o bucket "customizations"
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

revoke all on function public.store_catalog(text) from public;
revoke all on function public.create_order(text, text, text, jsonb) from public;
grant execute on function public.store_catalog(text) to anon, authenticated;
grant execute on function public.create_order(text, text, text, jsonb) to anon, authenticated;

-- 3) Imagem do design: o navegador envia direto para o Storage (somente PNG com nome em UUID, até 5 MB)
update storage.buckets
   set file_size_limit = 5242880, allowed_mime_types = array['image/png']
 where id = 'customizations';

drop policy if exists "customizations upload publico" on storage.objects;
create policy "customizations upload publico" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'customizations' and name ~ '^[0-9a-f-]{36}\.png$');
