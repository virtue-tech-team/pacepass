import { Router } from 'express'

import { createEventRequest, listEventRequests, updateEventRequestStatus } from '../controllers/event-request.controller.js'
import { roles } from '../constants/roles.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.post('/', createEventRequest)
router.get('/', authenticate, authorize(roles.superAdmin), listEventRequests)
router.patch('/:id/status', authenticate, authorize(roles.superAdmin), updateEventRequestStatus)

export default router