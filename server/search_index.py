import json

# Fields the browser search needs: everything Redis searches or filters on,
# plus what a search card shows. Repeated strings (instructor names, terms,
# schedule types) are stored once and referenced by index.


def build_search_index(data):
  names, terms, scheds, geneds = {}, {}, {}, {}

  def ref(table, value):
    if value not in table:
      table[value] = len(table)
    return table[value]

  docs = []
  for course in data:
    instructor = {
      ref(terms, term): [ref(names, name) for name in people]
      for term, people in (course.get('instructor') or {}).items()
    }
    docs.append([
      course['detailId'],
      course['subjectCode'],
      course['courseCode'],
      course['title'],
      course['fullTitle'],
      course['credits'],
      course['description'],
      instructor,
      [ref(terms, term) for term in course['terms']],
      [ref(scheds, sched) for sched in course['sched']],
      [ref(geneds, gened) for gened in course['gened']],
      course['overallGpa'],
    ])

  def values(table):
    return sorted(table, key=table.get)

  return {
    'names': values(names),
    'terms': values(terms),
    'scheds': values(scheds),
    'geneds': values(geneds),
    'docs': docs,
  }


def write_search_index(data, path):
  with open(path, 'w') as f:
    json.dump(build_search_index(data), f, separators=(',', ':'))
