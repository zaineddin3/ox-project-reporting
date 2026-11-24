-- Sign In and Out: shared data so every tablet stays in sync.
-- Uses the same team list (public.team / public.is_team()) as Oxford Project Reporting:
-- only signed-in team members can read or write. Already applied; kept here for reference.

create table if not exists public.sio_records (
  kind text not null check (kind in ('person','log','user','site','settings')),
  id text not null,
  data jsonb not null default '{}'::jsonb,   -- the record exactly as the app keeps it
  deleted boolean not null default false,    -- removals are kept as a flag so other devices remove it too
  device text,                               -- which tablet sent it
  updated_at timestamptz not null default clock_timestamp(),  -- server time, set by trigger
  updated_by uuid default auth.uid(),
  primary key (kind, id)
);
comment on table public.sio_records is 'Sign In and Out app: people (face templates), attendance log, admin users, sites and shared settings, synced between kiosk devices.';
create index if not exists sio_records_updated_idx on public.sio_records (updated_at);

-- Server sets the time and author, so a device's clock can't change them.
create or replace function public.sio_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists sio_touch on public.sio_records;
create trigger sio_touch before insert or update on public.sio_records
for each row execute function public.sio_touch();

-- Attendance records can't be changed or deleted once uploaded.
create or replace function public.sio_log_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.kind = 'log' then
    if tg_op = 'DELETE' then raise exception 'Attendance records cannot be deleted'; end if;
    if new.data is distinct from old.data or new.deleted <> old.deleted then
      raise exception 'Attendance records cannot be changed';
    end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists sio_log_guard on public.sio_records;
create trigger sio_log_guard before update or delete on public.sio_records
for each row execute function public.sio_log_guard();

alter table public.sio_records enable row level security;
drop policy if exists "team reads sign-in data" on public.sio_records;
drop policy if exists "team adds sign-in data" on public.sio_records;
drop policy if exists "team updates sign-in data" on public.sio_records;
create policy "team reads sign-in data"   on public.sio_records for select to authenticated using (public.is_team());
create policy "team adds sign-in data"    on public.sio_records for insert to authenticated with check (public.is_team());
create policy "team updates sign-in data" on public.sio_records for update to authenticated using (public.is_team()) with check (public.is_team());
-- no delete policy: nothing is ever hard-deleted from the app
