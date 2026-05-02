import requests

def get_artwork_data(title):
    # Step 1: search for the title
    search_url = "https://collectionapi.metmuseum.org/public/collection/v1/search"
    search_response = requests.get(search_url, params={"q": title})
    search_data = search_response.json()
    
    if not search_data["total"]:
        return None
    
    # Take the first result
    object_id = search_data["objectIDs"][0]
    
    # Step 2: fetch full data using that ID
    object_url = f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{object_id}"
    object_response = requests.get(object_url)
    
    return object_response.json()

result = get_artwork_data("Starry Night")
print(result["title"])
print(result["artistDisplayName"])
print(result["objectDate"])
print(result["primaryImageSmall"])