# HuskyHack ArtStories Notes

## Current Product

ArtStories is a full-stack hackathon prototype:

1. React uploads an artwork image.
2. Express receives the image at `/analyze`.
3. Gemini identifies likely artwork/title/search terms from the image.
4. Wikipedia and The Met provide public grounding context.
5. Gemini writes factual analysis, interpretation, fictional lore, and a narration script.
6. ElevenLabs generates narration audio.
7. Runway receives the cinematic prompt for text-to-video generation.

## Main Files

```text
backend/src/server.js
backend/src/grounding.js
frontend/src/App.jsx
frontend/src/App.css
README.md
```

## Prototype Files From Teammate Work

```text
backend/vision_test.py
backend/starry_night.jpg
```

These are useful for experimenting with Google Cloud Vision web detection, but the current app flow uses Gemini image identification in the Node backend.

## Conventions

- Do not commit `.env` or real API keys.
- Keep generated folders out of git: `node_modules`, `dist`, `.vite`, `uploads`, `generated`.
- Factual claims should prefer grounded source data when Wikipedia or Met finds a match.
- Fictional lore must stay clearly labeled as fictional.
