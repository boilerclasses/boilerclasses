"""Loads a professor's rating through a new container the way a course page does
(src/components/RMP.js): search RMP for the most common instructors until one is
found, then fetch that professor's rating. deploy.sh runs this inside the container
before it takes traffic, so a broken ratings route keeps the old one serving."""
import json
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter

# RMP sometimes rate limits or times out; those are retried for this long
RETRY_SECONDS = 120
# more than one, since any single instructor can be missing from RMP
INSTRUCTORS = 5


def get(route, **params):
    request = urllib.request.Request(
        f"http://127.0.0.1:3000/api/ratings/{route}?{urllib.parse.urlencode(params)}",
        headers={"Host": "boilerclasses.com"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


with open("/home/src/data/rmpSchools.json") as infile:
    schools = json.load(infile)
with open("/home/server/classes_out.json") as infile:
    courses = json.load(infile)
# the instructors listed on the most courses are the likeliest to be on RMP; a real
# name has a first and last name, which leaves out placeholders like "TBA"
taught = Counter(
    name
    for course in courses
    for name in {name for names in course.get("instructor", {}).values() for name in names if " " in name}
)
instructors = [name for name, _ in taught.most_common(INSTRUCTORS)]


def first_rating():
    for name in instructors:
        for school in schools:
            profs = [prof for prof in get("searchTeacher", name=name, id=school)["prof"] if prof]
            if profs:
                return get("getTeacher", id=profs[0]["id"])["RMPrating"]
    sys.exit(f"none of {', '.join(instructors)} were found on RMP")


deadline = time.monotonic() + RETRY_SECONDS
while True:
    try:
        professor = first_rating()
        break
    # RMP trouble reaches us as a 500 from the route or a timeout; a 4xx won't fix itself
    except OSError as error:
        if getattr(error, "code", 500) < 500 or time.monotonic() > deadline:
            sys.exit(f"ratings failed: {error}")
        time.sleep(5)

if not professor or "avgRating" not in professor:
    sys.exit(f"getTeacher returned no rating: {professor}")
print(f"ratings work: {professor['firstName']} {professor['lastName']} is rated {professor['avgRating']}")
