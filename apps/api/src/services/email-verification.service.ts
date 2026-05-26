import crypto from 'crypto'

import { env } from '../config/env.js'

function getVerificationTokenExpiration() {
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + env.emailVerificationExpiresInHours)
  return expiresAt
}

export function hashEmailVerificationToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function createEmailVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex')

  return {
    token,
    tokenHash: hashEmailVerificationToken(token),
    expiresAt: getVerificationTokenExpiration(),
  }
}

export function buildEmailVerificationUrl(token: string) {
  const url = new URL('/confirmar-conta', env.clientUrl)
  url.searchParams.set('token', token)
  return url.toString()
}