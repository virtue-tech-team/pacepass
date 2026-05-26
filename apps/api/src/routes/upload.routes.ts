import { Router } from 'express'

import { createPresignedUpload } from '../controllers/upload.controller.js'
import { roles } from '../constants/roles.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.post(
  '/presign',
  authenticate,
  authorize(roles.superAdmin, roles.eventAdmin),
  createPresignedUpload,
)

export default router