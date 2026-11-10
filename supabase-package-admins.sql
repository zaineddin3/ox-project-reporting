-- Oxford Project Reporting: package admins (run once, after supabase-packages.sql)
-- A package can be handed to another company: its admin adds and manages their own people.
-- Package admins see only the people in packages they admin (never the Oxford team or Oxford admins),
-- can only make "member / only their packages" users, and can only add brand-new projects to their package.
-- Uploaded files are tied to their project, so package users cannot open files from other projects.

-- 1. Package roles
alter table public.package_members add column if not exists role text not null default 'member';
alter table public.package_members drop constraint if exists package_members_role_check;
alter table public.package_members add constraint package_members_role_check check (role in ('member','admin'));
alter table public.packages alter column created_by drop not null;

-- 2. Helpers
create or replace function public.my_admin_pkgs() returns setof uuid
language sql stable security definer set search_path = public as $$
  select package_id from public.package_members where email = public.my_email() and role = 'admin';
$$;
create or replace function public.is_pkg_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.package_members where email = public.my_email() and role = 'admin');
$$;
-- people in a package I admin
create or replace function public.pkg_sees(target text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.package_members m where m.email = lower(target) and m.package_id in (select public.my_admin_pkgs()));
$$;
-- people I may change or remove: package-only members, not me, and only in packages I admin
create or replace function public.pkg_manages(target text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team t
    where t.email = lower(target) and t.email <> public.my_email() and t.role = 'member' and t.scope = 'packages'
      and exists (select 1 from public.package_members m where m.email = t.email and m.package_id in (select public.my_admin_pkgs()))
      and not exists (select 1 from public.package_members m where m.email = t.email and m.package_id not in (select public.my_admin_pkgs())));
$$;
create or replace function public.project_has_docs(pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.docs d where public.path_project(d.path) = pid);
$$;

-- 3. Team list
drop policy if exists "team members see the team" on public.team;
create policy "team members see the team" on public.team for select to authenticated
  using (email = public.my_email() or public.is_admin() or (public.is_team() and coalesce(public.my_scope(),'all') = 'all') or public.pkg_sees(email));
drop policy if exists "package admins add users" on public.team;
create policy "package admins add users" on public.team for insert to authenticated
  with check (public.is_pkg_admin() and role = 'member' and scope = 'packages');
drop policy if exists "package admins change users" on public.team;
create policy "package admins change users" on public.team for update to authenticated
  using (public.pkg_manages(email)) with check (role = 'member' and scope = 'packages');
drop policy if exists "package admins remove users" on public.team;
create policy "package admins remove users" on public.team for delete to authenticated
  using (public.pkg_manages(email));

-- 4. Package members
drop policy if exists "see package members" on public.package_members;
create policy "see package members" on public.package_members for select to authenticated
  using (public.is_admin() or email = public.my_email() or package_id in (select public.my_admin_pkgs()));
drop policy if exists "package admins add members" on public.package_members;
create policy "package admins add members" on public.package_members for insert to authenticated
  with check (package_id in (select public.my_admin_pkgs())
    and exists (select 1 from public.team t where t.email = package_members.email and t.role = 'member' and t.scope = 'packages'));
drop policy if exists "package admins change members" on public.package_members;
create policy "package admins change members" on public.package_members for update to authenticated
  using (package_id in (select public.my_admin_pkgs()) and email <> public.my_email())
  with check (package_id in (select public.my_admin_pkgs()) and email <> public.my_email());
drop policy if exists "package admins remove members" on public.package_members;
create policy "package admins remove members" on public.package_members for delete to authenticated
  using (package_id in (select public.my_admin_pkgs()) and email <> public.my_email());

-- 5. Package projects: a package admin can put only a brand-new project into their package
drop policy if exists "package admins add new projects" on public.package_projects;
create policy "package admins add new projects" on public.package_projects for insert to authenticated
  with check (package_id in (select public.my_admin_pkgs()) and project_id <> 'main' and not public.project_has_docs(project_id));

-- 6. Temporary passwords: package admins for the people they manage
create or replace function public.admin_set_password(target_email text, new_password text)
returns text language plpgsql security definer set search_path = public, auth, extensions as $function$
declare uid uuid; em text := lower(trim(target_email));
begin
  if not (public.is_admin() or public.pkg_manages(em)) then raise exception 'Only admins can set passwords'; end if;
  if new_password is null or length(new_password) < 8 then raise exception 'Use at least 8 characters'; end if;
  if em = public.my_email() then raise exception 'Use Change password for your own account'; end if;
  if not exists (select 1 from public.team where email = em) then raise exception 'That email is not on the team'; end if;
  select id into uid from auth.users where lower(email) = em;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em, extensions.crypt(new_password, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid::text, uid, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
    return 'ok';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'pw_set',
         updated_at = now()
   where id = uid;
  return 'ok';
end $function$;

-- 7. Files belong to a project
create table if not exists public.file_projects (
  id text primary key,
  project_id text not null,
  created_at timestamptz not null default now()
);
alter table public.file_projects enable row level security;
create or replace function public.file_exists(fid text) returns boolean
language sql stable security definer set search_path = public, storage as $$
  select exists (select 1 from storage.objects where bucket_id = 'files' and name = fid);
$$;
-- a file tied to a project follows that project; an older untied file stays with the Oxford team ("All projects" users and admins)
create or replace function public.can_see_file(fid text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.file_projects f where f.id = fid)
    then exists (select 1 from public.file_projects f where f.id = fid and public.can_see_project(f.project_id))
    else public.is_admin() or (public.is_team() and coalesce(public.my_scope(),'all') = 'all') end;
$$;
drop policy if exists "see file projects" on public.file_projects;
create policy "see file projects" on public.file_projects for select to authenticated using (public.can_see_project(project_id));
drop policy if exists "tie new files" on public.file_projects;
create policy "tie new files" on public.file_projects for insert to authenticated
  with check (public.can_see_project(project_id) and project_id <> 'main' and not public.file_exists(id));

-- tie existing files to the one project whose records mention them
insert into public.file_projects (id, project_id)
select o.name, min(public.path_project(d.path))
  from storage.objects o join public.docs d on d.data::text like '%' || o.name || '%'
 where o.bucket_id = 'files' and public.path_project(d.path) <> 'main'
 group by o.name having count(distinct public.path_project(d.path)) = 1
on conflict (id) do nothing;

drop policy if exists "team can read files" on storage.objects;
drop policy if exists "team can delete files" on storage.objects;
drop policy if exists "team can upload files" on storage.objects;
create policy "team can read files" on storage.objects for select to authenticated using (bucket_id = 'files' and public.can_see_file(name));
create policy "team can delete files" on storage.objects for delete to authenticated using (bucket_id = 'files' and public.can_see_file(name));
create policy "team can upload files" on storage.objects for insert to authenticated with check (bucket_id = 'files' and public.is_team() and public.can_see_file(name));

drop policy if exists "team can read blobs" on public.blobs;
drop policy if exists "team can delete blobs" on public.blobs;
drop policy if exists "team can add blobs" on public.blobs;
create policy "team can read blobs" on public.blobs for select to authenticated using (public.can_see_file(id));
create policy "team can delete blobs" on public.blobs for delete to authenticated using (public.can_see_file(id));
create policy "team can add blobs" on public.blobs for insert to authenticated with check (public.is_team() and public.can_see_file(id));
