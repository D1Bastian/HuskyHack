const API_BASE = import.meta.env.VITE_API_URL ?? ''

function mediaUrl(path) {
  if (!path || path.startsWith('http')) return path
  return `${API_BASE}${path}`
}

function withMediaUrl(post) {
  return { ...post, image_url: mediaUrl(post.image_url) }
}

export async function listPosts() {
  const response = await fetch(`${API_BASE}/api/posts`)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to load posts.')
  return data.posts.map(withMediaUrl)
}

export async function getPost(id) {
  const response = await fetch(`${API_BASE}/api/posts/${id}`)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to load post.')
  return withMediaUrl(data.post)
}

export async function createPost(formData) {
  const response = await fetch(`${API_BASE}/api/posts`, {
    method: 'POST',
    body: formData,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to create post.')
  return withMediaUrl(data.post)
}

export async function deletePost(id) {
  const response = await fetch(`${API_BASE}/api/posts/${id}`, { method: 'DELETE' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to delete post.')
  return data
}

export async function analyzeImage(file) {
  const formData = new FormData()
  formData.append('image', file)
  const response = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: formData })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Analysis failed.')
  return data
}

// Called by App.jsx — hits the narration endpoint (Runway video removed).
export async function generateMedia({ script }) {
  const response = await fetch(`${API_BASE}/generate-narration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Narration generation failed.')
  return data
}
