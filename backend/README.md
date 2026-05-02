# HuskyHack ArtStories Backend

Express API for turning an uploaded artwork image into structured art analysis, narration, ElevenLabs audio, and a Runway video generation task.

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create your local environment file:

   ```sh
   cp .env.example .env
   ```

3. Fill in `.env` with:

   - `GEMINI_API_KEY` from Google AI Studio
   - `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` from ElevenLabs
   - `RUNWAY_API_KEY` from the Runway developer portal

4. Start the backend:

   ```sh
   npm run dev
   ```

The server runs on `http://localhost:3000` by default.

## Endpoints

### `GET /health`

Returns a simple health check.

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
    "runwayPrompt": "..."
  },
  "raw": "..."
}
```

### `POST /generate-video`

JSON body:

```json
{
  "script": "Narration script from /analyze",
  "runwayPrompt": "Optional visual prompt for Runway"
}
```

Returns local audio metadata plus Runway task output. Runway output URLs are temporary, so download/store them in production.
