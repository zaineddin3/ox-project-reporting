# Oxford Project Reporting

This is the Oxford Electrical Group project reporting app. It covers financials, progress claims, variations with sell PDFs, orders and invoices, procurement, cash flow, subcontractors and labour.

There are three ways to run it, and all three use the same online database, so the whole team works on the same projects:

| Version | How people get it |
|---|---|
| **Website** | Open the address in any browser. On a phone or PC you can also choose **Install app** or **Add to Home Screen**. |
| **Windows app** | Run `OX-Project-Reporting-Setup-1.0.0.exe`. |
| **Mac app** | Unzip `OX-Project-Reporting-1.0.0-mac-arm64.zip` on Apple silicon Macs (M1 and later), or the `-mac-x64` version on Intel Macs. |

People sign in with their email and a 6-digit code that is emailed to them. They only see project data once an admin has added them on the **Team & users** page.

## What's in this folder

| File | What it is |
|---|---|
| `src/app.html` | The app itself. This is the only file to edit, and the Claude version runs the same file. |
| `build.py` | Run `python3 build.py` after any edit. It rebuilds `index.html` (the website) and `desktop/app/index.html` (the desktop app). |
| `config.js` | Your Supabase address and public key, for the website. |
| `manifest.webmanifest`, `sw.js`, `icons/` | Let the website install like an app. These are also what app stores use. |
| `desktop/` | The Windows and Mac app. Run `npm install` then `npm run dist:win` or `npm run dist:mac` to rebuild the installers. |
| `supabase-setup.sql` | Creates the database, the team list, the access rules and the PDF storage. Run it once. |

Your existing data is in `existing-data.sql`, which Claude sent to you separately. It is deliberately left out of this folder so your figures never go into the code repository.

## 1. Set up the database (once, about 15 minutes)
1. Sign up at **supabase.com** and create a project. Choose the **Sydney** region.
2. Open `supabase-setup.sql` and replace `you@example.com` with **your** email. That makes you the first admin.
3. In Supabase, open **SQL Editor → New query**, paste in the file and click **Run**. Then do the same with `existing-data.sql` to bring across your current data.
4. Go to **Authentication → Email Templates**. In both the **Magic Link** and **Confirm signup** templates, add this line to the email body so people receive a code:
   `Your sign-in code is: {{ .Token }}`
   (Confirm signup is the email someone gets the very first time they sign in.)
5. Go to **Authentication → URL Configuration** and set **Site URL** to the website address from step 3 below.
6. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.

Leave **Allow new users to sign up** switched on. Anyone can request a code, but only people on the team list can see or change data.

## 2. Add users
Sign in, open **Team & users** at the bottom of the side bar, and add each person's email with a role:
- **Member**: can view and edit all projects.
- **Admin**: can also add, remove and change users.

The person can sign in straight away with that email. You can't remove yourself, so there is always at least one admin.

## 3. Put the website online (GitHub Pages, free)
1. Create a free account at **github.com** and an empty **public** repository, for example `ox-project-reporting`. Only the code is public. All data stays behind the sign-in.
2. In Claude, connect GitHub (**Settings → Connectors**). Then send Claude the repository name and the two Supabase values. Claude fills in `config.js`, uploads the files and switches on GitHub Pages.
3. The website goes live at `https://<your-github-name>.github.io/ox-project-reporting/`.

## 4. Install the desktop app
- **Windows:** run the setup file. If Windows SmartScreen shows "Windows protected your PC", click **More info → Run anyway**. That warning appears because the app isn't code-signed yet (see app stores below).
- **Mac:** unzip the file and drag **OX Project Reporting** into Applications. Because the app isn't signed with an Apple certificate, you need to run this once in **Terminal**:
  ```
  xattr -cr "/Applications/OX Project Reporting.app" && codesign --force --deep --sign - "/Applications/OX Project Reporting.app"
  ```
  After that, open it normally.
- On first launch, the app asks for the Supabase URL and key, plus the website address if you have one. You can change these later under **File → Connection settings**.

With the website address filled in, the desktop app always opens the latest version from the website. Updates Claude makes then appear on everyone's computer without reinstalling. Without internet it falls back to the copy built into the app.

## 5. Publishing to app stores
Claude can't publish to an app store for you. Each store needs its own developer account in your company's name, and it reviews the app first. Everything else is ready:

| Store | What you need | Steps |
|---|---|---|
| **Microsoft Store** (Windows) | Microsoft Partner Center developer account, about US$19 one-off for an individual, or a company account | Go to **pwabuilder.com**, enter the website address and download the Windows package. Upload it in Partner Center. This also removes the SmartScreen warning. |
| **Apple App Store** (iPhone, iPad, Mac) | Apple Developer Program, US$99/year, plus a Mac with Xcode | On **pwabuilder.com**, choose iOS to get an Xcode project. Open it on a Mac, then archive and submit through App Store Connect. |
| **Google Play** (Android) | Google Play Console, US$25 one-off | On **pwabuilder.com**, choose Android and upload the package to Play Console. |

All three store versions open the same website, so they pick up updates automatically. Apple sometimes rejects apps that only wrap a website for internal business use. If that happens, Apple's **Custom Apps** or **Business Manager** programme (private distribution to your own staff) is the usual route, and Claude can help prepare it.

If you'd rather skip the stores for Windows and Mac, a code-signing certificate removes the security warnings. That's roughly A$300–600/year for Windows, or the Apple Developer Program for Mac. Claude can add the signing settings once you have one.

## Making changes later with Claude
Ask Claude for the change, for example "add a retention column to the progress claim". Claude edits `src/app.html`, runs the build and pushes to GitHub. The website, the desktop apps (if a website address is set) and the store versions all update within about a minute. New installers are only needed if the desktop shell itself changes, which is rare.

## Good to know
- The Claude version and the hosted versions use separate databases. Once you've moved over, use the hosted versions day to day.
- PDFs (ITPs, quotes, invoices) are stored privately. Links to them open only for team members and expire after 10 minutes. PDFs uploaded in the Claude version need uploading again.
- Supabase's free plan includes 500 MB of database and 1 GB of files. A free project pauses after a week with no use and wakes up when someone opens the app. Supabase Pro (US$25/month) adds daily backups and removes the pausing.
