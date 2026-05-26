import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

import type { Role } from '../constants/roles.js'
import { env } from '../config/env.js'
import { User } from '../models/User.js'

interface TokenPayload {
  sub: string
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authorization = req.headers.authorization || ''

    if (!authorization.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Token de acesso ausente.' })
      return
    }

    const token = authorization.replace('Bearer ', '').trim()
    const payload = jwt.verify(token, env.jwtSecret) as TokenPayload
    const user = await User.findById(payload.sub)

    if (!user) {
      res.status(401).json({ message: 'Usuário não encontrado.' })
      return
    }

    req.user = user
    next()
  } catch {
    res.status(401).json({ message: 'Sessão inválida ou expirada.' })
  }
}

export function authorize(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: 'Você não tem permissão para esta ação.' })
      return
    }

    next()
  }
}