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

type Category =
  | 'ACCOUNT' | 'INQUIRY' | 'PAYMENT' | 'TECHNICAL'
  | 'VOUCHER' | 'OTHER' | 'DELIVERY' | 'MENU'

type Article = {
  id: string
  title: string
  content: string
  category: Category
}

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'ACCOUNT',   label: 'Account' },
  { value: 'DELIVERY',  label: 'Delivery' },
  { value: 'MENU',      label: 'Menu' },
  { value: 'PAYMENT',   label: 'Payments' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'VOUCHER',   label: 'Vouchers' },
  { value: 'INQUIRY',   label: 'General Inquiries' },
  { value: 'OTHER',     label: 'Other' },
]

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  category: z.enum(['ACCOUNT', 'INQUIRY', 'PAYMENT', 'TECHNICAL', 'VOUCHER', 'OTHER', 'DELIVERY', 'MENU'] as [Category, ...Category[]]),
})

type FormValues = z.infer<typeof schema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  article: Article | null
  defaultCategory: Category
}

export default function ArticleDialog({ open, onOpenChange, article, defaultCategory }: Props) {
  const queryClient = useQueryClient()
  const isEditing = !!article

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: defaultCategory },
  })

  useEffect(() => {
    if (open) {
      reset(
        article
          ? { title: article.title, content: article.content, category: article.category }
          : { title: '', content: '', category: defaultCategory }
      )
    }
  }, [open, article, defaultCategory]) // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (isEditing) {
        const { data } = await axios.patch(`/api/articles/${article!.id}`, values)
        return data
      } else {
        const { data } = await axios.post('/api/articles', values)
        return data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Article' : 'New Article'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="art-category">Category</Label>
            <select
              id="art-category"
              {...register('category')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="art-title">Title</Label>
            <Input
              id="art-title"
              placeholder="e.g. Account Management — Subscriptions & Password Reset"
              aria-invalid={!!errors.title || undefined}
              {...register('title')}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="art-content">Content</Label>
            <textarea
              id="art-content"
              rows={16}
              placeholder="Write the SOP / instructions here…"
              aria-invalid={!!errors.content || undefined}
              {...register('content')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
            />
            {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
          </div>

          {mutation.isError && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {(mutation.error as AxiosError<{ error: string }>)?.response?.data?.error ?? 'Failed to save article'}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (isEditing ? 'Saving…' : 'Creating…') : (isEditing ? 'Save Changes' : 'Create Article')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
