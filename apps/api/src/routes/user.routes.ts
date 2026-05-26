import { Router } from 'express'

import { createEventAdmin, listUsers, updateMyProfile, updateUserCommercialSettings } from '../controllers/user.controller.js'
import { roles } from '../constants/roles.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.put('/me', authenticate, updateMyProfile)
router.post('/event-admins', authenticate, authorize(roles.superAdmin), createEventAdmin)
router.put('/:id/commercial-settings', authenticate, authorize(roles.superAdmin), updateUserCommercialSettings)
router.get('/', authenticate, authorize(roles.superAdmin), listUsers)

export default router