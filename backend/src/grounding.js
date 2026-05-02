import axios from "axios";

const http = axios.create({
  timeout: 9000,
  headers: {
    "User-Agent": "HuskyHackArtStories/1.0 (hackathon prototype)",
  },
});

const uniq = (items) =>
  [...new Set(items.map((item) => item?.trim()).filter(Boolean))];

const compactObject = (value) =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""));

export function buildGroundingQueries(identification = {}) {
  const title = identification.titleGuess || identification.title || identification.bestGuess;
  const artist = identification.artistGuess || identification.artist;
  const queries = [
    title,
    title && artist ? `${title} ${artist}` : null,
    ...(Array.isArray(identification.searchQueries) ? identification.searchQueries : []),
  ];

  return uniq(queries).slice(0, 5);
}

export async function fetchWikipediaSummary(query) {
  const candidates = uniq([query, `${query} (painting)`, `${query} (artwork)`]);

  for (const candidate of candidates) {
    try {
      const { data } = await http.get(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate)}`,
      );

      if (data?.type === "disambiguation" || !data?.extract) {
        continue;
      }

      return compactObject({
        source: "Wikipedia",
        title: data.title,
        description: data.description,
        summary: data.extract,
        url: data.content_urls?.desktop?.page,
        thumbnailUrl: data.thumbnail?.source,
      });
    } catch (error) {
      if (error.response?.status !== 404) {
        console.warn(`Wikipedia grounding failed for "${candidate}": ${error.message}`);
      }
    }
  }

  return null;
}

const scoreMetObject = (object, query) => {
  const normalizedQuery = query.toLowerCase();
  const title = object.title?.toLowerCase() || "";
  const artist = object.artistDisplayName?.toLowerCase() || "";
  let score = 0;

  if (title === normalizedQuery) score += 100;
  if (title.includes(normalizedQuery)) score += 45;
  if (normalizedQuery.includes(title) && title.length > 8) score += 30;
  if (artist && normalizedQuery.includes(artist)) score += 20;
  if (object.primaryImageSmall) score += 5;

  return score;
};

export async function fetchMetObject(query) {
  try {
    const search = await http.get("https://collectionapi.metmuseum.org/public/collection/v1/search", {
      params: {
        hasImages: true,
        q: query,
      },
    });

    const objectIds = search.data?.objectIDs?.slice(0, 6) || [];
    if (!objectIds.length) {
      return null;
    }

    const objects = await Promise.all(
      objectIds.map(async (id) => {
        try {
          const { data } = await http.get(
            `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
          );
          return data;
        } catch {
          return null;
        }
      }),
    );

    const bestMatch = objects
      .filter(Boolean)
      .map((object) => ({ object, score: scoreMetObject(object, query) }))
      .sort((a, b) => b.score - a.score)[0];

    if (!bestMatch || bestMatch.score < 30) {
      return null;
    }

    const best = bestMatch.object;

    return compactObject({
      source: "The Metropolitan Museum of Art",
      objectId: best.objectID,
      title: best.title,
      artist: best.artistDisplayName,
      date: best.objectDate,
      culture: best.culture,
      medium: best.medium,
      department: best.department,
      classification: best.classification,
      url: best.objectURL,
      imageUrl: best.primaryImageSmall || best.primaryImage,
    });
  } catch (error) {
    console.warn(`Met grounding failed for "${query}": ${error.message}`);
    return null;
  }
}

export async function buildArtworkGrounding(identification = {}) {
  const queries = buildGroundingQueries(identification);
  const results = {
    identification,
    queries,
    wikipedia: null,
    met: null,
    sources: [],
  };

  for (const query of queries) {
    const [wikipedia, met] = await Promise.all([
      results.wikipedia ? Promise.resolve(results.wikipedia) : fetchWikipediaSummary(query),
      results.met ? Promise.resolve(results.met) : fetchMetObject(query),
    ]);

    results.wikipedia = results.wikipedia || wikipedia;
    results.met = results.met || met;

    if (results.wikipedia && results.met) {
      break;
    }
  }

  results.sources = [results.wikipedia, results.met]
    .filter(Boolean)
    .map((source) =>
      compactObject({
        name: source.source,
        title: source.title,
        url: source.url,
      }),
    );

  return results;
}
