-- Oxford Project Reporting: database copies of uploaded files (run once).
-- The Claude page reaches the data only through the database connector, so drawings and PDFs it needs are kept here in base64 pieces.
create table if not exists public.blobs (
  id text not null,
  n int not null,            -- piece number; -1 holds {type,size,chunks,name}
  data text not null,        -- base64
  created_at timestamptz not null default now(),
  primary key (id, n)
);
alter table public.blobs enable row level security;
drop policy if exists "team can read blobs" on public.blobs;
drop policy if exists "team can add blobs" on public.blobs;
drop policy if exists "team can delete blobs" on public.blobs;
create policy "team can read blobs" on public.blobs for select to authenticated using (public.is_team());
create policy "team can add blobs" on public.blobs for insert to authenticated with check (public.is_team());
create policy "team can delete blobs" on public.blobs for delete to authenticated using (public.is_team());
