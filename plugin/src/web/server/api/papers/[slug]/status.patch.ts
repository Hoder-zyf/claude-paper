import fs from 'fs'
import path from 'path'
import { homedir } from 'os'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Slug is required' })

  const body = await readBody<{ read?: boolean; starred?: boolean }>(event)
  if (body.read === undefined && body.starred === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'read or starred required' })
  }

  const papersDir = path.join(homedir(), 'claude-papers/papers')
  const paperDir = path.join(papersDir, slug)
  const metaPath = path.join(paperDir, 'meta.json')
  const indexPath = path.join(homedir(), 'claude-papers/index.json')

  if (!fs.existsSync(paperDir)) {
    throw createError({ statusCode: 404, statusMessage: 'Paper not found' })
  }

  // Update meta.json
  let meta: Record<string, any> = {}
  if (fs.existsSync(metaPath)) {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  }
  if (body.read !== undefined) meta.read = body.read
  if (body.starred !== undefined) meta.starred = body.starred
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

  // Update index.json
  if (fs.existsSync(indexPath)) {
    const raw = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
    const papers = Array.isArray(raw) ? raw : (raw.papers || [])
    const paper = papers.find((p: any) => p.slug === slug || p.id === slug)
    if (paper) {
      if (body.read !== undefined) paper.read = body.read
      if (body.starred !== undefined) paper.starred = body.starred
      fs.writeFileSync(indexPath, JSON.stringify(raw, null, 2))
    }
  }

  return { ok: true }
})
