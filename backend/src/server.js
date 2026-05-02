import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import express from "express";
import multer from "multer";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { buildArtworkGrounding } from "./grounding.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const uploadsDir = path.join(backendRoot, "uploads");
const audioDir = path.join(backendRoot, "generated", "audio");
const videoDir = path.join(backendRoot, "generated", "video");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  }),
);
app.use("/media/audio", express.static(audioDir));
app.use("/media/video", express.static(videoDir));

await fs.mkdir(uploadsDir, { recursive: true });
await fs.mkdir(audioDir, { recursive: true });
await fs.mkdir(videoDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are supported."));
      return;
    }

    cb(null, true);
  },
});

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`Missing required environment variable: ${name}`);
    error.status = 500;
    throw error;
  }

  return value;
};

const stripJsonFences = (text) =>
  text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const parseGeminiAnalysis = (text) => {
  try {
    return JSON.parse(stripJsonFences(text));
  } catch {
    return {
      artHistory: text,
      meaning: "uncertain",
      lore: "uncertain",
      videoScript: text,
      runwayPrompt: text,
    };
  }
};

const parseGeminiJson = (text, fallback = {}) => {
  try {
    return JSON.parse(stripJsonFences(text || ""));
  } catch {
    return fallback;
  }
};

const trimForRunway = (text) => text.trim().slice(0, 1000);

const parseProviderMessage = (data) => {
  if (!data) {
    return null;
  }

  if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
    return parseProviderMessage(Buffer.from(data).toString("utf8"));
  }

  if (typeof data === "string") {
    try {
      return parseProviderMessage(JSON.parse(data));
    } catch {
      return data;
    }
  }

  return data.detail?.message || data.message || data.error || JSON.stringify(data);
};

const providerError = (provider, status, message, details) => {
  const error = new Error(`${provider}: ${message}`);
  error.status = status && status >= 400 && status < 500 ? status : 502;
  error.provider = provider;
  error.details = details;
  return error;
};

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

async function identifyArtwork(ai, imageBase64, mimeType) {
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: [
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
      {
        text: `
Identify the uploaded artwork for source lookup.

If you are not sure of the exact artwork, say "uncertain" in titleGuess and provide visual search queries instead.

Return strict JSON only:
{
  "titleGuess": "known artwork title or uncertain",
  "artistGuess": "artist name or uncertain",
  "likelyKnownArtwork": true,
  "visualDescription": "one concise sentence",
  "searchQueries": ["best lookup query", "alternate lookup query"]
}
`,
      },
    ],
  });

  return parseGeminiJson(response.text, {
    titleGuess: "uncertain",
    artistGuess: "uncertain",
    likelyKnownArtwork: false,
    visualDescription: "uncertain",
    searchQueries: [],
  });
}

app.post("/analyze", upload.single("image"), async (req, res, next) => {
  let imagePath;

  try {
    if (!req.file) {
      res.status(400).json({ error: "Upload an image using the form field named image." });
      return;
    }

    imagePath = req.file.path;
    const imageBase64 = await fs.readFile(imagePath, "base64");
    const ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
    const identification = await identifyArtwork(ai, imageBase64, req.file.mimetype);
    const grounding = await buildArtworkGrounding(identification);

    const prompt = `
You are a captivated, opinionated art specialist — part historian, part storyteller, part obsessive. You speak in your own voice: warm, authoritative, full of genuine fascination. You don't produce reports; you share what grips you about a work.

Use the grounding data below as your factual foundation, but let your personality breathe through the writing. When you're uncertain, say so with intellectual humility — not disclaimers.

Gemini visual identification:
${JSON.stringify(identification, null, 2)}

Grounding from public APIs:
${JSON.stringify(grounding, null, 2)}

Return strict JSON only, with these string fields:
{
  "artHistory": "Speak as an expert who loves this piece. Tell its history in your own words — who made it, when, why it matters, what the era felt like. Cite sources naturally if they helped. If uncertain, admit it with curiosity not caution.",
  "meaning": "What does this work *do* to you? Interpret its symbolism, composition, mood, and cultural weight the way a specialist who has spent years with art would — with conviction and nuance.",
  "lore": "Invent a vivid, clearly fictional myth or legend this artwork could have inspired. Make it feel ancient, poetic, and earned by the image itself.",
  "videoScript": "Write a 30-second cinematic voiceover — one flowing paragraph — in the voice of this art specialist. Evocative, rhythmic, made to be spoken aloud over moving images.",
  "runwayPrompt": "A visual text-to-video prompt under 1000 characters. Describe exactly what should appear on screen: camera movement, lighting, atmosphere, subject, style.",
  "groundingSummary": "One honest sentence: which sources matched and how confident you are."
}
`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: req.file.mimetype,
            data: imageBase64,
          },
        },
        { text: prompt },
      ],
    });

    const raw = response.text || "";
    const analysis = parseGeminiAnalysis(raw);

    res.json({
      success: true,
      analysis,
      grounding,
      raw,
    });
  } catch (error) {
    next(error);
  } finally {
    if (imagePath) {
      await fs.rm(imagePath, { force: true }).catch(() => {});
    }
  }
});

async function generateVoice(script) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`;

  let response;
  try {
    response = await axios.post(
      url,
      {
        text: script,
        model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
      },
      {
        headers: {
          "xi-api-key": requireEnv("ELEVENLABS_API_KEY"),
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        responseType: "arraybuffer",
      },
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw providerError(
        "ElevenLabs",
        error.response?.status || 502,
        parseProviderMessage(error.response?.data) || error.message,
        error.response?.data ? parseProviderMessage(error.response.data) : null,
      );
    }

    throw error;
  }

  const filename = `audio_${Date.now()}.mp3`;
  const filePath = path.join(audioDir, filename);
  await fs.writeFile(filePath, response.data);

  return {
    filename,
    path: filePath,
    url: `/media/audio/${filename}`,
  };
}

async function generateVeoVideo(promptText, imageBase64, mimeType) {
  const ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
  const model = process.env.VEO_MODEL || "veo-2.0-generate-001";

  let operation;
  try {
    const params = {
      model,
      prompt: trimForRunway(promptText),
      config: {
        aspectRatio: process.env.VEO_ASPECT_RATIO || "16:9",
        durationSeconds: Number(process.env.VEO_DURATION_SECONDS || 5),
        numberOfVideos: 1,
      },
    };

    // Use the uploaded artwork as the starting frame when available.
    if (imageBase64 && mimeType) {
      params.image = { imageBytes: imageBase64, mimeType };
    }

    operation = await ai.models.generateVideos(params);
  } catch (error) {
    throw providerError("Veo", error.status || 502, error.message, null);
  }

  // Poll until done (Veo is a long-running operation).
  const pollIntervalMs = 8000;
  const timeoutMs = Number(process.env.VEO_WAIT_TIMEOUT_MS || 600000);
  const deadline = Date.now() + timeoutMs;

  while (!operation.done) {
    if (Date.now() > deadline) {
      throw providerError("Veo", 504, "Video generation timed out.", null);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    try {
      operation = await ai.operations.getVideosOperation({ operation });
    } catch (error) {
      throw providerError("Veo", 502, `Polling failed: ${error.message}`, null);
    }
  }

  const generatedVideo = operation.response?.generatedVideos?.[0]?.video;
  if (!generatedVideo) {
    throw providerError("Veo", 502, "Veo returned no video in its response.", null);
  }

  // Download the video bytes and save locally so the frontend can stream it.
  const filename = `video_${Date.now()}.mp4`;
  const filePath = path.join(videoDir, filename);

  if (generatedVideo.videoBytes) {
    // Bytes returned directly (base64 or Buffer).
    const buf = Buffer.isBuffer(generatedVideo.videoBytes)
      ? generatedVideo.videoBytes
      : Buffer.from(generatedVideo.videoBytes, "base64");
    await fs.writeFile(filePath, buf);
  } else if (generatedVideo.uri) {
    // Signed URI — fetch and save.
    const dlRes = await axios.get(generatedVideo.uri, {
      responseType: "arraybuffer",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY },
    });
    await fs.writeFile(filePath, Buffer.from(dlRes.data));
  } else {
    throw providerError("Veo", 502, "Veo video has neither bytes nor URI.", null);
  }

  return { filename, url: `/media/video/${filename}` };
}

app.post("/generate-video", async (req, res, next) => {
  try {
    const { script, runwayPrompt, imageBase64, imageMimeType } = req.body;

    if (!script || typeof script !== "string") {
      res.status(400).json({ error: "Provide a non-empty script string." });
      return;
    }

    const [audio, video] = await Promise.all([
      generateVoice(script),
      generateVeoVideo(runwayPrompt || script, imageBase64 || null, imageMimeType || null),
    ]);

    res.json({
      success: true,
      audio,
      videoUrl: video.url,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error.provider ? `${error.provider} error: ${error.message}` : error);

  const status = error.status || 500;
  res.status(status).json({
    error: error.message || "Something went wrong.",
    provider: error.provider,
    details: error.details,
  });
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
