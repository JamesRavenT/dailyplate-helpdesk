import 'dotenv/config'
import { prisma } from '../src/lib/prisma.ts'

const result = await prisma.ticket.updateMany({
  where: { assigned_to_id: 'ai-system-agent', status: 'RESOLVED' },
  data: { status: 'AI_RESOLVED' },
})
console.log('Updated', result.count, 'ticket(s) to AI_RESOLVED')
await prisma.$disconnect()
