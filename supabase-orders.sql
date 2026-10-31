-- Ejecutar después de supabase-reviews.sql en el proyecto BioStyle de Supabase.
-- Guarda los pedidos directamente en la base. No se procesan pagos en línea:
-- el pago se realiza al recibir el producto.

create table if not exists public.customer_orders (
  order_number bigint generated always as identity primary key,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  address text not null check (char_length(address) between 1 and 160),
  province text not null check (char_length(province) between 1 and 80),
  locality text not null check (char_length(locality) between 1 and 80),
  postal_code text not null check (char_length(postal_code) between 1 and 12),
  size_g smallint not null check (size_g in (100, 200)),
  quantity smallint not null check (quantity between 1 and 20),
  payment_method text not null default 'cash_on_delivery' check (payment_method = 'cash_on_delivery'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.customer_orders enable row level security;
revoke all on public.customer_orders from public, anon, authenticated;

drop function if exists public.create_customer_order(text, text, text, text, text, text, integer, integer);
create function public.create_customer_order(
  p_first_name text,
  p_last_name text,
  p_address text,
  p_province text,
  p_locality text,
  p_postal_code text,
  p_size_g integer,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_number bigint;
  v_first_name text := pg_catalog.btrim(coalesce(p_first_name, ''));
  v_last_name text := pg_catalog.btrim(coalesce(p_last_name, ''));
  v_address text := pg_catalog.btrim(coalesce(p_address, ''));
  v_province text := pg_catalog.btrim(coalesce(p_province, ''));
  v_locality text := pg_catalog.btrim(coalesce(p_locality, ''));
  v_postal_code text := pg_catalog.btrim(coalesce(p_postal_code, ''));
begin
  if pg_catalog.char_length(v_first_name) not between 1 and 80
    or pg_catalog.char_length(v_last_name) not between 1 and 80
    or pg_catalog.char_length(v_address) not between 1 and 160
    or pg_catalog.char_length(v_province) not between 1 and 80
    or pg_catalog.char_length(v_locality) not between 1 and 80
    or pg_catalog.char_length(v_postal_code) not between 1 and 12 then
    raise exception using errcode = 'P0001', message = 'Completá todos los datos con valores válidos.';
  end if;
  if p_size_g not in (100, 200) then
    raise exception using errcode = 'P0001', message = 'La presentación seleccionada no es válida.';
  end if;
  if p_quantity not between 1 and 20 then
    raise exception using errcode = 'P0001', message = 'La cantidad debe estar entre 1 y 20.';
  end if;

  insert into public.customer_orders (
    first_name, last_name, address, province, locality, postal_code, size_g, quantity
  ) values (
    v_first_name, v_last_name, v_address, v_province, v_locality, v_postal_code,
    p_size_g::smallint, p_quantity::smallint
  ) returning order_number into v_order_number;

  return pg_catalog.jsonb_build_object('order_number', v_order_number, 'status', 'pending');
end;
$$;

revoke all on function public.create_customer_order(text, text, text, text, text, text, integer, integer) from public;
grant execute on function public.create_customer_order(text, text, text, text, text, text, integer, integer) to anon, authenticated;

drop function if exists public.admin_list_customer_orders();
create function public.admin_list_customer_orders()
returns table (
  order_number bigint,
  first_name text,
  last_name text,
  address text,
  province text,
  locality text,
  postal_code text,
  size_g smallint,
  quantity smallint,
  payment_method text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles as profile
    where profile.id = auth.uid() and profile.is_admin = true
  ) then
    raise exception using errcode = 'P0001', message = 'No tenés permisos para ver los pedidos.';
  end if;

  return query
    select orders.order_number, orders.first_name, orders.last_name, orders.address,
           orders.province, orders.locality, orders.postal_code, orders.size_g,
           orders.quantity, orders.payment_method, orders.status, orders.created_at
    from public.customer_orders as orders
    order by orders.created_at desc;
end;
$$;

revoke all on function public.admin_list_customer_orders() from public, anon;
grant execute on function public.admin_list_customer_orders() to authenticated;

-- Sustituye el reinicio administrativo para incluir también pedidos.
create or replace function public.admin_reset_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviews_deleted bigint;
  v_redemptions_deleted bigint;
  v_qr_codes_deleted bigint;
  v_orders_deleted bigint;
begin
  if not exists (
    select 1 from public.profiles as profile
    where profile.id = auth.uid() and profile.is_admin = true
  ) then
    raise exception using errcode = 'P0001', message = 'No tenés permisos para borrar los datos de la demo.';
  end if;

  delete from public.product_reviews;
  get diagnostics v_reviews_deleted = row_count;
  delete from public.reward_redemptions;
  get diagnostics v_redemptions_deleted = row_count;
  delete from public.point_transactions;
  delete from public.qr_codes;
  get diagnostics v_qr_codes_deleted = row_count;
  delete from public.customer_orders;
  get diagnostics v_orders_deleted = row_count;
  update public.profiles set points_balance = 0;

  return pg_catalog.jsonb_build_object(
    'reviews_deleted', v_reviews_deleted,
    'redemptions_deleted', v_redemptions_deleted,
    'qr_codes_deleted', v_qr_codes_deleted,
    'orders_deleted', v_orders_deleted
  );
end;
$$;

revoke all on function public.admin_reset_demo_data() from public, anon;
grant execute on function public.admin_reset_demo_data() to authenticated;

notify pgrst, 'reload schema';

select n.nspname as schema_name,
       p.proname as function_name,
       pg_catalog.pg_get_function_arguments(p.oid) as arguments
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_customer_order', 'admin_list_customer_orders', 'admin_reset_demo_data')
order by p.proname;
