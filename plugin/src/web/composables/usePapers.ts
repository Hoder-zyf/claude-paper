export interface Paper {
  title: string
  slug: string
  authors: string[]
  abstract: string
  githubLinks?: string[]
  codeLinks?: string[]
  url?: string
  date?: string
  tags?: string[]
  read?: boolean
  starred?: boolean
}

export const usePapers = () => {
  const papers = ref<Paper[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const loadPapers = async () => {
    loading.value = true
    error.value = null

    try {
      const data = await $fetch<Paper[]>('/api/papers')
      papers.value = data
    } catch (e: any) {
      error.value = e.message || 'Failed to load papers'
      papers.value = []
    } finally {
      loading.value = false
    }
  }

  const getPaper = (slug: string): Paper | null => {
    return papers.value.find(p => p.slug === slug) || null
  }

  const getPaperMarkdown = async (slug: string): Promise<string | null> => {
    try {
      const data = await $fetch<{ slug: string; markdown: string }>(`/api/papers/${slug}`)
      return data.markdown
    } catch (e) {
      return null
    }
  }

  const removePaper = async (slug: string): Promise<boolean> => {
    try {
      await $fetch(`/api/papers/${slug}/delete`, { method: 'DELETE' })
      papers.value = papers.value.filter(p => p.slug !== slug)
      return true
    } catch (e) {
      console.error('Failed to remove paper:', e)
      return false
    }
  }

  const updatePaperTags = async (slug: string, tags: string[]): Promise<boolean> => {
    try {
      const result = await $fetch<{ success: boolean; tags: string[] }>(`/api/papers/${slug}/tags`, {
        method: 'PATCH',
        body: { tags }
      })

      const paper = papers.value.find(p => p.slug === slug)
      if (paper) {
        paper.tags = result.tags
      }

      return true
    } catch (e) {
      console.error('Failed to update tags:', e)
      return false
    }
  }

  const updateStatus = async (slug: string, status: { read?: boolean; starred?: boolean }): Promise<boolean> => {
    try {
      await $fetch(`/api/papers/${slug}/status`, {
        method: 'PATCH',
        body: status,
      })
      const paper = papers.value.find(p => p.slug === slug)
      if (paper) {
        if (status.read !== undefined) (paper as any).read = status.read
        if (status.starred !== undefined) (paper as any).starred = status.starred
      }
      return true
    } catch (e) {
      console.error('Failed to update status:', e)
      return false
    }
  }

  return {
    papers,
    loading,
    error,
    loadPapers,
    getPaper,
    getPaperMarkdown,
    removePaper,
    updatePaperTags,
    updateStatus
  }
}
