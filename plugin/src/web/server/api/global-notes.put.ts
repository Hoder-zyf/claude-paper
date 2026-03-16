import fs from 'fs'
import path from 'path'
import { homedir } from 'os'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ content: string }>(event)

  if (typeof body?.content !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'content is required' })
  }

  const notesPath = path.join(homedir(), 'claude-papers/paper.md')
  fs.mkdirSync(path.dirname(notesPath), { recursive: true })
  fs.writeFileSync(notesPath, body.content, 'utf-8')

  return { ok: true }
})
