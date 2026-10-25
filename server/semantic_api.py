import json
import re

import redis
from flask import Flask, jsonify, request
from waitress import serve

from embeddings import SEMANTIC_READY_KEY, load_embedding_model
from semantic_search import search


app = Flask(__name__)
client = redis.Redis(host="localhost", port=6379)
MAX_RESULTS = 8
MAX_QUERY_LENGTH = 500
# Only what a result card shows, like /api/search?view=card. Full records carry
# every instructor's grade history and are many times larger.
CARD_FIELDS = (
    "detailId", "subjectCode", "courseCode", "title", "credits",
    "description", "instructor", "terms", "sched", "overallGpa",
)


# A search needs at least one real word from the catalog to get semantic matches, so
# gibberish ("asdkjqwe", "lorem ipsum") returns nothing instead of the nearest vectors.
# Stop words are Redis's defaults, ignored like they are in lexical search.
WORD = re.compile(r"[a-z]+")
STOP_WORDS = {
    "a", "is", "the", "an", "and", "are", "as", "at", "be", "but", "by", "for",
    "if", "in", "into", "it", "no", "not", "of", "on", "or", "such", "that",
    "their", "then", "there", "these", "they", "this", "to", "was", "will", "with",
}


def load_vocabulary(path="classes_out.json"):
    with open(path) as infile:
        courses = json.load(infile)
    words = set()
    for course in courses:
        words.update(WORD.findall(f"{course.get('title', '')} {course.get('description', '')}".lower()))
    return words


VOCABULARY = load_vocabulary()


def has_catalog_word(query):
    return any(
        word in VOCABULARY
        for word in WORD.findall(query.lower())
        if len(word) >= 3 and word not in STOP_WORDS
    )


def csv_values(name):
    return [value for value in request.args.get(name, "").split(",") if value]


def int_arg(name, default):
    try:
        return int(request.args.get(name, default))
    except (TypeError, ValueError):
        return default


def float_arg(name, default):
    try:
        return float(request.args.get(name, default))
    except (TypeError, ValueError):
        return default


def request_filters():
    levels = []
    for level in csv_values("levels"):
        try:
            levels.append(int(level))
        except ValueError:
            continue
    return {
        "subjects": csv_values("sub"),
        "terms": csv_values("term"),
        "geneds": csv_values("gen"),
        "levels": levels,
        "schedule_types": csv_values("sched"),
        "credit_min": float_arg("cmin", 0),
        "credit_max": float_arg("cmax", 18),
    }


@app.get("/health")
def health():
    return jsonify({"ready": True})


@app.get("/search")
def semantic_search():
    query = request.args.get("q", "").strip()[:MAX_QUERY_LENGTH]
    limit = min(max(int_arg("maxlim", MAX_RESULTS), 1), MAX_RESULTS)
    # While embed.py is still loading vectors, results are partial and must not be cached.
    ready = client.exists(SEMANTIC_READY_KEY) == 1
    if len(query) < 2 or not has_catalog_word(query):
        return jsonify({"courses": {"documents": []}, "ready": ready})

    matches = search(query, limit, request_filters(), client)
    documents = [
        {
            "id": match["courseKey"],
            "value": {
                **{field: match["course"].get(field) for field in CARD_FIELDS},
                "semanticDistance": match["distance"],
            },
        }
        for match in matches
    ]
    return jsonify({"courses": {"documents": documents}, "ready": ready})


if __name__ == "__main__":
    load_embedding_model()
    # each request embeds with one thread, so several can run at once on the VM's cores
    serve(app, host="127.0.0.1", port=5001, threads=4)
