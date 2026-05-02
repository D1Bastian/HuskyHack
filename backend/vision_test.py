import requests
import base64
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GOOGLE_VISION_API_KEY")

def identify_artwork(image_bytes):
    url = f"https://vision.googleapis.com/v1/images:annotate?key={API_KEY}"
    
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    
    payload = {
        "requests": [{
            "image": {"content": encoded},
            "features": [{"type": "WEB_DETECTION", "maxResults": 5}]
        }]
    }
    
    response = requests.post(url, json=payload)
    data = response.json()
    
    web = data["responses"][0]["webDetection"]
    
    best_guesses = web.get("bestGuessLabels", [])
    entities = web.get("webEntities", [])
    
    return {
        "best_guess": best_guesses[0]["label"] if best_guesses else None,
        "entities": [(e["description"], e["score"]) for e in entities if "score" in e]
    }

# Test it
with open("starry_night.jpg", "rb") as f:
    result = identify_artwork(f.read())

print(result["best_guess"])
print(result["entities"])