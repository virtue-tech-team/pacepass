import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import morgan from 'morgan'

import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import authRoutes from './routes/auth.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js'
import eventRoutes from './routes/event.routes.js'
import eventRequestRoutes from './routes/event-request.routes.js'
import paymentRoutes from './routes/payment.routes.js'
import registrationRoutes from './routes/registration.routes.js'
import uploadRoutes from './routes/upload.routes.js'
import userRoutes from './routes/user.routes.js'

export const app = express()

app.set('trust proxy', env.trustProxy)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }

      if (env.corsAllowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Origem não permitida pelo CORS.'))
    },
    credentials: true,
  }),
)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

app.get('/api/health', (_req, res) => {
  const databaseState = mongoose.connection.readyState
  const databaseStatus = databaseState === 1 ? 'up' : databaseState === 2 ? 'connecting' : 'down'
  const isHealthy = databaseStatus === 'up'

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    environment: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      api: 'up',
      database: databaseStatus,
    },
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/events', eventRoutes)
app.use('/api/event-requests', eventRequestRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/registrations', registrationRoutes)
app.use('/api/uploads', uploadRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/users', userRoutes)

app.use(notFoundHandler)
app.use(errorHandler)