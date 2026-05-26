import { Router } from 'express'

import {
    cancelRegistrationFromSupport,
    cancelMyRegistration,
	createRegistration,
	downloadRegistrationReceipt,
	getMyRegistration,
	listMyRegistrations,
	resendRegistrationReceipt,
	searchSupportRegistrations,
} from '../controllers/registration.controller.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.get('/support/search', authenticate, authorize('event_admin', 'super_admin'), searchSupportRegistrations)
router.post('/:id/cancel', authenticate, authorize('event_admin', 'super_admin'), cancelRegistrationFromSupport)
router.post('/:id/request-cancel', authenticate, cancelMyRegistration)
router.get('/me', authenticate, listMyRegistrations)
router.get('/:id/receipt', authenticate, downloadRegistrationReceipt)
router.post('/:id/resend-receipt', authenticate, resendRegistrationReceipt)
router.get('/:id', authenticate, getMyRegistration)
router.post('/', authenticate, createRegistration)

export default router