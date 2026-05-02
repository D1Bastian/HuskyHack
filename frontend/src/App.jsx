import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import backgroundVideo from './assets/Art_Background.mp4'
import './App.css'
import VerificationBadge from './components/VerificationBadge.jsx'
import { analyzeImage, generateNarration } from './lib/api.js'
import BlogList from './pages/BlogList.jsx'
import BlogNew from './pages/BlogNew.jsx'
import BlogPost from './pages/BlogPost.jsx'

const emptyAnalysis = {
  artHistory: '',
  meaning: '',
  lore: '',
  videoScript: '',
  slideCaptions: [],
  slideSearchQueries: [],
  groundingSummary: '',
}

const galleryArtworks = [
  {
    id: 'sunset-dreams',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&auto=format&fit=crop',
    title: 'Sunset Dreams',
    artist: '@artlover',
    description: 'A serene landscape study with warm horizon light and a quiet mountain silhouette.',
    views: 127,
    likes: 45,
  },
  {
    id: 'urban-chaos',
    image: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=900&auto=format&fit=crop',
    title: 'Urban Chaos',
    artist: '@cityscapes',
    description: 'Bold color fields and restless geometry turn the city into a visual rhythm.',
    views: 234,
    likes: 89,
  },
  {
    id: 'still-peace',
    image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=900&auto=format&fit=crop',
    title: 'Still Peace',
    artist: '@florals',
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
  const [creations, setCreations] = useState([])
  const [creationImage, setCreationImage] = useState('')
  const [creationTitle, setCreationTitle] = useState('')
  const [creationStory, setCreationStory] = useState('')
  const fileInputRef = useRef(null)
  const creationInputRef = useRef(null)
  const audioRef = useRef(null)
  const slideTimerRef = useRef(null)
  const [slideImages, setSlideImages] = useState([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
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
    setSlideImages([])
    setCurrentSlide(0)
    setIsPlaying(false)
    clearInterval(slideTimerRef.current)
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
    setStatus('Analyzing artwork and grounding with Wikipedia and community sources...')

    try {
      const data = await analyzeImage(file)
      setAnalysis({ ...emptyAnalysis, ...data.analysis })
      setSources(data.grounding?.sources || [])
      setVerification(data.verification || null)
      setCommunityMatch(data.communityMatch || null)
      setSlideImages(data.slideImages || [])
      setStatus(
        data.communityMatch
          ? `Matched community blog post: "${data.communityMatch.post.title}".`
          : 'Analysis ready. Generate narration when you are ready.',
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
    setStatus('Generating narration with ElevenLabs...')

    try {
      const data = await generateNarration(analysis.videoScript)
      setAudioUrl(data.audio?.url || '')
      setStatus(data.audio?.url ? 'Narration ready — press Play Documentary below.' : 'Narration finished without audio.')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  // Build slides: artwork first, then contextual Wikipedia/Commons images (no repeats).
  const slides = useMemo(() => {
    const captions = Array.isArray(analysis.slideCaptions) ? analysis.slideCaptions : []
    const images = []
    // Slide 1 is always the uploaded artwork.
    if (previewUrl) images.push(previewUrl)
    // Remaining slides are contextual images — never repeat the artwork.
    slideImages.forEach((url) => { if (url && !images.includes(url)) images.push(url) })

    const animations = ['kb-zoom-in', 'kb-pan-left', 'kb-zoom-out', 'kb-pan-right', 'kb-zoom-in']
    return images.map((src, i) => ({
      src,
      caption: captions[i] || '',
      animation: animations[i % animations.length],
    }))
  }, [previewUrl, slideImages, analysis.slideCaptions])

  const startSlideshow = useCallback(() => {
    const audio = audioRef.current
    if (!audio || slides.length === 0) return
    setCurrentSlide(0)
    setIsPlaying(true)
    audio.currentTime = 0
    audio.play().catch(() => {})
    clearInterval(slideTimerRef.current)
    const getInterval = () => {
      const dur = audio.duration
      return dur && Number.isFinite(dur) && dur > 0 ? (dur / slides.length) * 1000 : 7000
    }
    slideTimerRef.current = setInterval(() => {
      setCurrentSlide((prev) => {
        if (prev >= slides.length - 1) {
          clearInterval(slideTimerRef.current)
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, getInterval())
  }, [slides])

  const stopSlideshow = useCallback(() => {
    setIsPlaying(false)
    clearInterval(slideTimerRef.current)
    audioRef.current?.pause()
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnded = () => stopSlideshow()
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [audioUrl, stopSlideshow])

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
          <NavLink to="/blog" className={({ isActive }) => (isActive ? 'active' : '')}>
            Blog
          </NavLink>
          <button
            type="button"
            onClick={() => {
              setView('home')
              setStatus('Upload, analyze, then generate narration and video from one artwork.')
            }}
          >
            Help
          </button>
        </nav>
      </header>

      {view === 'home' && (
        <main className="home-page">
          <section className="hero-copy">
            <p className="eyebrow">Gemini + Wikipedia + ElevenLabs + Runway</p>
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
                  <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()}>
                    <Icon name="upload" />
                    Choose from computer
                  </button>
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
              {previewUrl ? <img alt="Analyzed artwork" src={previewUrl} /> : <div className="empty-preview" />}
              <div className="artwork-meta">
                <p className="eyebrow">{artworkMode === 'famous' ? 'Famous Artwork' : 'Personal Creation'}</p>
                <h1>{analysis.groundingSummary ? 'Artwork Analysis' : 'Awaiting Analysis'}</h1>
                <p>{status}</p>
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
                <p>{analysis.artHistory || 'The factual analysis will appear here once Gemini and the public sources respond.'}</p>
              </article>
              <article>
                <div className="article-head">
                  <h2>Interpretation</h2>
                  <VerificationBadge verdict={verification?.meaning} />
                </div>
                <p>{analysis.meaning || 'Symbolism, mood, composition, and plausible readings will appear here.'}</p>
              </article>
              <article>
                <div className="article-head">
                  <h2>Fictional Lore</h2>
                  <span className="verify-badge verify-fiction">Fiction</span>
                </div>
                <p>{analysis.lore || 'The fictional lore section will stay clearly labeled as fiction.'}</p>
              </article>
              <article>
                <h2>Narration Script</h2>
                <p>{analysis.videoScript || 'A voiceover-ready script will appear here after analysis.'}</p>
              </article>

              <div className="generate-panel">
                <button type="button" onClick={generateVideo} disabled={!canGenerate}>
                  <Icon name="video" />
                  {isGenerating ? 'Generating...' : '🎙 Generate Narration'}
                </button>

                {audioUrl && slides.length > 0 && (
                  <div className="theater">
                    <h2>🎬 Documentary</h2>
                    <div className="slideshow">
                      {slides.map((slide, i) => (
                        <div
                          key={`slide-${i}`}
                          className={`slide ${slide.animation} ${i === currentSlide ? 'active' : ''}`}
                        >
                          <img src={slide.src} alt={slide.caption || `Slide ${i + 1}`} />
                          {slide.caption && <div className="slide-caption">{slide.caption}</div>}
                        </div>
                      ))}
                    </div>
                    <div className="theater-controls">
                      <button type="button" className="play-btn" onClick={isPlaying ? stopSlideshow : startSlideshow}>
                        {isPlaying ? '⏸ Pause' : '▶ Play Documentary'}
                      </button>
                      <div className="slide-dots">
                        {slides.map((_, i) => (
                          <span key={`dot-${i}`} className={`dot ${i === currentSlide ? 'active' : ''}`} />
                        ))}
                      </div>
                    </div>
                    <audio ref={audioRef} src={audioUrl} preload="auto">
                      <track kind="captions" />
                    </audio>
                  </div>
                )}

                {audioUrl && slides.length === 0 && (
                  <div className="media-results">
                    <audio controls src={audioUrl}>
                      <track kind="captions" />
                    </audio>
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

          <section className="gallery-grid">
            {galleryArtworks.map((artwork) => {
              const isLiked = likedArtworks.has(artwork.id)
              return (
                <article className="gallery-card" key={artwork.id}>
                  <img alt={artwork.title} src={artwork.image} />
                  <div>
                    <h2>{artwork.title}</h2>
                    <p>{artwork.artist}</p>
                    <p>{artwork.description}</p>
                    <footer>
                      <span><Icon name="eye" />{artwork.views}</span>
                      <button className={isLiked ? 'liked' : ''} type="button" onClick={() => toggleLike(artwork.id)}>
                        <Icon name="heart" />{artwork.likes + (isLiked ? 1 : 0)}
                      </button>
                    </footer>
                  </div>
                </article>
              )
            })}
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
          <NavLink to="/blog">Blog</NavLink>
          <NavLink to="/blog/new">New Post</NavLink>
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
