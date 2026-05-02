import { useMemo, useState } from 'react'
import './App.css'

const emptyAnalysis = {
  artHistory: '',
  meaning: '',
  lore: '',
  videoScript: '',
  runwayPrompt: '',
}

function App() {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [analysis, setAnalysis] = useState(emptyAnalysis)
  const [audioUrl, setAudioUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
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
    setStatus('Analyzing the artwork with Gemini...')

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
      setStatus('Analysis ready.')
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
    setStatus('Generating voice and video. This can take a few minutes...')

    try {
      const response = await fetch('/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      setStatus(data.videoUrl ? 'Video generated.' : 'Runway finished without a video URL.')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="workbench">
        <div className="upload-panel">
          <div className="image-stage">
            {previewUrl ? (
              <img src={previewUrl} alt="Selected artwork preview" />
            ) : (
              <div className="placeholder">Artwork preview</div>
            )}
          </div>

          <div className="controls">
            <label className="file-picker">
              <span>Upload image</span>
              <input type="file" accept="image/*" onChange={handleFileChange} />
            </label>
            <button type="button" onClick={analyzeArtwork} disabled={!file || isAnalyzing}>
              {isAnalyzing ? 'Analyzing' : 'Analyze'}
            </button>
            <button type="button" onClick={generateVideo} disabled={!canGenerate}>
              {isGenerating ? 'Generating' : 'Generate video'}
            </button>
          </div>

          <p className="status">{status}</p>
        </div>

        <div className="results-panel">
          <h1>ArtStories</h1>

          <div className="result-grid">
            <article>
              <h2>Art History</h2>
              <p>{analysis.artHistory || 'Factual analysis will appear here.'}</p>
            </article>
            <article>
              <h2>Meaning</h2>
              <p>{analysis.meaning || 'Interpretation will appear here.'}</p>
            </article>
            <article>
              <h2>Lore</h2>
              <p>{analysis.lore || 'Fictional lore will appear here.'}</p>
            </article>
            <article>
              <h2>Video Script</h2>
              <p>{analysis.videoScript || 'The narration script will appear here.'}</p>
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
  )
}

export default App
