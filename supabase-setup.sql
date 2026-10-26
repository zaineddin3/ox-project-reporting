-- Oxford Project Reporting: database setup for Supabase
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- BEFORE RUNNING: replace you@example.com in step 1 with your own email, so you become the first admin.

-- 1. The team: everyone allowed to use the app, and who can manage users
create table if not exists public.team (
  email text primary key check (email = lower(email)),
  name text,
  role text not null default 'member' check (role in ('admin','member')),
  added_at timestamptz not null default now(),
  added_by text default lower(auth.jwt()->>'email')
);
insert into public.team (email, name, role) values ('you@example.com', 'Owner', 'admin')
on conflict (email) do update set role = 'admin';

create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team where email = lower(auth.jwt()->>'email'));
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team where email = lower(auth.jwt()->>'email') and role = 'admin');
$$;

alter table public.team enable row level security;
drop policy if exists "team members see the team" on public.team;
drop policy if exists "admins add users" on public.team;
drop policy if exists "admins change users" on public.team;
drop policy if exists "admins remove users" on public.team;
create policy "team members see the team" on public.team for select to authenticated using (public.is_team() or email = lower(auth.jwt()->>'email'));
create policy "admins add users"    on public.team for insert to authenticated with check (public.is_admin());
create policy "admins change users" on public.team for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins remove users" on public.team for delete to authenticated using (public.is_admin() and email <> lower(auth.jwt()->>'email'));

-- 2. One table holds every record the app saves (projects, claims, variations, ...)
create table if not exists public.docs (
  path text primary key,          -- e.g. "variations/vabc123" or "p/<project>/tasks/t01"
  coll text not null,             -- the collection part of the path, e.g. "variations"
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create index if not exists docs_coll_idx on public.docs (coll);

-- 3. Only people on the team can read or change project data
alter table public.docs enable row level security;
drop policy if exists "team can read" on public.docs;
drop policy if exists "team can write" on public.docs;
create policy "team can read"  on public.docs for select to authenticated using (public.is_team());
create policy "team can write" on public.docs for all    to authenticated using (public.is_team()) with check (public.is_team());

-- 4. Live updates: everyone sees each other's changes without reloading
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 5. Private storage for ITP, quote and invoice PDFs (team only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('files', 'files', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;
drop policy if exists "team can read files"   on storage.objects;
drop policy if exists "team can upload files" on storage.objects;
drop policy if exists "team can delete files" on storage.objects;
create policy "team can read files"   on storage.objects for select to authenticated using (bucket_id = 'files' and public.is_team());
create policy "team can upload files" on storage.objects for insert to authenticated with check (bucket_id = 'files' and public.is_team());
create policy "team can delete files" on storage.objects for delete to authenticated using (bucket_id = 'files' and public.is_team());
