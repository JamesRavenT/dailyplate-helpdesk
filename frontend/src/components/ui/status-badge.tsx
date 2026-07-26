import * as React from "react"

import { cn } from "@/lib/utils"

export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED"
  | "AI_PROCESSING"
  | "AI_RESOLVED"

const statusConfig: Record<
  TicketStatus,
  { label: string; badge: string; dot: string }
> = {
  OPEN: {
    label: "Open",
    badge: "bg-status-open-soft text-status-open",
    dot: "bg-status-open",
  },
  IN_PROGRESS: {
    label: "In Progress",
    badge: "bg-status-inprogress-soft text-status-inprogress",
    dot: "bg-status-inprogress",
  },
  RESOLVED: {
    label: "Resolved",
    badge: "bg-status-resolved-soft text-status-resolved",
    dot: "bg-status-resolved",
  },
  CLOSED: {
    label: "Closed",
    badge: "bg-status-resolved-soft text-status-resolved",
    dot: "bg-status-resolved",
  },
  AI_PROCESSING: {
    label: "AI Processing",
    badge: "bg-status-ai-resolved-soft text-status-ai-resolved",
    dot: "bg-status-ai-resolved",
  },
  AI_RESOLVED: {
    label: "AI Resolved",
    badge: "bg-status-ai-resolved-soft text-status-ai-resolved",
    dot: "bg-status-ai-resolved",
  },
}

type StatusBadgeProps = React.ComponentPropsWithoutRef<"span"> & {
  status: TicketStatus
  showDot?: boolean
}

function StatusBadge({
  status,
  showDot = true,
  className,
  ...props
}: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      data-slot="status-badge"
      data-status={status}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-caption font-medium whitespace-nowrap",
        config.badge,
        className,
      )}
      {...props}
    >
      {showDot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", config.dot)}
        />
      ) : null}
      {config.label}
    </span>
  )
}

export { StatusBadge, type StatusBadgeProps }