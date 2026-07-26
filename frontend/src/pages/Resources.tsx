import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import { ArrowLeft, BookOpen, FileText, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategoryBadge } from '@/components/ui/category-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { authClient } from '../lib/auth-client'
import ArticleDialog from '../components/ArticleDialog'
import DeleteArticleDialog from '../components/DeleteArticleDialog'

type Category =
  | 'ACCOUNT' | 'INQUIRY' | 'PAYMENT' | 'TECHNICAL'
  | 'VOUCHER' | 'OTHER' | 'DELIVERY' | 'MENU'

type Article = {
  id: string
  title: string
  content: string
  category: Category
  createdAt: string
  updatedAt: string
}

const CATEGORY_LABELS: Record<Category, string> = {
  ACCOUNT:   'Account',
  DELIVERY:  'Delivery',
  MENU:      'Menu',
  PAYMENT:   'Payments',
  TECHNICAL: 'Technical',
  VOUCHER:   'Vouchers',
  INQUIRY:   'General Inquiries',
  OTHER:     'Other',
}

const CATEGORY_ORDER: Category[] = [
  'ACCOUNT', 'DELIVERY', 'MENU', 'PAYMENT', 'TECHNICAL', 'VOUCHER', 'INQUIRY', 'OTHER',
]

const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1:     ({ children }) => <h3 className="mb-3 mt-7 text-h3 font-semibold tracking-tight text-foreground first:mt-0">{children}</h3>,
  h2:     ({ children }) => <h3 className="mb-2 mt-6 text-h3 font-semibold tracking-tight text-foreground first:mt-0">{children}</h3>,
  h3:     ({ children }) => <h4 className="mb-2 mt-5 text-body-lg font-semibold text-foreground first:mt-0">{children}</h4>,
  p:      ({ children }) => <p className="mb-4 text-body-lg leading-7 text-foreground/80 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  ul:     ({ children }) => <ul className="mb-4 list-disc space-y-1.5 pl-5 text-body-lg leading-7 text-foreground/80 last:mb-0">{children}</ul>,
  ol:     ({ children }) => <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-body-lg leading-7 text-foreground/80 last:mb-0">{children}</ol>,
  li:     ({ children }) => <li className="pl-1 marker:text-muted-foreground">{children}</li>,
  a:      ({ href, children }) => (
    <a href={href} className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className="my-5 border-l-2 border-primary bg-primary/5 px-4 py-3 text-foreground/75">{children}</blockquote>,
  pre: ({ children }) => <pre className="my-5 overflow-x-auto rounded-lg border border-border bg-muted p-4 text-caption leading-6 text-foreground">{children}</pre>,
  code: ({ children }) => <code className="tabular rounded bg-muted px-1.5 py-0.5 text-caption text-foreground">{children}</code>,
  hr: () => <hr className="my-6 border-border" />,
}

async function fetchArticles(): Promise<Article[]> {
  const { data } = await axios.get<Article[]>('/api/articles')
  return data
}

export default function Resources() {
  const { data: session } = authClient.useSession()
  const isAdmin = (session?.user as any)?.role === 'ADMIN'

  const { data: articles = [], isPending, error, refetch } = useQuery({
    queryKey: ['articles'],
    queryFn: fetchArticles,
  })

  const [activeCategory, setActiveCategory] = useState<Category>('ACCOUNT')
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [deletingArticle, setDeletingArticle] = useState<Article | null>(null)

  const query = search.trim().toLowerCase()
  const isSearching = query.length > 0

  const searchResults = isSearching
    ? articles.filter((a) => a.title.toLowerCase().includes(query))
    : []

  const visibleArticles = articles.filter((a) => a.category === activeCategory)

  const countByCategory = articles.reduce<Partial<Record<Category, number>>>((acc, a) => {
    acc[a.category] = (acc[a.category] ?? 0) + 1
    return acc
  }, {})

  function openCreate() {
    setEditingArticle(null)
    setDialogOpen(true)
  }

  function openEdit(article: Article) {
    setEditingArticle(article)
    setSelectedArticle(null)
    setDialogOpen(true)
  }

  function selectArticle(article: Article) {
    setSelectedArticle(article)
    // Sync the sidebar category so "Back" from reader lands in the right list
    setActiveCategory(article.category)
    setSearch('')
  }

  function handleBack() {
    setSelectedArticle(null)
  }

  function ArticleCard({ article, showCategory = false }: { article: Article; showCategory?: boolean }) {
    return (
      <article className="group relative flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 shadow-e1 transition-[border-color,box-shadow,background-color] hover:border-primary/25 hover:bg-muted/20 hover:shadow-e2 motion-reduce:transition-none">
        <button
          type="button"
          onClick={() => selectArticle(article)}
          className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          aria-label={`Read ${article.title}`}
        >
          <span className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
              <FileText aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0">
              {showCategory ? <CategoryBadge category={article.category} className="mb-1.5" /> : null}
              <span className="block truncate text-body font-semibold text-foreground group-hover:text-primary">{article.title}</span>
              <span className="tabular mt-1 block text-caption text-muted-foreground">
                Updated {new Date(article.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </span>
          </span>
        </button>
        {isAdmin && (
          <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={(e) => { e.stopPropagation(); openEdit(article) }}
                aria-label={`Edit ${article.title}`}
                className="text-muted-foreground"
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={(e) => { e.stopPropagation(); setDeletingArticle(article) }}
                aria-label={`Delete ${article.title}`}
                className="text-muted-foreground hover:bg-status-danger-soft hover:text-status-danger"
              >
                <Trash2 aria-hidden="true" />
              </Button>
          </div>
        )}
      </article>
    )
  }

  function CategoryNavigation() {
    return (
      <nav aria-label="Article categories" className="flex gap-1 overflow-x-auto pb-2 lg:block lg:w-56 lg:shrink-0 lg:space-y-1 lg:overflow-visible lg:pb-0">
        {CATEGORY_ORDER.map((category) => {
          const active = activeCategory === category
          const count = countByCategory[category] ?? 0

          return (
            <button
              key={category}
              type="button"
              onClick={() => { setActiveCategory(category); setSelectedArticle(null) }}
              aria-current={active ? 'page' : undefined}
              className={`relative flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-label font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:w-full ${
                active
                  ? 'bg-primary/10 text-primary before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{CATEGORY_LABELS[category]}</span>
              {count > 0 ? (
                <span className={`tabular rounded-full px-1.5 py-0.5 text-caption ${active ? 'bg-card text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-h1 font-semibold tracking-tight text-foreground">Resources</h1>
            {!isPending && !error ? (
              <span className="tabular rounded-full bg-muted px-2.5 py-1 text-caption font-medium text-muted-foreground">
                {articles.length} {articles.length === 1 ? 'article' : 'articles'}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-body text-muted-foreground">Standard operating procedures for every support category</p>
        </div>
        {isAdmin ? (
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" />
            New Article
          </Button>
        ) : null}
      </header>

      <div className="relative mb-6 max-w-2xl">
        <label htmlFor="article-search" className="sr-only">Search articles</label>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="article-search"
          type="search"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setSelectedArticle(null) }}
          placeholder="Search articles…"
          className="pl-9 pr-9"
        />
        {search ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setSearch('')}
            aria-label="Clear article search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      {isPending ? (
        <div aria-label="Loading articles" className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <div className="flex gap-2 overflow-hidden lg:block lg:space-y-2">
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-9 w-36 shrink-0 lg:w-full" />)}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[76px] w-full rounded-xl" />)}
          </div>
        </div>
      ) : error ? (
        <ErrorState
          title="Knowledge base unavailable"
          description="Articles could not be loaded. Try the request again."
          action={<Button variant="outline" size="sm" onClick={() => void refetch()}>Try again</Button>}
        />
      ) : isSearching ? (
        <section aria-labelledby="search-results-heading" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="search-results-heading" className="text-h3 font-semibold tracking-tight text-foreground">Search results</h2>
            <span className="tabular text-caption text-muted-foreground">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
          </div>
          {searchResults.length === 0 ? (
            <EmptyState
              title={`No articles match “${search}”`}
              description="Try a shorter title or browse by category."
              icon={<Search aria-hidden="true" className="size-5" />}
            />
          ) : searchResults.map((article) => <ArticleCard key={article.id} article={article} showCategory />)}
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-7">
          <CategoryNavigation />
          <section aria-live="polite" className="min-w-0">
            {selectedArticle ? (
              <article className="rounded-xl border border-border bg-card shadow-e1">
                <header className="border-b border-border px-5 py-5 sm:px-7">
                  <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4 -ml-2 text-muted-foreground">
                    <ArrowLeft aria-hidden="true" />
                    Back
                  </Button>
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <CategoryBadge category={selectedArticle.category} className="mb-2" />
                      <h2 className="text-h2 font-semibold tracking-tight text-foreground">{selectedArticle.title}</h2>
                    </div>
                    {isAdmin ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(selectedArticle)}>
                          <Pencil aria-hidden="true" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" className="border-status-danger/25 text-status-danger hover:bg-status-danger-soft hover:text-status-danger" onClick={() => setDeletingArticle(selectedArticle)}>
                          <Trash2 aria-hidden="true" />
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </header>
                <div className="px-5 py-6 sm:px-7 sm:py-7">
                  <ReactMarkdown components={mdComponents}>{selectedArticle.content}</ReactMarkdown>
                  <p className="tabular mt-8 border-t border-border pt-4 text-caption text-muted-foreground">
                    Last updated {new Date(selectedArticle.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </article>
            ) : visibleArticles.length === 0 ? (
              <EmptyState
                title="No articles for this category yet"
                description={`Add the first ${CATEGORY_LABELS[activeCategory].toLowerCase()} procedure to the knowledge base.`}
                icon={<BookOpen aria-hidden="true" className="size-5" />}
                action={isAdmin ? <Button variant="outline" size="sm" onClick={openCreate}>Create the first one</Button> : undefined}
              />
            ) : (
              <div className="space-y-3">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <CategoryBadge category={activeCategory} />
                    <h2 className="mt-2 text-h3 font-semibold tracking-tight text-foreground">{CATEGORY_LABELS[activeCategory]}</h2>
                  </div>
                  <span className="tabular text-caption text-muted-foreground">{visibleArticles.length} article{visibleArticles.length !== 1 ? 's' : ''}</span>
                </div>
                {visibleArticles.map((article) => <ArticleCard key={article.id} article={article} />)}
              </div>
            )}
          </section>
        </div>
      )}

      <ArticleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        article={editingArticle}
        defaultCategory={activeCategory}
      />

      {deletingArticle && (
        <DeleteArticleDialog
          article={deletingArticle}
          onClose={() => setDeletingArticle(null)}
          onDeleted={() => {
            setDeletingArticle(null)
            if (selectedArticle?.id === deletingArticle.id) setSelectedArticle(null)
          }}
        />
      )}
    </div>
  )
}
