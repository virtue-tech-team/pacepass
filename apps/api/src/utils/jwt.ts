import jwt from 'jsonwebtoken'

import type { UserDocument } from '../models/User.js'
import { env } from '../config/env.js'

export function signToken(user: UserDocument) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
      name: user.name,
    },
    env.jwtSecret,
    { expiresIn: '7d' },
  )
}