import * as React from "react"

import { cn } from "@/lib/utils"

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH"

const priorityConfig: Record<
  TicketPriority,
  { label: string; className: string }
> = {
  LOW: {
    label: "Low",
    className: "bg-muted text-muted-foreground",
  },
  MEDIUM: {
    label: "Medium",
    className: "bg-status-inprogress-soft text-status-inprogress",
  },
  HIGH: {
    label: "High",
    className: "bg-status-danger-soft text-status-danger",
  },
}

type PriorityBadgeProps = React.ComponentPropsWithoutRef<"span"> & {
  priority: TicketPriority
}

function PriorityBadge({
  priority,
  className,
  ...props
}: PriorityBadgeProps) {
  const config = priorityConfig[priority]

  return (
    <span
      data-slot="priority-badge"
      data-priority={priority}
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-caption font-medium whitespace-nowrap",
        config.className,
        className,
      )}
      {...props}
    >
      {config.label}
    </span>
  )
}

export { PriorityBadge, type PriorityBadgeProps }