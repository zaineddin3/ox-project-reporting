-- Oxford Project Reporting: packages (run once, after supabase-setup.sql)
-- A package is a group of projects plus the people allowed to see them.
-- Admins see everything. A project in a package is visible only to that package's members (and admins).
-- Projects not in any package stay visible to everyone whose access is "All projects".

-- 1. Each user's access: 'all' = every project that isn't in someone else's package; 'packages' = only their packages
alter table public.team add column if not exists scope text not null default 'all';
alter table public.team drop constraint if exists team_scope_check;
alter table public.team add constraint team_scope_check check (scope in ('all','packages'));

-- 2. Packages, their members and their projects
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  created_by text default lower(auth.jwt()->>'email')
);
create table if not exists public.package_members (
  package_id uuid not null references public.packages(id) on delete cascade,
  email text not null references public.team(email) on delete cascade on update cascade,
  primary key (package_id, email)
);
create table if not exists public.package_projects (
  project_id text primary key,               -- a project belongs to at most one package
  package_id uuid not null references public.packages(id) on delete cascade
);

-- 3. Helpers
create or replace function public.my_email() returns text language sql stable as $$
  select lower(auth.jwt()->>'email');
$$;
create or replace function public.path_project(p text) returns text language sql immutable as $$
  select case when p like 'p/%' or p like 'projects/%' then split_part(p, '/', 2) else 'main' end;
$$;
create or replace function public.my_scope() returns text
language sql stable security definer set search_path = public as $$
  select scope from public.team where email = public.my_email();
$$;
create or replace function public.can_see_project(pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.is_team() and (
    case when exists (select 1 from public.package_projects pp where pp.project_id = pid)
      then exists (select 1 from public.package_projects pp join public.package_members m on m.package_id = pp.package_id
                   where pp.project_id = pid and m.email = public.my_email())
      else coalesce(public.my_scope(), 'all') = 'all'
    end));
$$;

-- 4. Project data: only people who can see the project
drop policy if exists "team can read" on public.docs;
drop policy if exists "team can write" on public.docs;
drop policy if exists "project members can read" on public.docs;
drop policy if exists "project members can write" on public.docs;
create policy "project members can read"  on public.docs for select to authenticated using (public.can_see_project(public.path_project(path)));
create policy "project members can write" on public.docs for all    to authenticated using (public.can_see_project(public.path_project(path))) with check (public.can_see_project(public.path_project(path)));

-- 5. The team list: admins and "All projects" users see everyone; package-only users see themselves
drop policy if exists "team members see the team" on public.team;
create policy "team members see the team" on public.team for select to authenticated
  using (email = public.my_email() or public.is_admin() or (public.is_team() and coalesce(public.my_scope(),'all') = 'all'));

-- 6. Packages: admins manage; members can see the packages they belong to
alter table public.packages enable row level security;
alter table public.package_members enable row level security;
alter table public.package_projects enable row level security;
drop policy if exists "see packages" on public.packages;
drop policy if exists "admins manage packages" on public.packages;
create policy "see packages" on public.packages for select to authenticated
  using (public.is_admin() or exists (select 1 from public.package_members m where m.package_id = id and m.email = public.my_email()));
create policy "admins manage packages" on public.packages for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "see package members" on public.package_members;
drop policy if exists "admins manage package members" on public.package_members;
create policy "see package members" on public.package_members for select to authenticated
  using (public.is_admin() or email = public.my_email());
create policy "admins manage package members" on public.package_members for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "see package projects" on public.package_projects;
drop policy if exists "admins manage package projects" on public.package_projects;
create policy "see package projects" on public.package_projects for select to authenticated
  using (public.can_see_project(project_id));
create policy "admins manage package projects" on public.package_projects for all to authenticated using (public.is_admin()) with check (public.is_admin());
