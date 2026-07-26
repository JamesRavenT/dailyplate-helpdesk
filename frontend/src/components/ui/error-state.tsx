import * as React from "react"
import { CircleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

type ErrorStateProps = React.ComponentPropsWithoutRef<"div"> & {
  title?: string
  description: string
  action?: React.ReactNode
}

function ErrorState({
  title = "Unable to load this view",
  description,
  action,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn(
        "flex min-h-48 flex-col items-center justify-center rounded-xl border border-status-danger/20 bg-status-danger-soft px-6 py-10 text-center",
        className,
      )}
      {...props}
    >
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-card/70 text-status-danger shadow-e1">
        <CircleAlert aria-hidden="true" className="size-5" />
      </div>
      <h3 className="text-body-lg font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-1 max-w-sm text-body text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export { ErrorState, type ErrorStateProps }