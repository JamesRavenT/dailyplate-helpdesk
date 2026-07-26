import * as React from "react"
import { LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"

const spinnerSizes = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const

type SpinnerProps = React.ComponentPropsWithoutRef<"span"> & {
  size?: keyof typeof spinnerSizes
  label?: string
}

function Spinner({
  className,
  size = "md",
  label = "Loading",
  ...props
}: SpinnerProps) {
  return (
    <span
      data-slot="spinner"
      role={label ? "status" : undefined}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      {...props}
    >
      <LoaderCircle
        aria-hidden="true"
        className={cn("animate-spin motion-reduce:animate-none", spinnerSizes[size])}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}

export { Spinner, type SpinnerProps }