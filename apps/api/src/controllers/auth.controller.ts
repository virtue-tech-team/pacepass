import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import { User, type UserDocument } from '../models/User.js'
import {
  buildEmailVerificationUrl,
  createEmailVerificationToken,
  hashEmailVerificationToken,
} from '../services/email-verification.service.js'
import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  hashPasswordResetToken,
} from '../services/password-reset.service.js'
import { sendAccountVerificationEmail, sendPasswordResetEmail } from '../services/mail.service.js'
import { roles } from '../constants/roles.js'
import { signToken } from '../utils/jwt.js'

const registerSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  acceptedTerms: z.boolean().refine((value) => value, 'Você precisa aceitar os termos de uso para continuar.'),
  acceptedPrivacyPolicy: z.boolean().refine((value) => value, 'Você precisa aceitar a política de privacidade para continuar.'),
  acceptedLgpdConsent: z.boolean().refine((value) => value, 'Você precisa autorizar o tratamento de dados conforme a LGPD para continuar.'),
})

const loginSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('participant'),
    identifier: z.string().trim().email(),
    password: z.string().min(6),
  }),
  z.object({
    mode: z.literal('organizer'),
    identifier: z.string().trim().min(3),
    password: z.string().min(6),
  }),
])

const resendVerificationSchema = z.object({
  email: z.string().email(),
})

const forgotPasswordSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('participant'),
    identifier: z.string().trim().email(),
  }),
  z.object({
    mode: z.literal('organizer'),
    identifier: z.string().trim().min(3),
  }),
])

const verifyEmailSchema = z.object({
  token: z.string().min(12),
})

const resetPasswordSchema = z.object({
  token: z.string().min(12),
  password: z.string().min(6),
})

async function issueVerificationEmail(user: UserDocument) {
  const verification = createEmailVerificationToken()

  user.emailVerificationTokenHash = verification.tokenHash
  user.emailVerificationExpiresAt = verification.expiresAt
  await user.save()

  await sendAccountVerificationEmail(
    user.email,
    user.name,
    buildEmailVerificationUrl(verification.token),
  )
}

async function issuePasswordResetEmail(user: UserDocument) {
  const resetToken = createPasswordResetToken()

  user.passwordResetTokenHash = resetToken.tokenHash
  user.passwordResetExpiresAt = resetToken.expiresAt
  await user.save()

  await sendPasswordResetEmail(
    user.email,
    user.name,
    buildPasswordResetUrl(resetToken.token),
  )
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = registerSchema.parse(req.body)
    const existingUser = await User.findOne({ email: payload.email.toLowerCase() })

    if (existingUser) {
      res.status(409).json({ message: 'Já existe uma conta com este e-mail.' })
      return
    }

    const user = await User.create({
      ...payload,
      email: payload.email.toLowerCase(),
      phone: payload.phone || '',
      termsAcceptedAt: new Date(),
      privacyPolicyAcceptedAt: new Date(),
      lgpdConsentAcceptedAt: new Date(),
    })

    await issueVerificationEmail(user)

    res.status(201).json({
      user: user.toPublicJSON(),
      message: 'Conta criada. Verifique seu e-mail para liberar o acesso.',
    })
  } catch (error) {
    next(error)
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = loginSchema.parse(req.body)

    const user = payload.mode === 'participant'
      ? await User.findOne({ email: payload.identifier.toLowerCase() })
      : await User.findOne({
          username: payload.identifier.toLowerCase(),
          role: { $in: [roles.eventAdmin, roles.superAdmin] },
        })

    if (!user || !(await user.comparePassword(payload.password))) {
      res.status(401).json({
        message: payload.mode === 'participant' ? 'E-mail ou senha inválidos.' : 'Username ou senha inválidos.',
      })
      return
    }

    if (payload.mode === 'participant' && user.role !== roles.customer) {
      res.status(403).json({ message: 'Use o acesso de organizador para entrar com username e senha.' })
      return
    }

    if (user.role === roles.customer && !user.emailVerifiedAt) {
      res.status(403).json({ message: 'Confirme seu e-mail antes de entrar na plataforma.' })
      return
    }

    const token = signToken(user)

    res.json({
      token,
      user: user.toPublicJSON(),
    })
  } catch (error) {
    next(error)
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = verifyEmailSchema.parse(req.query)
    const tokenHash = hashEmailVerificationToken(payload.token)

    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
    })

    if (!user) {
      res.status(400).json({
        message: 'Link de confirmação inválido.',
        code: 'INVALID_VERIFICATION_LINK',
      })
      return
    }

    if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt <= new Date()) {
      res.status(400).json({
        message: 'Este link de confirmação expirou. Solicite um novo e-mail para continuar.',
        code: 'EXPIRED_VERIFICATION_LINK',
      })
      return
    }

    user.emailVerifiedAt = new Date()
    user.emailVerificationTokenHash = ''
    user.emailVerificationExpiresAt = null
    await user.save()

    const token = signToken(user)

    res.json({
      token,
      user: user.toPublicJSON(),
      message: 'E-mail confirmado com sucesso.',
    })
  } catch (error) {
    next(error)
  }
}

export async function resendVerificationEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = resendVerificationSchema.parse(req.body)
    const user = await User.findOne({ email: payload.email.toLowerCase() })

    if (user && !user.emailVerifiedAt) {
      await issueVerificationEmail(user)
    }

    res.json({
      message: 'Se existir uma conta pendente para este e-mail, um novo link de confirmacao foi enviado.',
    })
  } catch (error) {
    next(error)
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = forgotPasswordSchema.parse(req.body)
    const user = payload.mode === 'participant'
      ? await User.findOne({ email: payload.identifier.toLowerCase(), role: roles.customer })
      : await User.findOne({
          username: payload.identifier.toLowerCase(),
          role: { $in: [roles.eventAdmin, roles.superAdmin] },
        })

    if (user) {
      await issuePasswordResetEmail(user)
    }

    res.json({
      message: payload.mode === 'participant'
        ? 'Se existir uma conta para este e-mail, enviamos as instruções para redefinir a senha.'
        : 'Se existir uma conta para este username e ela tiver um e-mail cadastrado, enviamos as instruções para redefinir a senha.',
    })
  } catch (error) {
    next(error)
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = resetPasswordSchema.parse(req.body)
    const tokenHash = hashPasswordResetToken(payload.token)

    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
    })

    if (!user) {
      res.status(400).json({
        message: 'Link de redefinição inválido.',
        code: 'INVALID_PASSWORD_RESET_LINK',
      })
      return
    }

    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt <= new Date()) {
      res.status(400).json({
        message: 'Este link de redefinição expirou. Solicite um novo link para continuar.',
        code: 'EXPIRED_PASSWORD_RESET_LINK',
      })
      return
    }

    user.password = payload.password
    user.passwordResetTokenHash = ''
    user.passwordResetExpiresAt = null
    await user.save()

    res.json({
      message: 'Senha redefinida com sucesso. Voce ja pode entrar com a nova senha.',
    })
  } catch (error) {
    next(error)
  }
}

export async function me(req: Request, res: Response) {
  res.json({ user: req.user?.toPublicJSON() })
}