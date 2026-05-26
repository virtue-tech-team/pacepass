import { Router } from 'express'

import {
  getFinancialSummary,
  getDashboardSummary,
  getManagedEvents,
  getOperationsReadiness,
} from '../controllers/dashboard.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/summary', authenticate, getDashboardSummary)
router.get('/events', authenticate, getManagedEvents)
router.get('/financial-summary', authenticate, getFinancialSummary)
router.get('/operations-readiness', authenticate, getOperationsReadiness)

export default router