-- Ordem dos produtos na vitrine, definida pelo lojista (time por time).
-- Pré-requisito: 0005. Pode rodar mais de uma vez sem quebrar.

alter table public.products add column if not exists ordem integer;

-- Mantém a ordem atual (mais novo primeiro) como ponto de partida, loja por loja
update public.products p
   set ordem = s.rn
  from (
    select id, row_number() over (partition by organization_id order by created_at desc) as rn
      from public.products
  ) s
 where p.id = s.id and p.ordem is null;

-- A vitrine passa a seguir a ordem do lojista (sem posição = fim da lista)
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
      ) order by p.ordem nulls last, p.created_at desc)
      from public.products p
      where p.organization_id = o.id and p.active and p.stock > 0
    ), '[]'::jsonb)
  )
  from public.organizations o
  where o.slug = p_slug;
$$;
