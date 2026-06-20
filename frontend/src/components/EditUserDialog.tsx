import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios, { type AxiosError } from 'axios'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type User = {
  id: string
  name: string
  email: string
}

const schema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().refine(
    (val) => val === '' || val.length >= 8,
    { message: 'Password must be at least 8 characters' }
  ),
})

type FormValues = z.infer<typeof schema>

type Props = {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function EditUserDialog({ user, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (open && user) {
      reset({ name: user.name, email: user.email, password: '' })
    }
  }, [open, user, reset])

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data } = await axios.patch(`/api/users/${user!.id}`, values)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (!open) mutation.reset()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="eu-name">Name</Label>
            <Input
              id="eu-name"
              type="text"
              aria-invalid={!!errors.name || undefined}
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="eu-email">Email</Label>
            <Input
              id="eu-email"
              type="email"
              autoComplete="off"
              aria-invalid={!!errors.email || undefined}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="eu-password">Password</Label>
            <Input
              id="eu-password"
              type="password"
              placeholder="Leave blank to keep current password"
              autoComplete="new-password"
              aria-invalid={!!errors.password || undefined}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {mutation.isError && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {(mutation.error as AxiosError<{ error: string }>)?.response?.data?.error ?? 'Failed to update user'}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
