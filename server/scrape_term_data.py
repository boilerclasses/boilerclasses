"""Scrape the schedule terms' class dates and exams into termdata_out.json.

Output is {termCode: {"dates": ..., "exams": ...}} for the newest 2 terms in terms.json:
  dates: {"classesBegin", "classesEnd", "noClassDays": [ISO dates]} from Purdue's academic
         calendar on events.purdue.edu (a Localist site with a JSON API)
  exams: {"SUBJ 12345": [{"kind", "date", "start", "end", "rooms", "crn"}]} from the
         registrar's final and evening exam PDFs, which only ever cover the current term

Used by the data pipeline's publish job and pinned in termdata.lock. Each part of a term
that can't be scraped this run (exams for a term the PDFs don't cover yet, or an API
outage) keeps its value from the currently pinned snapshot.
"""

import argparse
import io
import json
import re
from datetime import date, timedelta
from pathlib import Path

import requests
from pypdf import PdfReader
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from merge_sections import term_code

EVENTS_URL = "https://events.purdue.edu/api/2/events"
EXAM_PDFS = {
    "final": "https://www.purdue.edu/registrar/pdf/exam/current_final_exam_schedule_PWL.pdf",
    "evening": "https://www.purdue.edu/registrar/pdf/exam/current_evening_exam_schedule_PWL.pdf",
}
HEADERS = {"User-Agent": "boilerclasses-scraper (+https://www.boilerclasses.com)"}


def make_session():
    # events.purdue.edu often times out (504) on its first try for a range
    session = requests.Session()
    session.headers.update(HEADERS)
    session.mount("https://", HTTPAdapter(max_retries=Retry(
        total=4, backoff_factor=2, status_forcelist=[429, 500, 502, 503, 504])))
    return session


# --- class dates -----------------------------------------------------------------------

def term_months(term):
    """The months a term's classes fall in, which keeps the API's date range small."""
    season, year = term.split(" ")
    return {"Spring": (f"{year}-01-01", f"{year}-05-31"),
            "Summer": (f"{year}-05-01", f"{year}-08-31"),
            "Fall": (f"{year}-08-01", f"{year}-12-31")}[season]


def fetch_calendar_events(session, start, end):
    """Academic calendar events between two dates as (title, [ISO dates]) pairs.

    The API returns a multi-day event once per day, so instances are grouped by event id.
    """
    events, page = {}, 1
    while True:
        response = session.get(EVENTS_URL, timeout=60, params={
            "keyword": "academic calendar", "start": start, "end": end, "pp": 100, "page": page})
        response.raise_for_status()
        data = response.json()
        for item in data["events"]:
            event = item["event"]
            days = events.setdefault(event["id"], (event["title"].strip(), set()))[1]
            for instance in event["event_instances"]:
                first = date.fromisoformat(instance["event_instance"]["start"][:10])
                last = instance["event_instance"].get("end")
                last = date.fromisoformat(last[:10]) if last else first
                while first <= last:
                    days.add(first.isoformat())
                    first += timedelta(days=1)
        if page >= data["page"]["total"]:
            break
        page += 1
    return [(title, sorted(days)) for title, days in events.values()]


def class_dates(term, events):
    """A term's first and last day of classes and the days without class in between.

    "Classes Begin" and "Classes End" events name their term ("Fall 2026 Semester Classes
    Begin", "Spring Semester 2027 Classes Begin"). Every other academic calendar event
    strictly between them is a break or holiday, so no list of holiday names is needed.
    """
    season, year = term.split(" ")

    def named(title, words):
        return all(re.search(rf"\b{word}\b", title, re.I) for word in (season, year, *words))

    begin = [days[0] for title, days in events if named(title, ["classes", "begin"])]
    end = [days[-1] for title, days in events if named(title, ["classes", "end"])]
    if not begin or not end:
        return None
    begin, end = min(begin), max(end)
    no_class = sorted({day for _, days in events for day in days if begin < day < end})
    return {"classesBegin": begin, "classesEnd": end, "noClassDays": no_class}


# --- exams -----------------------------------------------------------------------------

EXAM_TIME = re.compile(r"\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{2})/(\d{2}) +(\d{1,2}:\d{2})([ap]) *- *(\d{1,2}:\d{2})([ap])")
# what follows a time or stands alone on a continuation line: "ME    1061    158    85"
ROOM = re.compile(r"^\s*(\S.*?)\s+\d+\s+\d+\s*$")
TERM_HEADER = re.compile(r"\b(Fall|Spring|Summer) (\d{4}) \(PWL\)")
SKIP = re.compile(r"^\s*(UniTime|[A-Z][a-z]{2} \d{2}/\d{2}, \d{4}|=+|Subject|-+ -)")


def to_24h(clock, half):
    hours, minutes = map(int, clock.split(":"))
    return f"{hours % 12 + (12 if half == 'p' else 0):02d}:{minutes:02d}"


def parse_exam_text(text, kind):
    """(term, {"SUBJ 12345": [exam]}) from a UniTime "schedule by course" PDF's text.

    Rows leave the subject (and for a course's later exams, the course) blank when it
    repeats. A row may name one section ("10002-001", CRN then section), extra rooms
    continue on the following lines, and "w/MA 51400" lines cross-list another course
    into the same exam.
    """
    term = TERM_HEADER.search(text)
    if not term:
        raise ValueError(f"{kind} exam schedule has no term header")
    season, year = term.group(1), int(term.group(2))

    exams, aliases = {}, {}
    subject = course = None
    last = None
    for line in text.splitlines():
        if not line.strip() or SKIP.match(line):
            continue
        time = EXAM_TIME.search(line)
        left = line[:time.start()] if time else line
        tokens = left.split()
        cross_list = tokens and tokens[0].startswith("w/")
        if tokens and re.fullmatch(r"(w/)?[A-Z]{2,5}", tokens[0]) and len(tokens) > 1 and re.fullmatch(r"\d{5}\w*", tokens[1]):
            if cross_list:
                aliases[f"{tokens[0][2:]} {tokens[1]}"] = f"{subject} {course}"
                continue
            subject, course, tokens = tokens[0], tokens[1], tokens[2:]
        elif tokens and re.fullmatch(r"\d{5}\w*", tokens[0]) and line[:8].strip() == "":
            course, tokens = tokens[0], tokens[1:]
        if not time:
            room = ROOM.match(line)
            if last is not None and room and not tokens[:1] == [course]:
                last["rooms"].append(" ".join(room.group(1).split()))
            continue
        section = next((token for token in tokens if re.fullmatch(r"\d{5}-\w+", token)), None)
        month, day = int(time.group(1)), int(time.group(2))
        # a fall term's January dates would be next year; spring and summer stay in one year
        exam_year = year + 1 if season == "Fall" and month < 8 else year
        room = ROOM.match(line[time.end():])
        last = {
            "kind": kind,
            "date": date(exam_year, month, day).isoformat(),
            "start": to_24h(time.group(3), time.group(4)),
            "end": to_24h(time.group(5), time.group(6)),
            "rooms": [" ".join(room.group(1).split())] if room else [],
            "crn": int(section.split("-")[0]) if section else None,
        }
        exams.setdefault(f"{subject} {course}", []).append(last)
    for alias, key in aliases.items():
        exams.setdefault(alias, []).extend(exams.get(key, []))
    # a cross-listed exam is listed under each of its courses as well as linked by "w/"
    for course, rows in exams.items():
        unique = {(row["kind"], row["date"], row["start"], row["crn"]): row for row in rows}
        exams[course] = sorted(unique.values(), key=lambda row: (row["date"], row["start"]))
    return f"{season} {year}", exams


def fetch_exams(session):
    """{term: {course: [exam]}} from the registrar's current final and evening exam PDFs."""
    by_term = {}
    for kind, url in EXAM_PDFS.items():
        response = session.get(url, timeout=60)
        response.raise_for_status()
        reader = PdfReader(io.BytesIO(response.content))
        text = "\n".join(page.extract_text(extraction_mode="layout") for page in reader.pages)
        term, exams = parse_exam_text(text, kind)
        merged = by_term.setdefault(term, {})
        for course, rows in exams.items():
            merged.setdefault(course, []).extend(rows)
    return by_term


# --- main ------------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Scrape schedule terms' class dates and exams")
    parser.add_argument("--terms-file", default="../src/data/terms.json")
    parser.add_argument("--pinned", help="currently pinned term data snapshot, if any")
    parser.add_argument("--out", default="termdata_out.json")
    args = parser.parse_args()

    # the schedule terms are the newest 2 in terms.json (SCHEDULE_SEMESTERS in src/lib/terms.js)
    terms = json.load(open(args.terms_file))["all"][:2]
    pinned = json.load(open(args.pinned)) if args.pinned and Path(args.pinned).exists() else {}

    session = make_session()
    try:
        exams = fetch_exams(session)
    except (requests.RequestException, ValueError) as error:
        print(f"::warning::could not fetch exam schedules: {error}")
        exams = {}

    out = {}
    for term in terms:
        code = term_code(term)
        previous = pinned.get(code, {})
        try:
            dates = class_dates(term, fetch_calendar_events(session, *term_months(term)))
        except (requests.RequestException, KeyError, ValueError) as error:
            print(f"::warning::could not fetch the academic calendar for {term}: {error}")
            dates = None
        if dates is None:
            print(f"::warning::no class dates for {term}, keeping the pinned ones")
            dates = previous.get("dates")
        entry = {"dates": dates, "exams": exams.get(term, previous.get("exams", {}))}
        out[code] = entry
        print(f"{term}: dates {'found' if dates else 'missing'}, exams for {len(entry['exams'])} courses")

    with open(args.out, "w") as file:
        json.dump(out, file, separators=(",", ":"), sort_keys=True)


if __name__ == "__main__":
    main()
