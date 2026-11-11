# Backlog

Things to build, in rough priority order. Move an item to "Done" with the
date when it ships. Dates are Sydney time.

## Now

- [x] In-place tab editing: new tab is named on the tab itself; rename,
      reorder, set default and delete from the tab, with no separate
      "Edit tabs" screen. (2026-11-11)
- [x] Tool library: "Add tool" opens a library of AIRE seed prompts and
      Claude skills, plus "Write your own". (2026-11-11)

## Next

### Multi-assistant support (ChatGPT, Gemini, Copilot)
- [ ] `src/shared/assistants.ts` registry (id, label, host patterns), read by
      the manifest, the service worker and the side panel.
- [ ] `src/content/adapters/`: one adapter per site with `findInput()`,
      `insert(text)`, `watchForSend()`. Move the Claude code in first,
      unchanged.
- [ ] ChatGPT adapter (`chatgpt.com`).
- [ ] Copilot adapter: Microsoft 365 Copilot (`m365.cloud.microsoft`) first,
      then consumer (`copilot.microsoft.com`).
- [ ] Gemini adapter (`gemini.google.com`).
- [ ] Verify each site's chat-box selectors on the live site; add an e2e
      test per adapter against a saved page.
- [ ] Error text names the current site ("Open Claude, ChatGPT, Gemini or
      Copilot to use this tool.").
- [ ] Skill tools show as "Claude only" (greyed out) on other sites. Keep
      the usage-rings widget Claude only.
- [ ] Library items carry an `assistant` field; the library shows the
      native skills for the assistant in the active tab (Claude skills,
      ChatGPT GPTs/tools, Gemini Gems, Copilot agents).
- [ ] Permissions: add all hosts before first public release, or use
      `optional_host_permissions` if the extension is already live.
- [ ] Rename the product when the other assistants ship (for example
      "AIRE Prompt Toolkit for Claude, ChatGPT, Gemini & Copilot").

### Microsoft Edge
- [ ] Test the MV3 build in Edge: side panel, `launchWebAuthFlow` sign-in.
- [ ] Add the Edge store extension's redirect URI
      (`https://<edge-id>.chromiumapp.org/`) to the Clerk OAuth app.
- [ ] Publish through Microsoft Partner Center: listing copy, screenshots,
      privacy URL.

### Organisation library (company admins manage seeded tools)
- [ ] Serve the library from the backend instead of the bundled file, with
      sources: AIRE (global), then the user's organisation.
- [ ] Company admins add, edit, order and retire library items for their
      organisation in Manage Organisation.
- [ ] Library items can be "recommended" (shown first) or "required"
      (added to every member's panel automatically).
- [ ] Track library adds per item and per organisation in analytics.
- [ ] Link library items and tools to training workbooks (a "Learn more"
      link per item).

### Analytics
- [ ] Add `assistant` to each `/api/prompt-run` event (new column in
      `schema.sql`); show a per-assistant breakdown in org analytics.
- [ ] Report runs of personal tools that came from the library (by library
      item id), not only shared team prompts.

### Polish
- [ ] One-line description field on personal tools (library items already
      have one).
- [ ] Regenerate store screenshots (`pnpm run store-assets`) for the new UI
      and the new name.
- [ ] Clerk production instance on the company domain (see README launch
      checklist).
