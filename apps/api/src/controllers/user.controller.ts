import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import { roles } from '../constants/roles.js'
import { User } from '../models/User.js'

const updateProfileSchema = z.object({
  name: z.string().trim().min(3),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8),
  birthDate: z.string().trim().optional().default(''),
  gender: z.string().trim().optional().default(''),
  documentType: z.string().trim().optional().default('CPF'),
  document: z.string().trim().optional().default(''),
  zipCode: z.string().trim().min(8),
  country: z.string().trim().min(2),
  state: z.string().trim().min(2),
  city: z.string().trim().min(2),
  addressLine: z.string().trim().min(4),
  addressNumber: z.string().trim().min(1),
  currentPassword: z.string().min(6).optional().or(z.literal('')),
  newPassword: z.string().min(6).optional().or(z.literal('')),
}).superRefine((payload, context) => {
  if (payload.newPassword && !payload.currentPassword) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe a senha atual para definir uma nova senha.',
      path: ['currentPassword'],
    })
  }
})

const createEventAdminSchema = z.object({
  name: z.string().trim().min(3),
  email: z.string().trim().email(),
  username: z.string().trim().min(3).max(40).regex(/^[a-z0-9._-]+$/i, 'Use apenas letras, números, ponto, hífen ou underscore no username.'),
  password: z.string().min(6),
  phone: z.string().trim().min(8),
  platformFeePercent: z.coerce.number().min(0).max(100),
  birthDate: z.string().trim().optional().default(''),
  gender: z.string().trim().optional().default(''),
  documentType: z.string().trim().optional().default('CPF'),
  document: z.string().trim().optional().default(''),
  zipCode: z.string().trim().optional().default(''),
  country: z.string().trim().optional().default('Brasil'),
  state: z.string().trim().optional().default(''),
  city: z.string().trim().optional().default(''),
  addressLine: z.string().trim().optional().default(''),
  addressNumber: z.string().trim().optional().default(''),
})

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: Record<string, unknown> = {}

    if (typeof req.query.role === 'string' && req.query.role) {
      filters.role = req.query.role
    }

    const users = await User.find(filters).sort({ createdAt: -1 })

    res.json({
      users: users.map((user) => user.toPublicJSON()),
    })
  } catch (error) {
    next(error)
  }
}

export async function createEventAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = createEventAdminSchema.parse(req.body)
    const normalizedEmail = payload.email.toLowerCase()
    const normalizedUsername = payload.username.toLowerCase()

    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { username: normalizedUsername },
      ],
    })

    if (existingUser) {
      const message = existingUser.email === normalizedEmail
        ? 'Já existe uma conta com este e-mail.'
        : 'Este username já está em uso.'

      res.status(409).json({ message })
      return
    }

    const user = await User.create({
      ...payload,
      email: normalizedEmail,
      username: normalizedUsername,
      emailVerifiedAt: new Date(),
      role: roles.eventAdmin,
    })

    res.status(201).json({
      user: user.toPublicJSON(),
      message: 'Organizador cadastrado com sucesso.',
    })
  } catch (error) {
    next(error)
  }
}

export async function updateMyProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = updateProfileSchema.parse(req.body)

    if (!req.user) {
      res.status(401).json({ message: 'Sessão inválida ou expirada.' })
      return
    }

    const normalizedEmail = payload.email.toLowerCase()
    const emailOwner = await User.findOne({ email: normalizedEmail, _id: { $ne: req.user._id } })

    if (emailOwner) {
      res.status(409).json({ message: 'Já existe outra conta com este e-mail.' })
      return
    }

    req.user.name = payload.name
    req.user.email = normalizedEmail
    req.user.phone = payload.phone
    req.user.birthDate = payload.birthDate
    req.user.gender = payload.gender
    req.user.documentType = payload.documentType
    req.user.document = payload.document
    req.user.zipCode = payload.zipCode
    req.user.country = payload.country
    req.user.state = payload.state
    req.user.city = payload.city
    req.user.addressLine = payload.addressLine
    req.user.addressNumber = payload.addressNumber

    if (payload.newPassword) {
      const isCurrentPasswordValid = await req.user.comparePassword(payload.currentPassword || '')

      if (!isCurrentPasswordValid) {
        res.status(400).json({ message: 'A senha atual informada está incorreta.' })
        return
      }

      req.user.password = payload.newPassword
    }

    await req.user.save()

    res.json({
      user: req.user.toPublicJSON(),
      message: 'Dados atualizados com sucesso.',
    })
  } catch (error) {
    next(error)
  }
}

const updateCommercialSettingsSchema = z.object({
  platformFeePercent: z.coerce.number().min(0).max(100),
})

export async function updateUserCommercialSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = updateCommercialSettingsSchema.parse(req.body)

    const user = await User.findById(req.params.id)

    if (!user) {
      res.status(404).json({ message: 'Organizador não encontrado.' })
      return
    }

    if (user.role !== roles.eventAdmin) {
      res.status(400).json({ message: 'A taxa comercial só pode ser configurada para organizadores.' })
      return
    }

    user.platformFeePercent = payload.platformFeePercent
    await user.save()

    res.json({
      user: user.toPublicJSON(),
      message: 'Taxa comercial do organizador atualizada com sucesso.',
    })
  } catch (error) {
    next(error)
  }
}