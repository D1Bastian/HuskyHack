import requests
from urllib.parse import quote

HEADERS = {"User-Agent": "HuskyHackArtStories/0.1 (jamesroma14@gmail.com)"}
TIMEOUT = 5


def get_artwork_info(title):
    """
    Fetch Wikipedia summary for an artwork by title.
    Accepts the best_guess string from identify_artwork() directly.
    Returns a dict on success, None if not found or on error.
    """
    data = _fetch_summary(title)
    if data is None:
        return None

    if data.get("type") == "disambiguation":
        data = _fetch_summary(title + " (painting)")
        if data is None:
            return None

    categories = _fetch_categories(data["title"])

    meaningful_categories = [
    c for c in categories 
    if not any(skip in c for skip in [
        "Articles", "All articles", "Commons", "Wikipedia"
    ])]

    return {
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "summary": data.get("extract", ""),
        "url": data.get("content_urls", {}).get("desktop", {}).get("page", ""),
        "thumbnail_url": data.get("thumbnail", {}).get("source") if data.get("thumbnail") else None,
        "categories": meaningful_categories,
    }


def enrich_with_met(artwork_info, title):
    """
    Merge Met Museum data into an existing artwork_info dict.
    Returns the dict unchanged if the Met doesn't have the piece.
    """
    try:
        from met_test import get_artwork_data
        met = get_artwork_data(title)
        if met:
            artwork_info["artist"] = met.get("artistDisplayName", "")
            artwork_info["date"] = met.get("objectDate", "")
            artwork_info["met_image_url"] = met.get("primaryImageSmall", "")
    except Exception:
        pass
    return artwork_info


def _fetch_summary(title):
    try:
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(title)}"
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()
    except Exception:
        return None


def _fetch_categories(title):
    try:
        params = {
            "action": "query",
            "titles": title,
            "prop": "categories",
            "format": "json",
            "cllimit": 10,
        }
        response = requests.get(
            "https://en.wikipedia.org/w/api.php",
            params=params,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        pages = response.json().get("query", {}).get("pages", {})
        categories = []
        for page in pages.values():
            for cat in page.get("categories", []):
                name = cat.get("title", "")
                categories.append(name.removeprefix("Category:"))
        return categories
    except Exception:
        return []


if __name__ == "__main__":
    # Basic fetch
    info = get_artwork_info("The Starry Night")
    if info:
        print("Title:", info["title"])
        print("Description:", info["description"])
        print("Summary:", info["summary"][:200], "...")
        print("URL:", info["url"])
        print("Thumbnail:", info["thumbnail_url"])
        print("Categories:", info["categories"])
    else:
        print("Not found on Wikipedia.")

    print()

    # Met enrichment
    enriched = enrich_with_met(info or {}, "Starry Night")
    print("Artist:", enriched.get("artist"))
    print("Date:", enriched.get("date"))
    print("Met image:", enriched.get("met_image_url"))

    print()

    # Graceful failure
    missing = get_artwork_info("xyzzy_nonexistent_painting_12345")
    print("Missing artwork result:", missing)
