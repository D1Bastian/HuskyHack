import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPost } from '../lib/api.js'

export default function BlogNew() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [inspiration, setInspiration] = useState('')
  const [meaning, setMeaning] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleFile(event) {
    const selected = event.target.files?.[0] || null
    setFile(selected)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(selected ? URL.createObjectURL(selected) : '')
  }

  async function submit(event) {
    event.preventDefault()
    if (!file) {
      setError('Please attach an image.')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('title', title)
      formData.append('author', author)
      formData.append('inspiration', inspiration)
      formData.append('meaning', meaning)
      formData.append('body', body)

      const post = await createPost(formData)
      navigate(`/blog/${post.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className="page-heading">
        <h1>Share an artwork</h1>
        <p>Tell the story behind your piece. AI will recall it next time someone uploads the image.</p>
      </section>

      <section className="blog-shell">

      <form className="blog-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="form-image-stage">
            {previewUrl ? <img src={previewUrl} alt="Preview" /> : <div className="placeholder">Choose an image</div>}
            <label className="file-picker form-file-picker">
              <span>{file ? '↺ Change image' : '⬆ Upload image'}</span>
              <input type="file" accept="image/*" onChange={handleFile} />
            </label>
          </div>

          <div className="form-fields">
            <label>
              <span>Title</span>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Untitled (Blue Husky)" />
            </label>
            <label>
              <span>Artist / Author</span>
              <input type="text" required value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" />
            </label>
            <label>
              <span>Inspiration</span>
              <textarea rows={3} value={inspiration} onChange={(e) => setInspiration(e.target.value)} placeholder="What sparked this piece?" />
            </label>
            <label>
              <span>Meaning</span>
              <textarea rows={3} value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder="Symbolism, intent, themes…" />
            </label>
            <label>
              <span>Story</span>
              <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Anything else worth knowing about this piece." />
            </label>

            {error && <p className="status">{error}</p>}

            <button type="submit" disabled={submitting} className="full-button">
              {submitting ? '⟳ Saving…' : '✦ Publish post'}
            </button>
          </div>
        </div>
      </form>
      </section>
    </>
  )
}
