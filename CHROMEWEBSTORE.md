# Chrome Web Store Listing — AI Ready Tools Extension

> Last Updated: 2026-11-21. Everything the Chrome Developer Dashboard asks
> for, ready to copy-paste. Items marked **NEEDED** come from the company
> owner; see [Before launch](README.md#before-launch--what-is-still-needed) in the README.

## Store Listing

**Extension Name**
AI Ready Tools Extension

**Short Description** (126/132 chars — matches manifest `description`)
Saved prompts for Claude, ChatGPT, Copilot and Gemini in a sidebar, plus optional team sharing. Nothing is sent automatically.

**Detailed Description**
```
AI Ready Tools Extension puts your best AI prompts one click away in Claude, ChatGPT, Microsoft Copilot and Google Gemini. Save prompts as buttons in a sidebar next to the chat; click one and it is typed into the chat box so you can review and edit it before you press Send. The extension never sends a message for you.

YOUR PROMPT LIBRARY
Save any prompt, or a Claude skill such as /summary, as a named button.
The same prompts work in every supported AI assistant.
Sort buttons into tabs like Writing, Code or Meetings, and drag to reorder.
Sort by most used to keep favourites on top.
Export and import your buttons as a file to back them up or share them.
Your personal buttons stay in your browser. No account needed.

TEAM PROMPTS (OPTIONAL)
Sign in to share one prompt library with your organisation.
Admins publish shared prompts in tabs such as Sales and Support, and every member gets them instantly alongside their own.
Invite teammates by email. Nobody joins a team without accepting the invite, and colleagues at your company's email domain can ask to join for an admin to approve.
Admins see which shared prompts get used and each member's Claude and Gemini usage levels, to keep the library useful and spot when the team is close to its limits.

HOW TO USE IT
1. Open Claude, ChatGPT, Copilot or Gemini and click the AIRE icon in the toolbar to open the sidebar.
2. Click "Add prompt", then pick one from the library or write your own.
3. Click the prompt any time to put its text in the chat box. Review it, then send.

PRIVACY
Your own prompts never leave your browser. If you sign in for team features, your email, membership, usage percentages and shared-prompt run counts are stored so your organisation's admins can see them; leaving the organisation deletes that data. The extension never reads or stores your AI conversations. Full details in the privacy policy.
```

**Category**: Productivity (Workflow & Planning)

**Single Purpose**
Inserts the user's saved prompts into the chat box of AI assistants (Claude, ChatGPT, Copilot, Gemini) from a sidebar, with optional sharing of those prompts across an organisation.

**Primary Language**: English

## Graphics & Assets

Regenerate after UI changes with `pnpm run build && pnpm run store-assets`.

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ✅ Ready | `src/icons/icon-128.png` |
| Screenshot 1 — personal library | 1280×800 | ✅ Ready | `store-assets/1-your-prompts.png` |
| Screenshot 2 — team prompts | 1280×800 | ✅ Ready | `store-assets/2-team-prompts.png` |
| Screenshot 3 — members & invites | 1280×800 | ✅ Ready | `store-assets/3-manage-team.png` |
| Screenshot 4 — analytics | 1280×800 | ✅ Ready | `store-assets/4-analytics.png` |
| Small Promo Tile | 440×280 | ✅ Ready | `store-assets/promo-tile-440x280.png` |
| Marquee Promo Tile | 1400×560 | ⬜ Optional, not needed | |

Screenshots use the real extension UI with demo data (fictional "Northwind"
team). They show the bundled demo Alfabet font — regenerate after the
licensed font is swapped in.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `sidePanel` | permissions | The extension's whole interface is a side panel shown next to the supported AI chat sites, where users manage and click their prompt buttons. |
| `storage` | permissions | Stores the user's saved prompt buttons, tabs, sort preference and sign-in session locally in the browser so they persist between sessions. |
| `identity` | permissions | Opens the optional sign-in window (OAuth) used only for the team prompt-sharing feature. Not used unless the user clicks Sign in. |
| `scripting` | permissions | When the user clicks a prompt button in a supported chat tab that was already open before the extension was installed or updated, Chrome has not yet loaded the extension's own script into that tab. This permission lets the extension load that same script (the one its manifest already runs on those sites) so the prompt can be typed, instead of asking the user to reload the page. It only runs on the supported chat sites, after the user clicks a button. |
| `https://claude.ai/*` | host_permissions | Types the user's chosen prompt into Claude's chat box when they click a button, and shows the user's own Claude usage levels in Claude's sidebar. |
| `https://chatgpt.com/*`, `https://chat.openai.com/*` | host_permissions | Types the user's chosen prompt into ChatGPT's chat box when they click a button, and shows the user's own ChatGPT usage (uses left per feature) in ChatGPT's sidebar. |
| `https://copilot.microsoft.com/*`, `https://copilot.com/*`, `https://copilot.cloud.microsoft/*`, `https://m365.cloud.microsoft/*` | host_permissions | Types the user's chosen prompt into Microsoft Copilot's chat box (consumer and Microsoft 365) when they click a button. On `m365.cloud.microsoft`, the Microsoft 365 web hub, the side panel and typing are limited to Copilot's chat at `/chat`; the extension's script loads on the hub's other pages (Chrome can't match by path finely enough to exclude them) but finds no chat box there and does nothing. Nothing else is read or changed. |
| `https://gemini.google.com/*` | host_permissions | Types the user's chosen prompt into Gemini's chat box when they click a button, and shows the user's own Gemini usage levels (read from Gemini's Usage page) in Gemini's sidebar. |
| Backend URL (`API_BASE_URL`) | host_permissions | Our own server, used only for the optional team features: loading the organisation's shared prompts, membership, invites and admin analytics. |
| Clerk sign-in host (`CLERK_DOMAIN`) | host_permissions | Our sign-in provider's token endpoint, called once when the user signs in to exchange the sign-in code for a session. |

**Remote code**: No. All code is bundled in the package.

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes — only when the user signs in for team features.

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | Yes (email address) | Yes, when signed in | Identify the user, organisation membership, invites | Service providers only (Clerk, Vercel, Neon) |
| Health info | No | | | |
| Financial info | No | | | |
| Authentication info | Yes (sign-in session token; on ChatGPT, the user's own ChatGPT session is read in the browser) | Our session token: stored locally and sent to our server to authenticate requests. The ChatGPT session: used only in the browser to ask ChatGPT for the user's own usage, the same call ChatGPT's page makes; never stored or sent to us | Keep the user signed in; show ChatGPT usage | No |
| Personal communications | No | | | |
| Location | No (IP address used only for 1-day rate limiting) | | | |
| Web history | No | | | |
| User activity | Yes (count of shared-prompt sends; Claude and Gemini usage percentages) | Yes, when signed in and an active member | Admin analytics for the organisation | No |
| Website content | No (conversation content is never read or sent) | | | |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**: `<backend URL>/privacy.html` — served from
`backend/public/privacy.html`. Currently
https://claude-extension-xi.vercel.app/privacy.html;
update after the production backend URL is set.
Contact email in that file: hello@getaiready.now.

## Distribution

**Visibility**: Private (your Google Workspace domain only) for the internal
rollout, or Unlisted (anyone with the link). Public later if wanted.
**Regions**: All regions.

## Developer Info

**Publisher Name**: **NEEDED** (company-owned developer account)
**Contact Email**: **NEEDED** (monitored — Google sends policy notices here)
**Support URL / Email**: https://getaiready.now/au/contact / hello@getaiready.now
**Homepage URL**: https://getaiready.now/au

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-11-21 | First store release: personal prompt library for Claude, ChatGPT, Copilot and Gemini, team prompt sharing with invites, admin analytics. | Draft |

## Review Notes

### Before submitting
Follow the step-by-step list in [Before launch](README.md#before-launch--what-is-still-needed)
in the README: Clerk production instance, the two config edits, contact
email, licensed font, test-data cleanup, draft upload to get the store
extension ID, its Clerk redirect URI, then submit.

### Known Issues / Limitations
- Depends on each site's chat box staying recognisable (markers listed in
  `src/content/site-inputs.ts`); a site redesign could need an update.
- Reviewers testing team features need a sign-in; personal buttons work
  without any account.

### Rejection History
None yet.
