import argparse
import json
import math
from decimal import Decimal, ROUND_HALF_UP

import redis
from tqdm import tqdm

from embeddings import (
  EMBEDDING_DIM,
  VECTOR_FIELD_NAME,
  VECTOR_INDEX_NAME,
  VECTOR_KEY_PREFIX,
)
from schema import validate_courses
from search_index import write_search_index


def overall_gpa(course):
  """Match the browser's instructor averages, counts, and GPA color."""
  averages = []
  semesters = set()
  for instructor, records in course.get('gpa', {}).items():
    if not instructor:
      continue
    semesters.update(records)
    if records:
      total = 0
      for row in records.values():
        total += row[13]
      average = math.floor(total / len(records) * 100 + 0.5) / 100
      if average != 0:
        averages.append(average)

  total = 0
  for average in averages:
    total += average
  # JavaScript toFixed rounds the exact binary float, with ties away from zero.
  gpa = str(Decimal(total / len(averages)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)) if averages else 0
  color = 'rgb(var(--background-color))'
  if gpa:
    stops = [(1.0, (71, 0, 0)), (2.25, (200, 30, 30)),
             (3.25, (218, 170, 0)), (4.0, (34, 197, 94))]
    lower, upper = stops[0], stops[-1]
    value = float(gpa)
    for start, end in zip(stops, stops[1:]):
      if start[0] <= value <= end[0]:
        lower, upper = start, end
        break
    fraction = (value - lower[0]) / (upper[0] - lower[0])
    rgb = [math.floor(a + fraction * (b - a) + 0.5)
           for a, b in zip(lower[1], upper[1])]
    color = '#' + ''.join(format(channel, '02x') for channel in rgb)
  return {'gpa': gpa, 'color': color, 'profCount': len(averages),
          'totalSemCount': len(semesters)}


def main():
  parser = argparse.ArgumentParser(description="Load course data into Redis")
  parser.add_argument("--data", "-data", default="classes_out.json", dest="infile")
  args = parser.parse_args()

  with open(args.infile) as infile:
    data = json.load(infile)
  validate_courses(data, kind="harmonized", source=args.infile)

  client = redis.Redis(host="localhost", port=6379)
  client.ping()
  client.flushall()

  print(f"Loading {len(data)} courses into Redis...")
  pipe = client.pipeline(transaction=False)
  for count, course in enumerate(tqdm(data), start=1):
    course["overallGpa"] = overall_gpa(course)
    course_key = f"classes:{count}"
    pipe.execute_command("JSON.SET", course_key, "$", json.dumps(course))
    if count % 500 == 0:
      pipe.execute()
  pipe.execute()

  # Same courses, in the same order, for browser-side search (/api/search-index)
  write_search_index(data, "search_index.json")

  client.execute_command("FT.CONFIG", "SET", "MINPREFIX", "1")

  client.execute_command("FT.CREATE", "idx:classes", "ON", "JSON", "PREFIX", "1",
              "classes:", "SCHEMA", 
              "$.fullTitle", "AS", "fullTitle", "TEXT", "WEIGHT", "50", 
              "$.detailId", "AS", "detailId", "TAG", 
              "$.description", "AS", "description", "TEXT", 
              "$.subjectCode", "AS", "subjectCode", "TAG", 
              "$.terms[*]", "AS", "terms", "TAG", 
              "$.courseCode", "AS", "courseCode", "NUMERIC", "SORTABLE",
              "$.instructor[*][*]", "AS", "instructor", "TEXT", "NOSTEM", 
              "$.credits[0]", "AS", "creditMin", "NUMERIC", 
              "$.credits[1]", "as", "creditMax", "NUMERIC", 
              "$.gened[*]", "AS", "gened", "TAG",
              "$.sched[*]", "AS", "sched", "TAG")

  # Kept separate so the lexical schema and queries are unchanged. It starts empty;
  # embed.py fills it in the background, and hashes are indexed as they're added.
  client.execute_command(
    "FT.CREATE", VECTOR_INDEX_NAME,
    "ON", "HASH",
    "PREFIX", "1", VECTOR_KEY_PREFIX,
    "SCHEMA",
    "subjectCode", "TAG",
    "terms", "TAG",
    "gened", "TAG",
    "sched", "TAG",
    "courseCode", "NUMERIC",
    "creditMin", "NUMERIC",
    "creditMax", "NUMERIC",
    "popularity", "NUMERIC",
    "intro", "NUMERIC",
    VECTOR_FIELD_NAME,
    "VECTOR", "FLAT", "6",
    "TYPE", "FLOAT32",
    "DIM", str(EMBEDDING_DIM),
    "DISTANCE_METRIC", "COSINE",
  )


if __name__ == "__main__":
  main()
