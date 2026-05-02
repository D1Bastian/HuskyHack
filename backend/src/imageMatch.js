import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getAllPostsWithHash } from "./db.js";

const HASH_SIZE = 8;
const PHASH_DOWNSCALE = 32;
const STRONG_MATCH_DISTANCE = 8;
const CANDIDATE_DISTANCE = 20;
const MAX_CANDIDATES = 4;

async function hashImageRegion(imagePath, extractOptions) {
  let pipeline = sharp(imagePath).greyscale();
  if (extractOptions) pipeline = pipeline.extract(extractOptions);
  const raw = await pipeline
    .resize(PHASH_DOWNSCALE, PHASH_DOWNSCALE, { fit: "fill" })
    .raw()
    .toBuffer();

  const pixels = Array.from(raw);
  const dct = dct2d(pixels, PHASH_DOWNSCALE);
  const lowFreq = [];
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      if (x === 0 && y === 0) continue;
      lowFreq.push(dct[y * PHASH_DOWNSCALE + x]);
    }
  }
  const sorted = [...lowFreq].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  let bits = "";
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      if (x === 0 && y === 0) {
        bits += "0";
        continue;
      }
      bits += dct[y * PHASH_DOWNSCALE + x] > median ? "1" : "0";
    }
  }
  return bitsToHex(bits);
}

export async function computePHash(imagePath) {
  return hashImageRegion(imagePath, null);
}

export async function computeTileHashes(imagePath) {
  const meta = await sharp(imagePath).metadata();
  const w = meta.width;
  const h = meta.height;
  const hw = Math.floor(w / 2);
  const hh = Math.floor(h / 2);

  const regions = [
    { left: 0,  top: 0,  width: hw,     height: h      }, // left half
    { left: hw, top: 0,  width: w - hw, height: h      }, // right half
    { left: 0,  top: 0,  width: w,      height: hh     }, // top half
    { left: 0,  top: hh, width: w,      height: h - hh }, // bottom half
    { left: 0,  top: 0,  width: hw,     height: hh     }, // TL quadrant
    { left: hw, top: 0,  width: w - hw, height: hh     }, // TR quadrant
    { left: 0,  top: hh, width: hw,     height: h - hh }, // BL quadrant
    { left: hw, top: hh, width: w - hw, height: h - hh }, // BR quadrant
  ];

  const hashes = await Promise.all(
    regions.map((r) => hashImageRegion(imagePath, r).catch(() => null)),
  );
  return hashes.filter(Boolean);
}

function dct2d(pixels, size) {
  const out = new Float64Array(size * size);
  const cosCache = new Float64Array(size * size);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      cosCache[i * size + j] = Math.cos(((2 * i + 1) * j * Math.PI) / (2 * size));
    }
  }
  for (let u = 0; u < size; u++) {
    for (let v = 0; v < size; v++) {
      let sum = 0;
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          sum += pixels[i * size + j] * cosCache[i * size + u] * cosCache[j * size + v];
        }
      }
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      out[u * size + v] = (cu * cv * sum) / 4;
    }
  }
  return out;
}

function bitsToHex(bits) {
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

export function hammingDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    distance += popcount(xor);
  }
  return distance;
}

function popcount(n) {
  let count = 0;
  while (n) {
    count += n & 1;
    n >>>= 1;
  }
  return count;
}

export function findCandidates(queryHash) {
  const all = getAllPostsWithHash();
  const scored = all
    .map((post) => {
      const fullDist = hammingDistance(queryHash, post.phash);
      let tileMin = Infinity;
      try {
        const tiles = JSON.parse(post.tile_phashes || "[]");
        for (const tileHash of tiles) {
          const d = hammingDistance(queryHash, tileHash);
          if (d < tileMin) tileMin = d;
        }
      } catch {
        // ignore malformed tile data
      }
      const distance = Math.min(fullDist, tileMin);
      return { post, distance };
    })
    .filter((entry) => entry.distance <= CANDIDATE_DISTANCE)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_CANDIDATES);
  return scored;
}

export async function confirmWithGemini(ai, queryImageBase64, queryMimeType, candidates) {
  if (!candidates.length) return null;

  const candidateBlocks = await Promise.all(
    candidates.map(async (entry, index) => {
      try {
        const filePath = entry.post.image_path;
        const buffer = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mimeMap = { ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
        const mimeType = mimeMap[ext] || "image/jpeg";
        return {
          index,
          inlineData: {
            mimeType,
            data: buffer.toString("base64"),
          },
        };
      } catch {
        return null;
      }
    }),
  );

  const validBlocks = candidateBlocks.filter(Boolean);
  if (!validBlocks.length) return null;

  const contents = [
    { text: "QUERY IMAGE (the user just uploaded this):" },
    { inlineData: { mimeType: queryMimeType, data: queryImageBase64 } },
  ];
  validBlocks.forEach((block) => {
    contents.push({ text: `CANDIDATE ${block.index + 1}:` });
    contents.push({ inlineData: block.inlineData });
  });
  contents.push({
    text: `
You are matching artworks. The QUERY IMAGE may be the same physical artwork as one of the candidates, possibly photographed from a different angle, lighting, or crop.

Return strict JSON only:
{
  "matchIndex": <integer 1-based index of the matching candidate, or 0 if no candidate is the same artwork>,
  "confidence": "high" | "medium" | "low",
  "reason": "one short sentence"
}

Be conservative. Only declare a match if you are confident the candidate depicts the same physical artwork as the query.
`,
  });

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents,
    });
    const raw = (response.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    const text = jsonStart !== -1 && jsonEnd > jsonStart ? raw.slice(jsonStart, jsonEnd + 1) : raw;
    const parsed = JSON.parse(text);
    if (
      typeof parsed.matchIndex === "number" &&
      parsed.matchIndex >= 1 &&
      parsed.matchIndex <= validBlocks.length &&
      parsed.confidence !== "low"
    ) {
      const matchedEntry = candidates[validBlocks[parsed.matchIndex - 1].index];
      return {
        post: matchedEntry.post,
        distance: matchedEntry.distance,
        confidence: parsed.confidence,
        reason: parsed.reason || "",
        method: "gemini-confirmed",
      };
    }
  } catch (error) {
    console.warn("Gemini match confirmation failed:", error.message);
  }
  return null;
}

export async function matchUploadAgainstBlog(ai, imagePath, imageBase64, mimeType) {
  let queryHash;
  try {
    queryHash = await computePHash(imagePath);
  } catch (error) {
    console.warn("pHash computation failed:", error.message);
    return null;
  }

  const candidates = findCandidates(queryHash);
  if (!candidates.length) return null;

  const closest = candidates[0];
  if (closest.distance <= STRONG_MATCH_DISTANCE) {
    return {
      post: closest.post,
      distance: closest.distance,
      confidence: "high",
      reason: "Near-exact perceptual hash match.",
      method: "phash",
    };
  }

  return confirmWithGemini(ai, imageBase64, mimeType, candidates);
}
