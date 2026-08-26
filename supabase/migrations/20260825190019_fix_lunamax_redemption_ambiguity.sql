create or replace function public.redeem_lunamax_code(p_user_id uuid, p_code_hash text)
returns table (plan text, status text, activated_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_code public.plan_codes%rowtype;
  current_expiry timestamptz;
  next_expiry timestamptz;
begin
  if p_user_id is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'invalid_code';
  end if;

  select pc.* into selected_code
  from public.plan_codes as pc
  where pc.code_hash = p_code_hash
    and pc.active = true
    and pc.redemption_count < pc.max_redemptions
    and (pc.expires_at is null or pc.expires_at > now())
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'invalid_code';
  end if;

  if exists (
    select 1 from public.plan_redemptions as pr
    where pr.code_id = selected_code.id and pr.user_id = p_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'code_already_used';
  end if;

  select up.expires_at into current_expiry
  from public.user_plans as up
  where up.user_id = p_user_id and up.status = 'active' and up.expires_at > now()
  for update;

  next_expiry := greatest(coalesce(current_expiry, now()), now())
    + make_interval(days => selected_code.duration_days);

  insert into public.plan_redemptions (code_id, user_id)
  values (selected_code.id, p_user_id);

  update public.plan_codes as pc
  set redemption_count = pc.redemption_count + 1
  where pc.id = selected_code.id;

  insert into public.user_plans (user_id, plan, status, source, activated_at, expires_at, updated_at)
  values (p_user_id, 'lunamax', 'active', 'manual_code', now(), next_expiry, now())
  on conflict (user_id) do update set
    plan = excluded.plan,
    status = excluded.status,
    source = excluded.source,
    expires_at = excluded.expires_at,
    updated_at = now();

  return query
  select up.plan, up.status, up.activated_at, up.expires_at
  from public.user_plans as up
  where up.user_id = p_user_id;
end;
$$;

revoke all on function public.redeem_lunamax_code(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_lunamax_code(uuid, text) to service_role;
