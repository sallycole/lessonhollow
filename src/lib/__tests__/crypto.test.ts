import { describe, it, expect, beforeAll } from 'vitest'
import { encryptPassword, decryptPassword } from '../crypto'
import { randomBytes } from 'crypto'

beforeAll(() => {
  // Set a test encryption key (32 bytes = 64 hex chars)
  process.env.API_KEY_ENCRYPTION_KEY = randomBytes(32).toString('hex')
})

describe('encryptPassword / decryptPassword', () => {
  it('round-trips a simple password', () => {
    const password = 'hunter2'
    const encrypted = encryptPassword(password)
    expect(decryptPassword(encrypted)).toBe(password)
  })

  it('produces iv:authTag:ciphertext format', () => {
    const encrypted = encryptPassword('test')
    const parts = encrypted.split(':')
    expect(parts).toHaveLength(3)
    // IV = 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24)
    // Auth tag = 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32)
    // Ciphertext is non-empty hex
    expect(parts[2].length).toBeGreaterThan(0)
  })

  it('produces different ciphertexts for the same input (unique IV)', () => {
    const a = encryptPassword('same-password')
    const b = encryptPassword('same-password')
    expect(a).not.toBe(b)
    // But both decrypt to the same value
    expect(decryptPassword(a)).toBe('same-password')
    expect(decryptPassword(b)).toBe('same-password')
  })

  it('handles unicode and special characters', () => {
    const password = '🦊p@$$wörd!日本語'
    const encrypted = encryptPassword(password)
    expect(decryptPassword(encrypted)).toBe(password)
  })

  it('handles empty string', () => {
    const encrypted = encryptPassword('')
    expect(decryptPassword(encrypted)).toBe('')
  })

  it('throws on missing encryption key', () => {
    const savedKey = process.env.API_KEY_ENCRYPTION_KEY
    delete process.env.API_KEY_ENCRYPTION_KEY
    expect(() => encryptPassword('test')).toThrow('API_KEY_ENCRYPTION_KEY is not set')
    process.env.API_KEY_ENCRYPTION_KEY = savedKey
  })
})
