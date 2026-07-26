import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CircleAlert, Eye, EyeOff, ShieldCheck, UtensilsCrossed } from 'lucide-react'
import { authClient } from '../lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

export default function Login() {
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const serverErrorRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!isPending && session) {
      navigate('/', { replace: true })
    }
  }, [session, isPending, navigate])

  useEffect(() => {
    if (serverError) serverErrorRef.current?.focus()
  }, [serverError])

  const onSubmit = async (values: FormValues) => {
    setServerError('')
    const { error } = await authClient.signIn.email(values)
    if (error) {
      setServerError(error.message ?? 'Invalid credentials')
    } else {
      navigate('/', { replace: true })
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" label="Loading session" className="text-primary" />
      </div>
    )
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-8">
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(135deg,var(--background)_0%,var(--muted)_52%,var(--background)_100%)]" />
      <div aria-hidden="true" className="absolute -left-24 -top-24 size-80 rounded-full bg-primary/10 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-32 -right-24 size-96 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <Card className="relative overflow-hidden border-foreground/10 shadow-e2 before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-primary">
        <CardHeader className="pt-2">
          <div className="mb-5 flex items-center gap-3" aria-label="DailyPlate Helpdesk">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-e1">
              <UtensilsCrossed aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block text-label font-semibold tracking-tight text-foreground">DailyPlate</span>
              <span className="block text-caption text-muted-foreground">Helpdesk</span>
            </span>
          </div>
          <CardTitle>
            <h1 className="text-h2 font-semibold tracking-tight text-foreground">Welcome back</h1>
          </CardTitle>
          <CardDescription>Sign in to your internal support console.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                aria-invalid={!!errors.email || undefined}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-caption text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
                  aria-invalid={!!errors.password || undefined}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </div>
              {errors.password && (
                <p id="password-error" role="alert" className="text-caption text-destructive">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <div
                ref={serverErrorRef}
                tabIndex={-1}
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-status-danger/20 bg-status-danger-soft px-3 py-2.5 text-label text-status-danger outline-none"
              >
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting} loading={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-2 border-t border-border pt-4 text-caption text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            <span>Authorized support team members only</span>
          </div>
        </CardContent>
      </Card>
      </div>
    </main>
  )
}
