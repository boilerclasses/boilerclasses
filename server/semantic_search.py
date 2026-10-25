import argparse
import json
import re
from functools import lru_cache

import redis

from embeddings import (
    INTRO_WEIGHT,
    POPULARITY_WEIGHT,
    SEMANTIC_CANDIDATES,
    SEMANTIC_MAX_DISTANCE,
    VECTOR_FIELD_NAME,
    VECTOR_INDEX_NAME,
    embed_query,
)


DEFAULT_QUERY = "low level classes about operating systems and memory"
TAG_SPECIAL_CHARACTERS = re.compile(r"([^a-zA-Z0-9_])")


def escape_tag(value):
    return TAG_SPECIAL_CHARACTERS.sub(r"\\\1", str(value))


def tag_filter(field, values):
    escaped = "|".join(escape_tag(value) for value in values)
    return f"@{field}:{{{escaped}}}"


def build_filter_query(filters):
    if not filters:
        return "*"

    clauses = []
    if filters.get("subjects"):
        clauses.append(tag_filter("subjectCode", filters["subjects"]))
    if filters.get("terms"):
        clauses.append(tag_filter("terms", filters["terms"]))
    for gened in filters.get("geneds", []):
        clauses.append(tag_filter("gened", [gened]))
    if filters.get("schedule_types"):
        clauses.append(tag_filter("sched", filters["schedule_types"]))
    if filters.get("levels"):
        ranges = [
            f"@courseCode:[{level * 100} {level * 100 + 9999}]"
            for level in filters["levels"]
        ]
        clauses.append(f"({' | '.join(ranges)})")
    if "credit_min" in filters and "credit_max" in filters:
        minimum = filters["credit_min"]
        maximum = filters["credit_max"]
        clauses.append(
            f"(@creditMin:[{minimum} {maximum}] | "
            f"@creditMax:[{minimum} {maximum}])"
        )
    return " ".join(clauses) or "*"


@lru_cache(maxsize=1024)
def query_vector(query):
    # the same text with different filters (or a cache miss at Cloudflare) skips the model
    return embed_query(query).tobytes()


def search(query, limit, filters=None, client=None, max_distance=SEMANTIC_MAX_DISTANCE):
    if not query.strip():
        return []
    if limit < 1:
        return []

    client = client or redis.Redis(host="localhost", port=6379)
    vector = query_vector(query)
    filter_query = build_filter_query(filters)
    filter_expression = "*" if filter_query == "*" else f"({filter_query})"
    pool = max(limit, SEMANTIC_CANDIDATES)
    knn_query = (
        f"{filter_expression}=>[KNN {pool} @{VECTOR_FIELD_NAME} "
        "$query_vector AS vector_score]"
    )
    result = client.execute_command(
        "FT.SEARCH",
        VECTOR_INDEX_NAME,
        knn_query,
        "PARAMS", "2", "query_vector", vector,
        "SORTBY", "vector_score",
        "LIMIT", "0", str(pool),
        "RETURN", "4", "courseKey", "vector_score", "popularity", "intro",
        "DIALECT", "2",
    )

    candidates = []
    for offset in range(1, len(result), 2):
        fields = result[offset + 1]
        row = {
            fields[index].decode("utf-8"): fields[index + 1]
            for index in range(0, len(fields), 2)
        }
        distance = float(row["vector_score"])
        if distance > max_distance:
            continue
        # see POPULARITY_WEIGHT in embeddings.py
        score = (distance
                 - POPULARITY_WEIGHT * float(row.get("popularity", 0))
                 - INTRO_WEIGHT * float(row.get("intro", 0)))
        candidates.append((score, row["courseKey"].decode("utf-8"), distance))
    candidates.sort()
    rows = [(course_key, distance) for _, course_key, distance in candidates[:limit]]

    pipe = client.pipeline(transaction=False)
    for course_key, _ in rows:
        pipe.execute_command("JSON.GET", course_key)
    courses = pipe.execute()

    matches = []
    for (course_key, distance), serialized_course in zip(rows, courses):
        course = json.loads(serialized_course)
        matches.append({
            "courseKey": course_key,
            "course": course,
            "detailId": course["detailId"],
            "fullTitle": course["fullTitle"],
            "description": course["description"],
            "distance": distance,
        })
    return matches


def main():
    parser = argparse.ArgumentParser(description="Test semantic course retrieval")
    parser.add_argument("query", nargs="?", default=DEFAULT_QUERY)
    parser.add_argument("--limit", type=int, default=10)
    args = parser.parse_args()

    print(f"Query: {args.query}\n")
    for rank, match in enumerate(search(args.query, args.limit), start=1):
        print(f"{rank}. {match['fullTitle']}")
        print(f"   cosine distance: {match['distance']:.4f}")
        print(f"   detail id: {match['detailId']}")
        print(f"   {match['description'][:240].strip()}\n")


if __name__ == "__main__":
    main()
