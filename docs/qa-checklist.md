# Manual QA checklist

The automated tests (unit + `e2e/`) cover the extension against mocks and a
local copy of claude.ai's chat box. This pass checks the parts they cannot:
the real claude.ai page, real Clerk sign-in and the live backend. Run it in a real Chrome before handing a build to testers, and
again after any change to `src/content/`, `src/sidepanel/`, or the
manifest.

Setup: `pnpm run build` (or `node build.mjs`), load `dist/` unpacked,
open a fresh claude.ai tab.

## 1. Install / lifecycle

- [ ] Extension loads with no errors on the `chrome://extensions` card.
- [ ] Card shows ID `fhaeedmmhjjkhnopifppigddjbbmdegh`.
- [ ] Service worker console (Inspect views: service worker) is clean.
- [ ] Toolbar icon opens the side panel on a claude.ai tab.
- [ ] Icon does nothing / panel disabled on a non-claude.ai tab.
- [ ] claude.ai tab console shows `[Claude Tools] content script loaded`.
- [ ] Rebuild + reload the card → panel and content script pick up the new build.
- [ ] Header logo shows in light and dark mode; clicking it opens getaiready.now/au in a new tab with `utm_source=chrome-extension`.
- [ ] Settings → **How to use the extension** expands; **Contact AIRE**, **AI training** and **Privacy policy** open in new tabs; the footer shows the version from the manifest.

## 2. Personal buttons (no sign-in)

- [ ] **Add prompt to <tab>** opens the library; **Add** on an item puts it in that tab and shows "Added ✓"; **Back** returns to the tab.
- [ ] Library: **Show prompt** reveals the full text; a Claude-skills item (e.g. Create a Word document) produces a .docx in Claude with file creation turned on.
- [ ] Add a **Prompt** button via **Write your own prompt** → appears in the list.
- [ ] Add a **Skill** button (e.g. `/summary`) → shows the `/` badge.
- [ ] Click a prompt button → text lands in claude.ai's chat box, **nothing is sent**.
- [ ] Click a skill button → claude.ai's own `/` picker opens.
- [ ] Edit a button → change name, text, type, tab → persists.
- [ ] Delete a button → confirm dialog → row goes.
- [ ] Drag a row by its handle to reorder → order holds after reopening the panel.
- [ ] Focus a row, press Arrow Up / Arrow Down → same reorder.
- [ ] Create a second tab, move a button to it, switch tabs → button follows.
- [ ] **+ New** → type the name on the tab itself → Enter saves; Escape removes the new tab.
- [ ] Double-click a tab (or tab ⋯ → Rename tab) → rename in place; set an emoji by typing it at the start of the name.
- [ ] Tab ⋯ → Move left / Move right, Open this tab first, Delete tab; the last tab cannot be deleted.
- [ ] Reorder tabs by drag.
- [ ] "Most used" toggle sorts by personal run count.

## 3. Backup

- [ ] Settings → **Export prompts** → a `.json` file downloads with every button.
- [ ] **Import prompts** with that file → buttons are added (not duplicated away), tabs preserved.
- [ ] Import a hand-broken file (invalid JSON) → clean error, no crash, existing buttons untouched.
- [ ] Import a bare v1 array (no `type`) → entries import as Prompt into "General".

## 4. Persistence

- [ ] Reload the claude.ai tab → buttons, tabs, active tab all survive.
- [ ] Reload the extension → same.
- [ ] Restart Chrome → same.

## 5. Organisation sign-in

- [ ] Settings → **Sign in** → Clerk hosted page → pick a method (Google / GitHub / email / …).
- [ ] "Signing in…" spinner shows during the flow.
- [ ] After sign-in: "Checking organisation…" then the correct state.
- [ ] First sign-in with any new account → back in Settings as **Personal account**; no organisation screen, no join request.
- [ ] Personal buttons work as normal while signed in.
- [ ] Settings → **Create an organisation** → Cancel → still signed in, still a personal account.
- [ ] Settings → **Create an organisation** at a new **company domain** → you are admin (Manage Organisation appears).
- [ ] Second account at the **same domain** → sign-in alone gives a personal account; **Create an organisation** sends a join request → "Waiting for approval from <org>".
- [ ] A `gmail.com` / `outlook.com` account → **Create an organisation** makes its own separate org (never joins another).
- [ ] Admin invites a brand-new account → that person signs in and sees the invite → **Accept** → member.

## 6. Admin (director)

- [ ] "Manage Organisation" appears in Settings.
- [ ] A same-domain sign-in shows as **Wants to join** → **Approve** → they move to active.
- [ ] Invite someone by email → they appear as **Invited** with only **Cancel invite** (no Approve, no Make admin).
- [ ] Promote a member to admin / demote back.
- [ ] The last admin cannot be removed or demoted (button blocked / error).
- [ ] Create / rename / reorder / delete a shared tab.
- [ ] Create / edit / delete a shared prompt; assign it to a tab.
- [ ] Analytics: Prompt runs, Active members, Top prompts, Per member.
- [ ] Member usage limits section lists snapshots once members report.

## 7. Member / pending

- [ ] Approved member sees the Team section with clickable tab-chip buttons (same style as the personal tab strip) when the org has more than one shared tab; clicking one filters the prompt list to that tab.
- [ ] Running a team prompt inserts text, **never sends**.
- [ ] Settings shows "Member of <org>." + **Leave organisation**.
- [ ] Pending user sees "Waiting for approval from <org>." + **Cancel request**.
- [ ] **Leave organisation** → confirm → Team section disappears; Settings returns to signed-in-no-org.
- [ ] After leaving, signing in again → personal account.
- [ ] **Cancel request** on a pending state → same, request is withdrawn.
- [ ] Invited user sees "<admin> invited you to join <org>." with **Accept** / **Decline** (list card and Settings).
- [ ] **Accept** → Team section appears, admin's roster shows them as Member.
- [ ] **Decline** → invite gone from the admin's roster; user can set up / join another org.

## 8. Usage widget (claude.ai sidebar)

- [ ] Rings appear above the Recents list.
- [ ] Percentages roughly match claude.ai's own usage screen.
- [ ] Refresh button re-fetches.
- [ ] Widget re-appears if claude.ai re-renders its sidebar.

## 9. Sign-out

- [ ] Sign out → Team section and org state clear immediately.
- [ ] Personal buttons still work.
- [ ] Usage reporting stops (no more `POST /api/usage-report` in the network tab).

## 10. Failure handling

- [ ] Run a button with the claude.ai tab on a non-chat page → "reload the tab" message, no crash.
- [ ] Go offline, open the panel → personal buttons work; org section falls back to cache, no crash.
- [ ] Let the 14-day backend session token near expiry → next org action silently refreshes or prompts re-sign-in (no stuck spinner).

## 11. Tester QA logging (tester build only)

Needs the backend set up as in the README's
[Tester QA logging](../README.md#tester-qa-logging) section.

- [ ] Settings shows a **Tester build** section with the build label (e.g. `1.0.0+3f2a1b4`).
- [ ] Signed out: **Send feedback or report a problem** opens the form, but **Send** is disabled with a sign-in notice.
- [ ] Signed in: send a **Something broke** report with diagnostics ticked → "Thanks, your feedback was sent".
- [ ] A GitHub issue appears in the repository, with the text in a code block, recent activity attached and no email address.
- [ ] Open `https://claude-extension-xi.vercel.app/qa.html` on a phone, enter the dashboard key → the report is under **Feedback**, with your activity.
- [ ] Use a few features (run a button, add a tab) and wait a minute → they show under **Feature usage** and drop out of **Features not yet tried**.
- [ ] On a claude.ai page with no chat box (e.g. Settings), run a button → an `insert_input_not_found` defect appears under **Defects**.
- [ ] The network tab shows `POST /api/qa-events` and never any prompt text in its body.
- [ ] `pnpm run build:store` succeeds; the store zip has no **Tester build** section and sends nothing to `/api/qa-*`.
