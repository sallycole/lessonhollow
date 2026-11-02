import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests for the automated browser detection logic used by GA4 visitor_type parameter.
 *
 * The actual detection runs in an inline <script>, so we test the logic here by
 * reimplementing it as a testable function.
 */

interface MockWindow {
  _phantom?: unknown
  __nightmare?: unknown
}

interface MockNavigator {
  webdriver?: boolean
  userAgent: string
}

function detectVisitorType(
  nav: MockNavigator,
  win: MockWindow = {}
): 'automated' | 'human' {
  try {
    if (nav.webdriver === true) {
      return 'automated'
    }

    const ua = nav.userAgent.toLowerCase()
    const botPatterns = [
      'headlesschrome',
      'headless',
      'bot',
      'crawler',
      'spider',
      'lighthouse',
      'pagespeed',
      'chrome-lighthouse',
      'googleother',
      'googlebot',
      'bingbot',
      'yandexbot',
      'baiduspider',
      'slurp',
      'duckduckbot',
      'facebookexternalhit',
      'twitterbot',
      'linkedinbot',
      'phantomjs',
      'prerender',
      'puppeteer',
      'selenium',
    ]

    if (botPatterns.some((pattern) => ua.includes(pattern))) {
      return 'automated'
    }

    if (win._phantom || win.__nightmare) {
      return 'automated'
    }

    return 'human'
  } catch {
    return 'human'
  }
}

describe('GA4 visitor_type detection', () => {
  describe('navigator.webdriver detection', () => {
    it('detects WebDriver/Selenium (webdriver=true)', () => {
      const nav = {
        webdriver: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      }
      expect(detectVisitorType(nav)).toBe('automated')
    })

    it('passes normal browser without webdriver flag', () => {
      const nav = {
        webdriver: false,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      }
      expect(detectVisitorType(nav)).toBe('human')
    })

    it('passes browser with undefined webdriver', () => {
      const nav = {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605.1.15',
      }
      expect(detectVisitorType(nav)).toBe('human')
    })
  })

  describe('user agent bot pattern detection', () => {
    it('detects HeadlessChrome', () => {
      const nav = {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36',
      }
      expect(detectVisitorType(nav)).toBe('automated')
    })

    it('detects Chrome-Lighthouse', () => {
      const nav = {
        userAgent: 'Mozilla/5.0 Chrome-Lighthouse',
      }
      expect(detectVisitorType(nav)).toBe('automated')
    })

    it('detects Googlebot', () => {
      const nav = {
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      }
      expect(detectVisitorType(nav)).toBe('automated')
    })

    it('detects Bingbot', () => {
      const nav = {
        userAgent: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      }
      expect(detectVisitorType(nav)).toBe('automated')
    })

    it('detects generic bot in user agent', () => {
      const nav = {
        userAgent: 'SomeCustomBot/1.0',
      }
      expect(detectVisitorType(nav)).toBe('automated')
    })

    it('detects crawler in user agent', () => {
      const nav = {
        userAgent: 'Mozilla/5.0 (compatible; AhrefsCrawler/1.0)',
      }
      expect(detectVisitorType(nav)).toBe('automated')
    })

    it('detects spider in user agent', () => {
      const nav = {
        userAgent: 'SomeSpider/1.0',
      }
      expect(detectVisitorType(nav)).toBe('automated')
    })

    it('detects Puppeteer', () => {
      const nav = {
        userAgent: 'Mozilla/5.0 Puppeteer/1.0',
      }
      expect(detectVisitorType(nav)).toBe('automated')
    })

    it('detects FacebookExternalHit', () => {
      const nav = {
        userAgent: 'facebookexternalhit/1.1',
      }
      expect(detectVisitorType(nav)).toBe('automated')
    })

    it('detects TwitterBot', () => {
      const nav = {
        userAgent: 'Twitterbot/1.0',
      }
      expect(detectVisitorType(nav)).toBe('automated')
    })

    it('passes normal Chrome browser', () => {
      const nav = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
      expect(detectVisitorType(nav)).toBe('human')
    })

    it('passes normal Firefox browser', () => {
      const nav = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
      }
      expect(detectVisitorType(nav)).toBe('human')
    })

    it('passes normal Safari browser', () => {
      const nav = {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      }
      expect(detectVisitorType(nav)).toBe('human')
    })

    it('passes mobile Chrome browser', () => {
      const nav = {
        userAgent:
          'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      }
      expect(detectVisitorType(nav)).toBe('human')
    })

    it('passes iOS Safari browser', () => {
      const nav = {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      }
      expect(detectVisitorType(nav)).toBe('human')
    })
  })

  describe('global variable detection', () => {
    it('detects PhantomJS via window._phantom', () => {
      const nav = {
        userAgent: 'Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/538.1 (KHTML, like Gecko) Safari/538.1',
      }
      expect(detectVisitorType(nav, { _phantom: {} })).toBe('automated')
    })

    it('detects Nightmare.js via window.__nightmare', () => {
      const nav = {
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Electron/1.0 Chrome/50.0.0.0 Safari/537.36',
      }
      expect(detectVisitorType(nav, { __nightmare: true })).toBe('automated')
    })
  })

  describe('edge cases', () => {
    it('returns human on detection error', () => {
      const nav = {
        get userAgent(): string {
          throw new Error('Access denied')
        },
      } as MockNavigator
      expect(detectVisitorType(nav)).toBe('human')
    })

    it('is case-insensitive for bot patterns', () => {
      const nav = {
        userAgent: 'GOOGLEBOT/2.1',
      }
      expect(detectVisitorType(nav)).toBe('automated')
    })
  })
})
