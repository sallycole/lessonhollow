import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  buildFeedbackEmailHtml,
  buildFeedbackEmailText,
} from '../notifications'

describe('escapeHtml', () => {
  it('escapes all HTML-sensitive characters', () => {
    const input = '<script>alert("xss")</script> & \'quotes\''
    const result = escapeHtml(input)
    expect(result).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;quotes&#39;'
    )
  })

  it('passes through safe strings unchanged', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123')
  })
})

describe('buildFeedbackEmailHtml', () => {
  const baseParams = {
    feedbackId: 'abc-123',
    feedbackType: 'Bug',
    title: 'Login broken',
    details: 'Cannot log in with <script>alert(1)</script>',
    userEmail: 'user@example.com',
    userId: 'user-id-12345678',
  }

  it('includes escaped title and details', () => {
    const html = buildFeedbackEmailHtml(baseParams)
    expect(html).toContain('Login broken')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('includes feedback type badge with correct color', () => {
    const html = buildFeedbackEmailHtml(baseParams)
    expect(html).toContain('#dc2626') // Bug color
    expect(html).toContain('Bug')
  })

  it('includes mailto reply link when email provided', () => {
    const html = buildFeedbackEmailHtml(baseParams)
    expect(html).toContain('mailto:user@example.com')
    expect(html).toContain('Reply to submitter')
  })

  it('omits mailto link when no email', () => {
    const html = buildFeedbackEmailHtml({ ...baseParams, userEmail: undefined })
    expect(html).not.toContain('mailto:')
    expect(html).not.toContain('Reply to submitter')
  })

  it('shows truncated userId when no email', () => {
    const html = buildFeedbackEmailHtml({ ...baseParams, userEmail: undefined })
    expect(html).toContain('User user-id-')
  })
})

describe('buildFeedbackEmailText', () => {
  const baseParams = {
    feedbackId: 'abc-123',
    feedbackType: 'Feature',
    title: 'Add dark mode',
    details: 'Would love a dark theme',
    userEmail: 'user@example.com',
    userId: 'user-id-12345678',
  }

  it('includes type and title on first line', () => {
    const text = buildFeedbackEmailText(baseParams)
    expect(text).toMatch(/^\[Feature\] Add dark mode/)
  })

  it('includes details and submitter info', () => {
    const text = buildFeedbackEmailText(baseParams)
    expect(text).toContain('Would love a dark theme')
    expect(text).toContain('From: user@example.com')
    expect(text).toContain('ID: abc-123')
  })

  it('includes mailto when email provided', () => {
    const text = buildFeedbackEmailText(baseParams)
    expect(text).toContain('Reply: mailto:user@example.com')
  })
})
