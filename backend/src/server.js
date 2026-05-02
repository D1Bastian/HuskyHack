import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import express from "express";
import multer from "multer";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import RunwayML, { APIError, TaskFailedError, TaskTimedOutError } from "@runwayml/sdk";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const uploadsDir = path.join(backendRoot, "uploads");
const audioDir = path.join(backendRoot, "generated", "audio");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  }),
);
app.use("/media/audio", express.static(audioDir));

await fs.mkdir(uploadsDir, { recursive: true });
await fs.mkdir(audioDir, { recursive: true });

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

    const prompt = `
You are an elite art historian, cultural analyst, and mythological storyteller.

Analyze the uploaded artwork. If the exact artwork, artist, period, or provenance is uncertain, say "uncertain" instead of guessing.

Return strict JSON only, with these string fields:
{
  "artHistory": "[FACTUAL ANALYSIS] Accurate history, artist/school if known, period, visual evidence, and uncertainty notes.",
  "meaning": "[INTERPRETATION] Symbolism, mood, composition, cultural meaning, and plausible readings.",
  "lore": "[LORE - FICTIONAL] A clearly fictional myth or story inspired by the image.",
  "videoScript": "[VIDEO SCRIPT] A 30 second cinematic narration in one voiceover-ready paragraph.",
  "runwayPrompt": "A visual text-to-video prompt under 1000 characters describing what should appear on screen."
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

async function generateRunwayVideo(promptText) {
  const runwayApiKey = process.env.RUNWAY_API_KEY || process.env.RUNWAYML_API_SECRET;
  if (!runwayApiKey) {
    const error = new Error("Missing required environment variable: RUNWAY_API_KEY");
    error.status = 500;
    throw error;
  }

  const client = new RunwayML({ apiKey: runwayApiKey });
  let task;
  try {
    const createdTask = await client.textToVideo.create({
      model: process.env.RUNWAY_MODEL || "gen4.5",
      promptText: trimForRunway(promptText),
      ratio: process.env.RUNWAY_RATIO || "1280:720",
      duration: Number(process.env.RUNWAY_DURATION || 5),
    });

    task = await client.tasks
      .retrieve(createdTask.id)
      .waitForTaskOutput({
        timeout: Number(process.env.RUNWAY_WAIT_TIMEOUT_MS || 600000),
      });
  } catch (error) {
    if (error instanceof APIError) {
      throw providerError(
        "Runway",
        error.status || 502,
        parseProviderMessage(error.error) || error.message,
        error.error,
      );
    }

    throw error;
  }

  return task;
}

app.post("/generate-video", async (req, res, next) => {
  try {
    const { script, runwayPrompt } = req.body;

    if (!script || typeof script !== "string") {
      res.status(400).json({ error: "Provide a non-empty script string." });
      return;
    }

    const audio = await generateVoice(script);
    const runwayTask = await generateRunwayVideo(runwayPrompt || script);
    const videoUrl = Array.isArray(runwayTask.output) ? runwayTask.output[0] : null;

    res.json({
      success: true,
      audio,
      videoUrl,
      runwayTask,
    });
  } catch (error) {
    if (error instanceof TaskFailedError) {
      res.status(502).json({
        error: "Runway video generation failed.",
        runwayTask: error.taskDetails,
      });
      return;
    }

    if (error instanceof TaskTimedOutError) {
      res.status(504).json({
        error: "Runway video generation timed out.",
        runwayTask: error.taskDetails,
      });
      return;
    }

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
