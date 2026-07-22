import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressStatusBadge } from '../progress-status-badge'
import type { ProgressStatusResult } from '@/lib/progress-status'

describe('ProgressStatusBadge', () => {
  it('renders label and icon for each known status', () => {
    const statuses: Array<{ result: ProgressStatusResult; label: string }> = [
      { result: { status: 'complete' }, label: 'Complete' },
      { result: { status: 'ahead', pctComplete: 60, pctExpected: 40 }, label: 'Ahead' },
      { result: { status: 'on_track', pctComplete: 50, pctExpected: 50 }, label: 'On track' },
      { result: { status: 'behind', pctComplete: 30, pctExpected: 50 }, label: 'Behind' },
      { result: { status: 'overdue', pctComplete: 70 }, label: 'Overdue' },
    ]

    for (const { result, label } of statuses) {
      const { container, unmount } = render(
        <ProgressStatusBadge progressStatus={result} />
      )
      // Text label is present
      expect(screen.getByText(label)).toBeTruthy()
      // An SVG icon is present alongside text (never color alone)
      const svg = container.querySelector('svg')
      expect(svg).toBeTruthy()
      unmount()
    }
  })

  it('renders nothing for no_target status', () => {
    const { container } = render(
      <ProgressStatusBadge progressStatus={{ status: 'no_target' }} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('exposes the status via a data-status attribute for distinct styling', () => {
    const cases: Array<{ result: ProgressStatusResult; status: string }> = [
      { result: { status: 'ahead', pctComplete: 60, pctExpected: 40 }, status: 'ahead' },
      { result: { status: 'behind', pctComplete: 30, pctExpected: 50 }, status: 'behind' },
      { result: { status: 'overdue', pctComplete: 70 }, status: 'overdue' },
    ]

    for (const { result, status } of cases) {
      const { container, unmount } = render(
        <ProgressStatusBadge progressStatus={result} />
      )
      const badge = container.querySelector('span')!
      expect(badge.getAttribute('data-status')).toBe(status)
      unmount()
    }
  })
})
