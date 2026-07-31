import type { TicketStatus } from '../ui/status-badge'
import type { TicketPriority } from '../ui/priority-badge'
import type { TicketCategory } from '../ui/category-badge'

export type OnlineAgent = {
  id: string
  name: string
  email: string
  online_status: 'ONLINE' | 'AWAY' | 'MEETING'
}

export type TicketCard = {
  id: string
  subject: string
  customer_name: string
  status: TicketStatus
  priority: TicketPriority | null
  category?: TicketCategory | null
  created_at: string
  last_updated_at: string | null
}