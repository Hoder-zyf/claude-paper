import fs from 'fs'
import path from 'path'
import { homedir } from 'os'

interface PaperEntry {
  id: string
  slug: string
  title: string
  authors: string[]
  tags: string[]
  abstract?: string
}

interface GraphNode {
  id: string
  title: string
  tags: string[]
  authors: string[]
}

interface GraphEdge {
  source: string
  target: string
  type: 'shared-tag' | 'shared-author' | 'related-idea'
  label: string
  weight?: number
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'only',
  'own', 'same', 'than', 'too', 'very', 'just', 'because', 'if', 'when',
  'where', 'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him',
  'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'all',
  'also', 'about', 'up', 'down', 'here', 'there', 'while', 'using',
  'based', 'show', 'shows', 'shown', 'use', 'uses', 'used', 'paper',
  'propose', 'proposed', 'approach', 'method', 'results', 'model',
  'however', 'although', 'thus', 'therefore', 'et', 'al', 'fig',
  'table', 'section', 'figure', 'eq', 'equation', 'where', 'given',
  'well', 'two', 'one', 'three', 'new', 'first', 'second',
])

function extractKeywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))

  // Also extract bigrams for compound concepts
  const bigrams: string[] = []
  for (let i = 0; i < words.length - 1; i++) {
    if (!STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i + 1])) {
      bigrams.push(words[i] + '_' + words[i + 1])
    }
  }

  return new Set([...words, ...bigrams])
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const w of a) {
    if (b.has(w)) intersection++
  }
  return intersection / (a.size + b.size - intersection)
}

function getTopSharedKeywords(a: Set<string>, b: Set<string>, limit = 3): string[] {
  const shared: string[] = []
  for (const w of a) {
    if (b.has(w) && !w.includes('_')) shared.push(w)
  }
  return shared
    .sort((x, y) => y.length - x.length)
    .slice(0, limit)
}

export default defineEventHandler(() => {
  const indexPath = path.join(homedir(), 'claude-papers/index.json')
  if (!fs.existsSync(indexPath)) {
    return { nodes: [], edges: [] }
  }

  const raw = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
  const papers: PaperEntry[] = Array.isArray(raw) ? raw : (raw.papers || [])

  if (papers.length === 0) {
    return { nodes: [], edges: [] }
  }

  const papersDir = path.join(homedir(), 'claude-papers/papers')

  // Build keyword sets per paper from abstract + summary.md
  const paperKeywords = new Map<string, Set<string>>()
  for (const p of papers) {
    const id = p.slug || p.id
    let text = p.abstract || ''

    const summaryPath = path.join(papersDir, id, 'summary.md')
    if (fs.existsSync(summaryPath)) {
      try {
        text += ' ' + fs.readFileSync(summaryPath, 'utf-8')
      } catch { /* skip */ }
    }

    // Also read method.md for technical keyword coverage
    const methodPath = path.join(papersDir, id, 'method.md')
    if (fs.existsSync(methodPath)) {
      try {
        text += ' ' + fs.readFileSync(methodPath, 'utf-8')
      } catch { /* skip */ }
    }

    paperKeywords.set(id, extractKeywords(text))
  }

  const nodes: GraphNode[] = papers.map(p => ({
    id: p.slug || p.id,
    title: p.title || p.slug || p.id,
    tags: p.tags || [],
    authors: p.authors || [],
  }))

  const edges: GraphEdge[] = []
  const seen = new Set<string>()

  const IDEA_SIMILARITY_THRESHOLD = 0.08

  for (let i = 0; i < papers.length; i++) {
    for (let j = i + 1; j < papers.length; j++) {
      const a = papers[i]
      const b = papers[j]
      const aId = a.slug || a.id
      const bId = b.slug || b.id
      const edgeKey = [aId, bId].sort().join('::')

      // Shared tags
      const sharedTags = (a.tags || []).filter(t => (b.tags || []).includes(t))
      if (sharedTags.length > 0 && !seen.has(edgeKey + '::tag')) {
        seen.add(edgeKey + '::tag')
        edges.push({
          source: aId,
          target: bId,
          type: 'shared-tag',
          label: sharedTags.join(', '),
        })
      }

      // Shared authors
      const normalizeAuthor = (name: string) => name.toLowerCase().replace(/[^a-z\s]/g, '').trim()
      const aAuthors = (a.authors || []).map(normalizeAuthor)
      const bAuthors = (b.authors || []).map(normalizeAuthor)
      const sharedAuthors = aAuthors.filter(au => bAuthors.includes(au))
      if (sharedAuthors.length > 0 && !seen.has(edgeKey + '::author')) {
        seen.add(edgeKey + '::author')
        edges.push({
          source: aId,
          target: bId,
          type: 'shared-author',
          label: sharedAuthors.join(', '),
        })
      }

      // Content/idea similarity
      const kwA = paperKeywords.get(aId)
      const kwB = paperKeywords.get(bId)
      if (kwA && kwB) {
        const sim = jaccardSimilarity(kwA, kwB)
        if (sim >= IDEA_SIMILARITY_THRESHOLD && !seen.has(edgeKey + '::idea')) {
          seen.add(edgeKey + '::idea')
          const topWords = getTopSharedKeywords(kwA, kwB)
          edges.push({
            source: aId,
            target: bId,
            type: 'related-idea',
            label: topWords.length > 0 ? topWords.join(', ') : 'related',
            weight: Math.round(sim * 100),
          })
        }
      }
    }
  }

  return { nodes, edges }
})
