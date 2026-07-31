import type { ElementType } from 'react'
import { Card, CardContent, CardHeader } from '../ui/card'
import { Skeleton } from '../ui/skeleton'

export function shareOf(value: number, total: number) {
  if (total === 0) return 'No tickets yet'
  return `${Math.round((value / total) * 100)}% of total`
}

export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  accent,
}: {
  icon: ElementType
  label: string
  value: number
  detail: string
  tone: string
  accent: string
}) {
  return (
    <Card size="sm" className={`relative min-h-32 before:absolute before:inset-y-0 before:left-0 before:w-1 ${accent}`}>
      <CardHeader className="flex-row items-start justify-between gap-3 pl-5">
        <p className="text-caption font-medium text-muted-foreground">{label}</p>
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </CardHeader>
      <CardContent className="mt-auto pl-5">
        <p className="tabular text-[1.75rem] font-semibold leading-none tracking-[-0.04em] text-foreground">{value}</p>
        <p className="mt-2 text-caption text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

// ─── Stat skeleton row ────────────────────────────────────────────────────────

export function StatSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} size="sm" className="min-h-32">
          <CardHeader className="flex-row justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="size-8 rounded-lg" />
          </CardHeader>
          <CardContent className="mt-auto space-y-2">
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </>
  )
}
