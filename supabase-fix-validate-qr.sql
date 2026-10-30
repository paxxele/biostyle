-- Ejecutá este archivo en Supabase > SQL Editor, en el proyecto configurado
-- en supabase-config.js (referencia: ybyhudssticsnwznhine).
-- Crea únicamente el RPC que falta y actualiza la caché de PostgREST.

create or replace function public.validate_product_qr(p_code text)
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

  select q.redeemed_at
    into v_redeemed_at
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
notify pgrst, 'reload schema';

-- Verificación: debe aparecer una fila con el argumento p_code text.
select n.nspname as schema_name,
       p.proname as function_name,
       pg_catalog.pg_get_function_arguments(p.oid) as arguments
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'validate_product_qr';
