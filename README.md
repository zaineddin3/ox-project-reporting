# Oxford Project Reporting

The project reporting app as a normal website, for you and your team. It covers financials, progress claims, variations with sell PDFs, orders and invoices, procurement, cash flow, subcontractors and labour. People sign in with an emailed link, everyone sees the same data, and changes appear for others without a reload.

## What's in this folder

| File | What it is |
|---|---|
| `src/app.html` | The app itself. This is the only file to edit, and it is the same file the Claude version runs. |
| `build.py` | Turns `src/app.html` into `index.html` for the website. Run `python3 build.py` after any edit. |
| `index.html` | The built website. Don't edit it by hand. |
| `config.js` | Your Supabase address and public key. |
| `supabase-setup.sql` | Creates the database, the sign-in rules and the PDF storage. Run it once. |

Your existing data is in a separate file, `existing-data.sql`, which was sent to you in Claude. It is left out of this folder on purpose so your figures never end up in the code repository.

## One-time setup (about 20 minutes)

### 1. Create the database (Supabase, free plan)
1. Sign up at supabase.com and create a new project. Choose the **Sydney** region and save the database password somewhere safe.
2. Open **SQL Editor → New query**, paste in all of `supabase-setup.sql`, then click **Run**.
3. To bring across what you entered in the Claude version, open a second new query, paste in `existing-data.sql` and click **Run**.

### 2. Lock down sign-in
1. Go to **Authentication → Sign In / Providers** and make sure **Email** is on.
2. On the same page, turn **off** "Allow new users to sign up". Only people you invite can then get in.
3. Go to **Authentication → URL Configuration** and set **Site URL** to the app's address from step 4, for example `https://yourname.github.io/ox-project-reporting/`. Add the same address under **Redirect URLs**.

### 3. Invite your team
Go to **Authentication → Users → Invite user** and add each person's email, including your own. To sign in, they type their email on the app's sign-in screen and click the link they're sent.

### 4. Put the website online (GitHub Pages, free)
1. Sign up at github.com and create a new **public** repository, for example `ox-project-reporting`. A public repository only shows the code. Your data stays in Supabase behind the sign-in.
2. In Claude, connect GitHub (Settings → Connectors → GitHub) and give Claude access to the repository.
3. Tell Claude the repository name and send it the **Project URL** and **anon public key** from Supabase (**Project Settings → API**). Claude fills in `config.js`, uploads the files and turns on GitHub Pages.
   - To do it yourself instead: fill in `config.js`, upload all files with **Add file → Upload files**, then go to **Settings → Pages → Deploy from a branch → main / (root)**.
4. The app goes live at `https://<your-github-name>.github.io/ox-project-reporting/` within a minute or two.

## Making changes later with Claude
Ask Claude for the change in a chat that has this repository attached, for example: "In the progress claim, add a retention column". Claude edits `src/app.html`, rebuilds `index.html` and pushes. GitHub Pages updates the live site about a minute later, and everyone gets the new version the next time they load the page.

## Good to know
- **Two separate databases.** The Claude version and the hosted app don't share data. Once you've moved over, use the hosted app day to day. The Claude version stays useful for trying out changes.
- **PDFs** (ITPs, quotes, invoices) are stored privately in Supabase Storage. Links to them open for signed-in users only and expire after 10 minutes. PDFs uploaded in the Claude version don't carry across, so upload those again.
- **Free plan limits.** Supabase's free plan gives 500 MB of database and 1 GB of file storage. Free projects pause after a week with no activity and restart when someone opens the app.
- **Backups.** Supabase's free plan has no point-in-time restore. For extra safety, export the `docs` table now and then from **Table Editor → docs → Export to CSV**.
