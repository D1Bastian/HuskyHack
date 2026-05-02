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
    setStatus('Generating voice and video with Veo — this takes a minute or two…')

    try {
      // Read the image as base64 so Veo can use it as the starting frame.
      let imageBase64 = null
      let imageMimeType = null
      if (file) {
        const buf = await file.arrayBuffer()
        imageBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
        imageMimeType = file.type
      }

      const response = await fetch('/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: analysis.videoScript,
          runwayPrompt: analysis.runwayPrompt,
          imageBase64,
          imageMimeType,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Video generation failed.')
      }

      setAudioUrl(data.audio?.url || '')
      setVideoUrl(data.videoUrl || '')
      setStatus(data.videoUrl ? 'Video generated!' : 'Veo finished — no video URL returned.')
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

            {(audioUrl || videoUrl) && (
              <div className="media-results">
                {audioUrl && (
                  <audio controls src={audioUrl}>
                    <track kind="captions" />
                  </audio>
                )}
                {videoUrl && (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    controls
                    src={videoUrl}
                    style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '8px' }}
                  />
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
