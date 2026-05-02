# 🎨 ArtStories — HuskyHack

> **Upload any artwork photo. Get AI-grounded history, myth, narration audio, and a cinematic video — in seconds.**

Built in one weekend for **HuskyHack** at Northeastern University.  
We turned museum walls into interactive mini-documentaries using a full AI pipeline stitched together with public art APIs.

---

## ✨ What It Does

| Step | What happens |
|------|-------------|
| 📸 **Upload** | Drop any photo of an artwork into the React UI |
| 🔍 **Identify** | Gemini 2.5 Flash reads the image and proposes title, artist, and search queries |
| 📚 **Ground** | Backend hits Wikipedia and The Metropolitan Museum of Art APIs for real-world facts |
| ✍️ **Write** | Gemini synthesizes: factual art history · symbolic meaning · fictional lore · 30-sec narration script · Runway visual prompt |
| 🎙️ **Narrate** | ElevenLabs generates cinematic voiceover audio from the script |
| 🎬 **Film** | Runway Gen 4.5 produces a text-to-video clip from the visual prompt |

No hallucinations go unchecked — the grounding layer flags uncertainty when Wikipedia or Met data doesn't clearly match the image.

---

## 🏗️ Architecture

```
React Upload UI (Vite)
      │
      ▼
Express /analyze
      ├─▶ Gemini 2.5 Flash  →  image identification (title/artist/queries)
      ├─▶ Wikipedia REST API →  article summary + thumbnail
      ├─▶ Met Museum API     →  collection object match + metadata
      └─▶ Gemini 2.5 Flash  →  grounded story, script & Runway prompt
      │
      ▼
Express /generate-video
      ├─▶ ElevenLabs TTS  →  MP3 voiceover
      └─▶ Runway Gen 4.5  →  text-to-video task → video URL
```

### Why two Gemini calls?

The first is a **fast identification pass** — it only returns JSON with a title guess and search queries so the grounding APIs can run. The second is the **creative synthesis pass** — it sees both the image *and* the grounding context, so factual claims are anchored to real sources.

---

## 🗂️ Project Structure

```
HuskyHackArtStories/
├── backend/
│   ├── src/
│   │   ├── server.js        # Express API, provider orchestration, error handling
│   │   └── grounding.js     # Wikipedia + Met Museum lookup, relevance scoring
│   ├── .env.example         # Local secrets template (copy → .env)
│   └── vision_test.py       # Teammate prototype: Google Cloud Vision web detection
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Upload UI, result cards, audio/video output
│   │   └── App.css          # Dark glassmorphism design system
│   └── vite.config.js       # Proxy /analyze and /generate-video → backend:3000
│
└── README.md
```

---

## ⚡ Local Setup

### 1. Install dependencies

```sh
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure secrets

```sh
cd backend
cp .env.example .env
```

Fill in `backend/.env`:

```env
PORT=3000
CLIENT_ORIGIN=http://localhost:5173

GEMINI_API_KEY=your_google_ai_studio_key       # aistudio.google.com
ELEVENLABS_API_KEY=your_elevenlabs_key          # elevenlabs.io
RUNWAY_API_KEY=your_runway_developer_key        # dev.runwayml.com
```

Optional env overrides (defaults shown):

```env
GEMINI_MODEL=gemini-2.5-flash
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
RUNWAY_MODEL=gen4.5
RUNWAY_RATIO=1280:720
RUNWAY_DURATION=5
```

### 3. Run

```sh
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open **http://localhost:5173** and upload an artwork photo.

---

## 🔌 API Reference

### `POST /analyze`

Multipart form. Field: `image` (any image MIME type, max 12 MB).

**Response:**
```json
{
  "success": true,
  "analysis": {
    "artHistory":       "Factual provenance and period...",
    "meaning":          "Symbolic interpretation...",
    "lore":             "[FICTIONAL] A myth inspired by the image...",
    "videoScript":      "30-second cinematic narration...",
    "runwayPrompt":     "Visual prompt for Runway (<1000 chars)...",
    "groundingSummary": "Wikipedia matched; Met returned no relevant object."
  },
  "grounding": {
    "queries":   ["The Starry Night", "The Starry Night Vincent van Gogh"],
    "wikipedia": { "source": "Wikipedia", "title": "...", "summary": "...", "url": "..." },
    "met":       null,
    "sources":   [{ "name": "Wikipedia", "title": "...", "url": "..." }]
  }
}
```

### `POST /generate-video`

```json
{ "script": "...", "runwayPrompt": "..." }
```

Returns ElevenLabs audio path (`/media/audio/audio_*.mp3`) and Runway task + video URL.

### `GET /health`

Returns `{ "ok": true }`.

---

## 🔑 API Keys & Credits

| Service | Key needed? | Free tier |
|---------|-------------|-----------|
| Google AI Studio (Gemini) | ✅ | 1 500 req/day free |
| Wikipedia REST | ❌ | Public, unlimited |
| The Met Museum | ❌ | Public, unlimited |
| ElevenLabs | ✅ | 10 000 chars/month free |
| Runway | ✅ | Credits required |

> **Keep `.env` local — never commit real keys.**  
> Runway output URLs expire; a production build would download and re-host the generated video.

---

## 👥 Team

Built at HuskyHack · Northeastern University  
Pipeline: Gemini · Wikipedia · Met Museum · ElevenLabs · Runway  
Stack: React · Vite · Express · Node.js

---

*ArtStories — because every painting has a story worth hearing.*
