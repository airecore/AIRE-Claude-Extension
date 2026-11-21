import { describe, expect, it } from 'vitest'
import { usageSnapshotToReportBody, parseOrgUsageResponse } from '../../src/shared/usage-report'

describe('usageSnapshotToReportBody', () => {
  it('maps Session, Weekly, and Extra usage meters to their named fields', () => {
    const snapshot = {
      meters: [
        { label: 'Session', key: 'session' as const, percent: 12, severity: 'normal', resetsAt: null, disabledReason: null },
        { label: 'Weekly', key: 'weekly' as const, percent: 25, severity: 'normal', resetsAt: null, disabledReason: null },
        { label: 'Extra usage', key: 'spend' as const, percent: 73, severity: 'normal', resetsAt: null, disabledReason: null },
      ],
    }
    expect(usageSnapshotToReportBody(snapshot)).toEqual({
      site: 'claude',
      sessionPercent: 12,
      weeklyPercent: 25,
      spendPercent: 73,
    })
  })

  it('reports null for a meter that is absent', () => {
    const snapshot = { meters: [{ label: 'Session', key: 'session' as const, percent: 12, severity: 'normal', resetsAt: null, disabledReason: null }] }
    expect(usageSnapshotToReportBody(snapshot)).toEqual({
      site: 'claude',
      sessionPercent: 12,
      weeklyPercent: null,
      spendPercent: null,
    })
  })

  it('returns all nulls for an empty meters array', () => {
    expect(usageSnapshotToReportBody({ meters: [] })).toEqual({
      site: 'claude',
      sessionPercent: null,
      weeklyPercent: null,
      spendPercent: null,
    })
  })

  it('rounds fractional percentages to integers (the DB columns are integer)', () => {
    const snapshot = {
      meters: [
        { label: 'Session', key: 'session' as const, percent: 12.4, severity: 'normal', resetsAt: null, disabledReason: null },
        { label: 'Weekly', key: 'weekly' as const, percent: 25.5, severity: 'normal', resetsAt: null, disabledReason: null },
        { label: 'Extra usage', key: 'spend' as const, percent: 73.99, severity: 'normal', resetsAt: null, disabledReason: null },
      ],
    }
    expect(usageSnapshotToReportBody(snapshot)).toEqual({
      site: 'claude',
      sessionPercent: 12,
      weeklyPercent: 26,
      spendPercent: 74,
    })
  })

  it('reports null for a non-finite percent rather than sending NaN', () => {
    const snapshot = {
      meters: [{ label: 'Session', key: 'session' as const, percent: Number.NaN, severity: 'normal', resetsAt: null, disabledReason: null }],
    }
    expect(usageSnapshotToReportBody(snapshot)).toEqual({
      site: 'claude',
      sessionPercent: null,
      weeklyPercent: null,
      spendPercent: null,
    })
  })

  it('tags the figures with the site and maps Gemini by key, not label', () => {
    const snapshot = {
      meters: [
        { label: 'Current', key: 'session' as const, percent: 40, severity: 'normal', resetsAt: null, disabledReason: null },
        { label: 'Weekly', key: 'weekly' as const, percent: 10, severity: 'normal', resetsAt: null, disabledReason: null },
      ],
    }
    expect(usageSnapshotToReportBody(snapshot, 'gemini')).toEqual({
      site: 'gemini',
      sessionPercent: 40,
      weeklyPercent: 10,
      spendPercent: null,
    })
  })

  it('ignores an unrecognized meter label', () => {
    const snapshot = {
      meters: [{ label: 'Mystery', percent: 50, severity: 'normal', resetsAt: null, disabledReason: null }],
    }
    expect(usageSnapshotToReportBody(snapshot)).toEqual({
      site: 'claude',
      sessionPercent: null,
      weeklyPercent: null,
      spendPercent: null,
    })
  })
})

describe('parseOrgUsageResponse', () => {
  it('parses a list of usage snapshots', () => {
    const raw = {
      snapshots: [
        { email: 'alice@acme.com', sessionPercent: 12, weeklyPercent: 25, spendPercent: null, updatedAt: '2026-08-19T00:00:00Z' },
      ],
    }
    expect(parseOrgUsageResponse(raw)).toEqual([
      { email: 'alice@acme.com', site: 'claude', sessionPercent: 12, weeklyPercent: 25, spendPercent: null, updatedAt: '2026-08-19T00:00:00Z' },
    ])
  })

  it('skips an entry missing email', () => {
    const raw = { snapshots: [{ sessionPercent: 12, weeklyPercent: 25, spendPercent: null, updatedAt: 'x' }] }
    expect(parseOrgUsageResponse(raw)).toEqual([])
  })

  it('returns an empty array when snapshots is missing', () => {
    expect(parseOrgUsageResponse({})).toEqual([])
  })

  it('returns an empty array for non-object input, without throwing', () => {
    expect(parseOrgUsageResponse(null)).toEqual([])
    expect(parseOrgUsageResponse('nope')).toEqual([])
  })
})
