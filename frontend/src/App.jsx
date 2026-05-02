import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const emptyAnalysis = {
  artHistory: '',
  meaning: '',
  lore: '',
  videoScript: '',
  slideCaptions: [],
  groundingSummary: '',
}

function App() {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [analysis, setAnalysis] = useState(emptyAnalysis)
  const [audioUrl, setAudioUrl] = useState('')
  const [slideImages, setSlideImages] = useState([])
  const [sources, setSources] = useState([])
  const [status, setStatus] = useState('Choose an artwork image to begin.')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Slideshow state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const audioRef = useRef(null)
  const slideTimerRef = useRef(null)

  const canGenerate = useMemo(
    () => Boolean(analysis.videoScript && !isGenerating && !audioUrl),
    [analysis.videoScript, isGenerating, audioUrl],
  )

  // Build slides: artwork first, then contextual Wikipedia images.
  const slides = useMemo(() => {
    const captions = Array.isArray(analysis.slideCaptions)
      ? analysis.slideCaptions
      : []

    const images = []
    // Slide 1: always the uploaded artwork.
    if (previewUrl) images.push(previewUrl)
    // Slides 2-4+: contextual images from Wikipedia (artist, era, museum, etc.)
    slideImages.forEach((url) => {
      if (url && !images.includes(url)) images.push(url)
    })
    // Only pad with artwork if we still have fewer than 4 slides.
    while (images.length < Math.min(4, captions.length || 4) && previewUrl) {
      images.push(previewUrl)
    }

    return images.map((src, i) => ({
      src,
      caption: captions[i] || '',
      animation: ['kb-zoom-in', 'kb-pan-left', 'kb-zoom-out', 'kb-pan-right'][i % 4],
    }))
  }, [previewUrl, slideImages, analysis.slideCaptions])

  // Auto-advance slides while audio is playing.
  const startSlideshow = useCallback(() => {
    const audio = audioRef.current
    if (!audio || slides.length === 0) return

    setCurrentSlide(0)
    setIsPlaying(true)
    audio.currentTime = 0
    audio.play().catch(() => {})

    // Use audio duration if available, otherwise default to ~7s per slide.
    const fallbackPerSlide = 7000
    const getInterval = () => {
      const dur = audio.duration
      if (dur && Number.isFinite(dur) && dur > 0) {
        return (dur / slides.length) * 1000
      }
      return fallbackPerSlide
    }

    clearInterval(slideTimerRef.current)

    // Start advancing immediately with best-guess interval.
    let interval = getInterval()
    slideTimerRef.current = setInterval(() => {
      // Re-check interval in case duration loaded late.
      interval = getInterval()
      setCurrentSlide((prev) => {
        if (prev >= slides.length - 1) {
          clearInterval(slideTimerRef.current)
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, interval)
  }, [slides])

  const stopSlideshow = useCallback(() => {
    setIsPlaying(false)
    clearInterval(slideTimerRef.current)
    audioRef.current?.pause()
  }, [])

  // Stop when audio ends.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnded = () => stopSlideshow()
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [audioUrl, stopSlideshow])

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0]
    setFile(selectedFile || null)
    setAnalysis(emptyAnalysis)
    setAudioUrl('')
    setSlideImages([])
    setSources([])
    stopSlideshow()

    if (previewUrl) URL.revokeObjectURL(previewUrl)

    if (selectedFile) {
      setPreviewUrl(URL.createObjectURL(selectedFile))
      setStatus('Ready to analyze.')
    } else {
      setPreviewUrl('')
      setStatus('Choose an artwork image to begin.')
    }
  }

  async function analyzeArtwork() {
    if (!file) {
      setStatus('Select an image first.')
      return
    }

    setIsAnalyzing(true)
    setAudioUrl('')
    stopSlideshow()
    setStatus('Analyzing artwork… grounding with Wikipedia & The Met…')

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/analyze', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Analysis failed.')

      setAnalysis({ ...emptyAnalysis, ...data.analysis })
      setSources(data.grounding?.sources || [])
      setSlideImages(data.slideImages || [])
      setStatus('Analysis ready — generate the narration below.')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function generateNarration() {
    if (!analysis.videoScript) {
      setStatus('Analyze an image first.')
      return
    }

    setIsGenerating(true)
    setStatus('Generating narration with ElevenLabs…')

    try {
      const response = await fetch('/generate-narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: analysis.videoScript }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Narration failed.')

      setAudioUrl(data.audio?.url || '')
      setStatus('Narration ready — press ▶ Play to watch the slideshow.')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="logo-mark" aria-hidden="true">🎨</div>
        <span className="brand">ArtStories</span>
        <span className="tagline">HuskyHack · Gemini × Wikipedia × The Met × ElevenLabs</span>
      </header>

      <main>
        <section className={`workbench${isAnalyzing ? ' analyzing' : ''}`}>
          {/* ── Upload Panel ── */}
          <div className="upload-panel">
            <div className="image-stage">
              {previewUrl ? (
                <img src={previewUrl} alt="Selected artwork preview" />
              ) : (
                <div className="placeholder">Drop artwork here</div>
              )}
            </div>

            <div className="controls">
              <label className="file-picker" htmlFor="artwork-upload">
                <span>{file ? '↺ Change image' : '⬆ Upload image'}</span>
                <input
                  id="artwork-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>

              <button
                type="button"
                id="analyze-btn"
                onClick={analyzeArtwork}
                disabled={!file || isAnalyzing}
              >
                {isAnalyzing ? '⟳ Analyzing…' : '✦ Analyze'}
              </button>

              <button
                type="button"
                id="generate-btn"
                onClick={generateNarration}
                disabled={!canGenerate}
              >
                {isGenerating ? '⟳ Generating…' : '🎙 Generate narration'}
              </button>
            </div>

            <p className="status" role="status">{status}</p>
          </div>

          {/* ── Results Panel ── */}
          <div className="results-panel">
            <div className="panel-header">
              <h1>ArtStories</h1>
              <p className="panel-subtitle">AI-grounded art history · lore · cinematic narration</p>
            </div>

            <div className="result-grid">
              <article>
                <h2>History</h2>
                <p>{analysis.artHistory || 'Upload a piece and the specialist will share its history.'}</p>
              </article>

              <article>
                <h2>What It Means</h2>
                <p>{analysis.meaning || 'Interpretation and meaning will appear here.'}</p>
              </article>

              <article>
                <h2>The Legend</h2>
                <p>{analysis.lore || 'A myth or legend inspired by the work will appear here.'}</p>
              </article>

              <article>
                <h2>Narration Script</h2>
                <p>{analysis.videoScript || 'The 30-second cinematic voiceover script will appear here.'}</p>
              </article>

              <article>
                <h2>Grounding</h2>
                <p>{analysis.groundingSummary || 'Wikipedia and Met Museum source matches will appear here.'}</p>
                {sources.length > 0 && (
                  <div className="source-list">
                    {sources.map((source) => (
                      <a
                        key={`${source.name}-${source.title}`}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {source.name}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            </div>

            {/* ── Slideshow Theater ── */}
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
                      {slide.caption && (
                        <div className="slide-caption">{slide.caption}</div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="theater-controls">
                  <button
                    type="button"
                    className="play-btn"
                    onClick={isPlaying ? stopSlideshow : startSlideshow}
                  >
                    {isPlaying ? '⏸ Pause' : '▶ Play Documentary'}
                  </button>

                  <div className="slide-dots">
                    {slides.map((_, i) => (
                      <span
                        key={`dot-${i}`}
                        className={`dot ${i === currentSlide ? 'active' : ''}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Hidden audio element for synced playback */}
                <audio ref={audioRef} src={audioUrl} preload="auto">
                  <track kind="captions" />
                </audio>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
