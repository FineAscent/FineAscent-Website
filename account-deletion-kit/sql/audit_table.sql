-- Record of deleted accounts. Optional: set CONFIG.auditTable to null to skip.
--
-- Intentionally has no foreign key to auth.users, since the whole point is to
-- outlive that row. The email is retained so support can answer "did this
-- address get deleted?" without keeping the account itself; drop the column if
-- your retention policy forbids that.

create table if not exists public.account_deletions (
  id           bigint generated always as identity primary key,
  user_id      uuid        not null,
  email        text,
  requested_by uuid        not null,
  reason       text,
  deleted_at   timestamptz not null default now()
);

create index if not exists account_deletions_user_id_idx
  on public.account_deletions (user_id);

-- Only the service role should ever touch this table. RLS with no policies
-- denies every regular client while the service role continues to bypass it.
alter table public.account_deletions enable row level security;

revoke all on public.account_deletions from anon, authenticated;
