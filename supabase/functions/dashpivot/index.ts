// Supabase Edge Function "dashpivot": Dashpivot sign in / out for Oxford Project Reporting (Site diary & hours).
// The Flowsite link, username and password for each job are kept in public.dp_links, which has row level security on and no
// policies, so the app can't read them back; only this function (server side) can. Anyone calling it must be signed in to the
// app and able to see the project. See dp.js for the parsing and the request handling.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle } from './dp.js';

const URL_ = Deno.env.get('SUPABASE_URL') ?? '';
const keyFrom = (single: string, many: string): string => {
  const v = Deno.env.get(single);
  if (v) return v;
  try { const j = JSON.parse(Deno.env.get(many) ?? '{}'); return (j.default ?? Object.values(j)[0] ?? '') as string; } catch { return ''; }
};
const SERVER_KEY = keyFrom('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS');
const PUBLIC_KEY = keyFrom('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const server = createClient(URL_, SERVER_KEY, opts);
const asUser = (jwt: string) => createClient(URL_, PUBLIC_KEY, { ...opts, global: { headers: { Authorization: `Bearer ${jwt}` } } });

const b64 = (s: string) => { const u = new TextEncoder().encode(s); let t = ''; for (const c of u) t += String.fromCharCode(c); return btoa(t); };
// follow redirects by hand so the username and password are never sent on to another site (e.g. the storage the file is served from)
async function get(url: string | URL, headers: Record<string, string>): Promise<Response> {
  let u = new URL(url); let h = { ...headers };
  for (let i = 0; i < 6; i++) {
    const r = await fetch(u, { headers: h, redirect: 'manual', signal: AbortSignal.timeout(25000) });
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc) {
      await r.body?.cancel();
      const next = new URL(loc, u);
      if (next.origin !== u.origin) { delete h.Authorization; }
      u = next; continue;
    }
    return r;
  }
  throw new Error('the link redirected too many times');
}
async function fetchUrl(url: string, cred: { username: string; password: string }, etag: string) {
  const extra: Record<string, string> = etag ? { 'If-None-Match': etag } : {};
  let r = await get(url, { Authorization: 'Basic ' + b64(`${cred.username}:${cred.password}`), Accept: 'text/csv, text/plain, */*', ...extra });
  if (r.status === 401 || r.status === 403) {
    // some hosted links take the username and password in the address instead (as in Flowsite's Excel-on-Mac steps)
    await r.body?.cancel();
    const u = new URL(url); u.searchParams.set('username', cred.username); u.searchParams.set('password', cred.password);
    const r2 = await get(u, { Accept: 'text/csv, text/plain, */*', ...extra });
    if (r2.ok || r2.status === 304) r = r2; else await r2.body?.cancel();
  }
  const text = r.status === 200 ? await r.text() : (await r.body?.cancel(), '');
  return { status: r.status, text, etag: r.headers.get('etag') ?? '', type: r.headers.get('content-type') ?? '' };
}

Deno.serve((req: Request) => handle(req, {
  getUser: async (jwt: string) => { const { data, error } = await server.auth.getUser(jwt); return error ? null : data.user; },
  canSee: async (jwt: string, pid: string) => { const { data, error } = await asUser(jwt).rpc('can_see_project', { pid }); return !error && data === true; },
  scope: async (jwt: string) => { const { data } = await asUser(jwt).rpc('my_scope'); return (data as string) ?? ''; },
  db: {
    get: async (pid: string) => { const { data, error } = await server.from('dp_links').select('*').eq('project_id', pid).maybeSingle(); if (error) throw error; return data; },
    put: async (row: Record<string, unknown>) => { const { error } = await server.from('dp_links').upsert(row); if (error) throw error; },
    patch: async (pid: string, f: Record<string, unknown>) => { const { error } = await server.from('dp_links').update(f).eq('project_id', pid); if (error) throw error; },
    del: async (pid: string) => { const { error } = await server.from('dp_links').delete().eq('project_id', pid); if (error) throw error; },
  },
  fetchUrl,
  now: () => Date.now(),
}));
