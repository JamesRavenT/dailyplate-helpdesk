import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-label font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-e1 hover:bg-primary/90",
        primary: "bg-primary text-primary-foreground shadow-e1 hover:bg-primary/90",
        secondary:
          "border-border bg-secondary text-secondary-foreground shadow-e1 hover:bg-secondary/75",
        outline:
          "border-border bg-card text-foreground shadow-e1 hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        ghost:
          "bg-transparent text-foreground hover:bg-muted aria-expanded:bg-muted",
        destructive:
          "bg-destructive text-destructive-foreground shadow-e1 hover:bg-destructive/90 focus-visible:ring-destructive",
        link: "h-auto rounded-none p-0 text-primary underline-offset-4 shadow-none hover:underline focus-visible:ring-offset-1",
      },
      size: {
        default: "h-9 gap-2 px-3.5",
        md: "h-9 gap-2 px-3.5",
        xs: "h-7 gap-1.5 rounded-md px-2 text-caption [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 text-caption [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-4 text-body",
        icon: "size-9",
        "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean
  }

const Button = React.forwardRef<HTMLElement, ButtonProps>(function Button(
  {
    className,
    variant = "default",
    size = "default",
    loading = false,
    disabled,
    nativeButton = true,
    render,
    focusableWhenDisabled,
    type = "button",
    children,
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading
  const content = (
    <>
      {loading ? <Spinner size="sm" label="" aria-hidden="true" /> : null}
      {children}
    </>
  )
  const sharedProps = {
    "data-slot": "button",
    "aria-busy": loading || undefined,
    disabled: isDisabled,
    className: cn(buttonVariants({ variant, size, className })),
  }

  // Base UI's render path is retained for callers that explicitly need a
  // polymorphic button. Ordinary actions use a native button so `disabled`
  // remains a real, non-focusable, non-interactive HTML state.
  if (render || nativeButton === false) {
    return (
      <ButtonPrimitive
        ref={ref}
        render={render}
        nativeButton={nativeButton}
        focusableWhenDisabled={focusableWhenDisabled}
        type={type}
        {...sharedProps}
        {...props}
      >
        {content}
      </ButtonPrimitive>
    )
  }

  return (
    <button
      ref={ref as React.ForwardedRef<HTMLButtonElement>}
      type={type}
      {...sharedProps}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {content}
    </button>
  )
})

export { Button, buttonVariants, type ButtonProps }
