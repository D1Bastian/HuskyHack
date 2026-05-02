import { useMemo, useState } from 'react'
import './App.css'

const emptyAnalysis = {
  artHistory: '',
  meaning: '',
  lore: '',
  videoScript: '',
  runwayPrompt: '',
  groundingSummary: '',
}

function App() {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [analysis, setAnalysis] = useState(emptyAnalysis)
  const [audioUrl, setAudioUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [sources, setSources] = useState([])
  const [status, setStatus] = useState('Choose an artwork image to begin.')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const canGenerate = useMemo(
    () => Boolean(analysis.videoScript && !isGenerating),
    [analysis.videoScript, isGenerating],
  )

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0]
    setFile(selectedFile || null)
    setAnalysis(emptyAnalysis)
    setAudioUrl('')
    setVideoUrl('')
    setSources([])

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

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
    setStatus('Analyzing artwork… grounding with Wikipedia & The Met…')

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/analyze', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed.')
      }

      setAnalysis({ ...emptyAnalysis, ...data.analysis })
      setSources(data.grounding?.sources || [])
      setStatus('Analysis ready. Generate a video below.')
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
    setStatus('Generating voice and video — this takes a minute or two…')

    try {
      const response = await fetch('/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: analysis.videoScript,
          runwayPrompt: analysis.runwayPrompt,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Video generation failed.')
      }

      setAudioUrl(data.audio?.url || '')
      setVideoUrl(data.videoUrl || '')
      setStatus(data.videoUrl ? 'Video generated!' : 'Runway finished — no video URL returned.')
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
        <span className="tagline">HuskyHack · Gemini × Wikipedia × The Met × ElevenLabs × Runway</span>
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
                onClick={generateVideo}
                disabled={!canGenerate}
              >
                {isGenerating ? '⟳ Generating…' : '▶ Generate video'}
              </button>
            </div>

            <p className="status" role="status">{status}</p>
          </div>

          {/* ── Results Panel ── */}
          <div className="results-panel">
            <div className="panel-header">
              <h1>ArtStories</h1>
              <p className="panel-subtitle">AI-grounded art history · lore · narration · video</p>
            </div>

            <div className="result-grid">
              <article>
                <h2>Art History</h2>
                <p>{analysis.artHistory || 'Factual analysis will appear here once you analyze an image.'}</p>
              </article>

              <article>
                <h2>Meaning</h2>
                <p>{analysis.meaning || 'Symbolic interpretation will appear here.'}</p>
              </article>

              <article>
                <h2>Lore</h2>
                <p>{analysis.lore || 'Fictional myth or story will appear here.'}</p>
              </article>

              <article>
                <h2>Video Script</h2>
                <p>{analysis.videoScript || 'The 30-second narration script will appear here.'}</p>
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

            {(audioUrl || videoUrl) && (
              <div className="media-results">
                {audioUrl && (
                  <audio controls src={audioUrl}>
                    <track kind="captions" />
                  </audio>
                )}
                {videoUrl && (
                  <a href={videoUrl} target="_blank" rel="noreferrer">
                    Open generated video
                  </a>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
