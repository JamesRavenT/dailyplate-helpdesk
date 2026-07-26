import * as React from "react"
import { Inbox } from "lucide-react"

import { cn } from "@/lib/utils"

type EmptyStateProps = React.ComponentPropsWithoutRef<"div"> & {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center",
        className,
      )}
      {...props}
    >
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon ?? <Inbox aria-hidden="true" className="size-5" />}
      </div>
      <h3 className="text-body-lg font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 max-w-sm text-body text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export { EmptyState, type EmptyStateProps }