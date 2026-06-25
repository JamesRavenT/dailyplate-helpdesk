import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { TicketCategory } from '@prisma/client'
import { prisma } from '../lib/prisma.ts'

const articleSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  content: z.string().min(10, 'Content must be at least 10 characters').max(20_000),
  category: z.nativeEnum(TicketCategory),
})

export async function listArticles(_req: Request, res: Response, next: NextFunction) {
  try {
    const articles = await prisma.article.findMany({ orderBy: [{ category: 'asc' }, { title: 'asc' }] })
    res.json(articles)
  } catch (err) { next(err) }
}

export async function getArticle(req: Request, res: Response, next: NextFunction) {
  try {
    const article = await prisma.article.findUnique({ where: { id: req.params.id } })
    if (!article) return res.status(404).json({ error: 'Article not found' })
    res.json(article)
  } catch (err) { next(err) }
}

export async function createArticle(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = articleSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
    const article = await prisma.article.create({ data: parsed.data })
    res.status(201).json(article)
  } catch (err) { next(err) }
}

export async function updateArticle(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.article.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Article not found' })
    const parsed = articleSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
    const article = await prisma.article.update({ where: { id: req.params.id }, data: parsed.data })
    res.json(article)
  } catch (err) { next(err) }
}

export async function deleteArticle(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.article.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Article not found' })
    await prisma.article.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) { next(err) }
}
