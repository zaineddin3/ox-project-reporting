-- Oxford Project Reporting: database setup for Supabase
-- Run this once in Supabase: SQL Editor > New query > paste > Run.

-- 1. One table holds every record the app saves (projects, claims, variations, ...)
create table if not exists public.docs (
  path text primary key,          -- e.g. "variations/vabc123" or "p/<project>/tasks/t01"
  coll text not null,             -- the collection part of the path, e.g. "variations"
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create index if not exists docs_coll_idx on public.docs (coll);

-- 2. Only signed-in (invited) users can read or change anything
alter table public.docs enable row level security;
drop policy if exists "team can read" on public.docs;
drop policy if exists "team can write" on public.docs;
create policy "team can read"  on public.docs for select to authenticated using (true);
create policy "team can write" on public.docs for all    to authenticated using (true) with check (true);

-- 3. Live updates: everyone sees each other's changes without reloading
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 4. Private storage for ITP, quote and invoice PDFs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('files', 'files', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;
drop policy if exists "team can read files"   on storage.objects;
drop policy if exists "team can upload files" on storage.objects;
drop policy if exists "team can delete files" on storage.objects;
create policy "team can read files"   on storage.objects for select to authenticated using (bucket_id = 'files');
create policy "team can upload files" on storage.objects for insert to authenticated with check (bucket_id = 'files');
create policy "team can delete files" on storage.objects for delete to authenticated using (bucket_id = 'files');
