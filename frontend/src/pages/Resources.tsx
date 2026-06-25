import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import { Plus, Pencil, Trash2, BookOpen, Search, X } from 'lucide-react'
import Navbar from '../components/Navbar'
import { Button } from '@/components/ui/button'
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

// Markdown renderer — shared between article reader and (future) preview
const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  p:      ({ children }) => <p className="text-sm text-slate-700 leading-relaxed mb-3 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  ul:     ({ children }) => <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1 mb-3 last:mb-0">{children}</ul>,
  ol:     ({ children }) => <ol className="text-sm text-slate-700 list-decimal pl-5 space-y-1 mb-3 last:mb-0">{children}</ol>,
  li:     ({ children }) => <li className="leading-relaxed">{children}</li>,
  a:      ({ href, children }) => (
    <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
}

async function fetchArticles(): Promise<Article[]> {
  const { data } = await axios.get<Article[]>('/api/articles')
  return data
}

export default function Resources() {
  const { data: session } = authClient.useSession()
  const isAdmin = (session?.user as any)?.role === 'ADMIN'

  const { data: articles = [], isPending, error } = useQuery({
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

  // ── Article card (shared between category list and search results) ─────────
  function ArticleCard({ article, showCategory = false }: { article: Article; showCategory?: boolean }) {
    return (
      <button
        onClick={() => selectArticle(article)}
        className="w-full text-left bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-slate-300 hover:shadow-sm transition-all group"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            {showCategory && (
              <span className="inline-block mb-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {CATEGORY_LABELS[article.category]}
              </span>
            )}
            <p className="font-medium text-gray-900 group-hover:text-slate-700 truncate">{article.title}</p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); openEdit(article) }}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDeletingArticle(article) }}
                className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Resources</h1>
            <p className="text-sm text-slate-500 mt-0.5">Standard operating procedures for every support category</p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Article
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedArticle(null) }}
            placeholder="Search articles…"
            className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder:text-slate-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isPending ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => <Skeleton key={n} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load articles.</p>
        ) : isSearching ? (
          /* ── Search results ─────────────────────────────────────────────── */
          <div className="space-y-3">
            {searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
                <Search className="h-8 w-8 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-500">No articles match "{search}"</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-400 mb-1">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</p>
                {searchResults.map((article) => (
                  <ArticleCard key={article.id} article={article} showCategory />
                ))}
              </>
            )}
          </div>
        ) : selectedArticle ? (
          /* ── Article reader ─────────────────────────────────────────────── */
          <div className="flex gap-6">
            <nav className="w-52 shrink-0 space-y-1">
              {CATEGORY_ORDER.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setSelectedArticle(null) }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    activeCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                  {(countByCategory[cat] ?? 0) > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeCategory === cat ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {countByCategory[cat]}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <h2 className="text-lg font-semibold text-gray-900">{selectedArticle.title}</h2>
                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEdit(selectedArticle)}>
                          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setDeletingArticle(selectedArticle)}>
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={handleBack}>← Back</Button>
                  </div>
                </div>
                <div className="[&>*:last-child]:mb-0">
                  <ReactMarkdown components={mdComponents}>{selectedArticle.content}</ReactMarkdown>
                </div>
                <p className="text-xs text-slate-400 mt-6 pt-4 border-t border-slate-100">
                  Last updated {new Date(selectedArticle.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* ── Category browse ────────────────────────────────────────────── */
          <div className="flex gap-6">
            <nav className="w-52 shrink-0 space-y-1">
              {CATEGORY_ORDER.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setSelectedArticle(null) }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    activeCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                  {(countByCategory[cat] ?? 0) > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeCategory === cat ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {countByCategory[cat]}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="flex-1 min-w-0">
              {visibleArticles.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
                  <BookOpen className="h-8 w-8 text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-500">No articles for this category yet</p>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" className="mt-3" onClick={openCreate}>
                      Create the first one
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleArticles.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

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
