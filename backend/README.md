# AI Ready Tools Extension — Backend

Vercel serverless API over Neon Postgres. It powers the extension's
optional organisation features: sign-in sessions, shared prompts and
tabs, membership and invites, usage reporting and admin analytics. It
also serves the privacy policy (`public/privacy.html`).

Live at https://claude-extension-xi.vercel.app (Vercel project
`claude-extension`, Root Directory `backend`, deploys on every push to
`main`).

In the API, an admin is stored as role `director`.

## Environment variables

Set in Vercel → Settings → Environment Variables, then redeploy:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string. Must be a plain non-superuser role without `BYPASSRLS`. |
| `SESSION_JWT_SECRET` | output of `openssl rand -hex 32`. Signs the 14-day session tokens the extension receives from `POST /api/auth/session`. |
| `CLERK_ISSUER` | Clerk instance origin, e.g. `https://innocent-lamb-6401.clerk.accounts.dev`. Same as `CLERK_DOMAIN` in `src/shared/auth/providers.ts` with `https://`. Clerk tokens are verified against `${CLERK_ISSUER}/.well-known/jwks.json`. |
| `CLERK_OAUTH_CLIENT_ID` | Client ID of the Clerk OAuth application. |

Tester QA logging (see the main README's
[Tester QA logging](../README.md#tester-qa-logging)):

| Variable | Value |
|---|---|
| `QA_DASHBOARD_KEY` | output of `openssl rand -hex 24`. Password for `/qa.html` and `GET /api/qa-dashboard`. Unset = dashboard disabled (503). |
| `QA_GITHUB_TOKEN` | Optional. Fine-grained token for this repository only, **Issues: Read and write**. Lets feedback open GitHub issues. |
| `QA_GITHUB_REPO` | Optional, default `airecore/AIRE-QA-Feedback`. Where those issues go. May be public (anyone can then read them; emails are never included). The dashboard's status line shows whether issues are working and whether the repository is public. |

Do not set `CLERK_OAUTH_CLIENT_SECRET`: the Clerk OAuth application must
be **Public (PKCE)**. A Confidential application makes sign-in fail with
"Client authentication failed".

Clerk setup (OAuth application, redirect URIs, sign-in methods) is in the
main [README](../README.md#2-clerk-sign-in).

## Database

Run `schema.sql` in the Neon SQL Editor (or
`psql "$DATABASE_URL" -f schema.sql`). It is safe to re-run and brings an
existing database up to date, so re-run it whenever it changes.

Organisations are isolated by row-level security (`force row level
security` on every table that holds organisation data), on top of the `WHERE org_id = ...`
filters in the API code. Writes set `app.current_org_id` in the same
transaction so the policies apply.

Organisations, members and prompts are created through the API and the
extension. `../examples/org-seed.sql` fills an existing organisation with
demo data.

## Local development

```bash
pnpm install
pnpm typecheck
pnpm test
```

The API is verified by the unit tests and by the deployed endpoints;
there is no local server step.

## API

Every endpoint's `Authorization: Bearer <token>` accepts **either** a
Clerk id_token **or** a backend session token from `POST /api/auth/session`.
The extension exchanges once after sign-in and then sends the session token.

```
POST /api/auth/session
Authorization: Bearer <token>

200 -> { "sessionToken": "<jwt>", "email": "a@b.com", "expiresAt": "<ISO-8601>" }
401 -> token missing or invalid
500 -> SESSION_JWT_SECRET not configured on the server
```

(GET /api/org-prompts and the shared-tab endpoints are documented together
further down.)

```
POST /api/org-session
Authorization: Bearer <token>

200 -> { "state": "active", "org": { "id": "...", "name": "..." }, "role": "director" | "member" }
200 -> { "state": "pending", "org": { "id": "...", "name": "..." } }
200 -> { "state": "invited", "org": { "id": "...", "name": "..." }, "invitedBy": "admin@b.com" | null }
200 -> { "state": "none" }      a personal account: signing in never creates an organisation
                                or join request on its own
401 -> token missing or invalid

POST   /api/org-session   { "action": "accept-invite" }   (invitee only)
200 -> { "state": "active", "org": { ... }, "role": "member" }
404 -> no pending invite

DELETE /api/org-session      leave the organisation, cancel a join request, or decline an invite
204 -> done (membership, usage reports and run counts deleted)
400 -> caller is the last admin
```

```
POST /api/org-onboarding        Settings > "Create an organisation" (optional)
Authorization: Bearer <token>
Body: { "orgName": "...", "initialMemberEmails": ["...", "..."] }

200 -> { "outcome": "created", "org": { "id": "...", "name": "..." }, "role": "director" }
200 -> { "outcome": "joined_existing", "org": { "id": "...", "name": "..." } }
         -- the caller's company domain already has an organisation, so a
            join request was sent to it instead of creating a second one
400 -> orgName missing/empty, or invalid email
401 -> token missing or invalid
409 -> already a member of, invited to, or requesting an organisation
```

```
GET  /api/org-members                                    (director-only)
200 -> { "members": [ { "email", "role", "status", "createdAt" } ] }
403 -> caller is not an active director

POST /api/org-members   { "action", "email", "role"? }   (director-only)
  action = "add"      -> invites the email (status invited; they accept on next sign-in)
           "approve"  -> approves a same-domain join request (status pending)
           "remove"   -> removes a member, request or invite, and their usage data
           "set-role" -> promotes/demotes an active member ("director" = admin)
  -> 204 | 400 (last director / unknown action) | 404 (not in this org)
```

```
GET    /api/org-prompts                                                   (any active member)
200 -> { "org": { "name" }, "tabs": [ { "id", "name", "emoji", "sort_order" } ],
        "prompts": [ { "id", "name", "prompt_text", "type", "tab_id", "sort_order" } ] }

POST   /api/org-prompts        { "name", "promptText", "type", "tabId"? }  (director-only) -> 201
PATCH  /api/org-prompts/:id    { "name"?, "promptText"?, "type"?, "tabId"? }  (director-only) -> 204 | 404
DELETE /api/org-prompts/:id                                               (director-only) -> 204 | 404
```

```
POST   /api/org-tabs             { "name", "emoji"? }                     (director-only) -> 201
POST   /api/org-tabs             { "action": "reorder", "orderedIds" }    (director-only) -> 204
PATCH  /api/org-tabs?id=<id>     { "name"?, "emoji"? }                    (director-only) -> 204 | 404
DELETE /api/org-tabs?id=<id>                                             (director-only) -> 204 | 400 (last tab) | 404
  -- the deleted tab's prompts move to the org's first remaining tab.
```

```
POST /api/prompt-run   { "promptId": "..." }                             (any active member) -> 204 | 404
  -- bumps the (prompt, member) lifetime counter and today's org-wide total.

GET  /api/org-analytics                                                  (director-only)
200 -> { "topPrompts": [ { "promptId", "name", "runCount" } ],
         "perMember":  [ { "email", "runCount", "lastUsedAt" } ],
         "dailyRuns":  [ { "day", "runCount" } ] }   // last 30 days
```

```
POST /api/usage-report
Authorization: Bearer <token>
Body: { "sessionPercent": number | null, "weeklyPercent": number | null, "spendPercent": number | null }
204 -> accepted
403 -> caller is not an active organization member

GET /api/org-usage   (director-only)
Authorization: Bearer <token>
200 -> { "snapshots": [ { "email", "sessionPercent", "weeklyPercent", "spendPercent", "updatedAt" } ] }
```

```
POST /api/qa-events      { "events": [ ... up to 50 ] }                 (any signed-in user)
  event = { "kind": "event"|"error", "name", "source": "sidepanel"|"content"|"background",
            "at": <ms since epoch>, "version", "browser", "props"?, "message"?, "stack"? }
204 -> stored (malformed events skipped; count in the X-QA-Dropped header)
400 -> body is not { events: [...] }

POST /api/qa-feedback    { "category": "bug"|"suggestion"|"other", "description",
                           "attachDiagnostics"?, "version", "browser" }  (any signed-in user)
201 -> { "id": "...", "issueUrl": "https://github.com/..." | null }
  -- attachDiagnostics attaches the caller's own last 40 events from the past 24 hours.

GET  /api/qa-dashboard?days=14                                          (Bearer QA_DASHBOARD_KEY)
200 -> { "days", "defects", "feedback", "usage", "notExercised", "testers", "daily" }
401 -> wrong key; 503 -> QA_DASHBOARD_KEY not set
```

The QA routes need a verified sign-in but not organisation membership:
QA data spans every organisation, so `qa_events` and `qa_feedback` have no
row-level security (like `rate_limits`). Every row is keyed by the
caller's verified email. `public/qa.html` is the dashboard page.
