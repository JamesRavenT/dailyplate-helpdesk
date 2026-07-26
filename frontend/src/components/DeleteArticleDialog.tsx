import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios, { type AxiosError } from 'axios'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Article</DialogTitle>
          <DialogDescription>This action permanently removes the article from the knowledge base.</DialogDescription>
        </DialogHeader>
        <p className="text-body leading-6 text-muted-foreground">
          Are you sure you want to delete <span className="font-semibold text-foreground">“{article.title}”</span>? This action cannot be undone.
        </p>
        {mutation.isError && (
          <p role="alert" className="rounded-lg border border-status-danger/20 bg-status-danger-soft px-3 py-2 text-label text-status-danger">
            {(mutation.error as AxiosError<{ error: string }>)?.response?.data?.error ?? 'Failed to delete article'}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending} loading={mutation.isPending}>
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
