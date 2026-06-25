import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios, { type AxiosError } from 'axios'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Article = { id: string; title: string }

type Props = {
  article: Article
  onClose: () => void
  onDeleted: () => void
}

export default function DeleteArticleDialog({ article, onClose, onDeleted }: Props) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => axios.delete(`/api/articles/${article.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      onDeleted()
    },
  })

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Article</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <span className="font-medium text-gray-900">"{article.title}"</span>? This action cannot be undone.
        </p>
        {mutation.isError && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {(mutation.error as AxiosError<{ error: string }>)?.response?.data?.error ?? 'Failed to delete article'}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
