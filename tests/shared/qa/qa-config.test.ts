import { describe, expect, it } from 'vitest'
import { QA_ENABLED, browserLabel, buildLabel } from '../../../src/shared/qa/config'

describe('QA config', () => {
  it('is disabled when not built by Vite (unit tests, any unknown build)', () => {
    expect(QA_ENABLED).toBe(false)
  })

  it('labels the build with the manifest version and build id', () => {
    expect(buildLabel('1.2.3')).toBe('1.2.3+local')
  })

  it('reduces the user agent to browser and major version', () => {
    const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.86 Safari/537.36'
    expect(browserLabel(chrome)).toBe('Chrome 131')
    expect(browserLabel(`${chrome} Edg/131.0.2903.70`)).toBe('Edge 131')
    expect(browserLabel('curl/8')).toBe('unknown')
  })
})
