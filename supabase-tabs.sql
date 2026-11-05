-- Oxford Project Reporting: choose which tabs each team member can open (run once).
-- null = all tabs. Only admins can change it (existing "admins change users" policy). Admins always see every tab.
alter table public.team add column if not exists tabs text;
