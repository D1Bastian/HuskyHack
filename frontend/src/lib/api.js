export async function listPosts() {
  const response = await fetch('/api/posts')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to load posts.')
  return data.posts
}

export async function getPost(id) {
  const response = await fetch(`/api/posts/${id}`)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to load post.')
  return data.post
}

export async function createPost(formData) {
  const response = await fetch('/api/posts', {
    method: 'POST',
    body: formData,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to create post.')
  return data.post
}

export async function analyzeImage(file) {
  const formData = new FormData()
  formData.append('image', file)
  const response = await fetch('/analyze', { method: 'POST', body: formData })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Analysis failed.')
  return data
}

export async function generateNarration(script) {
  const response = await fetch('/generate-narration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Narration failed.')
  return data
}
