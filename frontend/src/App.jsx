import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import backgroundVideo from './assets/Art_Background.mp4'
import './App.css'
import VerificationBadge from './components/VerificationBadge.jsx'
import { analyzeImage, generateNarration, listPosts, resolveBackendUrl } from './lib/api.js'
import BlogList from './pages/BlogList.jsx'
import BlogNew from './pages/BlogNew.jsx'
import BlogPost from './pages/BlogPost.jsx'


const emptyAnalysis = {
  artHistory: '',
  meaning: '',
  lore: '',
  videoScript: '',
  runwayPrompt: '',
  groundingSummary: '',
}

const galleryArtworks = [
  {
    id: 'sunset-dreams',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&auto=format&fit=crop',
    title: 'Sunset Dreams',
    artist: 'Elena Vasquez',
    description: 'A serene landscape study with warm horizon light and a quiet mountain silhouette.',
    views: 127,
    likes: 45,
  },
  {
    id: 'urban-chaos',
    image: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=900&auto=format&fit=crop',
    title: 'Urban Chaos',
    artist: 'Marcus Okafor',
    description: 'Bold color fields and restless geometry turn the city into a visual rhythm.',
    views: 234,
    likes: 89,
  },
  {
    id: 'still-peace',
    image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=900&auto=format&fit=crop',
    title: 'Still Peace',
    artist: 'Suki Tanaka',
    description: 'Soft botanical forms, calm contrast, and a palette built around small details.',
    views: 156,
    likes: 62,
  },
]

function Icon({ name }) {
  const icons = {
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="M7 9l5-5 5 5" />
        <path d="M20 16v4H4v-4" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
      </>
    ),
    clipboard: (
      <>
        <path d="M9 4h6v3H9z" />
        <path d="M9 5H6v16h12V5h-3" />
      </>
    ),
    sparkle: (
      <>
        <path d="M12 3l1.8 5.1L19 10l-5.2 1.9L12 17l-1.8-5.1L5 10l5.2-1.9z" />
        <path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
      </>
    ),
    video: (
      <>
        <path d="M4 6h11v12H4z" />
        <path d="M15 10l5-3v10l-5-3z" />
      </>
    ),
    back: <path d="M15 18l-6-6 6-6" />,
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    heart: (
      <path d="M20.8 5.6a5.4 5.4 0 0 0-7.6 0L12 6.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 22l8.8-8.8a5.4 5.4 0 0 0 0-7.6z" />
    ),
    camera: (
      <>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    save: (
      <>
        <path d="M19 21H5V3h11l3 3z" />
        <path d="M8 21v-7h8v7" />
        <path d="M8 3v5h7" />
      </>
    ),
  }

  return (
    <svg aria-hidden="true" className="icon" fill="none" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  )
}

function ArtStoryExperience() {
  const [view, setView] = useState('home')
  const [artworkMode, setArtworkMode] = useState('famous')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [objectUrl, setObjectUrl] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [analysis, setAnalysis] = useState(emptyAnalysis)
  const [audioUrl, setAudioUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [sources, setSources] = useState([])
  const [verification, setVerification] = useState(null)
  const [communityMatch, setCommunityMatch] = useState(null)
  const [status, setStatus] = useState('Choose an artwork image to begin.')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [likedArtworks, setLikedArtworks] = useState(() => new Set())
  const [blogPosts, setBlogPosts] = useState([])
  const [blogLoading, setBlogLoading] = useState(false)
  const [blogError, setBlogError] = useState('')
  const [creations, setCreations] = useState([])
  const [creationImage, setCreationImage] = useState('')
  const [creationTitle, setCreationTitle] = useState('')
  const [creationStory, setCreationStory] = useState('')
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const creationInputRef = useRef(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  useEffect(() => {
    if (view === 'gallery') {
      setBlogLoading(true)
      setBlogError('')
      listPosts()
        .then((data) => setBlogPosts(data))
        .catch((err) => setBlogError(err.message))
        .finally(() => setBlogLoading(false))
    }
  }, [view])

  const canGenerate = useMemo(
    () => Boolean(analysis.videoScript && !isGenerating),
    [analysis.videoScript, isGenerating],
  )

  function resetGeneratedContent() {
    setAnalysis(emptyAnalysis)
    setAudioUrl('')
    setVideoUrl('')
    setSources([])
    setVerification(null)
    setCommunityMatch(null)
  }

  function selectArtwork(selectedFile) {
    if (!selectedFile || !selectedFile.type.startsWith('image/')) {
      setStatus('Choose a supported image file.')
      return
    }

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
    }

    const nextUrl = URL.createObjectURL(selectedFile)
    setObjectUrl(nextUrl)
    setFile(selectedFile)
    setPreviewUrl(nextUrl)
    resetGeneratedContent()
    setStatus('Artwork ready. Start the analysis when you are ready.')
  }

  function handleFileChange(event) {
    selectArtwork(event.target.files?.[0])
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)
    selectArtwork(event.dataTransfer.files?.[0])
  }

  async function loadRemoteImage() {
    const trimmedUrl = urlInput.trim()
    if (!trimmedUrl) {
      setStatus('Paste an image URL first.')
      return
    }

    setStatus('Loading image URL...')

    try {
      const response = await fetch(trimmedUrl)
      if (!response.ok) {
        throw new Error('Could not load that image URL.')
      }

      const blob = await response.blob()
      const extension = blob.type.split('/')[1] || 'jpg'
      const remoteFile = new File([blob], `remote-artwork.${extension}`, {
        type: blob.type || 'image/jpeg',
      })
      selectArtwork(remoteFile)
      setUrlInput('')
    } catch (error) {
      setStatus(error.message || 'Could not load that image URL.')
    }
  }

  async function pasteFromClipboard() {
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          selectArtwork(new File([blob], 'clipboard-artwork.png', { type: imageType }))
          return
        }
      }

      const text = await navigator.clipboard.readText()
      if (text.startsWith('http://') || text.startsWith('https://')) {
        setUrlInput(text)
        setStatus('Clipboard URL pasted. Press Load to use it.')
        return
      }

      setStatus('Clipboard does not contain an image or image URL.')
    } catch {
      setStatus('Browser clipboard access was blocked.')
    }
  }

  async function analyzeArtwork() {
    if (!file) {
      setStatus('Select an image first.')
      return
    }

    setIsAnalyzing(true)
    setView('analysis')
    setStatus('Analyzing artwork and grounding with Wikipedia and The Met...')

    try {
      const data = await analyzeImage(file)
      setAnalysis({ ...emptyAnalysis, ...data.analysis })
      setSources(data.grounding?.sources || [])
      setVerification(data.verification || null)
      setCommunityMatch(data.communityMatch || null)
      setStatus(
        data.communityMatch
          ? `Matched community blog post: "${data.communityMatch.post.title}".`
          : 'Analysis ready. Generate a narrated video when you are ready.',
      )
    } catch (error) {
      setStatus(error.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function generateVideo() {
    if (!analysis.videoScript) {
      setStatus('Analyze an image first so there is a script to narrate.')
      return
    }

    setIsGenerating(true)
    setStatus('Generating narration and video...')

    try {
      const data = await generateMedia({
        script: analysis.videoScript,
        runwayPrompt: analysis.runwayPrompt,
      })
      setAudioUrl(data.audio?.url || '')
      setVideoUrl(data.videoUrl || '')
      setStatus(data.videoUrl ? 'Video generated.' : 'Runway finished without a video URL.')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  function clearArtwork() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
    }
    setObjectUrl('')
    setFile(null)
    setPreviewUrl('')
    resetGeneratedContent()
    setStatus('Choose an artwork image to begin.')
    setView('home')
  }

  function toggleLike(artworkId) {
    setLikedArtworks((current) => {
      const next = new Set(current)
      if (next.has(artworkId)) {
        next.delete(artworkId)
      } else {
        next.add(artworkId)
      }
      return next
    })
  }

  function handleCreationFile(event) {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile || !selectedFile.type.startsWith('image/')) {
      return
    }

    const reader = new FileReader()
    reader.onload = (readerEvent) => {
      setCreationImage(readerEvent.target?.result || '')
    }
    reader.readAsDataURL(selectedFile)
  }

  function saveCreation() {
    if (!creationImage || !creationTitle.trim() || !creationStory.trim()) {
      return
    }

    setCreations((current) => [
      {
        id: String(Date.now()),
        image: creationImage,
        title: creationTitle.trim(),
        story: creationStory.trim(),
        createdAt: new Date().toLocaleDateString(),
      },
      ...current,
    ])
    setCreationImage('')
    setCreationTitle('')
    setCreationStory('')
  }

  const navItems = [
    ['home', 'Analyze'],
    ['creations', 'My Creations'],
    ['gallery', 'Gallery'],
  ]

  return (
    <div className="artstory-app">
      <div className="video-backdrop" aria-hidden="true">
        <video autoPlay loop muted playsInline>
          <source src={backgroundVideo} type="video/mp4" />
        </video>
      </div>
      <div className="backdrop-overlay" aria-hidden="true" />

      <header className="top-nav">
        <button className="brand-button" type="button" onClick={() => setView('home')}>
          ArtStory
        </button>
        <nav aria-label="Primary navigation">
          {navItems.map(([itemView, label]) => (
            <button
              className={view === itemView ? 'active' : ''}
              key={itemView}
              type="button"
              onClick={() => setView(itemView)}
            >
              {label}
            </button>
          ))}
          <button
            className={view === 'help' ? 'active' : ''}
            type="button"
            onClick={() => setView('help')}
          >
            FAQ
          </button>
        </nav>
      </header>

      {view === 'home' && (
        <main className="home-page">
          <section className="hero-copy">
            <h1>Welcome to ArtStory</h1>
            <p>Discover the stories, emotions, and history behind any artwork.</p>
          </section>

          <section className="upload-surface" aria-label="Artwork upload">
            <div className="mode-tabs" role="group" aria-label="Artwork type">
              <button
                className={artworkMode === 'famous' ? 'selected' : ''}
                type="button"
                onClick={() => setArtworkMode('famous')}
              >
                Famous Artwork
              </button>
              <button
                className={artworkMode === 'personal' ? 'selected' : ''}
                type="button"
                onClick={() => setArtworkMode('personal')}
              >
                Personal Creation
              </button>
            </div>

            {!previewUrl ? (
              <>
                <div
                  className={`drop-zone${isDragging ? ' dragging' : ''}`}
                  onDragLeave={() => setIsDragging(false)}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setIsDragging(true)
                  }}
                  onDrop={handleDrop}
                >
                  <Icon name="upload" />
                  <h2>Drop your image here</h2>
                  <p>{artworkMode === 'famous' ? 'Painting, sculpture, or object photo' : 'Sketch, painting, render, or digital work'}</p>
                  <input
                    accept="image/*"
                    className="hidden-input"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    type="file"
                  />
                  <input
                    accept="image/*"
                    capture="environment"
                    className="hidden-input"
                    onChange={handleFileChange}
                    ref={cameraInputRef}
                    type="file"
                  />
                  <div className="drop-zone-buttons">
                    <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()}>
                      <Icon name="upload" />
                      Choose from device
                    </button>
                    <button type="button" className="secondary-button camera-button" onClick={() => cameraInputRef.current?.click()}>
                      <Icon name="camera" />
                      Take a photo
                    </button>
                  </div>
                </div>

                <div className="or-divider">
                  <span>or</span>
                </div>

                <div className="url-loader">
                  <label htmlFor="image-url">
                    <Icon name="link" />
                    Paste Image URL
                  </label>
                  <div>
                    <input
                      id="image-url"
                      onChange={(event) => setUrlInput(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && loadRemoteImage()}
                      placeholder="https://example.com/image.jpg"
                      type="url"
                      value={urlInput}
                    />
                    <button type="button" onClick={loadRemoteImage}>
                      Load
                    </button>
                  </div>
                </div>

                <button type="button" className="wide-button" onClick={pasteFromClipboard}>
                  <Icon name="clipboard" />
                  Paste from Clipboard
                </button>
              </>
            ) : (
              <div className="selected-artwork">
                <img alt="Selected artwork" src={previewUrl} />
                <div className="selected-actions">
                  <button type="button" onClick={analyzeArtwork} disabled={isAnalyzing}>
                    <Icon name="sparkle" />
                    {isAnalyzing ? 'Analyzing...' : 'Analyze Artwork'}
                  </button>
                  <button type="button" className="secondary-button" onClick={clearArtwork}>
                    Upload Different Image
                  </button>
                </div>
              </div>
            )}

            <p className="status-line" role="status">{status}</p>
          </section>
        </main>
      )}

      {view === 'analysis' && (
        <main className="analysis-page">
          <button type="button" className="back-button" onClick={() => setView('home')}>
            <Icon name="back" />
            Analyze Another Artwork
          </button>

          <section className="analysis-layout">
            <aside className="artwork-panel">
              <div className={`artwork-image-wrap${isAnalyzing ? ' artwork-loading' : ''}`}>
                {previewUrl ? <img alt="Analyzed artwork" src={previewUrl} /> : <div className="empty-preview" />}
                {isAnalyzing && <div className="artwork-loading-overlay"><div className="artwork-spinner" /></div>}
              </div>
              <div className="artwork-meta">
                {isAnalyzing ? (
                  <div className="skeleton-block" style={{marginBottom: '12px'}}>
                    <span style={{width: '70%', height: '22px'}} />
                    <span style={{width: '90%'}} />
                    <span style={{width: '55%'}} />
                  </div>
                ) : (
                  <>
                    <h1>{analysis.groundingSummary ? 'Artwork Analysis' : 'Awaiting Analysis'}</h1>
                    <p>{status}</p>
                  </>
                )}
                {sources.length > 0 && (
                  <div className="source-list">
                    {sources.map((source) => (
                      source.url?.startsWith('/') ? (
                        <Link key={`${source.name}-${source.title}`} to={source.url}>
                          {source.name}
                        </Link>
                      ) : (
                        <a href={source.url} key={`${source.name}-${source.title}`} rel="noreferrer" target="_blank">
                          {source.name}
                        </a>
                      )
                    ))}
                  </div>
                )}
              </div>
            </aside>

            <section className="analysis-results">
              {communityMatch && (
                <article className="community-callout">
                  <span className="community-tag">Community match</span>
                  <div>
                    <strong>{communityMatch.post.title}</strong> by {communityMatch.post.author}
                    <p>{communityMatch.reason}</p>
                    <Link to={`/blog/${communityMatch.post.id}`}>View blog post</Link>
                  </div>
                </article>
              )}
              <article>
                <div className="article-head">
                  <h2>Factual History</h2>
                  <VerificationBadge verdict={verification?.artHistory} />
                </div>
                {isAnalyzing ? <div className="skeleton-block"><span /><span /><span style={{width:'72%'}} /></div> : <p>{analysis.artHistory || 'The factual analysis will appear here once Gemini and the public sources respond.'}</p>}
              </article>
              <article>
                <div className="article-head">
                  <h2>Interpretation</h2>
                  <VerificationBadge verdict={verification?.meaning} />
                </div>
                {isAnalyzing ? <div className="skeleton-block"><span /><span /><span style={{width:'60%'}} /></div> : <p>{analysis.meaning || 'Symbolism, mood, composition, and plausible readings will appear here.'}</p>}
              </article>
              <article>
                <div className="article-head">
                  <h2>Fictional Lore</h2>
                  <span className="verify-badge verify-fiction">Fiction</span>
                </div>
                {isAnalyzing ? <div className="skeleton-block"><span /><span /><span style={{width:'80%'}} /></div> : <p>{analysis.lore || 'The fictional lore section will stay clearly labeled as fiction.'}</p>}
              </article>
              <article>
                <h2>Narration Script</h2>
                {isAnalyzing ? <div className="skeleton-block"><span /><span /><span style={{width:'55%'}} /></div> : <p>{analysis.videoScript || 'A voiceover-ready script will appear here after analysis.'}</p>}
              </article>

              <div className="generate-panel">
                <button type="button" onClick={generateVideo} disabled={!canGenerate}>
                  <Icon name="video" />
                  {isGenerating ? 'Generating...' : 'Generate Narrated Video'}
                </button>
                {(audioUrl || videoUrl) && (
                  <div className="media-results">
                    {audioUrl && (
                      <audio controls src={resolveBackendUrl(audioUrl)}>
                        <track kind="captions" />
                      </audio>
                    )}
                    {videoUrl && (
                      <a href={videoUrl} rel="noreferrer" target="_blank">
                        Open generated video
                      </a>
                    )}
                  </div>
                )}
              </div>
            </section>
          </section>
        </main>
      )}

      {view === 'gallery' && (
        <main className="gallery-page">
          <section className="page-heading">
            <h1>Community Gallery</h1>
            <p>Discover the world's creativity and explore stories from the ArtStory community.</p>
          </section>

          <section className="blog-shell gallery-blog-section">
            <div className="blog-header" style={{justifyContent: 'center'}}>
              <Link to="/blog/new" className="new-post-button">+ New post</Link>
            </div>

            {blogLoading && <p className="status">Loading posts…</p>}
            {blogError && <p className="status">{blogError}</p>}

            {!blogLoading && !blogError && blogPosts.length === 0 && (
              <p className="status">No posts yet. Be the first to share an artwork.</p>
            )}

            <div className="post-grid">
              {blogPosts.map((post) => (
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
            <section className="gallery-grid gallery-grid-inset">
              {galleryArtworks.map((artwork) => {
                const isLiked = likedArtworks.has(artwork.id)
                return (
                  <article className="gallery-card" key={artwork.id}>
                    <img alt={artwork.title} src={artwork.image} />
                    <div>
                      <h2>{artwork.title}</h2>
                      <p>By <strong>{artwork.artist}</strong></p>
                    </div>
                  </article>
                )
              })}
            </section>
          </section>
        </main>
      )}

      {view === 'creations' && (
        <main className="creations-page">
          <section className="page-heading">
            <h1>My Creations</h1>
            <p>Keep a small local collection of art and the stories behind it.</p>
          </section>

          <section className="creation-form">
            <button
              className="creation-drop"
              type="button"
              onClick={() => creationInputRef.current?.click()}
            >
              {creationImage ? (
                <img alt="Creation preview" src={creationImage} />
              ) : (
                <>
                  <Icon name="upload" />
                  <span>Click to upload</span>
                </>
              )}
            </button>
            <input
              accept="image/*"
              className="hidden-input"
              onChange={handleCreationFile}
              ref={creationInputRef}
              type="file"
            />

            <div className="creation-fields">
              <label>
                Title
                <input
                  onChange={(event) => setCreationTitle(event.target.value)}
                  placeholder="Give your artwork a title"
                  type="text"
                  value={creationTitle}
                />
              </label>
              <label>
                Your Story
                <textarea
                  onChange={(event) => setCreationStory(event.target.value)}
                  placeholder="What inspired it? What does it mean to you?"
                  rows="7"
                  value={creationStory}
                />
              </label>
              <button
                type="button"
                onClick={saveCreation}
                disabled={!creationImage || !creationTitle.trim() || !creationStory.trim()}
              >
                <Icon name="save" />
                Save Creation
              </button>
            </div>
          </section>

          {creations.length > 0 && (
            <section className="saved-creations">
              {creations.map((creation) => (
                <article key={creation.id}>
                  <img alt={creation.title} src={creation.image} />
                  <div>
                    <h2>{creation.title}</h2>
                    <p>{creation.story}</p>
                    <span>{creation.createdAt}</span>
                  </div>
                </article>
              ))}
            </section>
          )}
        </main>
      )}

      {view === 'help' && (
        <main className="help-page">
          <section className="page-heading">
            <h1>FAQ</h1>
            <p>Everything you want to know about ArtStory and the stories behind art.</p>
          </section>

          <section className="faq-list">
            <article className="faq-card">
              <h2>What is ArtStory?</h2>
              <p>ArtStory is an AI-powered platform that uncovers the hidden narratives behind artworks. Upload any painting, sculpture, or creative piece and receive a rich analysis covering its factual history, symbolic meaning, fictional lore, and even a cinematic narration — all generated in moments.</p>
            </article>

            <article className="faq-card">
              <h2>How was ArtStory created?</h2>
              <p>ArtStory was born at a hackathon where a team of developers, designers, and art enthusiasts came together to bridge technology and creativity. The app combines Google's Gemini AI for image recognition and storytelling, Wikipedia and The Metropolitan Museum of Art for factual grounding, ElevenLabs for lifelike narration, and Runway for cinematic video generation — all woven into a seamless full-stack experience.</p>
            </article>

            <article className="faq-card">
              <h2>Why does knowing the story behind art matter?</h2>
              <p>Every artwork carries layers of meaning — the artist's intent, the cultural moment it was made in, the emotions it evokes, and the conversations it sparks across generations. Understanding these stories transforms a passive glance into a profound connection. Art becomes more than a visual experience; it becomes a dialogue between you and the creator, separated by time but united by shared human expression.</p>
            </article>

            <article className="faq-card">
              <h2>How do art pieces tell stories?</h2>
              <p>Artists embed narrative through composition, color, symbolism, and technique. A single brushstroke can convey urgency; a palette choice can evoke melancholy or joy. Historical paintings often encode political commentary, religious allegory, or personal memoir. Even abstract works tell stories through rhythm, texture, and the physical act of creation. ArtStory helps decode these visual languages so you can experience the full depth of what the artist intended — and discover meanings that even the artist may not have planned.</p>
            </article>

            <article className="faq-card">
              <h2>What kinds of artwork can I analyze?</h2>
              <p>Anything visual — famous masterpieces, museum photographs, street art, personal sketches, digital illustrations, sculptures, and more. Whether it's the Mona Lisa or a drawing from your sketchbook, ArtStory will find the story within it.</p>
            </article>

            <article className="faq-card">
              <h2>Is the information accurate?</h2>
              <p>ArtStory grounds its factual analysis in trusted public sources like Wikipedia and The Metropolitan Museum of Art's open-access collection. Each section of the analysis is labeled with a verification badge so you always know what's sourced from established records, what's interpretive, and what's creative fiction. Transparency is at the heart of everything we do.</p>
            </article>

            <article className="faq-card">
              <h2>What is the "Fictional Lore" section?</h2>
              <p>Fictional Lore is a creative, imaginative retelling inspired by the artwork — clearly labeled as fiction. It's designed to spark your imagination and show how art can inspire entirely new stories. Think of it as the legend that might surround a painting if it existed in a fantasy world.</p>
            </article>
          </section>
        </main>
      )}
    </div>
  )
}

function BlogFrame({ children }) {
  return (
    <div className="artstory-app">
      <div className="video-backdrop" aria-hidden="true">
        <video autoPlay loop muted playsInline>
          <source src={backgroundVideo} type="video/mp4" />
        </video>
      </div>
      <div className="backdrop-overlay" aria-hidden="true" />

      <header className="top-nav">
        <NavLink className="brand-button" to="/">
          ArtStory
        </NavLink>
        <nav aria-label="Primary navigation">
          <NavLink to="/" end>
            Analyze
          </NavLink>
          <NavLink to="/" end>
            My Creations
          </NavLink>
          <NavLink to="/" end>
            Gallery
          </NavLink>
          <NavLink to="/" end>
            FAQ
          </NavLink>
        </nav>
      </header>

      <main className="blog-page">{children}</main>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<ArtStoryExperience />} />
      <Route path="/blog" element={<BlogFrame><BlogList /></BlogFrame>} />
      <Route path="/blog/new" element={<BlogFrame><BlogNew /></BlogFrame>} />
      <Route path="/blog/:id" element={<BlogFrame><BlogPost /></BlogFrame>} />
    </Routes>
  )
}

export default App
