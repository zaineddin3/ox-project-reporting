-- Oxford Project Reporting: admins set a temporary password for a team member (run once).
-- If the person has no sign-in yet, one is created directly (confirmed), so no email is needed.
create or replace function public.admin_set_password(target_email text, new_password text)
returns text language plpgsql security definer set search_path to 'public','auth','extensions' as $function$
declare uid uuid; em text := lower(trim(target_email));
begin
  if not public.is_admin() then raise exception 'Only admins can set passwords'; end if;
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
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')), email_confirmed_at = coalesce(email_confirmed_at, now()),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'pw_set', updated_at = now() where id = uid;
  return 'ok';
end $function$;
revoke all on function public.admin_set_password(text,text) from public, anon;
grant execute on function public.admin_set_password(text,text) to authenticated;
-- Files up to 50 MB (the free plan's maximum per file)
update storage.buckets set file_size_limit = 52428800 where id = 'files';
