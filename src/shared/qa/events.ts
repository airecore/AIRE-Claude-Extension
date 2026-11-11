// Every usage event the tester build can send. Names only -- an event's
// props must never contain prompt text, button contents, emails or
// anything from a Claude conversation.
//
// Keep in step with QA_EVENT_CATALOGUE in backend/lib/qa.ts (the QA
// dashboard lists catalogue events nobody has triggered yet);
// tests/shared/qa-events.test.ts fails if the two lists drift apart.

export const QA_EVENTS = [
  'panel_opened',
  'button_run',
  'button_sent',
  'button_created',
  'button_edited',
  'button_deleted',
  'buttons_reordered',
  'tab_created',
  'tab_renamed',
  'tab_deleted',
  'tabs_reordered',
  'default_tab_set',
  'sort_toggled',
  'settings_opened',
  'tools_exported',
  'tools_imported',
  'sign_in_started',
  'sign_in_succeeded',
  'sign_in_failed',
  'signed_out',
  'org_onboarding_submitted',
  'invite_accepted',
  'org_left',
  'manage_org_opened',
  'member_approved',
  'member_removed',
  'member_role_changed',
  'member_invited',
  'org_tab_created',
  'org_tab_renamed',
  'org_tab_deleted',
  'org_tabs_reordered',
  'org_prompt_created',
  'org_prompt_edited',
  'org_prompt_deleted',
  'team_prompt_run',
  'team_prompt_sent',
  'feedback_opened',
  'feedback_sent',
] as const

export type QaEventName = (typeof QA_EVENTS)[number]
