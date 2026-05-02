import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getPost } from '../lib/api.js'

export default function BlogPost() {
  const { id } = useParams()
  const [post, setPost] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPost(id)
      .then(setPost)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <section className="blog-shell"><p className="status">Loading…</p></section>
  if (error) return <section className="blog-shell"><p className="status">{error}</p></section>
  if (!post) return null

  return (
    <section className="blog-shell">
      <Link to="/blog" className="back-link">← Back to blog</Link>

      <article className="post-detail">
        <div className="post-detail-image">
          <img src={post.image_url} alt={post.title} />
        </div>
        <div className="post-detail-body">
          <h1>{post.title}</h1>
          <p className="post-author">by {post.author} · {new Date(post.created_at).toLocaleDateString()}</p>

          {post.inspiration && (
            <section>
              <h2>Inspiration</h2>
              <p>{post.inspiration}</p>
            </section>
          )}

          {post.meaning && (
            <section>
              <h2>Meaning</h2>
              <p>{post.meaning}</p>
            </section>
          )}

          {post.body && (
            <section>
              <h2>Story</h2>
              <p>{post.body}</p>
            </section>
          )}
        </div>
      </article>
    </section>
  )
}
