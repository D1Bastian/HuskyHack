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
import { matchUploadAgainstBlog } from "./imageMatch.js";
import { verifyAnalysis } from "./verifier.js";
import { createBlogRouter } from "./blog.js";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const uploadsDir = path.join(backendRoot, "uploads");
const postsDir = path.join(backendRoot, "uploads", "posts");
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
app.use("/media/posts", express.static(postsDir));

await fs.mkdir(uploadsDir, { recursive: true });
await fs.mkdir(postsDir, { recursive: true });
await fs.mkdir(audioDir, { recursive: true });

app.use("/api/posts", createBlogRouter({ postsDir }));

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

/**
 * Fetch a single image from Wikipedia for a query string.
 * Tries: (1) direct page summary, (2) search + page summary, (3) Wikimedia Commons.
 */
async function fetchOneWikipediaImage(query) {
  const encoded = encodeURIComponent(query.trim());

  // Strategy 1: Direct page lookup.
  try {
    const res = await axios.get(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { timeout: 5000 },
    );
    const img = res.data?.originalimage?.source || res.data?.thumbnail?.source;
    if (img) return img;
  } catch {
    // Not found — try next strategy.
  }

  // Strategy 2: Search Wikipedia, take the best result's image.
  try {
    const searchRes = await axios.get(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srlimit=3&format=json&origin=*`,
      { timeout: 5000 },
    );
    const titles = searchRes.data?.query?.search?.map((r) => r.title) || [];
    for (const title of titles) {
      try {
        const fbRes = await axios.get(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
          { timeout: 4000 },
        );
        const img = fbRes.data?.originalimage?.source || fbRes.data?.thumbnail?.source;
        if (img) return img;
      } catch {
        // Skip this result.
      }
    }
  } catch {
    // Search failed.
  }

  // Strategy 3: Wikimedia Commons file search (great for art, artists, museums).
  try {
    const commonsRes = await axios.get(
      `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srnamespace=6&srlimit=1&format=json&origin=*`,
      { timeout: 5000 },
    );
    const fileTitle = commonsRes.data?.query?.search?.[0]?.title;
    if (fileTitle) {
      const infoRes = await axios.get(
        `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`,
        { timeout: 5000 },
      );
      const pages = infoRes.data?.query?.pages || {};
      const page = Object.values(pages)[0];
      const img = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url;
      if (img) return img;
    }
  } catch {
    // Commons failed.
  }

  return null;
}

/**
 * Fetch diverse contextual images for the slideshow.
 * Takes Gemini's search queries + identification data for robust fallbacks.
 */
async function fetchSlideImages(queries, identification, grounding) {
  // Build a broad list of queries: Gemini's suggestions + smart fallbacks.
  const allQueries = [...(queries || [])];

  // Add fallback queries from identification if Gemini's aren't enough.
  const artist = identification?.artistGuess;
  const title = identification?.titleGuess;
  if (artist && artist !== "uncertain" && !allQueries.some((q) => q.toLowerCase().includes(artist.toLowerCase()))) {
    allQueries.push(artist);
  }
  if (title && title !== "uncertain" && !allQueries.some((q) => q.toLowerCase().includes(title.toLowerCase()))) {
    allQueries.push(title);
  }

  // Deduplicate queries (case-insensitive).
  const seen = new Set();
  const uniqueQueries = allQueries.filter((q) => {
    const key = q.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log("[slideshow] Fetching images for queries:", uniqueQueries);

  const results = await Promise.allSettled(
    uniqueQueries.map((q) => fetchOneWikipediaImage(q)),
  );

  const images = results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter(Boolean);

  // Also include grounding images.
  if (grounding?.wikipedia?.thumbnailUrl) images.push(grounding.wikipedia.thumbnailUrl);
  if (grounding?.met?.imageUrl) images.push(grounding.met.imageUrl);

  // Deduplicate final URLs.
  const unique = [...new Set(images)];
  console.log(`[slideshow] Found ${unique.length} unique images`);
  return unique;
}

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

    const communityMatch = await matchUploadAgainstBlog(
      ai,
      imagePath,
      imageBase64,
      req.file.mimetype,
    );

    let identification;
    let grounding;

    if (communityMatch) {
      identification = {
        titleGuess: communityMatch.post.title,
        artistGuess: communityMatch.post.author,
        likelyKnownArtwork: true,
        visualDescription: communityMatch.reason,
        searchQueries: [],
        matchedFromCommunity: true,
      };
      grounding = {
        identification,
        queries: [],
        wikipedia: null,
        met: null,
        community: communityMatch.post,
        sources: [
          {
            name: "ArtStories Community",
            title: communityMatch.post.title,
            url: `/blog/${communityMatch.post.id}`,
          },
        ],
      };
    } else {
      identification = await identifyArtwork(ai, imageBase64, req.file.mimetype);
      grounding = await buildArtworkGrounding(identification);
    }

    const communityBlock = communityMatch
      ? `Community blog post (treat as authoritative ground truth — written by the artwork's own community):
Title: ${communityMatch.post.title}
Author: ${communityMatch.post.author}
Inspiration: ${communityMatch.post.inspiration}
Meaning: ${communityMatch.post.meaning}
Body: ${communityMatch.post.body}
`
      : "";

    const prompt = `
You are a captivated, opinionated art specialist — part historian, part storyteller, part obsessive. You speak in your own voice: warm, authoritative, full of genuine fascination. You don't produce reports; you share what grips you about a work.

Use the grounding data below as your factual foundation, but let your personality breathe through the writing. When you're uncertain, say so with intellectual humility — not disclaimers.

Rules:
- Treat Wikipedia and The Met as grounding, not as infallible proof.
- ${communityMatch
        ? "A community blog post matches this artwork. Trust it as the primary source — it was written by the artwork's community."
        : "If the image and sources do not clearly match, say \"uncertain\" instead of guessing."}
- Separate fact from interpretation and fiction.
- Cite source names naturally in factual analysis when relevant.

${communityBlock}
Gemini visual identification:
${JSON.stringify(identification, null, 2)}

Grounding from public APIs:
${JSON.stringify(grounding, null, 2)}

Return strict JSON only, with these fields:
{
  "artHistory": "Speak as an expert who loves this piece. Tell its history in your own words — who made it, when, why it matters, what the era felt like. Cite sources naturally if they helped. If uncertain, admit it with curiosity not caution.",
  "meaning": "What does this work *do* to you? Interpret its symbolism, composition, mood, and cultural weight the way a specialist who has spent years with art would — with conviction and nuance.",
  "lore": "Invent a vivid, clearly fictional myth or legend this artwork could have inspired. Make it feel ancient, poetic, and earned by the image itself.",
  "videoScript": "Write a 30-second cinematic voiceover — one flowing paragraph — in the voice of this art specialist. Evocative, rhythmic, made to be spoken aloud while slides display.",
  "slideCaptions": ["Array of exactly 5 short, evocative one-sentence captions for a documentary slideshow: (1) introduce the piece, (2) the artist's life/world, (3) the historical era or movement, (4) the emotional/symbolic core, (5) closing poetic thought."],
  "slideSearchQueries": ["Array of exactly 5 Wikipedia article titles to fetch images for the slideshow. Each MUST be a different topic — never repeat the same subject. Use real, well-known Wikipedia article titles that are likely to have images: (1) the artist's name (e.g. 'Leonardo da Vinci'), (2) the art movement or style (e.g. 'Impressionism'), (3) the city or country where it was created (e.g. 'Florence' or 'Paris'), (4) the museum where it is held (e.g. 'Louvre' or 'Metropolitan Museum of Art'), (5) a related famous artwork by the same artist or movement (e.g. 'The Last Supper')."],
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
    const verification = await verifyAnalysis(ai, analysis, grounding, communityMatch);

    // Fetch contextual images from Wikipedia + Wikimedia Commons for the slideshow.
    const queries = Array.isArray(analysis.slideSearchQueries)
      ? analysis.slideSearchQueries
      : [];
    const uniqueSlideImages = await fetchSlideImages(queries, identification, grounding);

    res.json({
      success: true,
      analysis,
      grounding,
      slideImages: uniqueSlideImages,
      verification,
      communityMatch: communityMatch
        ? {
            post: communityMatch.post,
            confidence: communityMatch.confidence,
            method: communityMatch.method,
            distance: communityMatch.distance,
            reason: communityMatch.reason,
          }
        : null,
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

app.post("/generate-narration", async (req, res, next) => {
  try {
    const { script } = req.body;

    if (!script || typeof script !== "string") {
      res.status(400).json({ error: "Provide a non-empty script string." });
      return;
    }

    const audio = await generateVoice(script);

    res.json({
      success: true,
      audio,
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
