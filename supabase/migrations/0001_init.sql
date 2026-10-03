-- SaaS Roupas Esportivas: schema inicial + RLS multi-tenant
create extension if not exists "pgcrypto";

-- Organizações (lojistas). id = auth.users.id (1 lojista = 1 organização)
create table public.organizations (
  id uuid primary key references auth.users(id) on delete cascade,
  name varchar not null,
  slug varchar unique not null,
  email varchar unique not null,
  subscription_plan varchar not null default 'free',
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name varchar not null,
  description text,
  base_image_url varchar,
  available_colors jsonb not null default '[]',
  available_sizes jsonb not null default '[]',
  price numeric(10,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.products (organization_id);

create table public.customization_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  name varchar not null,
  config jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.customization_templates (organization_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_email varchar not null,
  customer_name varchar not null,
  status varchar not null default 'pending'
    check (status in ('pending','in_production','shipped')),
  total_price numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);
create index on public.orders (organization_id, status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  size varchar not null,
  customization_data jsonb not null default '{}',
  customization_image_url varchar,
  price numeric(10,2) not null
);
create index on public.order_items (order_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan varchar not null default 'starter',
  status varchar not null default 'active',
  monthly_price numeric(10,2),
  billing_date date,
  created_at timestamptz not null default now()
);

create table public.production_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  stage varchar not null default 'queued'
    check (stage in ('queued','printing','finishing','done')),
  notes text,
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.organizations enable row level security;
alter table public.products enable row level security;
alter table public.customization_templates enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.subscriptions enable row level security;
alter table public.production_queue enable row level security;

create policy org_self on public.organizations
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Loja pública: qualquer um lê produtos ativos; só o dono escreve
create policy products_public_read on public.products
  for select to anon, authenticated using (active);
create policy products_owner on public.products
  for all to authenticated
  using (organization_id = auth.uid()) with check (organization_id = auth.uid());

create policy templates_public_read on public.customization_templates
  for select to anon, authenticated using (true);
create policy templates_owner on public.customization_templates
  for all to authenticated
  using (organization_id = auth.uid()) with check (organization_id = auth.uid());

-- Pedidos: criados pelo servidor (service role) após validação; lojista lê/atualiza os seus
create policy orders_owner_read on public.orders
  for select to authenticated using (organization_id = auth.uid());
create policy orders_owner_update on public.orders
  for update to authenticated
  using (organization_id = auth.uid()) with check (organization_id = auth.uid());

create policy items_owner_read on public.order_items
  for select to authenticated using (organization_id = auth.uid());

create policy subs_owner_read on public.subscriptions
  for select to authenticated using (organization_id = auth.uid());

create policy queue_owner on public.production_queue
  for all to authenticated
  using (organization_id = auth.uid()) with check (organization_id = auth.uid());

-- Cria organização + assinatura automaticamente no signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base_slug text;
begin
  base_slug := coalesce(nullif(new.raw_user_meta_data->>'slug',''), split_part(new.email,'@',1));
  insert into public.organizations (id, name, slug, email)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)),
          lower(regexp_replace(base_slug,'[^a-zA-Z0-9]+','-','g')) || '-' || substr(new.id::text,1,4),
          new.email);
  insert into public.subscriptions (organization_id, plan, monthly_price, billing_date)
  values (new.id, 'starter', 0, current_date + 30);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage
insert into storage.buckets (id, name, public) values
  ('product-images','product-images',true),
  ('customizations','customizations',true),
  ('logos','logos',true)
on conflict (id) do nothing;

create policy "storage public read" on storage.objects
  for select using (bucket_id in ('product-images','customizations','logos'));
create policy "product images owner write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "product images owner modify" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "product images owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
