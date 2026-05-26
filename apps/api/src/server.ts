import { app } from './app.js'
import { connectDatabase } from './config/db.js'
import { env } from './config/env.js'
import { seedDatabase } from './services/seed.service.js'

async function startServer() {
  try {
    await connectDatabase()

    if (env.seedDefaultUsers) {
      await seedDatabase()
    }

    app.listen(env.port, () => {
      console.log(`API online em http://localhost:${env.port}`)
    })
  } catch (error) {
    console.error('Falha ao iniciar a API', error)
    process.exit(1)
  }
}

void startServer()