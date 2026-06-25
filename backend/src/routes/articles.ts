import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.ts'
import { listArticles, getArticle, createArticle, updateArticle, deleteArticle } from '../controllers/articles.ts'

export const articlesRouter = Router()

articlesRouter.get('/', requireAuth, listArticles)
articlesRouter.get('/:id', requireAuth, getArticle)
articlesRouter.post('/', requireAdmin, createArticle)
articlesRouter.patch('/:id', requireAdmin, updateArticle)
articlesRouter.delete('/:id', requireAdmin, deleteArticle)
