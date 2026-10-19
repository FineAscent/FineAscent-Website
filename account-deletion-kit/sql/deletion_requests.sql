-- Pending requests from the public "delete my account" form.
--
-- A row here authorizes nothing. It only carries the reason the user typed and
-- backs the rate limit; the actual deletion is authorized by the emailed link.

create table if not exists public.account_deletion_requests (
  id           bigint generated always as identity primary key,
  email        text        not null,
  reason       text,
  -- Salted SHA-256, never the raw address, so the table is not an IP log.
  ip_hash      text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists account_deletion_requests_email_idx
  on public.account_deletion_requests (email, requested_at desc);

create index if not exists account_deletion_requests_ip_idx
  on public.account_deletion_requests (ip_hash, requested_at desc);

-- Service role only. RLS with zero policies denies every anon and authenticated
-- client outright, while the service role continues to bypass it. Without this
-- the table would let anyone read who has asked to be deleted.
alter table public.account_deletion_requests enable row level security;

revoke all on public.account_deletion_requests from anon, authenticated;

-- Optional retention: drop rows after 30 days so the form does not slowly turn
-- into a permanent record of email addresses. Schedule with pg_cron if wanted.
--
-- delete from public.account_deletion_requests
-- where requested_at < now() - interval '30 days';
