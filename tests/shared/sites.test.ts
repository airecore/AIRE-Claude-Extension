import { describe, expect, it } from 'vitest'
import { CHAT_SITES, SITE_NAMES_TEXT, siteForUrl, siteMatchPatterns } from '../../src/shared/sites'
import { inputText, isInputEmpty } from '../../src/content/claude-adapter'

describe('siteForUrl', () => {
  it.each([
    ['https://claude.ai/new', 'claude'],
    ['https://chatgpt.com/c/123', 'chatgpt'],
    ['https://chat.openai.com/', 'chatgpt'],
    ['https://copilot.microsoft.com/', 'copilot'],
    ['https://copilot.com/chats/1', 'copilot'],
    ['https://m365.cloud.microsoft/chat', 'copilot'],
    ['https://m365.cloud.microsoft/chat/conversation/1', 'copilot'],
    ['https://gemini.google.com/app', 'gemini'],
  ])('%s is %s', (url, id) => {
    expect(siteForUrl(url)?.id).toBe(id)
  })

  it.each([
    'https://google.com/',
    'https://evil.com/?https://claude.ai/',
    'https://claude.ai.evil.com/',
    'http://claude.ai/',
    'chrome://extensions',
    // The Microsoft 365 hub's other pages (home, search, apps) aren't chat.
    'https://m365.cloud.microsoft/',
    'https://m365.cloud.microsoft/search?q=x',
    'https://m365.cloud.microsoft/chatbot-lookalike',
    'not a url',
    undefined,
  ])('%s is not a chat site', (url) => {
    expect(siteForUrl(url)).toBeNull()
  })
})

describe('site lists', () => {
  it('gives the manifest one https match pattern per host', () => {
    const hosts = CHAT_SITES.flatMap((s) => s.hosts)
    expect(siteMatchPatterns()).toEqual(hosts.map((h) => `https://${h}/*`))
  })

  it('names every site for messages', () => {
    expect(SITE_NAMES_TEXT).toBe('Claude, ChatGPT, Copilot or Gemini')
  })
})

describe('inputText', () => {
  it('reads a textarea by its value', () => {
    expect(inputText({ textContent: '', value: 'typed' })).toBe('typed')
    expect(isInputEmpty({ textContent: '', value: '  ' })).toBe(true)
  })

  it('reads a contenteditable by its text', () => {
    expect(inputText({ textContent: 'hello' })).toBe('hello')
  })
})

describe('content script copy of the site list', () => {
  it('matches the shared list exactly (ids, names, hosts)', async () => {
    const { CHAT_SITES: contentSites } = await import('../../src/content/site-inputs')
    expect(contentSites.map(({ id, name, hosts }) => ({ id, name, hosts }))).toEqual(
      CHAT_SITES.map(({ id, name, hosts }) => ({ id, name, hosts })),
    )
    for (const site of contentSites) expect(site.inputSelectors.length).toBeGreaterThan(0)
  })
})

describe('chat-only paths', () => {
  it('is the same list in the side panel and the content script', async () => {
    const shared = await import('../../src/shared/sites')
    const content = await import('../../src/content/site-inputs')
    expect(content.CHAT_ONLY_PATHS).toEqual(shared.CHAT_ONLY_PATHS)
  })

  it('only treats Copilot\'s /chat as the chat on the Microsoft 365 hub', async () => {
    const { isChatPage } = await import('../../src/content/site-inputs')
    expect(isChatPage('m365.cloud.microsoft', '/chat')).toBe(true)
    expect(isChatPage('m365.cloud.microsoft', '/')).toBe(false)
    expect(isChatPage('m365.cloud.microsoft', '/chatbot')).toBe(false)
    expect(isChatPage('claude.ai', '/anything')).toBe(true)
  })
})
