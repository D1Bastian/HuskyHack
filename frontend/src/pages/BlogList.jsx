import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPosts, resolveBackendUrl } from '../lib/api.js'

export default function BlogList() {
  const [posts, setPosts] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listPosts()
      .then((data) => setPosts(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="blog-shell">
      <div className="blog-header">
        <div>
          <h1>Community Blog</h1>
          <p className="panel-subtitle">Artworks shared and explained by their creators.</p>
        </div>
        <Link to="/blog/new" className="primary-link">+ New post</Link>
      </div>

      {loading && <p className="status">Loading posts…</p>}
      {error && <p className="status">{error}</p>}

      {!loading && !error && posts.length === 0 && (
        <p className="status">No posts yet. Be the first to share an artwork.</p>
      )}

      <div className="post-grid">
        {posts.map((post) => (
          <Link key={post.id} to={`/blog/${post.id}`} className="post-card">
            <div className="post-thumb">
              <img src={resolveBackendUrl(post.image_url)} alt={post.title} />
            </div>
            <div className="post-meta">
              <h3>{post.title}</h3>
              <span className="post-author">by {post.author}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
