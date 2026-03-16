import fs from 'fs'
import path from 'path'
import { homedir } from 'os'

export default defineEventHandler(() => {
  const notesPath = path.join(homedir(), 'claude-papers/paper.md')

  if (!fs.existsSync(notesPath)) {
    return { content: '', exists: false }
  }

  const content = fs.readFileSync(notesPath, 'utf-8')
  return { content, exists: true }
})
