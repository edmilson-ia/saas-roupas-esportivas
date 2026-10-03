-- Pagamentos via Stripe Connect + estoque atômico

-- Conta Stripe conectada de cada lojista
alter table public.organizations
  add column stripe_account_id text unique,
  add column stripe_charges_enabled boolean not null default false;

-- Situação do pagamento do pedido
alter table public.orders
  add column payment_status varchar not null default 'unpaid'
    check (payment_status in ('unpaid','paid','failed','expired')),
  add column stripe_session_id text unique,
  add column paid_at timestamptz;

-- Pedidos já existentes (testes anteriores) ficam como pagos para não sumirem do painel
update public.orders set payment_status = 'paid', paid_at = created_at;

-- O lojista só enxerga pedidos pagos
drop policy if exists orders_owner_read on public.orders;
create policy orders_owner_read on public.orders
  for select to authenticated
  using (organization_id = auth.uid() and payment_status = 'paid');

drop policy if exists orders_owner_update on public.orders;
create policy orders_owner_update on public.orders
  for update to authenticated
  using (organization_id = auth.uid() and payment_status = 'paid')
  with check (organization_id = auth.uid() and payment_status = 'paid');

drop policy if exists items_owner_read on public.order_items;
create policy items_owner_read on public.order_items
  for select to authenticated
  using (
    organization_id = auth.uid()
    and exists (select 1 from public.orders o where o.id = order_id and o.payment_status = 'paid')
  );

-- Ajuste atômico de estoque (negativo reserva, positivo devolve). Falso se não houver saldo.
create or replace function public.adjust_stock(p_id uuid, p_delta integer)
returns boolean
language sql
security definer
set search_path = public
as $$
  with u as (
    update public.products
       set stock = stock + p_delta
     where id = p_id and stock + p_delta >= 0
    returning 1
  )
  select exists (select 1 from u);
$$;

revoke execute on function public.adjust_stock(uuid, integer) from public, anon, authenticated;
grant execute on function public.adjust_stock(uuid, integer) to service_role;
