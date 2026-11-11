# Chrome Web Store Listing — AI Ready Tools Extension

> Last Updated: 2026-11-09. Everything the Chrome Developer Dashboard asks
> for, ready to copy-paste. Items marked **NEEDED** come from the company
> owner; see [Before launch](README.md#before-launch--what-is-still-needed) in the README.

## Store Listing

**Extension Name**
AI Ready Tools Extension

**Short Description** (118/132 chars — matches manifest `description`)
Saved prompts and skills for claude.ai in a sidebar, plus optional team prompt sharing. Nothing is sent automatically.

**Detailed Description**
```
AI Ready Tools Extension puts your best Claude prompts one click away. Save prompts and skills as buttons in a sidebar next to claude.ai; click one and it is typed into Claude's chat box so you can review and edit it before you press Send. The extension never sends a message for you.

YOUR PROMPT LIBRARY
Save any prompt, or a skill such as /summary, as a named button.
Sort buttons into tabs like Writing, Code or Meetings, and drag to reorder.
Sort by most used to keep favourites on top.
Export and import your buttons as a file to back them up or share them.
Your personal buttons stay in your browser. No account needed.

TEAM PROMPTS (OPTIONAL)
Sign in to share one prompt library with your organisation.
Admins publish shared prompts in tabs such as Sales and Support, and every member gets them instantly alongside their own.
Invite teammates by email. Nobody joins a team without accepting the invite, and colleagues at your company's email domain can ask to join for an admin to approve.
Admins see which shared prompts get used and each member's claude.ai usage levels, to keep the library useful and spot when the team is close to its limits.

HOW TO USE IT
1. Open claude.ai and click the AIRE icon in the toolbar to open the sidebar.
2. Click "Add tool", give it a name and the text to insert.
3. Click the button any time to put that text in Claude's chat box. Review it, then send.

PRIVACY
Personal buttons never leave your browser. If you sign in for team features, your email, membership, usage percentages and shared-prompt run counts are stored so your organisation's admins can see them; leaving the organisation deletes that data. The extension never reads or stores your Claude conversations. Full details in the privacy policy.
```

**Category**: Productivity (Workflow & Planning)

**Single Purpose**
Inserts the user's saved prompts and skills into claude.ai's chat box from a sidebar, with optional sharing of those prompts across an organisation.

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
| `sidePanel` | permissions | The extension's whole interface is a side panel shown next to claude.ai, where users manage and click their prompt buttons. |
| `storage` | permissions | Stores the user's saved prompt buttons, tabs, sort preference and sign-in session locally in the browser so they persist between sessions. |
| `identity` | permissions | Opens the optional sign-in window (OAuth) used only for the team prompt-sharing feature. Not used unless the user clicks Sign in. |
| `https://claude.ai/*` | host_permissions | The extension's function is to type the user's chosen prompt into claude.ai's chat box when they click a button, and to show the user's own claude.ai usage levels in claude.ai's sidebar. It runs only on claude.ai. |
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
| Authentication info | Yes (sign-in session token) | Stored locally; sent to our server to authenticate requests | Keep the user signed in | No |
| Personal communications | No | | | |
| Location | No (IP address used only for 1-day rate limiting) | | | |
| Web history | No | | | |
| User activity | Yes (count of shared-prompt sends; claude.ai usage percentages) | Yes, when signed in and an active member | Admin analytics for the organisation | No |
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
| 1.0.0 | 2026-11-09 | First store release: personal prompt library, team prompt sharing with invites, admin analytics. | Draft |

## Review Notes

### Before submitting
Follow the step-by-step list in [Before launch](README.md#before-launch--what-is-still-needed)
in the README: Clerk production instance, the two config edits, contact
email, licensed font, test-data cleanup, draft upload to get the store
extension ID, its Clerk redirect URI, then submit.

### Known Issues / Limitations
- Depends on claude.ai's chat input staying recognisable
  (`[data-testid="chat-input"]`); a claude.ai redesign could need an update.
- Reviewers testing team features need a sign-in; personal buttons work
  without any account.

### Rejection History
None yet.
