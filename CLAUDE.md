# HuskyHack Art Stories

## Project Vision

**Primary goal**: Take an image of any artwork and surface the story behind it — title, artist, historical context, and narrative.

**Secondary goal**: A "DevPost for art" — users can upload pieces not in any museum or online database and write about them themselves, so others can discover and learn about the work.

## Architecture Overview

```
User uploads image
       |
       v
[vision_test.py] identify_artwork(image_bytes)
       |
       returns best_guess title string
       |
       +-----------------------------+
       |                             |
       v                             v
[met_test.py]                [wikipedia_fetch.py]
get_artwork_data(title)      get_artwork_info(title)
       |                             |
 Met Museum metadata          Wikipedia summary,
 (artist, date, image)        URL, categories
       |                             |
       +-----------------------------+
                    |
                    v
           Merged story payload
   (future: story_builder.py → Flask/FastAPI → React UI)
```

## Tech Stack

**Backend** (Python 3.x, no framework yet)
- Google Cloud Vision API — web detection for artwork identification
- Metropolitan Museum of Art public API — structured museum metadata, no key required
- Wikipedia MediaWiki REST API — narrative context and summaries, no key required
- Dependencies: `requests`, `python-dotenv`

**Frontend** (not yet connected to backend)
- React 19.2.5, Vite 8, React Compiler (babel-plugin-react-compiler)

## Repository Layout

```
backend/
  vision_test.py       — Google Vision API: image bytes → best_guess title + entities
  met_test.py          — Met Museum API: title → structured museum metadata
  wikipedia_fetch.py   — Wikipedia REST API: title → summary, URL, categories
  requirements.txt     — Python dependencies
  .env                 — API keys (gitignored)
  starry_night.jpg     — Test image

frontend/
  src/App.jsx          — React root (currently scaffold)
  src/main.jsx         — Entry point
  vite.config.js       — Vite + React Compiler config
  package.json         — Frontend dependencies
```

## Development Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
# Copy .env.example to .env and fill in GOOGLE_VISION_API_KEY
python wikipedia_fetch.py   # test Wikipedia integration
python met_test.py          # test Met Museum integration
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # → http://localhost:5173
```

## Environment Variables

| Variable | Location | Purpose |
|---|---|---|
| `GOOGLE_VISION_API_KEY` | `backend/.env` | Google Cloud project key with Vision API enabled |

## API Integration Notes

### Google Vision API (`vision_test.py`)
```python
identify_artwork(image_bytes) -> {"best_guess": str | None, "entities": list[tuple]}
```
`best_guess` is a plain string like `"The Starry Night"` — use this as the canonical title input for `wikipedia_fetch` and `met_test`.

### Met Museum API (`met_test.py`)
```python
get_artwork_data(title) -> dict | None
```
Public API, no auth. Returns full Met object JSON on success, `None` if not found. Key fields: `title`, `artistDisplayName`, `objectDate`, `primaryImageSmall`.

### Wikipedia REST API (`wikipedia_fetch.py`)
```python
get_artwork_info(title) -> dict | None
# Returns: {title, description, summary, url, thumbnail_url, categories}

enrich_with_met(artwork_info, title) -> dict
# Merges Met Museum data (artist, date, met_image_url) into an existing artwork_info dict
```
Uses `https://en.wikipedia.org/api/rest_v1/page/summary/{title}`. Handles disambiguation by retrying with `" (painting)"` suffix. Returns `None` gracefully when the artwork isn't on Wikipedia.

## Planned Next Steps

1. `backend/story_builder.py` — orchestrates Vision → Wikipedia + Met → merged story payload
2. `backend/app.py` — Flask or FastAPI server exposing a `/analyze` endpoint
3. Frontend — replace scaffold with image upload UI + story display

## Conventions

- Each backend module is independently runnable (has an `if __name__ == "__main__":` test block)
- Functions return `None` or empty collections on failure — never raise to caller
- New API integrations follow the pattern: one file, one primary function, plain `requests`, no framework
- All API keys in `backend/.env`, never hardcoded
- Frontend components go in `frontend/src/components/` once scaffolding begins
