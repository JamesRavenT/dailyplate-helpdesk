import { UserRound } from 'lucide-react'
import { Skeleton } from '../ui/skeleton'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/empty-state'
import { ErrorState } from '../ui/error-state'
import type { OnlineAgent } from './types'

const agentStatusDot: Record<string, string> = {
  ONLINE:  'bg-status-resolved',
  AWAY:    'bg-status-inprogress',
  MEETING: 'bg-status-danger',
}

const agentStatusLabel: Record<string, string> = {
  ONLINE:  'Online',
  AWAY:    'Away',
  MEETING: 'Meeting',
}

export function OnlineAgents({
  agents,
  isPending,
  isError,
  onRetry,
}: {
  agents: OnlineAgent[]
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-16 w-full rounded-xl" />)}
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        className="min-h-36"
        title="Agent presence unavailable"
        description="Current agent availability could not be loaded."
        action={<Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
      />
    )
  }

  if (agents.length === 0) {
    return <EmptyState className="min-h-36" title="No agents are currently online." icon={<UserRound aria-hidden="true" className="size-5" />} />
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {agents.map(agent => (
        <div
          key={agent.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-e1"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-label font-semibold text-foreground">
            {agent.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-label font-semibold text-foreground">{agent.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-caption text-muted-foreground">
              <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${agentStatusDot[agent.online_status] ?? 'bg-muted-foreground'}`} />
              {agentStatusLabel[agent.online_status]}
            </p>
          </div>
          <span className="ml-auto hidden truncate text-caption text-muted-foreground sm:block">{agent.email}</span>
        </div>
      ))}
    </div>
  )
}
