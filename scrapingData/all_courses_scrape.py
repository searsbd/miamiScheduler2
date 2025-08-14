import requests
import json
from bs4 import BeautifulSoup

with open('intermediary/class_codes.json', 'r') as file:
    string_array = json.load(file)

print(string_array)

iterator = 0

for i in range(len(string_array)):
    # 1. Start a session to handle cookies automatically
    session = requests.Session()
    headers = {
        "User-Agent": "Mozilla/5.0"
    }

    # 2. GET the main page to get cookies and token
    get_resp = session.get("https://www.apps.miamioh.edu/courselist/", headers=headers)
    soup = BeautifulSoup(get_resp.text, "html.parser")

    # Find the CSRF token in the form
    token = soup.find("input", {"name": "_token"})["value"]

    term = "202610"

    # 3. Prepare POST payload with the new token
    payload = {
        "_token": token,
        "term": term,
        "campusFilter[]": ["All", "Regional", "H", "L", "M", "O", "V"],
        "subject[]": string_array[i],
        "courseNumber": "",
        "openWaitlist": "",
        "crnNumber": "",
        "level": "",
        "courseTitle": "",
        "instructor": "",
        "instructorUid": "",
        "creditHours": "",
        "startEndTime[]": ["", ""],
        "courseSearch": ""
    }

    # 4. POST the search request
    post_resp = session.post("https://www.apps.miamioh.edu/courselist/", headers=headers, data=payload)

    # 5. Save the output to a file in the same directory
    with open("intermediary/individual_blocks/" + str(i) + ".html", "w", encoding="utf-8") as f:
        f.write(post_resp.text)