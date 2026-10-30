-- Ejecutar una vez en Supabase > SQL Editor, antes de habilitar las valoraciones.
-- La tabla qr_codes debe tener: id, code, redeemed_at y redeemed_by.
-- redeemed_by debe contener el UUID del usuario que canjeó el QR.

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  qr_code_id bigint not null unique references public.qr_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 0 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.product_reviews enable row level security;
revoke all on public.product_reviews from anon, authenticated;

drop function if exists public.validate_product_qr(text);
create function public.validate_product_qr(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_redeemed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'Iniciá sesión para continuar.';
  end if;

  select q.redeemed_at into v_redeemed_at
    from public.qr_codes as q
    where q.code = p_code;

  if not found then
    raise exception using errcode = 'P0001', message = 'El QR no existe.';
  end if;

  return pg_catalog.jsonb_build_object('available', v_redeemed_at is null);
end;
$$;

revoke all on function public.validate_product_qr(text) from public, anon;
grant execute on function public.validate_product_qr(text) to authenticated;

drop function if exists public.submit_product_review(text, integer, text);
create function public.submit_product_review(
  p_code text,
  p_rating integer,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_qr_id bigint;
  v_redeemed_at timestamptz;
  v_redeemed_by text;
  v_review_id uuid;
  v_comment text := pg_catalog.btrim(coalesce(p_comment, ''));
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'Iniciá sesión para enviar una valoración.';
  end if;
  if p_rating is null or p_rating < 0 or p_rating > 5 then
    raise exception using errcode = 'P0001', message = 'La valoración debe estar entre 0 y 5 estrellas.';
  end if;
  if pg_catalog.char_length(v_comment) > 1000 then
    raise exception using errcode = 'P0001', message = 'El comentario no puede superar los 1000 caracteres.';
  end if;

  select q.id, q.redeemed_at, q.redeemed_by::text
    into v_qr_id, v_redeemed_at, v_redeemed_by
    from public.qr_codes as q
    where q.code = p_code
    for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'El QR no existe.';
  end if;
  if v_redeemed_at is null then
    raise exception using errcode = 'P0001', message = 'El QR todavía no fue usado.';
  end if;
  if v_redeemed_by is distinct from v_user_id::text then
    raise exception using errcode = 'P0001', message = 'Solo quien canjeó este QR puede valorarlo.';
  end if;

  insert into public.product_reviews (qr_code_id, user_id, rating, comment)
    values (v_qr_id, v_user_id, p_rating::smallint, v_comment)
    on conflict (qr_code_id) do nothing
    returning id into v_review_id;

  if v_review_id is null then
    raise exception using errcode = 'P0001', message = 'Este QR ya fue valorado.';
  end if;

  return pg_catalog.jsonb_build_object('id', v_review_id, 'rating', p_rating);
end;
$$;

revoke all on function public.submit_product_review(text, integer, text) from public, anon;
grant execute on function public.submit_product_review(text, integer, text) to authenticated;

drop function if exists public.admin_list_product_reviews();
create function public.admin_list_product_reviews()
returns table (
  review_id uuid,
  qr_code text,
  reviewer_name text,
  rating smallint,
  comment text,
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
    raise exception using errcode = 'P0001', message = 'No tenés permisos para ver las valoraciones.';
  end if;

  return query
    select review.id,
           code.code::text,
           coalesce(profile.full_name, 'Cliente')::text,
           review.rating,
           review.comment,
           review.created_at
    from public.product_reviews as review
    join public.qr_codes as code on code.id = review.qr_code_id
    left join public.profiles as profile on profile.id = review.user_id
    order by review.created_at desc;
end;
$$;

revoke all on function public.admin_list_product_reviews() from public, anon;
grant execute on function public.admin_list_product_reviews() to authenticated;

drop function if exists public.admin_reset_demo_data();
create function public.admin_reset_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviews_deleted bigint;
  v_redemptions_deleted bigint;
  v_qr_codes_deleted bigint;
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

  update public.profiles set points_balance = 0;

  return pg_catalog.jsonb_build_object(
    'reviews_deleted', v_reviews_deleted,
    'redemptions_deleted', v_redemptions_deleted,
    'qr_codes_deleted', v_qr_codes_deleted
  );
end;
$$;

revoke all on function public.admin_reset_demo_data() from public, anon;
grant execute on function public.admin_reset_demo_data() to authenticated;

notify pgrst, 'reload schema';

-- Verificación: deben aparecer los RPC usados por el Club y por administración.
select n.nspname as schema_name,
       p.proname as function_name,
       pg_catalog.pg_get_function_arguments(p.oid) as arguments
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('validate_product_qr', 'submit_product_review', 'admin_list_product_reviews', 'admin_reset_demo_data')
order by p.proname;
