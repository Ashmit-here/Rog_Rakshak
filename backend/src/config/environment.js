const DEFAULT_JWT_EXPIRES_IN = '1h'
const JWT_EXPIRES_IN_PATTERN = /^\d+[smhd]?$/

function getJwtSecret() {
  const secret = process.env.JWT_SECRET

  if (!secret || !secret.trim()) {
    throw new Error('JWT_SECRET is required.')
  }
  if (Buffer.byteLength(secret) < 32) {
    throw new Error('JWT_SECRET must be at least 32 bytes long.')
  }

  return secret
}

function getJwtExpiresIn() {
  const expiresIn = process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN
  if (!JWT_EXPIRES_IN_PATTERN.test(expiresIn) || Number.parseInt(expiresIn, 10) <= 0) {
    throw new Error('JWT_EXPIRES_IN must be a positive number optionally followed by s, m, h, or d.')
  }

  return expiresIn
}

function validateEnvironment() {
  getJwtSecret()
  getJwtExpiresIn()

  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    throw new Error('DATABASE_URL is required.')
  }
}

module.exports = { getJwtSecret, getJwtExpiresIn, validateEnvironment }