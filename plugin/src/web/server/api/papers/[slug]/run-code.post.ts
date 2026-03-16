import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { homedir } from 'os'

const RUNNERS: Record<string, string[]> = {
  '.py': ['python3'],
  '.js': ['node'],
  '.ts': ['npx', 'tsx'],
  '.sh': ['bash'],
}

const TIMEOUT_MS = 30_000

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug is required' })
  }

  const body = await readBody(event)
  const filePath = body?.path as string
  if (!filePath) {
    throw createError({ statusCode: 400, statusMessage: 'path is required' })
  }

  const paperDir = path.join(homedir(), 'claude-papers/papers', slug)
  const fullPath = path.join(paperDir, filePath)

  if (!fullPath.startsWith(paperDir)) {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }
  if (!fs.existsSync(fullPath)) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  const ext = path.extname(fullPath).toLowerCase()
  const runner = RUNNERS[ext]
  if (!runner) {
    throw createError({ statusCode: 400, statusMessage: `Unsupported file type: ${ext}` })
  }

  const cwd = path.dirname(fullPath)

  return new Promise((resolve) => {
    const args = [...runner, fullPath]
    const cmd = args.shift()!
    const proc = spawn(cmd, args, {
      cwd,
      timeout: TIMEOUT_MS,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    })

    let stdout = ''
    let stderr = ''
    let resolved = false

    const finish = (exitCode: number | null) => {
      if (resolved) return
      resolved = true
      const maxLen = 50_000
      resolve({
        stdout: stdout.length > maxLen ? stdout.slice(0, maxLen) + '\n... [output truncated]' : stdout,
        stderr: stderr.length > maxLen ? stderr.slice(0, maxLen) + '\n... [output truncated]' : stderr,
        exitCode: exitCode ?? 1,
      })
    }

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    // `close` fires after streams are fully flushed — preferred for data completeness
    proc.on('close', (exitCode) => finish(exitCode))

    // Fallback: if `close` somehow doesn't fire within 5s after `exit`, resolve anyway
    proc.on('exit', (exitCode) => {
      setTimeout(() => finish(exitCode), 5000)
    })

    proc.on('error', (err) => {
      if (resolved) return
      resolved = true
      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
      })
    })
  })
})
