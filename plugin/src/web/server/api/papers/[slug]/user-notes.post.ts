import fs from 'fs'
import path from 'path'
import { homedir } from 'os'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug is required' })
  }

  const body = await readBody(event)
  const { content, source } = body || {}

  if (!content || typeof content !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'content is required' })
  }

  const paperDir = path.join(homedir(), 'claude-papers/papers', slug)
  if (!fs.existsSync(paperDir)) {
    throw createError({ statusCode: 404, statusMessage: 'Paper not found' })
  }

  const notesPath = path.join(paperDir, 'user.md')

  let existing = ''
  if (fs.existsSync(notesPath)) {
    existing = fs.readFileSync(notesPath, 'utf-8')
  } else {
    existing = '# My Notes\n\n'
  }

  const timestamp = new Date().toLocaleString()
  const sourceTag = source ? ` — from \`${source}\`` : ''
  const entry = `\n---\n\n> ${content.replace(/\n/g, '\n> ')}\n\n*Added ${timestamp}${sourceTag}*\n`

  fs.writeFileSync(notesPath, existing + entry, 'utf-8')

  return { ok: true }
})
