import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/empty-state'
import { ErrorState } from '../ui/error-state'
import { StatusBadge } from '../ui/status-badge'
import { PriorityBadge, type TicketPriority } from '../ui/priority-badge'
import { CategoryBadge } from '../ui/category-badge'
import type { TicketCard } from './types'

const PAGE_SIZE = 2

const ticketRail: Record<TicketPriority, string> = {
  LOW: 'before:bg-muted-foreground/45',
  MEDIUM: 'before:bg-status-inprogress',
  HIGH: 'before:bg-status-danger',
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPrefersReducedMotion(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  return prefersReducedMotion
}

function ticketTimestamp(ticket: TicketCard) {
  const value = ticket.last_updated_at ?? ticket.created_at
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export function TicketSlideshow({
  tickets,
  isPending,
  isError = false,
  onRetry,
  emptyMessage,
}: {
  tickets: TicketCard[]
  isPending: boolean
  isError?: boolean
  onRetry?: () => void
  emptyMessage: string
}) {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE))

  useEffect(() => { setPage(0) }, [tickets.length])

  useEffect(() => {
    if (paused || prefersReducedMotion || totalPages <= 1) return
    const id = setInterval(() => {
      setPage(prev => (prev + 1) % totalPages)
    }, 4000)
    return () => clearInterval(id)
  }, [paused, prefersReducedMotion, totalPages])

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Loading tickets">
        {Array.from({ length: PAGE_SIZE }).map((_, index) => (
          <Card key={index} size="sm" className="min-h-36">
            <CardHeader className="gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-4/5" />
            </CardHeader>
            <CardContent className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        className="min-h-36"
        title="Tickets unavailable"
        description="The latest ticket queue could not be loaded."
        action={onRetry ? <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button> : undefined}
      />
    )
  }

  if (tickets.length === 0) {
    return <EmptyState className="min-h-36" title={emptyMessage} />
  }

  const safePage = page % totalPages
  const visible = tickets.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  return (
    <div
      className="flex flex-col items-center"
      aria-label="Ticket carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {visible.map(ticket => (
          <Card
            key={ticket.id}
            size="sm"
            className={`relative min-h-40 overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-1 ${ticket.priority ? ticketRail[ticket.priority] : 'before:bg-status-open'}`}
          >
            <CardHeader className="gap-3 pl-5">
              <div className="flex items-center justify-between gap-3">
                <span className="tabular truncate text-caption text-muted-foreground">
                  #{ticket.id.slice(0, 8)}
                </span>
                <StatusBadge status={ticket.status} />
              </div>
              <a
                href={`/tickets/${ticket.id}`}
                onClick={(event) => {
                  event.preventDefault()
                  navigate(`/tickets/${ticket.id}`)
                }}
                className="line-clamp-2 text-body-lg font-semibold leading-snug tracking-tight text-foreground outline-none transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                {ticket.subject}
              </a>
            </CardHeader>
            <CardContent className="mt-auto pl-5">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-label font-medium text-foreground">{ticket.customer_name}</p>
                  <p className="tabular mt-0.5 text-caption text-muted-foreground">Updated {ticketTimestamp(ticket)}</p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {ticket.category ? <CategoryBadge category={ticket.category} /> : null}
                  {ticket.priority ? (
                    <>
                      <PriorityBadge priority={ticket.priority} aria-hidden="true" />
                      <span className="sr-only">{ticket.priority} priority</span>
                    </>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2" aria-label="Ticket pages">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous ticket page"
            onClick={() => setPage(prev => (prev - 1 + totalPages) % totalPages)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to ticket page ${i + 1}`}
                aria-current={i === safePage ? 'page' : undefined}
                onClick={() => setPage(i)}
                className={`size-2 rounded-full outline-none transition-[background-color,transform] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none ${i === safePage ? 'scale-110 bg-primary' : 'bg-border hover:bg-muted-foreground/60'}`}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next ticket page"
            onClick={() => setPage(prev => (prev + 1) % totalPages)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
