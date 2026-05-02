# HuskyHackArtStories

ArtStories analyzes an uploaded artwork image, produces art history/meaning/lore/narration with Gemini, generates narration audio with ElevenLabs, and starts a Runway text-to-video generation.

## Project Structure

- `frontend/` - Vite React upload and generation UI
- `backend/` - Express API for Gemini, ElevenLabs, and Runway

## Local Setup

Install dependencies in both apps:

```sh
cd backend
npm install

cd ../frontend
npm install
```

Create `backend/.env` from `backend/.env.example`, then fill in your API keys:

```sh
PORT=3000
CLIENT_ORIGIN=http://localhost:5173

GEMINI_API_KEY=your_google_ai_studio_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id
RUNWAY_API_KEY=your_runway_developer_key
```

Run the backend in one terminal:

```sh
cd backend
npm run dev
```

Run the frontend in another terminal:

```sh
cd frontend
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`.

## API Routes

- `POST /analyze` - multipart form upload with field name `image`
- `POST /generate-video` - JSON body with `script` and optional `runwayPrompt`
- `GET /health` - backend health check
