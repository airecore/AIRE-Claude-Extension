# AI Ready Tools Extension

Saved prompts for [claude.ai](https://claude.ai), one click away in a
sidebar. Clicking a button types the prompt into Claude's chat box for
you to check. **Nothing is ever sent automatically.**

## For testers

Thanks for helping test! You don't need to install anything except Chrome.

### 1. Install it

1. **Download** [`aire-extension-tester.zip`](https://github.com/airecore/AIRE-Claude-Extension/releases/download/tester-latest/aire-extension-tester.zip).
2. **Unzip it** somewhere you'll keep it, such as Documents (not
   Downloads). You'll get a folder called `aire-extension-tester`.
3. In Chrome, go to **`chrome://extensions`**.
4. Turn on **Developer mode** (switch in the top-right corner).
5. Click **Load unpacked** and choose the `aire-extension-tester` folder.
6. Click the puzzle-piece icon in Chrome's toolbar and **pin** AIRE.

Don't move or delete the folder afterwards: Chrome runs the extension
from it.

### 2. Sign in

1. Open [claude.ai](https://claude.ai) and click the **AIRE** icon in the
   toolbar. The sidebar opens.
2. Click **⚙ Settings** → **Sign in**, and use your work email.

Please stay signed in while testing, so any problems you hit are sent to
the team automatically.

### 3. Try everything

- **+ Add prompt** to make a button, then click it to put the prompt into
  Claude's chat box.
- Edit, delete and drag buttons to reorder them; make tabs; try
  **Sort by most used**.
- Settings → **Export prompts** and **Import prompts**.
- If you're in an organisation, try the shared Team prompts too.

Try to break it: odd inputs, lots of buttons, quick clicking, reloading
pages.

### 4. Report problems and ideas

Settings → **Send feedback or report a problem**. Say what you clicked,
what you expected and what happened. Leave **Attach my recent activity**
ticked, as it helps us find the cause.

Errors are also reported automatically. The tester build never sends your
prompts, buttons or Claude conversations.

### 5. Getting a new version

When you're told there's an update:

1. Download the zip again from the same link and unzip it.
2. Replace your old `aire-extension-tester` folder with the new one.
3. In `chrome://extensions`, click the **reload** icon on AIRE's card,
   then reload your claude.ai tab.

Your buttons are kept. (Removing the extension from Chrome would delete
them, so use reload instead.)

### If something isn't working

- **"Reload the Claude tab and try again"**: reload the claude.ai tab.
  This happens to tabs that were open before the extension was installed
  or updated.
- **"Couldn't find Claude's chat box"**: open a normal Claude chat (not
  Settings or Projects) and try again.
- **Sign-in fails**: your buttons still work without it. Report it from
  Settings → **Send feedback or report a problem**, or tell the team.

---

# Everything else: developers and admins

## About

- **Personal buttons** work with no sign-in and no backend; they are
  stored only in the browser (`chrome.storage.local`).
- **Organisations** (optional): sign in to get a shared, admin-managed
  prompt library, invites, membership and admin analytics. This part
  talks to the hosted backend — see [Organisations](#organisations).

Version **1.0.0** — feature-complete, tested, and prepared for the Chrome
Web Store. What is still needed before submitting is listed in
[Before launch](#before-launch--what-is-still-needed).

## Where everything lives

| Piece | Location |
|---|---|
| Code | https://github.com/airecore/AIRE-Claude-Extension (`main` branch) |
| Backend (API + privacy policy) | Vercel project `claude-extension` on the company Vercel team (Pro), live at https://claude-extension-xi.vercel.app. Deploys automatically on every push to `main`. |
| Database | Neon Postgres (connection string in the Vercel `DATABASE_URL` variable) |
| Sign-in | Clerk development instance `innocent-lamb-6401.clerk.accounts.dev` (to be replaced by a production instance on the company domain before launch) |
| Privacy policy | https://claude-extension-xi.vercel.app/privacy.html (source: `backend/public/privacy.html`) |
| Store listing text and answers | [`CHROMEWEBSTORE.md`](CHROMEWEBSTORE.md) |
| Tester build download | GitHub Releases → **Tester build (latest)** (`tester-latest`), rebuilt on every push to `main` |
| Tester QA dashboard | https://claude-extension-xi.vercel.app/qa.html (needs the `QA_DASHBOARD_KEY`); tester feedback also opens GitHub issues labelled `tester-feedback` in the private `airecore/AIRE-QA-Feedback` repository |

---

## Tester build: how it's published

The tester zip linked above is built by
`.github/workflows/tester-build.yml` and published to the **Tester build
(latest)** release (tag `tester-latest`) on every push to `main`. You can
also run it by hand from the Actions tab. The link at the top always
points to the newest one. Send testers the link to this README's
[For testers](#for-testers) section.

## Install it for development

### Developers: build from source

You need **Node.js 22 LTS** (20 also works), **pnpm 9+** and **git**.

```bash
git clone https://github.com/airecore/AIRE-Claude-Extension.git
cd AIRE-Claude-Extension
pnpm install
pnpm run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select the **`dist/`** folder (not the repo root)

Open a claude.ai tab and click the extension's toolbar icon to open the
sidebar. After any later `pnpm run build`, click the reload icon on the
extension's card in `chrome://extensions`, then reload the claude.ai tab.

Organisation sign-in uses the shared live backend; nothing needs
configuring.

**Installing the prerequisites:**

- **Windows:** install [Node.js 22 LTS](https://nodejs.org) and
  [Git for Windows](https://git-scm.com/download/win), then run
  `corepack enable`.
- **macOS:** `brew install node@22 pnpm git`
- **Linux:** install Node 22 (for example with `nvm install 22`), then
  `corepack enable`.

### If organisation sign-in fails (developer builds)

Personal buttons keep working either way.

- **"Reload the Claude tab and try again"** — reload the claude.ai tab.
  The extension only connects to tabs opened after it was loaded or
  reloaded.
- **`redirect_uri_mismatch`, or the sign-in page shows a 404** — the
  extension ID's redirect URI is missing from Clerk. See
  [Clerk sign-in](#2-clerk-sign-in).

---

## Setting up the services from scratch

The live setup above is already done. These steps are for recreating it
(for example for the production switch). The extension ID is pinned
(`key` in `manifest.config.ts`), so every developer build has the same ID
(`fhaeedmmhjjkhnopifppigddjbbmdegh`) and needs the same single redirect
URI.

### 1. Backend (Vercel + Neon)

1. Create a **Neon** Postgres database and run `backend/schema.sql` in
   the Neon SQL Editor. The file is safe to re-run; re-run it whenever it
   changes so new tables, constraints and policies are applied. The
   `DATABASE_URL` role must be a plain non-superuser without
   `BYPASSRLS`, otherwise row-level security is bypassed.
2. Create a **Vercel** project from this repo with **Root Directory =
   `backend`**. It deploys on every push to `main`.
3. Set these environment variables (Vercel → Settings → Environment
   Variables), then redeploy:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon connection string |
   | `SESSION_JWT_SECRET` | output of `openssl rand -hex 32`; signs the 14-day session tokens |
   | `CLERK_ISSUER` | the Clerk instance origin, e.g. `https://innocent-lamb-6401.clerk.accounts.dev` (same as `CLERK_DOMAIN` with `https://`) |
   | `CLERK_OAUTH_CLIENT_ID` | from Clerk → OAuth Applications |

   Do **not** set `CLERK_OAUTH_CLIENT_SECRET`. The Clerk OAuth application
   must be **Public (PKCE)**. If sign-in fails with "Client authentication
   failed", the application is set to Confidential: switch it to Public in
   Clerk and redeploy.

4. Put the deployed URL in **`src/shared/api-base.ts`** (`API_BASE_URL`)
   and commit. The manifest's host permissions are generated from it.

### 2. Clerk sign-in

All sign-in goes through one Clerk OAuth application, which offers
whichever methods are turned on in Clerk (Google, Microsoft, GitHub,
email code, enterprise SSO).

1. Clerk Dashboard → **Configure → OAuth Applications → New application**.
   Type **Public (PKCE)**. Scopes `openid email profile`. Redirect URI
   (exact, including the trailing slash):
   ```
   https://<extension-id>.chromiumapp.org/
   ```
   For developer builds the ID is `fhaeedmmhjjkhnopifppigddjbbmdegh`.
   The Chrome Web Store build gets its own ID on first upload; add that
   redirect URI as well.
2. Put the instance host in `CLERK_DOMAIN` and the client ID in
   `CLERK_OAUTH_CLIENT_ID` in **`src/shared/auth/providers.ts`**, and
   commit. The manifest's host permissions are generated from it.
3. Set `CLERK_ISSUER` and `CLERK_OAUTH_CLIENT_ID` in Vercel and redeploy.
4. Turn on the sign-in methods you want under **Social Connections** and
   **SSO Connections**. No code change is needed.

### 3. Tester QA logging

1. Re-run `backend/schema.sql` in the Neon SQL Editor (adds the
   `qa_events` and `qa_feedback` tables).
2. In Vercel → Settings → Environment Variables, add:

   | Variable | Value |
   |---|---|
   | `QA_DASHBOARD_KEY` | output of `openssl rand -hex 24`; the password for `/qa.html` |
   | `QA_GITHUB_TOKEN` | a GitHub fine-grained personal access token for the feedback repository only, with **Issues: Read and write** (optional; without it feedback is saved but no issues are opened) |
   | `QA_GITHUB_REPO` | `airecore/AIRE-QA-Feedback`: a **private** repository, because this code repository is public and issues there would be visible to anyone. Team members added to it see every report. |

3. Redeploy. Open `/qa.html` and enter the key.

### Secrets

No secrets are stored in this repo. Client IDs and the public key in
`manifest.config.ts` are public by design. `SESSION_JWT_SECRET`,
`DATABASE_URL`, `QA_DASHBOARD_KEY`, `QA_GITHUB_TOKEN` and any Clerk
secret key live only in Vercel environment variables. There is no `.env` file to create.

---

## Using it

- **Add a button:** sidebar → **+ Add prompt** → choose **Prompt** or
  **Skill** → enter a name and the text to insert. For a skill, the text
  is the slash command itself (e.g. `/doc-summary`); claude.ai's own
  autocomplete takes over after insertion.
- **Run a button:** click its name. The text is typed into claude.ai's
  chat box and nothing else happens. You press Send.
- **Reorder:** drag a row by its handle, or focus it and use Arrow
  Up/Down.
- **Tabs:** sort buttons into tabs (Writing, Code, …).
- **Export / import:** Settings → **Export prompts** saves all your buttons
  to a JSON file; **Import prompts** adds buttons from a JSON file to your
  list.

### Demo data

`examples/showcase.json` — 20 sample buttons across 5 tabs. Settings →
Import prompts → pick the file.

`examples/org-seed.sql` — fills Manage Organisation (shared tabs and
prompts, a sample roster, usage and run counts) for an existing
organisation. The comment at the top of the file says which value to
fill in before running it in the Neon SQL Editor.

---

## Organisations

Signing in is optional; personal buttons never need it.

- **Signing in gives you a personal account.** Nothing else happens: no
  organisation is created and no join request is sent. Settings says
  "Personal account".
- **Invites are how people join.** An admin invites anyone by email. The
  invitee sees "<admin> invited you to join <org>" in the sidebar and in
  Settings the next time they open it, and **accepts or declines**.
- **Creating an organisation is optional:** Settings → **Create an
  organisation** makes you its **admin**. If your company email domain
  already has an organisation, it sends that organisation a join request
  ("Wants to join") for an admin to approve, instead of creating a second
  one. Public email domains (`gmail.com`, `outlook.com`, …) never match
  each other, so each of those creates its own organisation. Nobody is added to an organisation, or has
  their usage shared, without accepting.
- **Leaving:** a member can leave, a requester can cancel and an invitee
  can decline, from Settings. Leaving or being removed deletes that
  person's usage data and run counts for the organisation. The last
  admin must promote someone else before leaving.
- **Admins** get **Manage Organisation** in Settings: approve or decline
  join requests, invite people, cancel invites, remove members, promote
  or demote admins, manage shared tabs and prompts, and see per-member
  usage and prompt-run analytics. An organisation always keeps at least
  one admin.
- **Shared tabs:** members see the organisation's shared prompts as tabs
  next to their personal ones.
- **Usage reporting:** while signed in, an active member's session,
  weekly and extra-usage percentages are reported for admins to see.
  Reporting stops on sign-out or leaving.

Security: every admin action is checked **on the server**. The backend
works out the caller's email from their verified sign-in token and
re-checks their membership on every request; the extension cannot claim
an email, organisation or role. Organisations are isolated from each
other by Postgres row-level security (`FORCE ROW LEVEL SECURITY`). Every
API route is rate-limited (`backend/lib/with-rate-limit.ts`, stored in
the `rate_limits` table), with sign-in limited per IP before any token
is verified.

---

## Tester QA logging

The tester build (every build except `pnpm run build:store`) reports
back to the team so testers can try to break it before the store
submission. The Chrome Web Store build leaves all of this out:
`vite.config.ts` switches it off, and `build:store` fails if any QA code
is left in the bundle.

What it collects, only while the tester is **signed in**:

- **Defects, automatically.** Every `console.error` in the side panel,
  service worker and content script (the extension already logs every
  caught failure that way), plus uncaught errors and unhandled promise
  rejections. Each one includes the message, stack trace, build label and
  browser version. The content script only reports its own errors, never
  claude.ai's, and reports "couldn't find Claude's chat box" as a named
  `insert_input_not_found` defect.
- **Feature usage.** A fixed list of events (button run and sent, tab
  created, import, sign-in, admin actions…) with a few plain props such as
  the button type. The list is in `src/shared/qa/events.ts`.
- **Feedback.** Settings → **Send feedback or report a problem**: a type,
  a description and, if ticked, the tester's own last 40 events from the
  past 24 hours.

It never collects prompt text, button contents or anything from a Claude
conversation, and console arguments that are objects are recorded only as
`[object]`.

Events are queued in `chrome.storage.local` (also while signed out or
offline, up to 500), and the side panel sends them every minute in
batches of 50. Rows older than 90 days are deleted automatically.

Where to read it:

- **`/qa.html`** on the backend (works on a phone). It shows defects
  grouped by cause, a feedback inbox, feature usage, a list of
  **features not yet tried**, testers with their build and browser, and
  activity by day.
- **GitHub issues** in the private
  [`airecore/AIRE-QA-Feedback`](https://github.com/airecore/AIRE-QA-Feedback)
  repository (see below).

### The `AIRE-QA-Feedback` repository

It holds no code: it exists only so tester feedback lands somewhere the
team can discuss, assign and close it. Its main page only shows a README;
the reports are under its **Issues** tab. It's private because this code
repository is public.

- **What creates an issue:** each report a tester sends from Settings →
  **Send feedback or report a problem**. The issue has their message (in a
  code block), the type (`bug`, `enhancement` or `question` label, plus
  `tester-feedback`), the build and browser, and their recent activity if
  they ticked the box. Their email is left out; it's on the dashboard.
- **What doesn't:** automatic error reports. Those are grouped on the
  dashboard instead, so one bug hit 50 times doesn't open 50 issues.
- **How it's connected:** the backend opens issues with a fine-grained
  GitHub token (`QA_GITHUB_TOKEN` in Vercel) that can only read and write
  issues in this one repository. Because the repository belongs to the
  `airecore` organisation, an organisation owner must approve the token
  once (organisation **Settings** → **Personal access tokens** →
  **Pending requests**). Until then, feedback still reaches the
  dashboard but no issues are opened.
- **Checking it works:** send a test from the extension. On the
  dashboard, a report with a **GitHub issue** link means it worked; one
  without a link means the token isn't approved yet, has expired, or
  `QA_GITHUB_REPO` doesn't match the repository name.
- **Who can see it:** anyone added to the repository (its **Settings** →
  **Collaborators and teams**). Use **Watch** → **All Activity** to be
  notified of each new report.
- **Token expiry:** the token expires after the period chosen when it was
  made (90 days). Before then, regenerate it and update `QA_GITHUB_TOKEN`
  in Vercel, then redeploy.

Every build is labelled `<version>+<commit>` (for example
`1.0.0+3f2a1b4`), shown in Settings, so every report says exactly which
build it came from.

---

## Development

```bash
pnpm install
pnpm run dev        # Vite dev build, watch mode
pnpm run build      # typecheck + production build to dist/
pnpm test           # extension unit tests (Vitest)
pnpm run typecheck  # typecheck only

cd backend && pnpm install && pnpm test && pnpm run typecheck
```

`build.mjs` (`node build.mjs`) runs the same typecheck and build without
pnpm.

### Architecture

- **`src/background/service-worker.ts`** — enables the side panel on
  claude.ai tabs.
- **`src/content/`** — runs on claude.ai. `claude-adapter.ts` finds the
  chat box and inserts text (never sends); `usage-widget.ts` draws the
  usage rings; `content-script.ts` handles messages from the sidebar and
  detects when an inserted prompt is actually sent (for analytics).
- **`src/sidepanel/`** — the sidebar UI (plain TypeScript + DOM).
  `render.ts` builds the page for the current state; `main.ts` is the
  controller.
- **`src/shared/`** — shared model and services: button storage,
  export/import (`backup.ts`), sign-in (`auth/`, OAuth with PKCE plus the
  backend session token) and the `org-*` client modules. `qa/` is the
  tester QA logging (queue, error capture, event list, feedback client);
  `src/content/qa-report.ts` is the content script's dependency-free
  version, which forwards its defects to the service worker.
- **`backend/`** — Vercel serverless API over Neon Postgres. `lib/`
  verifies tokens and resolves the caller's organisation and role; `api/`
  holds one file per route group. See `backend/README.md`.

## Testing

- **Unit tests:** `tests/` (extension) and `backend/lib/*.test.ts`
  (backend).
- **End-to-end:** `e2e/` runs the real built extension in a real
  Chromium with Playwright: button management, tabs, keyboard reorder,
  export/import, the admin, member, join-request and invite views
  (against a mocked backend), and prompt insertion and send detection
  using the exact compiled content script on a local copy of claude.ai's
  chat box.

  ```bash
  pnpm run build          # e2e loads dist/
  pnpm run e2e:install    # one time: downloads Playwright's Chromium
  pnpm run e2e
  ```

  It opens visible Chromium windows while it runs (Chrome extensions
  cannot run headless).
- **Manual live check:** [`docs/qa-checklist.md`](docs/qa-checklist.md)
  covers what automated tests cannot reach: real Clerk sign-in, the live
  backend and the real claude.ai page. Run it before each release.
- **CI** (`.github/workflows/ci.yml`) runs typecheck, all tests, the
  build and the e2e suite on every push and pull request to `main`.
  `.github/workflows/tester-build.yml` then publishes the tester zip to
  the **Tester build (latest)** release on every push to `main` (or run
  it by hand from the Actions tab).

## Publishing to the Chrome Web Store

```bash
pnpm run build:store                     # creates aire-extension-<version>.zip (no pinned key) to upload
pnpm run build && pnpm run store-assets  # regenerates screenshots + promo tile in store-assets/
```

Everything the Developer Dashboard asks for (descriptions, permission
justifications, data-use answers, assets) is in
[`CHROMEWEBSTORE.md`](CHROMEWEBSTORE.md).

## Known limitations

- **One claude.ai selector.** Insertion and the usage rings depend on
  claude.ai's chat box keeping `data-testid="chat-input"`. If claude.ai
  changes it, the extension shows a "couldn't find Claude's chat box"
  error and needs a code update.
- **Demo font.** The bundled Alfabet font files are a demo licence with
  most punctuation removed (system font is used for those characters).
  Replace them with the licensed files before the public release.

---

## Before launch — what is still needed

The code is finished. These items need a decision or an account from the
company owner before the extension can be submitted to the Chrome Web
Store.

1. **A web address for sign-in.** A subdomain of the company domain (for
   example `auth.getaiready.now`), plus access to the domain's DNS
   settings so Clerk's production records can be added. This replaces
   the Clerk test instance.
2. **A company Chrome Web Store developer account.** Registered at
   https://chrome.google.com/webstore/devconsole with a company Google
   account (one-off US$5 fee), with the developer added to it. Also
   needed:
   - the **publisher name** shown on the store page
   - a **contact email** that is monitored (Google sends review and
     policy notices there, and it goes in the privacy policy)
3. **The licensed Alfabet font files**, if the extension should use the
   brand font. Otherwise it uses a standard system font.
4. **Who can install it:**
   - **Company only** — only the company's Google Workspace accounts
     (requires Google Workspace)
   - **Unlisted** — anyone with the link; not shown in search
   - **Public** — anyone can find it in the store

### Then, to submit

1. Create the Clerk **production** instance on the sign-in domain, add
   its DNS records, turn on the sign-in methods, and create a **Public
   (PKCE)** OAuth application.
2. Update `src/shared/auth/providers.ts` (`CLERK_DOMAIN`,
   `CLERK_OAUTH_CLIENT_ID`) and the Vercel variables `CLERK_ISSUER` and
   `CLERK_OAUTH_CLIENT_ID`; redeploy.
3. Fill
   the publisher details in `CHROMEWEBSTORE.md`.
4. Swap in the licensed font (if provided) and run
   `pnpm run build && pnpm run store-assets` to refresh the screenshots.
5. Remove the test data from the database (the test organisation and
   test accounts, and optionally `qa_events` / `qa_feedback`).
6. `pnpm run build:store` and upload the zip to the developer dashboard
   as a **draft**. Copy the extension ID the store assigns, and add
   `https://<that-id>.chromiumapp.org/` as a redirect URI in the Clerk
   OAuth application.
7. Fill in the listing from `CHROMEWEBSTORE.md`, choose the visibility,
   and **submit for review** (usually a few days).
8. Once approved, share the store link with the team. Each person
   installs it, opens claude.ai, and signs in with their work email to
   join the organisation.
