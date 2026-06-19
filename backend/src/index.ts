import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { router } from './routes/index.ts'

dotenv.config()

const app = express()
const port = process.env.PORT ?? 3001

app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', router)

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`)
})
