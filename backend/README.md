# ArtStories Backend

Express backend for the ArtStories hackathon prototype.

## Pipeline

1. `/analyze` receives an uploaded artwork image.
2. Gemini performs a lightweight visual identification pass.
3. `src/grounding.js` searches Wikipedia and The Metropolitan Museum of Art public collection API.
4. Gemini receives the image plus grounding context and returns structured JSON:
   - `artHistory`
   - `meaning`
   - `lore`
   - `videoScript`
   - `runwayPrompt`
   - `groundingSummary`
5. `/generate-video` sends the script to ElevenLabs and the prompt to Runway.

## Setup

```sh
npm install
cp .env.example .env
npm run dev
```

Required keys:

- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY`
- `RUNWAY_API_KEY`

Wikipedia and Met are public APIs and do not need keys.

## Endpoints

### `GET /health`

Returns `{ "ok": true }`.

### `POST /analyze`

Multipart form upload with an `image` field.

Returns:

```json
{
  "success": true,
  "analysis": {
    "artHistory": "...",
    "meaning": "...",
    "lore": "...",
    "videoScript": "...",
    "runwayPrompt": "...",
    "groundingSummary": "..."
  },
  "grounding": {
    "identification": {},
    "queries": [],
    "wikipedia": {},
    "met": {},
    "sources": []
  }
}
```

### `POST /generate-video`

JSON body:

```json
{
  "script": "Narration script from /analyze",
  "runwayPrompt": "Visual prompt from /analyze"
}
```

Returns ElevenLabs audio metadata and Runway task/video data. If Runway has no credits, the API returns a clean provider error.
