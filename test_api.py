import uuid
import requests

url = "http://127.0.0.1:5000/posts"



# 1. Define the data you want to send (must match what app.py expects)
payload = {
    "user_id": 1, # Make sure a user with ID 1 actually exists in your database first!
    "content": "This is a test post from my Python script."
}
# 2. Send the POST request to your Flask server
response = requests.post("http://127.0.0.1:5000/posts", json=payload)

# 3. Print the server's response
print(f"Status Code: {response.status_code}")
print(response.json())
