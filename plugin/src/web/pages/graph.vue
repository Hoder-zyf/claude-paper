<template>
  <div class="graph-container">
    <nav class="top-bar">
      <NuxtLink to="/" class="back-link">
        <span class="back-arrow">&larr;</span>
        <span>Library</span>
      </NuxtLink>
      <div class="logo">
        <span class="logo-icon">◈</span>
        <span class="logo-text">Knowledge Graph</span>
      </div>
      <div class="legend">
        <span class="legend-item"><span class="dot dot-tag"></span>shared tag</span>
        <span class="legend-item"><span class="dot dot-author"></span>shared author</span>
        <span class="legend-item"><span class="dot dot-ref"></span>related idea</span>
      </div>
    </nav>

    <div class="graph-body">
      <div v-if="loading" class="state-msg">
        <div class="spinner"></div>
        <p>Loading graph...</p>
      </div>
      <div v-else-if="nodes.length === 0" class="state-msg">
        <p>No papers yet. Add papers with <code>/claude-paper:study</code> first.</p>
      </div>
      <div v-else-if="nodes.length === 1" class="state-msg">
        <p>Only one paper in library. Add more to see connections.</p>
      </div>
      <canvas
        v-show="nodes.length > 1"
        ref="canvasRef"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @wheel="onWheel"
        @dblclick="onDblClick"
      ></canvas>
      <div v-if="hoveredNode" class="tooltip" :style="tooltipStyle">
        <strong>{{ hoveredNode.title }}</strong>
        <span v-if="hoveredNode.tags.length" class="tooltip-tags">{{ hoveredNode.tags.join(', ') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface GNode {
  id: string; title: string; tags: string[]; authors: string[]
  x: number; y: number; vx: number; vy: number; radius: number
}
interface GEdge {
  source: string; target: string; type: string; label: string; weight?: number
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(true)
const nodes = ref<GNode[]>([])
const edges = ref<GEdge[]>([])
const hoveredNode = ref<GNode | null>(null)
const tooltipStyle = ref({ top: '0px', left: '0px' })

let animId = 0
let dragNode: GNode | null = null
let panOffset = { x: 0, y: 0 }
let panStart: { x: number; y: number } | null = null
let scale = 1
let isPanning = false

const COLORS: Record<string, string> = {
  'shared-tag': '#6366f1',
  'shared-author': '#059669',
  'related-idea': '#d97706',
}

onMounted(async () => {
  try {
    const data = await $fetch<{ nodes: any[]; edges: GEdge[] }>('/api/papers/graph')
    const w = window.innerWidth
    const h = window.innerHeight - 64
    nodes.value = (data.nodes || []).map((n: any, i: number) => ({
      ...n,
      x: w / 2 + (Math.cos(i * 2.4) * Math.min(w, h) * 0.3),
      y: h / 2 + (Math.sin(i * 2.4) * Math.min(w, h) * 0.3),
      vx: 0, vy: 0,
      radius: 24 + Math.min((n.tags?.length || 0) * 4, 16),
    }))
    edges.value = data.edges || []
  } catch { /* empty graph */ }
  loading.value = false

  await nextTick()
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  startSimulation()
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  window.removeEventListener('resize', resizeCanvas)
})

function resizeCanvas() {
  const c = canvasRef.value
  if (!c) return
  const dpr = window.devicePixelRatio || 1
  c.width = window.innerWidth * dpr
  c.height = (window.innerHeight - 64) * dpr
  c.style.width = window.innerWidth + 'px'
  c.style.height = (window.innerHeight - 64) + 'px'
}

function nodeMap(): Map<string, GNode> {
  const m = new Map<string, GNode>()
  for (const n of nodes.value) m.set(n.id, n)
  return m
}

function simulate() {
  const ns = nodes.value
  const es = edges.value
  const nm = nodeMap()
  const cw = window.innerWidth
  const ch = window.innerHeight - 64

  // repulsion
  for (let i = 0; i < ns.length; i++) {
    for (let j = i + 1; j < ns.length; j++) {
      let dx = ns[j].x - ns[i].x
      let dy = ns[j].y - ns[i].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = 8000 / (dist * dist)
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      ns[i].vx -= fx; ns[i].vy -= fy
      ns[j].vx += fx; ns[j].vy += fy
    }
  }

  // collision detection — push overlapping nodes apart
  for (let i = 0; i < ns.length; i++) {
    for (let j = i + 1; j < ns.length; j++) {
      const dx = ns[j].x - ns[i].x
      const dy = ns[j].y - ns[i].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.1
      const minDist = ns[i].radius + ns[j].radius + 12
      if (dist < minDist) {
        const overlap = (minDist - dist) * 0.5
        const ox = (dx / dist) * overlap
        const oy = (dy / dist) * overlap
        ns[i].vx -= ox; ns[i].vy -= oy
        ns[j].vx += ox; ns[j].vy += oy
      }
    }
  }

  // attraction along edges
  for (const e of es) {
    const a = nm.get(e.source)
    const b = nm.get(e.target)
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const force = (dist - 200) * 0.005
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    a.vx += fx; a.vy += fy
    b.vx -= fx; b.vy -= fy
  }

  // centering
  for (const n of ns) {
    n.vx += (cw / 2 - n.x) * 0.0003
    n.vy += (ch / 2 - n.y) * 0.0003
  }

  // apply velocities with damping
  for (const n of ns) {
    if (n === dragNode) { n.vx = 0; n.vy = 0; continue }
    n.vx *= 0.85; n.vy *= 0.85
    n.x += n.vx; n.y += n.vy
  }
}

function draw() {
  const c = canvasRef.value
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const w = c.width / dpr
  const h = c.height / dpr

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  ctx.translate(panOffset.x, panOffset.y)
  ctx.scale(scale, scale)

  const nm = nodeMap()

  // edges
  for (const e of edges.value) {
    const a = nm.get(e.source)
    const b = nm.get(e.target)
    if (!a || !b) continue
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = COLORS[e.type] || '#9ca3af'
    const weight = e.weight || 0
    ctx.lineWidth = e.type === 'related-idea' ? 1 + Math.min(weight / 20, 3) : 1.5
    ctx.globalAlpha = e.type === 'related-idea' ? 0.2 + Math.min(weight / 100, 0.5) : 0.4
    ctx.stroke()
    ctx.globalAlpha = 1

    // label
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    ctx.font = '10px Inter, sans-serif'
    ctx.fillStyle = COLORS[e.type] || '#6b7280'
    ctx.globalAlpha = 0.7
    ctx.textAlign = 'center'
    const labelText = e.label.length > 25 ? e.label.slice(0, 25) + '...' : e.label
    ctx.fillText(labelText, mx, my - 4)
    ctx.globalAlpha = 1
  }

  // nodes
  for (const n of nodes.value) {
    ctx.beginPath()
    ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
    ctx.fillStyle = n === hoveredNode.value ? '#374151' : '#1f2937'
    ctx.fill()

    ctx.font = '600 11px Inter, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const label = n.title.length > 18 ? n.title.slice(0, 18) + '...' : n.title
    ctx.fillText(label, n.x, n.y)
  }

  ctx.restore()
}

function startSimulation() {
  function tick() {
    simulate()
    draw()
    animId = requestAnimationFrame(tick)
  }
  tick()
}

function screenToWorld(sx: number, sy: number) {
  return {
    x: (sx - panOffset.x) / scale,
    y: (sy - panOffset.y) / scale,
  }
}

function findNodeAt(sx: number, sy: number): GNode | null {
  const { x, y } = screenToWorld(sx, sy)
  for (const n of nodes.value) {
    const dx = n.x - x
    const dy = n.y - y
    if (dx * dx + dy * dy < n.radius * n.radius) return n
  }
  return null
}

function onMouseDown(e: MouseEvent) {
  const rect = canvasRef.value!.getBoundingClientRect()
  const sx = e.clientX - rect.left
  const sy = e.clientY - rect.top
  const n = findNodeAt(sx, sy)
  if (n) {
    dragNode = n
  } else {
    isPanning = true
    panStart = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y }
  }
}

function onMouseMove(e: MouseEvent) {
  const rect = canvasRef.value!.getBoundingClientRect()
  const sx = e.clientX - rect.left
  const sy = e.clientY - rect.top

  if (dragNode) {
    const { x, y } = screenToWorld(sx, sy)
    dragNode.x = x
    dragNode.y = y
    dragNode.vx = 0
    dragNode.vy = 0
  } else if (isPanning && panStart) {
    panOffset.x = e.clientX - panStart.x
    panOffset.y = e.clientY - panStart.y
  } else {
    const n = findNodeAt(sx, sy)
    hoveredNode.value = n
    if (n) {
      tooltipStyle.value = { top: (e.clientY + 16) + 'px', left: (e.clientX + 16) + 'px' }
      canvasRef.value!.style.cursor = 'pointer'
    } else {
      canvasRef.value!.style.cursor = 'grab'
    }
  }
}

function onMouseUp() {
  dragNode = null
  isPanning = false
  panStart = null
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const rect = canvasRef.value!.getBoundingClientRect()
  const sx = e.clientX - rect.left
  const sy = e.clientY - rect.top
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const newScale = Math.max(0.2, Math.min(5, scale * delta))
  panOffset.x = sx - (sx - panOffset.x) * (newScale / scale)
  panOffset.y = sy - (sy - panOffset.y) * (newScale / scale)
  scale = newScale
}

function onDblClick(e: MouseEvent) {
  const rect = canvasRef.value!.getBoundingClientRect()
  const n = findNodeAt(e.clientX - rect.left, e.clientY - rect.top)
  if (n) {
    navigateTo(`/papers/${n.id}`)
  }
}

useHead({ title: 'Knowledge Graph - Research Library' })
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');

.graph-container {
  min-height: 100vh;
  background: #ffffff;
  overflow: hidden;
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
  gap: 0.4rem;
  text-decoration: none;
  color: #374151;
  font-weight: 500;
  font-size: 0.9rem;
  font-family: 'Inter', sans-serif;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  transition: all 0.2s;
}

.back-link:hover {
  background: #f8f9fa;
  color: #1f2937;
}

.back-arrow { font-weight: 600; }

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #1f2937;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
}

.logo-icon { font-size: 1.25rem; color: #6b7280; }
.logo-text { font-size: 0.95rem; }

.legend {
  margin-left: auto;
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  font-family: 'Inter', sans-serif;
  color: #6b7280;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.dot-tag { background: #6366f1; }
.dot-author { background: #059669; }
.dot-ref { background: #d97706; }

.graph-body {
  margin-top: 64px;
  width: 100%;
  height: calc(100vh - 64px);
  position: relative;
}

canvas {
  display: block;
  cursor: grab;
}

.state-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
  color: #6b7280;
  font-family: 'Inter', sans-serif;
}

.state-msg code {
  background: #e5e7eb;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  color: #374151;
}

.spinner {
  width: 40px; height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #6b7280;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.tooltip {
  position: fixed;
  background: #1f2937;
  color: #ffffff;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.825rem;
  font-family: 'Inter', sans-serif;
  pointer-events: none;
  z-index: 200;
  max-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.tooltip-tags {
  font-size: 0.75rem;
  color: #9ca3af;
}
</style>
