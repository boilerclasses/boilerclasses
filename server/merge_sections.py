"""Merge the schedule terms' section files into sections_out.json ({termCode: {detailId: sections}}).

Used by the data pipeline's publish job. A term whose fresh file is missing keeps its entry
from the currently pinned snapshot, so one failed scrape doesn't freeze or drop the others.
"""

import argparse
import json
from pathlib import Path


def term_code(term):
    # same as harmonize.py: Fall 2026 -> 202710, Spring 2026 -> 202620
    season, year = term.split(" ")
    return f"{int(year) + 1}10" if season == "Fall" else f"{year}20"


def main():
    parser = argparse.ArgumentParser(description="Merge schedule terms' sections")
    parser.add_argument("--terms-file", default="../src/data/terms.json")
    parser.add_argument("--sections-dir", default="data/sections", help="holds fresh <code>.json files")
    parser.add_argument("--pinned", help="currently pinned sections snapshot, if any")
    parser.add_argument("--out", default="sections_out.json")
    args = parser.parse_args()

    # the schedule terms are the newest 2 in terms.json (SCHEDULE_SEMESTERS in src/lib/terms.js)
    codes = [term_code(term) for term in json.load(open(args.terms_file))["all"][:2]]

    pinned = {}
    if args.pinned and Path(args.pinned).exists():
        data = json.load(open(args.pinned))
        # snapshots from before multi-term support are {detailId: sections} for an unrecorded term
        if not any(isinstance(value, list) for value in data.values()):
            pinned = data

    merged = {}
    for code in codes:
        fresh = Path(args.sections_dir) / f"{code}.json"
        if fresh.exists():
            merged[code] = json.load(open(fresh))
        elif code in pinned:
            print(f"::warning::no fresh sections for {code}, keeping the pinned ones")
            merged[code] = pinned[code]
        else:
            print(f"::warning::no sections for {code}, leaving it out")

    if not merged:
        raise SystemExit(f"no sections for any of {codes}")
    with open(args.out, "w") as out:
        json.dump(merged, out, separators=(",", ":"), sort_keys=True)
    print(f"merged sections for {sorted(merged)}")


if __name__ == "__main__":
    main()
