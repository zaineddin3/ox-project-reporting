-- Oxford Project Reporting: let admins give a team member a temporary password.
-- Lets someone sign in even if the set-up email is blocked by their company's email filter.
-- They are asked to choose their own password at first sign-in.
create or replace function public.admin_set_password(target_email text, new_password text)
returns text language plpgsql security definer set search_path = public, auth, extensions as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Only admins can set passwords'; end if;
  if new_password is null or length(new_password) < 8 then raise exception 'Use at least 8 characters'; end if;
  if lower(target_email) = public.my_email() then raise exception 'Use Change password for your own account'; end if;
  if not exists (select 1 from public.team where email = lower(target_email)) then raise exception 'That email is not on the team'; end if;
  select id into uid from auth.users where lower(email) = lower(target_email);
  if uid is null then return 'no_account'; end if;
  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'pw_set',
         updated_at = now()
   where id = uid;
  return 'ok';
end $$;
revoke all on function public.admin_set_password(text, text) from public, anon;
grant execute on function public.admin_set_password(text, text) to authenticated;
