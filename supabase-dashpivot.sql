-- Dashpivot sign in / out (Site diary & hours). Already applied; kept here for reference.
-- Each job's Flowsite "Hosted Source for Excel" link, username and password, and the last copy of its sign-ins read from that file.
-- Row level security is on and there are no policies, so the app (anonymous or signed-in users) can't read or write this table;
-- only the "dashpivot" server function (supabase/functions/dashpivot) can, after checking the user can see the project.
create table if not exists public.dp_links (
  project_id text primary key,
  url text not null,
  username text not null,
  password text not null,
  filter text not null default '',
  etag text not null default '',
  cache jsonb,
  fetched_at timestamptz,
  last_error text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.dp_links is 'Dashpivot sign in / out: Flowsite hosted CSV link and credentials per project, plus the last parsed copy. Server function only (RLS on, no policies).';
alter table public.dp_links enable row level security;
revoke all on table public.dp_links from anon, authenticated;

-- The server function is deployed with JWT verification off at the gateway because it checks the caller itself:
-- the bearer token must belong to a signed-in user (auth.getUser), who must pass public.can_see_project(project) and not be a
-- package-only user (public.my_scope() <> 'packages').
