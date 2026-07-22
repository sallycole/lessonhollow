import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PicoFooter } from '../chrome/pico-footer'

describe('Semantic HTML', () => {
  describe('PicoFooter', () => {
    it('uses footer landmark element', () => {
      const { container } = render(<PicoFooter />)
      expect(container.querySelector('footer')).toBeTruthy()
    })

    it('wraps links in nav with aria-label', () => {
      const { container } = render(<PicoFooter />)
      const nav = container.querySelector('nav')
      expect(nav).toBeTruthy()
      expect(nav?.getAttribute('aria-label')).toBe('Footer navigation')
    })

    it('contains at least one interactive element in nav', () => {
      const { container } = render(<PicoFooter />)
      const nav = container.querySelector('nav')!
      const interactive = nav.querySelectorAll('a, button')
      expect(interactive.length).toBeGreaterThanOrEqual(1)
    })
  })
})
