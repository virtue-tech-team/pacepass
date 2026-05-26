import { Router } from 'express'

import {
	forgotPassword,
	login,
	me,
	register,
	resendVerificationEmail,
	resetPassword,
	verifyEmail,
} from '../controllers/auth.controller.js'
import { env } from '../config/env.js'
import { authenticate } from '../middleware/auth.js'
import { createRateLimit } from '../middleware/rate-limit.js'

const router = Router()

const loginRateLimit = createRateLimit({
	windowMs: env.authLoginRateLimitWindowMs,
	maxRequests: env.authLoginRateLimitMax,
	keyPrefix: 'auth-login',
	message: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
	code: 'AUTH_LOGIN_RATE_LIMITED',
})

const registerRateLimit = createRateLimit({
	windowMs: env.authRegisterRateLimitWindowMs,
	maxRequests: env.authRegisterRateLimitMax,
	keyPrefix: 'auth-register',
	message: 'Muitas tentativas de cadastro. Aguarde um pouco antes de tentar novamente.',
	code: 'AUTH_REGISTER_RATE_LIMITED',
})

router.post('/register', registerRateLimit, register)
router.post('/login', loginRateLimit, login)
router.post('/resend-verification-email', resendVerificationEmail)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.get('/verify-email', verifyEmail)
router.get('/me', authenticate, me)

export default router