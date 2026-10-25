// Browser-side copy of the Redis course search (src/lib/redis.js), so typing
// never waits on the network once the index has loaded. The server builds the
// index once (server/build_search_index.mjs) and browsers load it in a worker
// (src/workers/search.worker.js); both use the rules below.
import MiniSearch from 'minisearch';
import { stemmer } from 'stemmer';
import { orderByCourseCode } from './courseOrder.mjs';
import { nicknameCourses, queryVariants } from './queryAliases.mjs';

// RediSearch's default English stop words: ignored in documents and queries.
const STOP_WORDS = new Set([
  'a', 'is', 'the', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for',
  'if', 'in', 'into', 'it', 'no', 'not', 'of', 'on', 'or', 'such', 'that',
  'their', 'then', 'there', 'these', 'they', 'this', 'to', 'was', 'will', 'with',
]);

const STEM = '+';
const isWord = term => /^\p{L}+$/u.test(term);

// Like Redis, index each word as written plus a marked stem, so "programming"
// also finds "program" while prefix and typo matching use the real words.
const processTerm = term => {
  const lower = term.toLowerCase();
  if (STOP_WORDS.has(lower)) return null;
  if (!isWord(lower)) return lower;
  return [lower, STEM + stemmer(lower)];
};

const INDEX_OPTIONS = {
  idField: 'index',
  fields: ['fullTitle', 'description', 'instructors'],
  processTerm,
};

// One query word, as buildSearchText writes it for Redis: the last word is a
// prefix, words of 4+ letters allow one typo, and (as in Redis) only whole
// words that aren't the last also match other words with the same stem.
const wordQuery = (word, last) => {
  // A single typed letter matches thousands of words; looking for it only at
  // the start of title words keeps each keystroke fast and the results useful.
  if (last && word.length === 1) return { queries: [word], prefix: true, fields: ['fullTitle'] };
  const options = [{ queries: [word], prefix: last }];
  if (/^\p{L}{4,}$/u.test(word)) options.push({ queries: [word], fuzzy: 1 });
  if (!last && isWord(word)) options.push({ queries: [STEM + stemmer(word)] });
  return options.length === 1 ? options[0] : { combineWith: 'OR', queries: options };
};

// Expands the compact file written by server/search_index.py.
export function decodeCourses({ names, terms, scheds, geneds, docs }) {
  return docs.map(([detailId, subjectCode, courseCode, title, fullTitle,
    credits, description, instructor, courseTerms, sched, gened, overallGpa], i) => {
    const instructorByTerm = Object.fromEntries(Object.entries(instructor)
      .map(([term, people]) => [terms[term], people.map(person => names[person])]));
    return {
      id: `classes:${i + 1}`,
      fullTitle,
      instructors: [...new Set(Object.values(instructorByTerm).flat())].join(' '),
      termSet: new Set(courseTerms.map(term => terms[term])),
      schedSet: new Set(sched.map(type => scheds[type])),
      genedSet: new Set(gened.map(type => geneds[type])),
      value: {
        detailId, subjectCode, courseCode, title, credits,
        description, instructor: instructorByTerm,
        terms: courseTerms.map(term => terms[term]),
        sched: sched.map(type => scheds[type]),
        overallGpa,
      },
    };
  });
}

export function buildIndex(courses) {
  const index = new MiniSearch(INDEX_OPTIONS);
  index.addAll(courses.map((course, i) => ({
    index: i,
    fullTitle: course.fullTitle,
    description: course.value.description,
    instructors: course.instructors,
  })));
  return index;
}

export const loadIndex = json => MiniSearch.loadJSON(json, INDEX_OPTIONS);

function matchesFilters(course, { sub, term, gen, cmin, cmax, levels, sched }) {
  const value = course.value;
  if (sub.length && !sub.includes(value.subjectCode)) return false;
  if (term.length && !term.some(t => course.termSet.has(t))) return false;
  if (gen.some(g => !course.genedSet.has(g))) return false;
  const [min, max] = value.credits;
  if (!((min >= cmin && min <= cmax) || (max >= cmin && max <= cmax))) return false;
  if (!levels.some(level => value.courseCode >= level * 100 && value.courseCode <= level * 100 + 9999)) return false;
  if (!sched.some(type => course.schedSet.has(type))) return false;
  return true;
}

// Same parameters as /api/search; returns documents shaped like its card view.
export function searchCourses(courses, index, params) {
  const filters = {
    ...params,
    cmin: Number(params.cmin),
    cmax: Number(params.cmax),
    levels: params.levels.map(Number),
  };
  const limit = Number(params.limit) || 100;
  const toDocument = course => ({ id: course.id, value: course.value });
  const splitWords = text => text.toLowerCase().split(/[\s\p{P}]+/u)
    .filter(word => word && !STOP_WORDS.has(word));

  if (!splitWords(params.q).length) {
    const results = [];
    for (const course of courses) {
      if (matchesFilters(course, filters)) {
        results.push(toDocument(course));
        if (results.length === limit) break;
      }
    }
    return results;
  }

  const options = {
    boost: { fullTitle: 50 },
    // Query words are already split and lowercased.
    tokenize: text => [text],
    processTerm: term => term,
    filter: result => matchesFilters(courses[result.id], filters),
  };
  const search = (words, combineWith) => index.search({
    combineWith,
    queries: words.map((word, i) => wordQuery(word, i === words.length - 1)),
  }, options);

  // Nicknames ("calc 3") pin their courses first, then each way of reading the
  // query ("calculus 3", "calculus iii", "calc 3") adds the courses matching all its words.
  const pinnedCodes = nicknameCourses(params.q);
  const results = pinnedCodes.length === 0 ? [] : courses
    .filter(course => pinnedCodes.includes(`${course.value.subjectCode} ${course.value.courseCode}`) && matchesFilters(course, filters))
    .sort((a, b) => pinnedCodes.indexOf(`${a.value.subjectCode} ${a.value.courseCode}`) - pinnedCodes.indexOf(`${b.value.subjectCode} ${b.value.courseCode}`))
    .map(toDocument);
  const found = new Set(results.map(document => document.id));
  const variants = queryVariants(params.q);
  for (const variant of variants) {
    // Other readings only matter when earlier ones didn't fill the page
    if (results.length >= limit) break;
    const matches = search(splitWords(variant), 'AND').map(result => toDocument(courses[result.id]));
    for (const document of orderByCourseCode(matches, variant)) {
      if (!found.has(document.id)) {
        found.add(document.id);
        results.push(document);
      }
    }
  }
  const words = splitWords(variants[0]);
  if (results.length >= PARTIAL_THRESHOLD || words.length < 2) return results.slice(0, limit);

  // Sentence-like searches ("machine learning for beginners") rarely match every
  // word, so add courses matching most of them. Rare words score far higher than
  // common ones like "classes", so the useful matches lead.
  const partial = search(words, 'OR')
    .filter(result => !found.has(courses[result.id].id) && matchedWords(result, words) >= 2)
    .map(result => ({ ...toDocument(courses[result.id]), partial: true }));
  return [...results, ...partial].slice(0, limit);
}

// Below this many full matches, partial matches are added after them.
const PARTIAL_THRESHOLD = 20;

// How many distinct query words a result matched, counting a word's stem as the word.
function matchedWords(result, words) {
  const matched = new Set(result.queryTerms.map(term => term.startsWith(STEM) ? term.slice(1) : term));
  return words.filter(word => matched.has(word) || matched.has(stemmer(word))).length;
}
