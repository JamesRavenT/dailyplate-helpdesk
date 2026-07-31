import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from 'recharts'
import { Card, CardContent, CardHeader } from '../ui/card'
import { Skeleton } from '../ui/skeleton'

export function formatDay(iso: string) {
  const [, month, day] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`
}

export const CHART_COLORS = {
  received:         '#6366f1',
  resolved:         '#10b981',
  resolvedByAI:     '#a855f7',
  resolvedByAgents: '#0ea5e9',
}

export const ADMIN_CHART_SERIES: ChartSeries[] = [
  { key: 'Received', color: CHART_COLORS.received, gradient: 'admin-received' },
  { key: 'Resolved', color: CHART_COLORS.resolved, gradient: 'admin-resolved' },
  { key: 'Resolved by AI', color: CHART_COLORS.resolvedByAI, gradient: 'admin-ai' },
  { key: 'Resolved by Agents', color: CHART_COLORS.resolvedByAgents, gradient: 'admin-agents' },
]

export const AGENT_CHART_SERIES: ChartSeries[] = [
  { key: 'Received', color: CHART_COLORS.received, gradient: 'agent-received' },
  { key: 'Resolved / Closed', color: CHART_COLORS.resolved, gradient: 'agent-resolved' },
]

export function ChartSkeleton({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-body-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <Skeleton className="h-3 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-56 w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

export type ChartSeries = {
  key: string
  color: string
  gradient: string
}

export type ActivityChartProps = {
  title: string
  description: string
  data: Array<Record<string, string | number>>
  series: ChartSeries[]
}

export function ActivityChart({
  title,
  description,
  data,
  series,
}: ActivityChartProps) {
  const totalReceived = data.reduce((sum, point) => sum + Number(point.Received ?? 0), 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-body-lg font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mt-1 text-caption text-muted-foreground">{description}</p>
          </div>
          <p className="tabular text-caption text-muted-foreground">
            <span className="font-semibold text-foreground">{totalReceived}</span> received
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div
          role="img"
          aria-label={`${title}. ${totalReceived} tickets received across the last 30 days.`}
          className="h-60 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                {series.map(item => (
                  <linearGradient key={item.gradient} id={item.gradient} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={item.color} stopOpacity={0.16} />
                    <stop offset="95%" stopColor={item.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="2 5" stroke="var(--border)" strokeOpacity={0.75} vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'var(--font-geist-mono)' }}
                tickLine={false}
                axisLine={false}
                interval={4}
                tickMargin={10}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'var(--font-geist-mono)' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--popover)',
                  color: 'var(--popover-foreground)',
                  boxShadow: 'var(--elevation-e2)',
                  fontFamily: 'var(--font-geist-mono)',
                  fontSize: 12,
                  fontVariantNumeric: 'tabular-nums',
                }}
                labelStyle={{ color: 'var(--muted-foreground)', marginBottom: 6 }}
                cursor={{ stroke: 'var(--border)' }}
              />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12, paddingTop: 14 }} />
              {series.map(item => (
                <Area
                  key={item.key}
                  dataKey={item.key}
                  type="monotone"
                  stroke={item.color}
                  strokeWidth={2}
                  fill={`url(#${item.gradient})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
