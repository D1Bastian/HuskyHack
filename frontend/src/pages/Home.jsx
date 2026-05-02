import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import VerificationBadge from '../components/VerificationBadge.jsx'
import { analyzeImage, generateMedia } from '../lib/api.js'

const emptyAnalysis = {
  artHistory: '',
  meaning: '',
  lore: '',
  videoScript: '',
  runwayPrompt: '',
  groundingSummary: '',
}

export default function Home() {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [analysis, setAnalysis] = useState(emptyAnalysis)
  const [audioUrl, setAudioUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [sources, setSources] = useState([])
  const [verification, setVerification] = useState(null)
  const [communityMatch, setCommunityMatch] = useState(null)
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
    setVerification(null)
    setCommunityMatch(null)

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
    setStatus('Analyzing artwork… checking community blog & public sources…')

    try {
      const data = await analyzeImage(file)
      setAnalysis({ ...emptyAnalysis, ...data.analysis })
      setSources(data.grounding?.sources || [])
      setVerification(data.verification || null)
      setCommunityMatch(data.communityMatch || null)
      setStatus(
        data.communityMatch
          ? `Matched community blog post: "${data.communityMatch.post.title}".`
          : 'Analysis ready. Generate a video below.',
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
    setStatus('Generating voice and video — this takes a minute or two…')

    try {
      const data = await generateMedia({
        script: analysis.videoScript,
        runwayPrompt: analysis.runwayPrompt,
      })
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
    <section className={`workbench${isAnalyzing ? ' analyzing' : ''}`}>
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

          <button type="button" id="analyze-btn" onClick={analyzeArtwork} disabled={!file || isAnalyzing}>
            {isAnalyzing ? '⟳ Analyzing…' : '✦ Analyze'}
          </button>

          <button type="button" id="generate-btn" onClick={generateVideo} disabled={!canGenerate}>
            {isGenerating ? '⟳ Generating…' : '▶ Generate video'}
          </button>
        </div>

        <p className="status" role="status">{status}</p>
      </div>

      <div className="results-panel">
        <div className="panel-header">
          <h1>ArtStories</h1>
          <p className="panel-subtitle">AI-grounded art history · lore · narration · video</p>
        </div>

        {communityMatch && (
          <div className="community-callout">
            <span className="community-tag">Community match</span>
            <div>
              <strong>{communityMatch.post.title}</strong> by {communityMatch.post.author}
              <p className="community-reason">{communityMatch.reason}</p>
              <Link to={`/blog/${communityMatch.post.id}`} className="community-link">
                View blog post →
              </Link>
            </div>
          </div>
        )}

        <div className="result-grid">
          <article>
            <div className="article-head">
              <h2>Art History</h2>
              <VerificationBadge verdict={verification?.artHistory} />
            </div>
            <p>{analysis.artHistory || 'Factual analysis will appear here once you analyze an image.'}</p>
          </article>

          <article>
            <div className="article-head">
              <h2>Meaning</h2>
              <VerificationBadge verdict={verification?.meaning} />
            </div>
            <p>{analysis.meaning || 'Symbolic interpretation will appear here.'}</p>
          </article>

          <article>
            <div className="article-head">
              <h2>Lore</h2>
              <span className="verify-badge verify-fiction">Fiction</span>
            </div>
            <p>{analysis.lore || 'Fictional myth or story will appear here.'}</p>
          </article>

          <article>
            <h2>Video Script</h2>
            <p>{analysis.videoScript || 'The 30-second narration script will appear here.'}</p>
          </article>

          <article>
            <h2>Grounding</h2>
            <p>{analysis.groundingSummary || 'Wikipedia and community source matches will appear here.'}</p>
            {sources.length > 0 && (
              <div className="source-list">
                {sources.map((source) => {
                  const isInternal = source.url?.startsWith('/')
                  return isInternal ? (
                    <Link key={`${source.name}-${source.title}`} to={source.url}>
                      {source.name}
                    </Link>
                  ) : (
                    <a key={`${source.name}-${source.title}`} href={source.url} target="_blank" rel="noreferrer">
                      {source.name}
                    </a>
                  )
                })}
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
  )
}
