import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const key = process.env.API_KEY_ENCRYPTION_KEY
  if (!key) {
    throw new Error('API_KEY_ENCRYPTION_KEY is not set')
  }
  return Buffer.from(key, 'hex')
}

/**
 * Encrypts a plaintext password using AES-256-GCM.
 * Returns a string in the format: iv:authTag:ciphertext (hex encoded)
 */
export function encryptPassword(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypts a password stored as iv:authTag:ciphertext (hex encoded).
 */
export function decryptPassword(encryptedString: string): string {
  const key = getEncryptionKey()
  const [ivHex, authTagHex, ciphertext] = encryptedString.split(':')

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
