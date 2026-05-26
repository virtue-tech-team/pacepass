import { Router } from 'express'

import { createPaymentIntent, handleStripeWebhook } from '../controllers/payment.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.post('/webhook', handleStripeWebhook)
router.post('/intents', authenticate, createPaymentIntent)

export default router