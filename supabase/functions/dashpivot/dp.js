// Dashpivot sign in / out for Oxford Project Reporting.
// Sign-ins come from a Flowsite "Hosted Source for Excel" flow on the Sign In or Out template: Flowsite publishes the forms as a CSV
// file at a link protected by a username and password. This module reads that CSV and turns it into sign-in / sign-out events.
// It has no outside calls of its own: the request handler gets them passed in, so it can be tested without a network or database.

/* ---------- the link ---------- */
// Only Flowsite / Sitemate hosted-file links are fetched (and the Amazon storage those files can be served from).
export const ALLOWED_HOSTS = [/(^|\.)flowsite\.com$/i, /(^|\.)sitemate\.com$/i, /(^|\.)dashpivot\.com$/i, /\.amazonaws\.com$/i, /\.cloudfront\.net$/i];
export function checkUrl(u) {
  let x;
  try { x = new URL(String(u || '').trim()); } catch { return { ok: false, why: 'That isn’t a web link. Copy the hosted file link from your Flowsite flow.' }; }
  if (x.protocol !== 'https:') return { ok: false, why: 'The link must start with https://' };
  if (!ALLOWED_HOSTS.some((r) => r.test(x.hostname))) return { ok: false, why: `That link is on ${x.hostname}. Use the hosted file link from your Flowsite flow (Flows tab → Copy URL).` };
  return { ok: true, url: x.toString(), host: x.hostname };
}

/* ---------- CSV ---------- */
// RFC 4180: quoted fields, doubled quotes, line breaks inside quotes, a byte-order mark; comma, semicolon or tab separated.
export function parseCsv(text) {
  let s = String(text || '');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  const first = s.slice(0, s.indexOf('\n') < 0 ? s.length : s.indexOf('\n'));
  const count = (ch) => first.split(ch).length - 1;
  const d = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === d) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(f); f = ''; rows.push(row); row = []; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}

/* ---------- which column is which ---------- */
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const NOT_PERSON = /template|folder|team|project|site|form|app|location|company|workspace|file/;
export function detectColumns(header, rows) {
  const H = header.map(norm);
  const find = (...cands) => {
    for (const c of cands) {
      const i = H.findIndex((h) => (typeof c === 'string' ? h === c : c.test(h)));
      if (i >= 0) return i;
    }
    return -1;
  };
  const col = {
    name: find('createdby', 'submittedby', 'signedby', 'fullname', 'workername', 'employeename', 'name', 'worker', 'employee', 'person', 'username', /createdby/, /submittedby/),
    type: find('signinorout', 'signinout', 'signinsignout', 'signinorsignout', 'inorout', /signin.*out/, /inorout/, 'event', 'action', 'type'),
    loc: find('location', /location/, /gps/, /coordinates/),
    time: find('signtime', 'signintime', 'datetime', 'timestamp', 'time', 'when', 'signedat', 'createddate', 'datecreated', 'created', 'createdat', 'submitteddate', 'submitted', 'date', /created/, /date/),
    created: find('createddate', 'datecreated', 'created', 'createdat', 'submitteddate', /created(date|at|on)?$/),
    lat: find('latitude', 'lat', /latitude/, /lat$/),
    lng: find('longitude', 'long', 'lng', 'lon', /longitude/, /lng$/, /lon$/),
    id: find('formid', 'id', 'formnumber', 'number', 'formno', /formid/, /formnumber/),
    ver: find('formversion', 'version', /version/),
    upd: find('lastupdated', 'lastmodified', 'updated', 'modified', 'updateddate', /lastupdated/, /lastmodified/),
  };
  // a person column with a looser name, e.g. "Worker's name"
  if (col.name < 0) col.name = H.findIndex((h) => /name/.test(h) && !NOT_PERSON.test(h));
  // the time column found by its values (e.g. "When")
  if (col.time < 0 && rows && rows.length) {
    let best = -1; let score = 0;
    for (let c = 0; c < header.length; c++) {
      if (c === col.type || c === col.name) continue;
      const sample = rows.slice(0, 80).map((r) => r[c]).filter((v) => String(v || '').trim());
      if (!sample.length) continue;
      const hits = sample.filter((v) => { const w = parseWhen(v); return w && w.h != null; }).length / sample.length;
      if (hits > score) { score = hits; best = c; }
    }
    if (score >= 0.6) col.time = best;
  }
  // the in / out column found by its values when its heading says something else
  if (col.type < 0 && rows && rows.length) {
    let best = -1; let score = 0;
    for (let c = 0; c < header.length; c++) {
      const sample = rows.slice(0, 80).map((r) => r[c]).filter((v) => String(v || '').trim());
      if (!sample.length) continue;
      const hits = sample.filter((v) => kindOf(v)).length / sample.length;
      if (hits > score) { score = hits; best = c; }
    }
    if (score >= 0.6) col.type = best;
  }
  return col;
}
export function kindOf(v) {
  const t = String(v || '').trim().toLowerCase();
  if (!t) return '';
  if (/sign(ed|ing)?[\s_-]*out|log(ged)?[\s_-]*out|clock(ed)?[\s_-]*out|check(ed)?[\s_-]*out|^out$|depart|leav|finish/.test(t)) return 'out';
  if (/sign(ed|ing)?[\s_-]*in|log(ged)?[\s_-]*in|clock(ed)?[\s_-]*in|check(ed)?[\s_-]*in|^in$|arriv|start/.test(t)) return 'in';
  return '';
}

/* ---------- dates and times ---------- */
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const ampm = (h, ap) => { if (!ap) return h; const p = ap[0].toLowerCase(); if (p === 'p' && h < 12) return h + 12; if (p === 'a' && h === 12) return 0; return h; };
// time-zone written beside the time: (UTC+11:00), GMT+10, +11:00 after an ISO time, AEDT / AEST
function offsetIn(t) {
  let m = t.match(/\b(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?/i);
  if (m) return (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0));
  if (/\bAEDT\b/.test(t)) return 660; if (/\bAEST\b/.test(t)) return 600;
  if (/\bACDT\b/.test(t)) return 630; if (/\bACST\b/.test(t)) return 570; if (/\bAWST\b/.test(t)) return 480;
  return null;
}
export function parseWhen(text) {
  const t = String(text || '');
  if (!t.trim()) return null;
  let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?)?/);
  if (m) {
    let off = null;
    if (m[7]) off = m[7] === 'Z' ? 0 : (m[7][0] === '-' ? -1 : 1) * (+m[7].slice(1, 3) * 60 + +m[7].slice(-2));
    else off = offsetIn(t);
    return { y: +m[1], m: +m[2], d: +m[3], h: m[4] ? +m[4] : null, mi: m[5] ? +m[5] : 0, s: m[6] ? +m[6] : 0, off };
  }
  const TM = '(?:,?\\s+(?:at\\s+)?(\\d{1,2})[:.](\\d{2})(?::(\\d{2}))?\\s*([ap]\\.?\\s?m\\.?)?)?';
  m = t.match(new RegExp('\\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})' + TM, 'i'));
  if (m) return { y: +m[3], m: MON[m[1].toLowerCase()], d: +m[2], h: m[4] ? ampm(+m[4], m[7]) : null, mi: m[5] ? +m[5] : 0, s: m[6] ? +m[6] : 0, off: offsetIn(t) };
  m = t.match(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?,?\\s+(\\d{4})' + TM, 'i'));
  if (m) return { y: +m[3], m: MON[m[2].toLowerCase()], d: +m[1], h: m[4] ? ampm(+m[4], m[7]) : null, mi: m[5] ? +m[5] : 0, s: m[6] ? +m[6] : 0, off: offsetIn(t) };
  m = t.match(new RegExp('\\b(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{2,4})' + TM, 'i'));
  if (m) {
    let a = +m[1]; let b = +m[2]; let y = +m[3]; if (y < 100) y += 2000;
    if (b > 12 && a <= 12) [a, b] = [b, a]; // month first (US style) only when the day can't be first
    return { y, m: b, d: a, h: m[4] ? ampm(+m[4], m[7]) : null, mi: m[5] ? +m[5] : 0, s: m[6] ? +m[6] : 0, off: offsetIn(t) };
  }
  return null;
}
// Australia/Sydney wall time <-> instant (handles daylight saving)
export const TZ = 'Australia/Sydney';
let FMT = null;
function zoneParts(ms) {
  FMT = FMT || new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = {}; for (const x of FMT.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}
function zoneToUtc(y, m, d, h, mi, s) {
  const want = Date.UTC(y, m - 1, d, h, mi, s); let t = want - 600 * 60000;
  for (let k = 0; k < 3; k++) { const q = zoneParts(t); const diff = want - Date.UTC(q.y, q.m - 1, q.d, q.h, q.mi, q.s); if (!diff) break; t += diff; }
  return t;
}
export function instantOf(w) {
  if (!w || w.h == null || !(w.m >= 1 && w.m <= 12) || !(w.d >= 1 && w.d <= 31)) return null;
  if (w.off != null) return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - w.off * 60000;
  return zoneToUtc(w.y, w.m, w.d, w.h, w.mi, w.s);
}
const p2 = (n) => String(n).padStart(2, '0');
export function localDayTime(ms) { const q = zoneParts(ms); return { day: `${q.y}-${p2(q.m)}-${p2(q.d)}`, time: `${p2(q.h)}:${p2(q.mi)}` }; }

/* ---------- GPS ---------- */
export function latLngIn(t) {
  const s = String(t || '');
  let m = s.match(/lat(?:itude)?\s*[:=]?\s*(-?\d{1,3}\.\d+)[^\d-]+(?:long|lng|lon)(?:gitude)?\s*[:=]?\s*(-?\d{1,3}\.\d+)/i);
  if (m) return [+m[1], +m[2]];
  m = s.match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
  if (m) return [+m[1], +m[2]];
  return null;
}

/* ---------- CSV -> events ---------- */
// Each event: [form id, person, 'in'|'out', instant (ms), lat, lng, form version, last updated]
export function parseSignins(text, opts = {}) {
  const rows = parseCsv(text);
  if (!rows.length) return { events: [], columns: [], detected: {}, total: 0, skipped: 0, why: {} };
  const header = rows[0].map((h) => String(h || '').trim()); const body = rows.slice(1);
  const C = detectColumns(header, body);
  const filt = String(opts.filter || '').trim().toLowerCase();
  const why = {}; const no = (k) => { why[k] = (why[k] || 0) + 1; };
  const out = []; const seen = new Set(); let total = 0;
  for (const r of body) {
    if (filt && !r.some((v) => String(v || '').toLowerCase().includes(filt))) continue;
    total++;
    const cell = (i) => (i >= 0 ? String(r[i] == null ? '' : r[i]).trim() : '');
    const kind = kindOf(cell(C.type));
    if (!kind) { no('no in/out'); continue; }
    const name = cell(C.name).replace(/\s+/g, ' ');
    if (!name) { no('no name'); continue; }
    // the time the phone recorded with the location, else the time column
    let at = null;
    const locW = parseWhen(cell(C.loc)); if (locW) at = instantOf(locW);
    if (at == null) { const tw = parseWhen(cell(C.time)); if (tw) at = instantOf(tw); }
    if (at == null && C.created >= 0 && C.created !== C.time) { const cw = parseWhen(cell(C.created)); if (cw) at = instantOf(cw); }
    if (at == null) { no('no time'); continue; }
    let ll = null;
    if (C.lat >= 0 && C.lng >= 0) { const a = parseFloat(cell(C.lat)); const b = parseFloat(cell(C.lng)); if (isFinite(a) && isFinite(b)) ll = [a, b]; }
    if (!ll) ll = latLngIn(cell(C.loc));
    const id = cell(C.id);
    const key = (id || name) + '|' + kind + '|' + at; if (seen.has(key)) continue; seen.add(key);
    out.push([id, name, kind, at, ll ? ll[0] : null, ll ? ll[1] : null, cell(C.ver), cell(C.upd)]);
  }
  out.sort((a, b) => a[3] - b[3]);
  const detected = {}; for (const [k, i] of Object.entries(C)) if (i >= 0) detected[k] = header[i];
  return { events: out, columns: header, detected, total, skipped: total - out.length, why };
}
// events for a range of days (YYYY-MM-DD, inclusive), with the local day and time added
export function eventsBetween(events, from, to) {
  const res = [];
  for (const e of events || []) {
    const { day, time } = localDayTime(e[3]);
    if ((from && day < from) || (to && day > to)) continue;
    res.push({ id: e[0], name: e[1], type: e[2], at: new Date(e[3]).toISOString(), day, time, lat: e[4], lng: e[5], ver: e[6], upd: e[7] });
  }
  return res;
}

/* ---------- the request handler ---------- */
// deps: getUser(jwt) -> user|null, canSee(jwt, pid) -> bool, scope(jwt) -> 'all'|'packages'|..., db.get/put/patch/del, fetchUrl(url, cred, etag) -> {status,text,etag,type}, now()
export const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const FRESH_MS = 10 * 60 * 1000; const FORCE_MS = 60 * 1000; const MAX_BYTES = 30 * 1024 * 1024;
const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');

async function pull(row, deps, useEtag) {
  let r;
  try { r = await deps.fetchUrl(row.url, { username: row.username, password: row.password }, useEtag ? row.etag : ''); }
  catch (e) { return { err: 'Couldn’t reach Flowsite: ' + (e && e.name === 'TimeoutError' ? 'it took too long to answer.' : String((e && e.message) || e)) }; }
  if (r.status === 304) return { same: true };
  if (r.status === 401 || r.status === 403) return { err: 'Flowsite didn’t accept the username or password. If the flow’s password was regenerated, enter the new one.' };
  if (r.status === 404) return { err: 'Flowsite says the hosted file isn’t there. Check the flow is saved and has run, and that the link is the current one.' };
  if (r.status !== 200) return { err: `Flowsite answered with an error (${r.status}).` };
  const text = r.text || '';
  if (text.length > MAX_BYTES) return { err: 'The Flowsite file is too big to read here.' };
  if (/^\s*</.test(text) || /text\/html/i.test(r.type || '')) return { err: 'The link returned a web page, not the CSV file. Use the hosted file link from the flow (Copy URL).' };
  const P = parseSignins(text, { filter: row.filter });
  return { P, etag: r.etag || '' };
}

export async function handle(req, deps) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const jwt = String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const user = jwt ? await deps.getUser(jwt).catch(() => null) : null;
  if (!user) return json({ error: 'Sign in to the app first.' }, 401);
  let b; try { b = await req.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const pid = String((b && b.project) || '');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(pid)) return json({ error: 'Unknown project.' }, 400);
  const [ok, sc] = await Promise.all([deps.canSee(jwt, pid).catch(() => false), deps.scope(jwt).catch(() => '')]);
  if (!ok || sc === 'packages') return json({ error: 'You don’t have access to this project’s sign-ins.' }, 403);
  const now = deps.now ? deps.now() : Date.now();
  const act = String(b.action || '');
  try {
    if (act === 'status') {
      const row = await deps.db.get(pid);
      if (!row) return json({ linked: false });
      const source = /^https:/i.test(row.url) ? 'flowsite' : 'claude';
      return json({ linked: true, source, host: source === 'flowsite' ? (() => { try { return new URL(row.url).hostname; } catch { return ''; } })() : '', username: row.username, filter: row.filter || '', updatedAt: row.updated_at, fetchedAt: row.fetched_at, lastError: row.last_error || '' });
    }
    if (act === 'unlink') { await deps.db.del(pid); return json({ linked: false }); }
    if (act === 'save') {
      const prev = await deps.db.get(pid);
      const U = checkUrl(b.url || (prev && prev.url));
      if (!U.ok) return json({ error: U.why }, 400);
      const username = String(b.username == null ? (prev && prev.username) || '' : b.username).trim();
      let password = String(b.password || '');
      const same = prev && prev.url === U.url && prev.username === username;
      if (!password && same) password = prev.password; // keep the saved password when only the filter changes
      if (!username || !password) return json({ error: 'Enter the username and password from the Flowsite flow.' }, 400);
      const filter = String(b.filter || '').trim().slice(0, 120);
      const row = { project_id: pid, url: U.url, username: username.slice(0, 300), password: password.slice(0, 500), filter, updated_at: new Date(now).toISOString(), updated_by: user.id, etag: '', cache: null, fetched_at: null, last_error: '' };
      const got = await pull(row, deps, false);
      if (got.err) return json({ error: got.err }, 400);
      row.cache = { events: got.P.events, columns: got.P.columns, detected: got.P.detected, total: got.P.total, skipped: got.P.skipped, why: got.P.why };
      row.etag = got.etag; row.fetched_at = new Date(now).toISOString();
      await deps.db.put(row);
      return json({ linked: true, host: U.host, username, filter, rows: got.P.total, events: got.P.events.length, columns: got.P.columns, detected: got.P.detected, why: got.P.why });
    }
    if (act === 'events') {
      const row = await deps.db.get(pid);
      if (!row) return json({ linked: false });
      const age = row.fetched_at ? now - Date.parse(row.fetched_at) : Infinity;
      let C = row.cache; let err = '';
      // rows filled by the daily pull from Dashpivot (url "claude:…") have no file to read: they're used as saved
      const live = /^https:/i.test(row.url);
      if (live && (!C || age > FRESH_MS || (b.force && age > FORCE_MS))) {
        const got = await pull(row, deps, !!C);
        if (got.err) { err = got.err; await deps.db.patch(pid, { last_error: err }); }
        else if (got.same) { await deps.db.patch(pid, { fetched_at: new Date(now).toISOString(), last_error: '' }); row.fetched_at = new Date(now).toISOString(); }
        else {
          C = { events: got.P.events, columns: got.P.columns, detected: got.P.detected, total: got.P.total, skipped: got.P.skipped, why: got.P.why };
          row.fetched_at = new Date(now).toISOString();
          await deps.db.patch(pid, { cache: C, etag: got.etag, fetched_at: row.fetched_at, last_error: '' });
        }
      }
      if (!C) return json({ linked: true, error: err || 'No sign-ins read yet.' });
      const from = day(b.from); const to = day(b.to);
      return json({ linked: true, source: live ? 'flowsite' : 'claude', events: eventsBetween(C.events, from, to), fetchedAt: row.fetched_at, error: err, columns: C.columns, detected: C.detected, total: C.total, skipped: C.skipped, why: C.why });
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    return json({ error: 'Something went wrong on the server: ' + String((e && e.message) || e).slice(0, 200) }, 500);
  }
}
