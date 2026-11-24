# Sign In and Out

Face-recognition sign in / sign out kiosk with GPS location. Installs on iPhone, Android and PC as an app.

**Address:** https://zaineddin3.github.io/ox-project-reporting/sign-in-out/

- **Kiosk screen** (what staff see): camera and Auto / Sign in / Sign out only.
- **Admin** (🔒 button): each admin user has their own PIN, a role (Owner, Manager, Supervisor, Registration only, Viewer or Custom) and a list of sites they can see.
- **Sites**: add as many sites as you like by address search, current location or coordinates. A kiosk is fixed to one site or detects the nearest site by GPS. Every sign in / out records its site.

Works offline: everything is saved on the device first. A device connected in Admin → Settings → Sync (with an Oxford Project Reporting team email) uploads its changes and downloads everyone else's whenever it has internet. Synced data lives in the Supabase table `sio_records` (see `supabase-sign-in-out.sql`); only signed-in team members can read or write it, and uploaded sign-ins can't be edited or deleted.

| File | What it is |
|---|---|
| `index.html` | The whole app |
| `manifest.webmanifest`, `sw.js`, icons | Let it install like an app and open offline |
