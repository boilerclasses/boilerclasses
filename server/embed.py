"""
Embeds courses for semantic search and loads the vectors into Redis. script.sh runs it in
the background after push.py, so the site serves lexical search while it works.

Vectors are cached by a hash of the text that gets embedded (code, title, description), so
only new or edited courses go through the model. Grade, instructor and term changes don't
touch that text and cost nothing. Each batch is saved as it finishes, so a deploy that
restarts the container partway through picks up where it left off.
"""
import argparse
import json
import math
import time

import redis

from embeddings import (
  DEFAULT_CACHE_PATH,
  SEMANTIC_READY_KEY,
  VECTOR_FIELD_NAME,
  VECTOR_KEY_PREFIX,
  course_embedding_text,
  course_text_hash,
  embed_texts,
  open_cache,
)

BATCH_SIZE = 256


def semesters_taught(course):
  # Same count as push.py's overall_gpa totalSemCount: semesters with grade data
  gpa = course.get("gpa")
  if not isinstance(gpa, dict):
    return 0
  return len({semester for instructor, records in gpa.items() if instructor for semester in records})


def tag_values(values):
  return ",".join(str(value) for value in values)


def cached_vectors(db, hashes):
  # sqlite caps bound parameters, so look hashes up in chunks
  found = {}
  hashes = list(hashes)
  for start in range(0, len(hashes), 900):
    chunk = hashes[start:start + 900]
    placeholders = ",".join("?" * len(chunk))
    found.update(db.execute(
      f"SELECT hash, vector FROM vectors WHERE hash IN ({placeholders})", chunk
    ))
  return found


def main():
  parser = argparse.ArgumentParser(description="Embed courses and load them into Redis")
  parser.add_argument("--data", "-data", default="classes_out.json", dest="infile")
  parser.add_argument("--cache", default=DEFAULT_CACHE_PATH)
  args = parser.parse_args()

  with open(args.infile) as infile:
    courses = json.load(infile)

  texts = [course_embedding_text(course) for course in courses]
  hashes = [course_text_hash(text) for text in texts]

  db = open_cache(args.cache)
  vectors = cached_vectors(db, set(hashes))
  missing = list({h: text for h, text in zip(hashes, texts) if h not in vectors}.items())
  print(f"Embeddings: {len(courses) - len(missing)} cached, {len(missing)} to embed", flush=True)

  start = time.time()
  for offset in range(0, len(missing), BATCH_SIZE):
    batch = missing[offset:offset + BATCH_SIZE]
    rows = [
      (h, embedding.tobytes())
      for (h, _), embedding in zip(batch, embed_texts([text for _, text in batch]))
    ]
    db.executemany("INSERT OR REPLACE INTO vectors (hash, vector) VALUES (?, ?)", rows)
    db.commit()
    vectors.update(rows)
    print(f"Embedded {offset + len(batch)}/{len(missing)} in {time.time() - start:.0f}s", flush=True)

  # Ranking signals for semantic_search: how many semesters a course has been taught
  # (log-scaled to 0-1) and whether it's 100-200 level
  semesters = [semesters_taught(course) for course in courses]
  most = math.log1p(max(semesters) or 1)

  # Same order as push.py, so class-vectors:N points at classes:N
  client = redis.Redis(host="localhost", port=6379)
  pipe = client.pipeline(transaction=False)
  for count, (course, h) in enumerate(zip(courses, hashes), start=1):
    pipe.hset(
      f"{VECTOR_KEY_PREFIX}{count}",
      mapping={
        "courseKey": f"classes:{count}",
        "subjectCode": course["subjectCode"],
        "terms": tag_values(course["terms"]),
        "gened": tag_values(course["gened"]),
        "sched": tag_values(course["sched"]),
        "courseCode": course["courseCode"],
        "creditMin": course["credits"][0],
        "creditMax": course["credits"][1],
        "popularity": math.log1p(semesters[count - 1]) / most,
        "intro": int(course["courseCode"] < 30000),
        VECTOR_FIELD_NAME: vectors[h],
      },
    )
    if count % 500 == 0:
      pipe.execute()
  pipe.execute()
  client.set(SEMANTIC_READY_KEY, "1")
  print(f"Semantic search ready: loaded {len(courses)} vectors", flush=True)


if __name__ == "__main__":
  main()
