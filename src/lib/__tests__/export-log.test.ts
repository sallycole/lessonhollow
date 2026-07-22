import { describe, it, expect } from 'vitest'
import {
  generateActivityMarkdown,
  generatePeriodMarkdown,
  type LogActivity,
} from '../export-log'

// Build a timestamp that reads back as the given local wall-clock time,
// regardless of the machine's timezone, so assertions on formatted times hold.
function localTs(
  year: number,
  month: number,
  day: number,
  hour = 9,
  minute = 0
): string {
  return new Date(year, month - 1, day, hour, minute).toISOString()
}

const sampleTask: LogActivity = {
  title: 'Write multiplication sentences for equal groups: factors up to 5',
  description: 'Understand multiplication - 3',
  actionType: 'Do',
  resourceUrl: null,
  curriculumName: 'Understand multiplication',
  status: 'completed',
  timeSpentMinutes: 5,
  timestamp: localTs(2026, 4, 23, 9, 0),
  notes:
    'IXL · Math - 3 · Grade 3 · Accuracy 96.0% · SmartScore 100 · Mastered after 6-day span (2026-04-17 to 2026-04-23)',
}

describe('generateActivityMarkdown', () => {
  it('includes every field the UI shows', () => {
    const md = generateActivityMarkdown(sampleTask, 'Sally')
    expect(md).toContain('# Activity — Thursday, April 23, 2026')
    expect(md).toContain('Player: Sally')
    expect(md).toContain(
      '**Write multiplication sentences for equal groups: factors up to 5** — Understand multiplication'
    )
    expect(md).toContain('Do · Completed · 5m · 9:00 AM')
    expect(md).toContain('Understand multiplication - 3')
    expect(md).toContain('Notes: IXL · Math - 3 · Grade 3 · Accuracy 96.0%')
    expect(md).toContain('_Exported from Lesson Hollow_')
  })

  it('labels a spontaneous entry and omits absent fields', () => {
    const md = generateActivityMarkdown({
      title: 'Read a chapter of Charlotte’s Web',
      actionType: 'Read',
      curriculumName: null,
      status: 'completed',
      timeSpentMinutes: 20,
      timestamp: localTs(2026, 4, 23, 14, 30),
    })
    expect(md).toContain('** — Spontaneous')
    expect(md).toContain('Read · Completed · 20m · 2:30 PM')
    expect(md).not.toContain('Player:')
    expect(md).not.toContain('Notes:')
    expect(md).not.toContain('Resource:')
  })

  it('emits a resource link when present', () => {
    const md = generateActivityMarkdown({
      ...sampleTask,
      resourceUrl: 'https://ixl.com/math',
    })
    expect(md).toContain('Resource: https://ixl.com/math')
  })
})

describe('generatePeriodMarkdown', () => {
  it('renders a single-day period flat, without day sub-headings', () => {
    const md = generatePeriodMarkdown({
      scope: 'daily',
      periodLabel: 'April 23, 2026',
      items: [sampleTask, { ...sampleTask, title: 'Second activity', timeSpentMinutes: 10 }],
      playerName: 'Sally',
    })
    expect(md).toContain('# Daily Log — April 23, 2026')
    expect(md).toContain('Player: Sally · 2 activities · 15m')
    expect(md).not.toContain('### ') // no per-day heading when only one day
    expect(md).toContain('**Second activity**')
  })

  it('groups a multi-day period by day with per-day subtotals, newest first', () => {
    const md = generatePeriodMarkdown({
      scope: 'weekly',
      periodLabel: 'Apr 20 – Apr 26, 2026',
      items: [
        { ...sampleTask, title: 'Later day task', timestamp: localTs(2026, 4, 22, 10, 0), timeSpentMinutes: 30 },
        { ...sampleTask, title: 'Earlier day task', timestamp: localTs(2026, 4, 20, 8, 0), timeSpentMinutes: 15 },
      ],
      playerName: 'Sally',
    })
    expect(md).toContain('# Weekly Log — Apr 20 – Apr 26, 2026')
    expect(md).toContain('Player: Sally · 2 activities · 45m')
    // Newest first: Wednesday (Apr 22) heading appears before Monday (Apr 20)
    const mondayIdx = md.indexOf('### Monday, April 20')
    const wedIdx = md.indexOf('### Wednesday, April 22')
    expect(mondayIdx).toBeGreaterThan(-1)
    expect(wedIdx).toBeGreaterThan(-1)
    expect(wedIdx).toBeLessThan(mondayIdx)
    expect(md).toContain('### Monday, April 20 (1 activity · 15m)')
  })

  it('leads a yearly copy with curriculum and month roll-ups, then detail', () => {
    const md = generatePeriodMarkdown({
      scope: 'yearly',
      periodLabel: '2026',
      items: [
        { ...sampleTask, timeSpentMinutes: 5, timestamp: localTs(2026, 4, 23, 9, 0) },
        {
          ...sampleTask,
          title: 'Reading Eggs lesson',
          curriculumName: 'Reading Eggs',
          timeSpentMinutes: 30,
          timestamp: localTs(2026, 2, 10, 9, 0),
        },
      ],
      playerName: 'Sally',
    })
    expect(md).toContain('# Yearly Log — 2026')
    // Roll-ups appear, ranked/ordered, before the detail section.
    const byCur = md.indexOf('## By curriculum')
    const byMonth = md.indexOf('## By month')
    const detail = md.indexOf('## Activity detail')
    expect(byCur).toBeGreaterThan(-1)
    expect(byCur).toBeLessThan(byMonth)
    expect(byMonth).toBeLessThan(detail)
    // Curriculum ranked by time desc: Reading Eggs (30m) before Understand multiplication (5m)
    expect(md.indexOf('- Reading Eggs — 1 activity · 30m')).toBeLessThan(
      md.indexOf('- Understand multiplication — 1 activity · 5m')
    )
    // Months in calendar order: February before April
    expect(md.indexOf('- February 2026 — 1 activity · 30m')).toBeLessThan(
      md.indexOf('- April 2026 — 1 activity · 5m')
    )
    // Detail still present below
    expect(md.indexOf('### Thursday, April 23')).toBeGreaterThan(detail)
  })

  it('does not add roll-ups to non-yearly scopes', () => {
    const md = generatePeriodMarkdown({
      scope: 'monthly',
      periodLabel: 'April 2026',
      items: [sampleTask],
    })
    expect(md).not.toContain('## By curriculum')
    expect(md).not.toContain('## Activity detail')
  })

  it('handles an empty period gracefully', () => {
    const md = generatePeriodMarkdown({
      scope: 'monthly',
      periodLabel: 'April 2026',
      items: [],
    })
    expect(md).toContain('# Monthly Log — April 2026')
    expect(md).toContain('0 activities · 0m')
    expect(md).toContain('No activities in this period.')
  })
})
