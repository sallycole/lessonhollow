import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PasswordInput } from '../password-input'

describe('PasswordInput', () => {
  it('renders a password input by default', () => {
    const { container } = render(<PasswordInput id="pw-test" />)
    const input = container.querySelector('input')
    expect(input).toBeTruthy()
    expect(input?.getAttribute('type')).toBe('password')
    cleanup()
  })

  it('toggles to text type when show button is clicked', () => {
    const { container } = render(<PasswordInput id="pw-test" />)
    const input = container.querySelector('input')!
    const toggle = container.querySelector('button')!

    expect(input.getAttribute('type')).toBe('password')
    expect(toggle.getAttribute('aria-label')).toBe('Show password')

    fireEvent.click(toggle)

    expect(input.getAttribute('type')).toBe('text')
    expect(toggle.getAttribute('aria-label')).toBe('Hide password')
    cleanup()
  })

  it('toggles back to password type when hide button is clicked', () => {
    const { container } = render(<PasswordInput id="pw-test" />)
    const input = container.querySelector('input')!
    const toggle = container.querySelector('button')!

    fireEvent.click(toggle)
    fireEvent.click(toggle)

    expect(input.getAttribute('type')).toBe('password')
    expect(toggle.getAttribute('aria-label')).toBe('Show password')
    cleanup()
  })

  it('has aria-pressed attribute reflecting visibility state', () => {
    const { container } = render(<PasswordInput id="pw-test" />)
    const toggle = container.querySelector('button')!

    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    cleanup()
  })

  it('passes through standard input attributes', () => {
    const { container } = render(
      <PasswordInput
        id="test-id"
        name="test-name"
        placeholder="Enter password"
        required
        minLength={8}
        autoComplete="new-password"
      />
    )
    const input = container.querySelector('input')!
    expect(input.getAttribute('id')).toBe('test-id')
    expect(input.getAttribute('name')).toBe('test-name')
    expect(input.getAttribute('placeholder')).toBe('Enter password')
    expect(input.hasAttribute('required')).toBe(true)
    expect(input.getAttribute('minLength')).toBe('8')
    expect(input.getAttribute('autoComplete')).toBe('new-password')
    cleanup()
  })

  it('toggle button is keyboard accessible', () => {
    const { container } = render(<PasswordInput id="pw-test" />)
    const toggle = container.querySelector('button')!
    expect(toggle.getAttribute('tabIndex')).toBe('0')
    expect(toggle.getAttribute('type')).toBe('button')
    cleanup()
  })
})
