import crypto from 'crypto'

import { env } from '../config/env.js'

function getPasswordResetExpiration() {
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + env.passwordResetExpiresInHours)
  return expiresAt
}

export function hashPasswordResetToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function createPasswordResetToken() {
  const token = crypto.randomBytes(32).toString('hex')

  return {
    token,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: getPasswordResetExpiration(),
  }
}

export function buildPasswordResetUrl(token: string) {
  const url = new URL('/redefinir-senha', env.clientUrl)
  url.searchParams.set('token', token)
  return url.toString()
}