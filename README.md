# 🎨 ArtStories — HuskyHack

> **Upload any artwork photo. Get AI-grounded history, myth, and a cinematic documentary slideshow — in seconds.**

Built in one weekend for **HuskyHack** at Northeastern University.  
We turned museum walls into interactive mini-documentaries using a full AI pipeline stitched together with public art APIs.

---

## ✨ What It Does

| Step | What happens |
|------|-------------|
| 📸 **Upload** | Drop any photo of an artwork into the React UI |
| 🔍 **Identify** | Gemini 2.0 Flash reads the image and proposes title, artist, and search queries |
| 📚 **Ground** | Backend hits Wikipedia and The Metropolitan Museum of Art APIs for real-world facts |
| ✍️ **Write** | Gemini synthesizes: factual art history · symbolic meaning · fictional lore · narration script |
| 🎙️ **Narrate** | ElevenLabs generates cinematic voiceover audio from the script |
| 🎬 **Screen** | A dynamic slideshow fetches contextual images from Wikipedia/Commons to visualize the story |

No hallucinations go unchecked — the grounding layer flags uncertainty when Wikipedia or Met data doesn't clearly match the image.

---

## 🏗️ Architecture

```
React UI (Vite)
      │
      ▼
Express /analyze
      ├─▶ Gemini 2.0 Flash  →  image identification (title/artist/queries)
      ├─▶ Wikipedia REST API →  article summary + thumbnail
      ├─▶ Met Museum API     →  collection object match + metadata
      ├─▶ Gemini 2.0 Flash  →  grounded story, script & slide queries
      └─▶ Wikipedia Search  →  contextual slideshow images
      │
      ▼
Express /generate-narration
      └─▶ ElevenLabs TTS    →  MP3 voiceover
```

### Why two Gemini passes?

The first is a **fast identification pass** — it only returns JSON with a title guess and search queries so the grounding APIs can run. The second is the **creative synthesis pass** — it sees both the image *and* the grounding context, so factual claims are anchored to real sources.

---

## 🗂️ Project Structure

```
HuskyHack/
├── backend/
│   ├── src/
│   │   ├── server.js        # Express API, provider orchestration, error handling
│   │   ├── grounding.js     # Wikipedia + Met Museum lookup, relevance scoring
│   │   ├── blog.js          # SQLite-backed community gallery logic
│   │   └── imageMatch.js    # Gemini-powered visual search for community posts
│   ├── .env.example         # Local secrets template (copy → .env)
│   └── vision_test.py       # Teammate prototype: Google Cloud Vision web detection
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main application, routing, and glassmorphism UI
│   │   ├── lib/api.js       # Backend API client
│   │   └── pages/           # Blog, Post, and Creation views
│   └── vite.config.js       # Proxy /analyze and /api → backend:3000
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
```

Optional env overrides (defaults shown):

```env
GEMINI_MODEL=gemini-2.0-flash
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
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
    "artHistory": "Factual provenance and period...",
    "meaning": "Symbolic interpretation...",
    "lore": "[FICTIONAL] A myth inspired by the image...",
    "videoScript": "30-second cinematic narration...",
    "slideCaptions": ["Caption 1", "Caption 2", "..."],
    "groundingSummary": "Wikipedia matched; Met returned no relevant object."
  },
  "slideImages": ["https://...", "https://..."],
  "grounding": { ... }
}
```

### `POST /generate-narration`

```json
{ "script": "..." }
```

Returns ElevenLabs audio path (`/media/audio/audio_*.mp3`).

---

## 🔑 API Keys & Credits

| Service | Key needed? | Free tier |
|---------|-------------|-----------|
| Google AI Studio (Gemini) | ✅ | 1,500 req/day free |
| Wikipedia REST | ❌ | Public, unlimited |
| The Met Museum | ❌ | Public, unlimited |
| ElevenLabs | ✅ | 10,000 chars/month free |

> **Keep `.env` local — never commit real keys.**  

---

## 👥 Team

Built at HuskyHack · Northeastern University  
Pipeline: Gemini · Wikipedia · Met Museum · ElevenLabs  
Stack: React · Vite · Express · Node.js · SQLite

---

*ArtStories — because every painting has a story worth hearing.*

