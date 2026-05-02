const stripJsonFences = (text) => {
  const s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  return start !== -1 && end > start ? s.slice(start, end + 1) : s;
};

function buildSourceText(grounding, communityMatch) {
  const parts = [];
  if (communityMatch?.post) {
    const p = communityMatch.post;
    parts.push(
      `COMMUNITY BLOG POST (highest authority — uploaded by the artwork's own community):
Title: ${p.title}
Author: ${p.author}
Inspiration: ${p.inspiration}
Meaning: ${p.meaning}
Body: ${p.body}`,
    );
  }
  if (grounding?.wikipedia) {
    const w = grounding.wikipedia;
    parts.push(
      `WIKIPEDIA:
Title: ${w.title}
Description: ${w.description || ""}
Summary: ${w.summary || ""}`,
    );
  }
  if (grounding?.met) {
    const m = grounding.met;
    parts.push(
      `THE MET MUSEUM:
Title: ${m.title}
Artist: ${m.artist || ""}
Date: ${m.date || ""}
Culture: ${m.culture || ""}
Medium: ${m.medium || ""}
Department: ${m.department || ""}
Classification: ${m.classification || ""}`,
    );
  }
  return parts.join("\n\n");
}

export async function verifyAnalysis(ai, analysis, grounding, communityMatch) {
  if (communityMatch?.post) {
    return {
      artHistory: { status: "grounded", note: "Matched and grounded in a community blog post." },
      meaning: { status: "grounded", note: "Matched and grounded in a community blog post." },
    };
  }

  const sourceText = buildSourceText(grounding, communityMatch);

  if (!sourceText.trim()) {
    return {
      artHistory: { status: "no-sources", note: "No matching sources were found for this artwork." },
      meaning: { status: "no-sources", note: "No matching sources were found for this artwork." },
    };
  }

  const prompt = `
You are a fact-checker. Two text cards were generated about an artwork. Compare them strictly against the SOURCES below and judge how grounded each card is.

SOURCES:
${sourceText}

CARD A — Art History (factual claims):
${analysis.artHistory || ""}

CARD B — Meaning (interpretation, more subjective):
${analysis.meaning || ""}

For each card, classify as:
- "grounded": every concrete factual claim is directly supported by the sources
- "partial": main claims are supported but some details are not in the sources
- "unverified": significant claims have no source backing, or the card contradicts the sources

Be strict for Card A — historical facts (dates, artist, period) MUST appear in the sources to be "grounded".
Be lenient for Card B — interpretation is allowed to extrapolate, but should not contradict the sources.

Return strict JSON only:
{
  "artHistory": {
    "status": "grounded" | "partial" | "unverified",
    "note": "one short sentence explaining what is or isn't supported"
  },
  "meaning": {
    "status": "grounded" | "partial" | "unverified",
    "note": "one short sentence"
  }
}
`;

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: [{ text: prompt }],
    });
    const parsed = JSON.parse(stripJsonFences(response.text || ""));
    return {
      artHistory: parsed.artHistory || { status: "unverified", note: "Verifier returned no result." },
      meaning: parsed.meaning || { status: "unverified", note: "Verifier returned no result." },
    };
  } catch (error) {
    console.warn("Verifier failed:", error.message);
    return {
      artHistory: { status: "unverified", note: "Verification step failed." },
      meaning: { status: "unverified", note: "Verification step failed." },
    };
  }
}
