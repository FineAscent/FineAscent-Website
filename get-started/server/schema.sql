-- Private delivery metadata only. Inquiry text is delivered by email, not stored here.
begin;
create table if not exists public.business_inquiry_delivery (
  id uuid primary key,
  payload_hash text not null,
  state text not null default 'pending' check (state in ('pending','sent','failed')),
  attempts integer not null default 1,
  created_at timestamptz not null default now(),
  attempted_at timestamptz not null default now()
);
create table if not exists public.business_inquiry_limits (
  bucket text primary key,
  count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.business_inquiry_delivery enable row level security;
alter table public.business_inquiry_limits enable row level security;
revoke all on public.business_inquiry_delivery, public.business_inquiry_limits from anon, authenticated;
grant all on public.business_inquiry_delivery, public.business_inquiry_limits to service_role;

create or replace function public.claim_business_inquiry(p_id uuid, p_payload_hash text, p_ip_hash text, p_email_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  existing public.business_inquiry_delivery%rowtype;
  hour_key text := to_char(now() at time zone 'UTC', 'YYYYMMDDHH24');
  keys text[];
  limits integer[] := array[30, 3, 2];
  current_count integer;
  i integer;
begin
  -- Serializes the short reservation transaction across all edge instances.
  perform pg_catalog.pg_advisory_xact_lock(816502734::bigint);
  delete from public.business_inquiry_limits where created_at < now() - interval '2 days';
  delete from public.business_inquiry_delivery where created_at < now() - interval '7 days';
  select * into existing from public.business_inquiry_delivery where id = p_id;
  if found then
    if existing.payload_hash <> p_payload_hash then return 'mismatch'; end if;
    if existing.state = 'sent' then return 'duplicate'; end if;
    -- Keep retries within Brevo's 30-minute idempotency lifetime.
    if existing.created_at < now() - interval '25 minutes' or existing.attempts >= 3 then return 'expired'; end if;
    if existing.state = 'pending' and existing.attempted_at > now() - interval '1 minute' then return 'busy'; end if;
    update public.business_inquiry_delivery set state = 'pending', attempts = attempts + 1, attempted_at = now() where id = p_id;
    return 'claimed';
  end if;
  keys := array['global:' || hour_key, 'ip:' || p_ip_hash || ':' || hour_key, 'email:' || p_email_hash || ':' || hour_key];
  for i in 1..3 loop
    select count into current_count from public.business_inquiry_limits where bucket = keys[i];
    if coalesce(current_count, 0) >= limits[i] then return 'limited'; end if;
  end loop;
  for i in 1..3 loop
    insert into public.business_inquiry_limits(bucket,count) values(keys[i],1)
    on conflict(bucket) do update set count = business_inquiry_limits.count + 1;
  end loop;
  insert into public.business_inquiry_delivery(id,payload_hash) values(p_id,p_payload_hash);
  return 'claimed';
end;
$$;
revoke all on function public.claim_business_inquiry(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_business_inquiry(uuid,text,text,text) to service_role;
commit;
