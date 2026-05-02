import { Routes, Route, NavLink } from 'react-router-dom'
import './App.css'
import Home from './pages/Home.jsx'
import BlogList from './pages/BlogList.jsx'
import BlogNew from './pages/BlogNew.jsx'
import BlogPost from './pages/BlogPost.jsx'

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to="/" className="brand-link">
          <div className="logo-mark" aria-hidden="true">🎨</div>
          <span className="brand">ArtStories</span>
        </NavLink>

        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Analyze
          </NavLink>
          <NavLink to="/blog" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Blog
          </NavLink>
          <NavLink to="/blog/new" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            New post
          </NavLink>
        </nav>

        <span className="tagline">HuskyHack · Gemini × Wikipedia × The Met × ElevenLabs × Runway</span>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/new" element={<BlogNew />} />
          <Route path="/blog/:id" element={<BlogPost />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
