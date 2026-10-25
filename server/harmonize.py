import json
import os
import argparse
from tqdm import tqdm
import re
from schema import validate_courses


def first_last(name):
    """Keep first/last names without treating a generational suffix as a surname."""
    parts = name.split()
    while len(parts) > 1 and re.fullmatch(r"(?:Jr|Sr|II|III|IV|V|VI|VII|VIII|IX|X)\.?", parts[-1], re.I):
        parts.pop()
    if not parts:
        return "TBA"
    first, last = parts[0], parts[-1].rstrip(",")
    return first if len(parts) == 1 else f"{first} {last}"

"""
structure for data:
{
  title:
  subjectCode:
  courseCode:
  instructor: [
    spring24: [],
    fall23: []..
  ]
  description:
  credits: [x, y]
  terms: [..]
  gened: [..]
  gpa: {
    prof1: [A+, A, A-, .. F, average],
    prof2: [A+, A, A-, .. F, average]
  }
  prereqs: [..]
}
"""

parser = argparse.ArgumentParser(description="in/out files")
parser.add_argument(
    "-folder",
    default="data/",
    dest="folder",
    help="which folder for original class data: format is 'classes_<year>' ",
)
parser.add_argument(
    "-grades",
    default="data/grades/",
    dest="gradefolder",
    help="which folder for the grade data",
)
parser.add_argument(
    "-gened",
    default="data/gened/classes_gened.json",
    dest="genedfile",
    help="gened JSON file",
)
parser.add_argument(
    "-prereqs",
    default="data/prereqs/classes_prereqs.json",
    dest="prereqsfile",
    help="prereqs JSON file",
)

parser.add_argument(
    "-outfile",
    default="classes_out.json",
    dest="outfile",
    help="where to write result JSON",
)
parser.add_argument(
    "-termsfile",
    default="../src/data/terms.json",
    dest="termsfile",
    help="where to write the term list used by the frontend",
)

args = parser.parse_args()


def term_key(term):
    season, year = term.split(" ")
    return (int(year), {"Spring": 0, "Summer": 1, "Fall": 2}[season])

def term_code(term):
    # Purdue Banner codes: Fall 2026 -> 202710, Spring 2026 -> 202620
    season, year = term.split(" ")
    return f"{int(year) + 1}10" if season == "Fall" else f"{year}20"

# combining scraped JSONs into one file
out = {}
semesters = []

for file_name in sorted(os.listdir(args.folder)):
    path = args.folder + file_name
    if "json" not in path:
        continue
    f = open(path)
    data = json.load(f)
    f.close()
    validate_courses(data, kind="scraped", source=path)
    semesters.append(data)

# oldest first, so later semesters win when picking descriptions
semesters.sort(key=lambda data: term_key(data[0]["term"]))
all_terms = [data[0]["term"] for data in semesters]
latest_sem = all_terms[-1]

# (subject, course, term, crn) -> course indexes; CRNs get reused across semesters
grade_index = {}
# (subject, course, term) -> courses offered under that number that term
term_index = {}

# Group once in semester order rather than rescan all records per course.
# Preserve the existing punctuation-insensitive title identity and sort order.
grouped = {}
for semester in semesters:
    for course in semester:
        title = ''.join(char for char in course["title"] if char.isalnum())
        identity = f'{course["subjectCode"]} {course["courseCode"]}: {title}'
        grouped.setdefault(identity, []).append(course)

print("syncing up classes.....")
for class_id in tqdm(sorted(grouped)):
    instances = grouped[class_id]
    s, c = instances[0]["subjectCode"], instances[0]["courseCode"]
    class_data = {"terms": [], "instructor": {}, "crn": [], "sched": []}
    for class_sem in instances:
        class_data["crn"].extend(class_sem["crn"])
        term_index.setdefault((s, c, class_sem["term"]), []).append(len(out))
        for crn in class_sem["crn"]:
            grade_index.setdefault((s, c, class_sem["term"], crn), []).append(len(out))
        if "Distance Learning" not in class_sem["sched"] or class_sem["term"] == latest_sem:
            class_data["sched"].extend(class_sem["sched"])
        class_data["terms"].append(class_sem["term"])
        class_data["instructor"][class_sem["term"]] = [
            first_last(name) for name in class_sem["instructor"]
        ]
        if "<a href=" not in class_sem["description"]:
            class_data["description"] = class_sem["description"]
        # Newest scraped term wins, including explicit null prerequisites.
        if "prereqs" in class_sem:
            class_data["prereqs"] = class_sem["prereqs"]

    class_data["title"] = instances[-1]["title"]
    class_data["subjectCode"] = s
    class_data["courseCode"] = c
    class_data["crn"] = sorted(set(class_data["crn"]))
    class_data["sched"] = sorted(set(class_data["sched"]))
    if "description" not in class_data:
        class_data["description"] = instances[0]["description"]
    class_data["credits"] = next(
        (instance["credits"] for instance in instances if "<a href=" not in instance["description"]),
        [0, 0]
    )
    for instance in instances:
        if "<a href=" not in instance["description"]:
            class_data["credits"][0] = min(instance["credits"][0], class_data["credits"][0])
            class_data["credits"][1] = max(instance["credits"][1], class_data["credits"][1])
    out[class_id] = class_data

course_data = list(out.values())

for i in range(len(course_data)):
    course_data[i]["gened"] = []
    if "gpa" not in course_data[i]:
        course_data[i]["gpa"] = {}

# adding grade information
grade_fields = (
    "totalAplus", "totalA", "totalAminus", "totalBplus", "totalB", "totalBminus",
    "totalCplus", "totalC", "totalCminus", "totalDplus", "totalD", "totalDminus", "totalF",
)
print("adding grades....")
for file_name in tqdm(sorted(os.listdir(args.gradefolder))):
    if "json" not in file_name:
        continue
    currSubjectCode = ""
    currCourseCode = ""
    currTitle = ""
    currSemester = ""

    grade_file = open(args.gradefolder + file_name)
    grade_data = json.load(grade_file)
    grade_file.close()
    for grade in grade_data:
        if grade["subject"] != "":
            currSubjectCode = grade["subject"]

        if grade["course number"] != "":
            currCourseCode = grade["course number"]

        if grade["academic period desc"] != "":
            currSemester = grade["academic period desc"]

        if grade["title"] != "":
            currTitle = grade["title"]

        if grade["avg gpa"] == "NaN":
            continue
        # honors rows share CRNs with regular sections, so only attach them to honors courses
        # titles are truncated to 30 chars, so the suffix shows up as -Honors, -Honor, - Honors, -Hnrs, etc.
        isHonors = re.search(r"[-–]\s*(Honors?|Honrs?|Hnrs)\s*$", currTitle, re.I)
        matches = grade_index.get((currSubjectCode, currCourseCode, currSemester, int(grade["CRN"])))
        if not matches:
            # older scrapes miss some sections; fall back when only one course had this number that term
            offered = [
                i for i in term_index.get((currSubjectCode, currCourseCode, currSemester), [])
                if bool(isHonors) == bool(re.search(r"\b(Honors?|Honrs?|Hnrs)\b", course_data[i]["title"], re.I))
            ]
            matches = offered if len(offered) == 1 else []
        for i in matches:
            course = course_data[i]
            if isHonors and not re.search(r"\b(Honors?|Honrs?|Hnrs)\b", course["title"], re.I):
                continue
            counts = [grade[field] for field in grade_fields]
            course["gpa"].setdefault(currSemester, []).append(
                [grade["instructor"], counts + [float(grade["avg gpa"])]]
            )
print("syncing grades....")
for i in range(len(course_data)):
    gpa_data = {}
    gpa_data_count = {}
    for semester, data in course_data[i]["gpa"].items():
        for entry in data:
            instructor = entry[0]
            # "Last Sr, First Middle" -> "First Last Sr", then the same first/last as the instructor lists
            last, _, first = instructor.partition(", ")
            formattedInstructor = first_last(f"{first} {last}")

            if formattedInstructor in gpa_data:
                if semester in gpa_data[formattedInstructor]:
                    for k in range(len(gpa_data[formattedInstructor][semester])):
                        gpa_data[formattedInstructor][semester][k] = (
                            gpa_data[formattedInstructor][semester][k] * gpa_data_count[formattedInstructor][semester]
                            + entry[1][k]
                        ) / (gpa_data_count[formattedInstructor][semester] + 1)
                    gpa_data_count[formattedInstructor][semester] += 1
                else:
                    gpa_data[formattedInstructor][semester] = entry[1]
                    gpa_data_count[formattedInstructor][semester] = 1
            else:
                gpa_data[formattedInstructor] = {semester: entry[1]}
                gpa_data_count[formattedInstructor] = {semester: 1}

    # round once at the end so the result doesn't depend on section order
    course_data[i]["gpa"] = {
        instr: {sem: [round(v, 2) for v in vals] for sem, vals in sems.items()}
        for instr, sems in gpa_data.items()
    }

# adding geneds
gened_file = open(args.genedfile)
gened_data = json.load(gened_file)
gened_file.close()

print("adding geneds.....")
tags = []
for tag in tqdm(gened_data):
    for c in gened_data[tag]:
        sub, code = c.split(" ")
        for i in range(len(course_data)):
            if (
                course_data[i]["subjectCode"] == sub
                and course_data[i]["courseCode"] == code
                and tag not in course_data[i]["gened"]
            ):
                course_data[i]["gened"].append(tag)

# adding prereqs
prereqs_file = open(args.prereqsfile)
prereqs_data = json.load(prereqs_file)
prereqs_file.close()

print("adding prereqs.....")
# static file only fills in courses no scraped term has prereq info for
for c in course_data:
    key = f'{c["subjectCode"]} {c["courseCode"]}'
    if "prereqs" not in c and key in prereqs_data:
        c["prereqs"] = prereqs_data[key]
    if "prereqs" in c and c["prereqs"] is None:
        del c["prereqs"]


test = []
invalid_indices = []
for i in range(len(course_data)):
    course_data[i]["fullTitle"] = " ".join(
        [
            course_data[i]["subjectCode"],
            course_data[i]["courseCode"],
            course_data[i]["title"],
        ]
    )
    course_data[i]["detailId"] = re.sub("[^a-zA-Z0-9]", "", course_data[i]["fullTitle"])
    test.append(course_data[i]["detailId"])
    # THTR T1200 seems to be an issue here, can just remove (it is outdated)
    try:
        course_data[i]["courseCode"] = int(course_data[i]["courseCode"])
    except:
        invalid_indices.append(i)

invalid_indices = set(invalid_indices)
course_data = [c for i, c in enumerate(course_data) if i not in invalid_indices]

# prereq tokens "SUBJ CODE concurrent" -> "detailId concurrent" for courses we have pages for
detail_ids = {f'{c["subjectCode"]} {c["courseCode"]}': c["detailId"] for c in course_data}
for c in course_data:
    for j, token in enumerate(c.get("prereqs", [])):
        parts = token.split(" ")
        if len(parts) == 3 and f"{parts[0]} {parts[1]}" in detail_ids:
            c["prereqs"][j] = f'{detail_ids[f"{parts[0]} {parts[1]}"]} {parts[2]}'

print(f"writing to {args.outfile}...")
validate_courses(course_data, kind="harmonized", source=args.outfile)
outfile = open(args.outfile, "w")
json.dump(course_data, outfile, indent=4, sort_keys=True)
outfile.close()

print(f"writing to {args.termsfile}...")
os.makedirs(os.path.dirname(args.termsfile), exist_ok=True)
with open(args.termsfile, "w") as termsfile:
    json.dump({
        "current": {"name": latest_sem, "code": term_code(latest_sem)},
        "all": all_terms[::-1],
    }, termsfile, indent=2)
    termsfile.write("\n")
print("done!")


freq = {}
for item in test:
    if (item in freq):
        freq[item] += 1
    else:
        freq[item] = 1

for x in freq:
    if freq[x] > 1:
        print(x)
print(len(test), len(course_data))
