<template>
  <div class="notes-container">
    <nav class="top-bar">
      <NuxtLink to="/" class="back-link">
        <span>←</span>
        <span>Library</span>
      </NuxtLink>
      <div class="title-area">
        <span class="icon">◈</span>
        <h1>Knowledge Base</h1>
        <span class="subtitle">~/claude-papers/paper.md</span>
      </div>
      <div class="actions">
        <template v-if="editMode">
          <button @click="saveNotes" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
          <button @click="cancelEdit" class="btn">Cancel</button>
        </template>
        <button v-else @click="enterEdit" class="btn">Edit</button>
      </div>
    </nav>

    <div class="notes-body">
      <div v-if="loading" class="state-center">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>

      <div v-else-if="editMode" class="editor-wrapper">
        <textarea v-model="editContent" class="editor" spellcheck="false" />
      </div>

      <div v-else-if="content" v-html="rendered" class="markdown-body" />

      <div v-else class="empty-state">
        <p class="empty-title">No global notes yet.</p>
        <p class="empty-hint">This file is updated automatically after each paper is studied — connecting papers into a continuous knowledge chain.</p>
        <button @click="enterEdit" class="btn btn-primary">Create paper.md</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'
import markedKatex from 'marked-katex-extension'

marked.use(markedKatex({ throwOnError: false, output: 'html' }))

const loading = ref(true)
const content = ref('')
const editMode = ref(false)
const editContent = ref('')
const saving = ref(false)

onMounted(async () => {
  try {
    const data = await $fetch<{ content: string }>('/api/global-notes')
    content.value = data.content || ''
  } catch {
    content.value = ''
  } finally {
    loading.value = false
  }
})

const rendered = computed(() => {
  if (!content.value) return ''
  return marked.parse(content.value) as string
})

const enterEdit = () => {
  editContent.value = content.value
  editMode.value = true
}

const cancelEdit = () => {
  editMode.value = false
  editContent.value = ''
}

const saveNotes = async () => {
  saving.value = true
  try {
    await $fetch('/api/global-notes', {
      method: 'PUT',
      body: { content: editContent.value },
    })
    content.value = editContent.value
    editMode.value = false
  } catch (e) {
    console.error('Save failed:', e)
  } finally {
    saving.value = false
  }
}

useHead({ title: 'Knowledge Base - Research Library' })
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');

* { box-sizing: border-box; }

.notes-container {
  min-height: 100vh;
  background: #ffffff;
  font-family: 'Inter', sans-serif;
}

.top-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 64px;
  background: rgba(255,255,255,0.95);
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  padding: 0 2rem;
  gap: 1.5rem;
  z-index: 100;
  backdrop-filter: blur(10px);
}

.back-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: #1f2937;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  white-space: nowrap;
  transition: background 0.2s;
}
.back-link:hover { background: #f8f9fa; }

.title-area {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  overflow: hidden;
}

.icon {
  font-size: 1.1rem;
  color: #6b7280;
  flex-shrink: 0;
}

.title-area h1 {
  font-family: 'Crimson Pro', serif;
  font-size: 1.2rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  white-space: nowrap;
}

.subtitle {
  font-size: 0.8rem;
  color: #9ca3af;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.btn {
  padding: 0.5rem 1rem;
  background: #ffffff;
  border: 1px solid #d1d5db;
  color: #374151;
  font-size: 0.875rem;
  font-family: 'Inter', sans-serif;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.btn:hover { background: #f8f9fa; border-color: #6b7280; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-primary {
  background: #111827;
  color: #ffffff;
  border-color: #111827;
}
.btn-primary:hover { background: #1f2937; }

.notes-body {
  max-width: 860px;
  margin: 64px auto 0;
  padding: 3rem 2rem;
}

.state-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem;
  color: #6b7280;
}

.spinner {
  width: 36px; height: 36px;
  border: 3px solid #e5e7eb;
  border-top-color: #6b7280;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.editor-wrapper {
  height: calc(100vh - 160px);
}

.editor {
  width: 100%;
  height: 100%;
  padding: 1.5rem;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
  font-size: 0.875rem;
  line-height: 1.7;
  color: #1f2937;
  background: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  resize: none;
  outline: none;
  tab-size: 2;
}
.editor:focus { border-color: #6b7280; background: #ffffff; }

.empty-state {
  text-align: center;
  padding: 5rem 2rem;
  color: #6b7280;
}
.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.75rem;
}
.empty-hint {
  max-width: 480px;
  margin: 0 auto 2rem;
  line-height: 1.6;
  font-size: 0.95rem;
}

/* Markdown styles */
.markdown-body {
  font-family: 'Crimson Pro', serif;
  font-size: 1.125rem;
  line-height: 1.8;
  color: #1f2937;
}
.markdown-body :deep(h1) { font-size: 2rem; font-weight: 700; margin: 0 0 1.5rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
.markdown-body :deep(h2) { font-size: 1.6rem; font-weight: 600; margin: 2rem 0 1rem; border-bottom: 1px solid #f3f4f6; padding-bottom: 0.3rem; }
.markdown-body :deep(h3) { font-size: 1.3rem; font-weight: 600; margin: 1.75rem 0 0.75rem; }
.markdown-body :deep(p) { margin-bottom: 1.25rem; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 2rem; margin-bottom: 1.25rem; }
.markdown-body :deep(li) { margin-bottom: 0.4rem; }
.markdown-body :deep(blockquote) { border-left: 4px solid #6b7280; padding: 0.75rem 1.5rem; margin: 1.5rem 0; color: #374151; font-style: italic; background: #f9fafb; border-radius: 0 6px 6px 0; }
.markdown-body :deep(code) { font-family: monospace; font-size: 0.82em; background: #f3f4f6; padding: 0.15em 0.4em; border-radius: 3px; border: 1px solid #e5e7eb; }
.markdown-body :deep(pre) { background: #111827; color: #e5e7eb; padding: 1.25rem; border-radius: 8px; overflow-x: auto; margin: 1.5rem 0; }
.markdown-body :deep(pre code) { background: none; border: none; padding: 0; font-size: 0.875rem; }
.markdown-body :deep(hr) { border: none; height: 1px; background: #e5e7eb; margin: 2.5rem 0; }
.markdown-body :deep(strong) { font-weight: 700; color: #111827; }
.markdown-body :deep(a) { color: #6b7280; text-decoration: underline; text-decoration-color: #d1d5db; }
.markdown-body :deep(a:hover) { color: #374151; }
</style>
