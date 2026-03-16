import fs from 'fs'
import path from 'path'
import { homedir } from 'os'

const WRITABLE_EXTENSIONS = new Set(['.md', '.py', '.js', '.ts', '.sh', '.txt'])

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Slug is required' })

  const body = await readBody(event)
  const { path: filePath, content } = body || {}

  if (!filePath || typeof content !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'path and content are required' })
  }

  const paperDir = path.join(homedir(), 'claude-papers/papers', slug)
  const fullPath = path.join(paperDir, filePath)

  if (!fullPath.startsWith(paperDir)) {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  const ext = path.extname(fullPath).toLowerCase()
  if (!WRITABLE_EXTENSIONS.has(ext)) {
    throw createError({ statusCode: 400, statusMessage: `File type not editable: ${ext}` })
  }

  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf-8')
  return { ok: true }
})
