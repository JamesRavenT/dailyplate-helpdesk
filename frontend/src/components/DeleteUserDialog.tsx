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
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type User = {
  id: string
  name: string
}

const schema = z.object({
  adminPassword: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

type Props = {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function DeleteUserDialog({ user, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      await axios.delete(`/api/users/${user!.id}`, { data: values })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (!open) {
      reset()
      mutation.reset()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {user?.name}?</DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone. Enter your admin password to confirm.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="du-password">Admin Password</Label>
            <Input
              id="du-password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              aria-invalid={!!errors.adminPassword || undefined}
              {...register('adminPassword')}
            />
            {errors.adminPassword && (
              <p className="text-xs text-destructive">{errors.adminPassword.message}</p>
            )}
          </div>

          {mutation.isError && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {(mutation.error as AxiosError<{ error: string }>)?.response?.data?.error ?? 'Failed to delete user'}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="flex-1"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Deleting…' : 'Delete User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
