import { type FormEvent, type ReactNode, useState } from 'react'
import { CircleAlert, KeyRound, ShieldCheck } from 'lucide-react'

import { useAccessGate } from '../context/AccessGateContext'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

const ERROR_ID = 'access-key-error'

export default function AccessGate({ children }: { children: ReactNode }) {
  const {
    phase,
    reason,
    retryAfterSeconds,
    isVerifying,
    submitKey,
  } = useAccessGate()
  const [value, setValue] = useState('')

  if (phase === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner
          size="lg"
          label="Checking access"
          className="text-primary"
        />
      </div>
    )
  }

  if (phase === 'granted') {
    return <>{children}</>
  }

  const errorMessage =
    reason === 'expired'
      ? 'This access key has expired. Please request a new one from the site owner and enter it above.'
      : reason === 'invalid'
        ? "That isn't a valid access key. Please check it and try again."
        : reason === 'unavailable'
          ? "Couldn't verify your key right now. Please try again."
          : reason === 'rate-limited'
            ? `Too many attempts. Please try again in ${retryAfterSeconds}s.`
            : reason === 'misconfigured'
              ? "The access gate isn't configured correctly. Please contact the site owner."
              : null
  const submitDisabled =
    isVerifying ||
    reason === 'misconfigured' ||
    (reason === 'rate-limited' && retryAfterSeconds > 0) ||
    value.trim().length === 0

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitKey(value)
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-8">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(135deg,var(--background)_0%,var(--muted)_52%,var(--background)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute -left-24 -top-24 size-80 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -right-24 size-96 rounded-full bg-primary/5 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-md">
        <Card className="relative overflow-hidden border-foreground/10 shadow-e2 before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-primary">
          <CardHeader className="pt-2">
            <div
              className="mb-5 flex items-center gap-3"
              aria-label="DailyPlate Helpdesk"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-e1">
                <KeyRound aria-hidden="true" className="size-5" />
              </span>
              <span>
                <span className="block text-label font-semibold tracking-tight text-foreground">
                  DailyPlate
                </span>
                <span className="block text-caption text-muted-foreground">
                  Helpdesk
                </span>
              </span>
            </div>
            <CardTitle>
              <h1 className="text-h2 font-semibold tracking-tight text-foreground">
                Access required
              </h1>
            </CardTitle>
            <CardDescription>
              Enter your access key to view this project. Don't have one? Request
              access from{' '}
              <a
                href="mailto:jraven.tabag@gmail.com"
                className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
              >
                jraven.tabag@gmail.com
              </a>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="access-key">Access key</Label>
                <Input
                  id="access-key"
                  type="text"
                  value={value}
                  onChange={event => setValue(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="characters"
                  autoFocus
                  className="uppercase font-mono tracking-widest"
                  aria-invalid={errorMessage ? true : undefined}
                  aria-describedby={errorMessage ? ERROR_ID : undefined}
                />
              </div>

              {errorMessage && (
                <div
                  id={ERROR_ID}
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-status-danger/20 bg-status-danger-soft px-3 py-2.5 text-label text-status-danger"
                >
                  <CircleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>{errorMessage}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitDisabled}
                loading={isVerifying}
              >
                {isVerifying ? 'Checking…' : errorMessage ? 'Try again' : 'Unlock'}
              </Button>
            </form>

            <div className="mt-5 flex items-center justify-center gap-2 border-t border-border pt-4 text-caption text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="size-3.5" />
              <span>Private portfolio demo</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
