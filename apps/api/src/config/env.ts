import dotenv from 'dotenv'

dotenv.config()

const nodeEnv = process.env.NODE_ENV || 'development'
const isProduction = nodeEnv === 'production'

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback
  }

  return value === 'true'
}

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback
}

function parseList(value: string | undefined, fallback: string[]) {
  const parsed = (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return parsed.length ? parsed : fallback
}

function requireEnv(name: string, options?: { allowFallback?: string }) {
  const value = process.env[name] ?? options?.allowFallback ?? ''

  if (!value) {
    throw new Error(`Variável obrigatória ausente: ${name}`)
  }

  return value
}

function parseStripePaymentMethodTypes(value: string | undefined) {
  const allowedTypes = new Set(['card', 'pix'])
  const configuredTypes = (value || 'card')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => allowedTypes.has(item))

  return configuredTypes.length > 0 ? configuredTypes : ['card']
}

export const env = {
  nodeEnv,
  isProduction,
  port: parseNumber(process.env.PORT, 4000),
  mongoUri: isProduction
    ? requireEnv('MONGO_URI')
    : (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/venda_ingressos_corrida'),
  jwtSecret: (() => {
    const value = isProduction
      ? requireEnv('JWT_SECRET')
      : (process.env.JWT_SECRET || 'dev-secret-change-me')

    if (isProduction && value === 'dev-secret-change-me') {
      throw new Error('JWT_SECRET inseguro para produção. Defina um segredo forte.')
    }

    return value
  })(),
  clientUrl: isProduction
    ? requireEnv('CLIENT_URL')
    : (process.env.CLIENT_URL || 'http://localhost:5173'),
  corsAllowedOrigins: parseList(
    process.env.CORS_ALLOWED_ORIGINS,
    [isProduction ? requireEnv('CLIENT_URL') : (process.env.CLIENT_URL || 'http://localhost:5173')],
  ),
  trustProxy: parseBoolean(process.env.TRUST_PROXY, isProduction),
  seedDefaultUsers: process.env.SEED_DEFAULT_USERS !== 'false',
  awsRegion: process.env.AWS_S3_REGION || '',
  awsBucketName: process.env.AWS_S3_BUCKET_NAME || '',
  awsAccessKeyId: process.env.AWS_S3_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY || '',
  awsPublicBaseUrl: process.env.AWS_S3_PUBLIC_BASE_URL || '',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripePaymentMethodTypes: parseStripePaymentMethodTypes(process.env.STRIPE_PAYMENT_METHOD_TYPES),
  emailProvider: process.env.EMAIL_PROVIDER || 'console',
  emailEnabled: parseBoolean(process.env.EMAIL_ENABLED, true),
  brevoApiKey: process.env.BREVO_API_KEY || '',
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS || 'no-reply@ticketflow.local',
  emailFromName: process.env.EMAIL_FROM_NAME || 'PacePass',
  emailReplyTo: process.env.EMAIL_REPLY_TO || '',
  emailVerificationExpiresInHours: parseNumber(process.env.EMAIL_VERIFICATION_EXPIRES_IN_HOURS, 24),
  passwordResetExpiresInHours: parseNumber(process.env.PASSWORD_RESET_EXPIRES_IN_HOURS, 2),
  cancellationFullRefundHoursBeforeEvent: parseNumber(process.env.CANCELLATION_FULL_REFUND_HOURS_BEFORE_EVENT, 7 * 24),
  cancellationPartialRefundHoursBeforeEvent: parseNumber(process.env.CANCELLATION_PARTIAL_REFUND_HOURS_BEFORE_EVENT, 3 * 24),
  cancellationPartialRefundPercent: parseNumber(process.env.CANCELLATION_PARTIAL_REFUND_PERCENT, 50),
  authLoginRateLimitWindowMs: parseNumber(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  authLoginRateLimitMax: parseNumber(process.env.AUTH_LOGIN_RATE_LIMIT_MAX, 8),
  authRegisterRateLimitWindowMs: parseNumber(process.env.AUTH_REGISTER_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
  authRegisterRateLimitMax: parseNumber(process.env.AUTH_REGISTER_RATE_LIMIT_MAX, 6),
}

if (env.emailEnabled && env.emailProvider === 'brevo' && !env.brevoApiKey) {
  throw new Error('BREVO_API_KEY é obrigatório quando EMAIL_PROVIDER=brevo e EMAIL_ENABLED=true.')
}