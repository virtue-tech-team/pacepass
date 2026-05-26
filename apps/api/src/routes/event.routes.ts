import { Router } from 'express'

import {
  createEvent,
  getEventById,
  getEventBySlug,
  listEvents,
  updateEvent,
  updateEventStatus,
} from '../controllers/event.controller.js'
import { roles } from '../constants/roles.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.get('/', listEvents)
router.get('/slug/:slug', getEventBySlug)
router.get('/:id', getEventById)
router.post('/', authenticate, authorize(roles.superAdmin, roles.eventAdmin), createEvent)
router.put('/:id', authenticate, authorize(roles.superAdmin, roles.eventAdmin), updateEvent)
router.patch(
  '/:id/status',
  authenticate,
  authorize(roles.superAdmin, roles.eventAdmin),
  updateEventStatus,
)

export default router