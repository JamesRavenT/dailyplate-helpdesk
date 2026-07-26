import * as React from "react"

import { cn } from "@/lib/utils"

export type TicketCategory =
  | "ACCOUNT"
  | "INQUIRY"
  | "PAYMENT"
  | "TECHNICAL"
  | "VOUCHER"
  | "OTHER"
  | "DELIVERY"
  | "MENU"

const categoryConfig: Record<
  TicketCategory,
  { label: string; className: string }
> = {
  ACCOUNT: {
    label: "Account",
    className: "bg-status-ai-resolved-soft text-status-ai-resolved",
  },
  INQUIRY: {
    label: "Inquiry",
    className: "bg-status-open-soft text-status-open",
  },
  PAYMENT: {
    label: "Payments",
    className: "bg-status-inprogress-soft text-status-inprogress",
  },
  TECHNICAL: {
    label: "Technical",
    className: "bg-status-open-soft text-status-open",
  },
  VOUCHER: {
    label: "Voucher",
    className: "bg-status-ai-resolved-soft text-status-ai-resolved",
  },
  OTHER: {
    label: "Others",
    className: "bg-muted text-muted-foreground",
  },
  DELIVERY: {
    label: "Delivery",
    className: "bg-status-resolved-soft text-status-resolved",
  },
  MENU: {
    label: "Menu",
    className: "bg-status-inprogress-soft text-status-inprogress",
  },
}

type CategoryBadgeProps = React.ComponentPropsWithoutRef<"span"> & {
  category: TicketCategory
}

function CategoryBadge({
  category,
  className,
  ...props
}: CategoryBadgeProps) {
  const config = categoryConfig[category]

  return (
    <span
      data-slot="category-badge"
      data-category={category}
      className={cn(
        "inline-flex w-fit items-center rounded-md px-2 py-0.5 text-caption font-medium whitespace-nowrap",
        config.className,
        className,
      )}
      {...props}
    >
      {config.label}
    </span>
  )
}

export { CategoryBadge, type CategoryBadgeProps }