// How students actually type course searches: abbreviations ("calc", "orgo"),
// numbers for sequences ("calc 3", "spanish iii"), and Purdue nicknames. Used by
// browser search (courseSearch.mjs) and for the text sent to semantic search.

// Whole-word abbreviations. Searches still run on the original words too, so
// real subject codes that look like these (STAT, PHIL) keep working.
const ABBREVIATIONS = {
  calc: 'calculus', precalc: 'precalculus', alg: 'algebra', lin: 'linear',
  diff: 'differential', eq: 'equations', eqs: 'equations', multivar: 'multivariate',
  multivariable: 'multivariate', prob: 'probability', stats: 'statistics', stat: 'statistics',
  chem: 'chemistry', ochem: 'organic chemistry', orgo: 'organic chemistry', bio: 'biology',
  phys: 'physics', econ: 'economics', psych: 'psychology', comp: 'computer', sci: 'science',
  intro: 'introduction', gen: 'general', thermo: 'thermodynamics', mech: 'mechanics',
  ml: 'machine learning', ai: 'artificial intelligence', os: 'operating systems', db: 'database',
};

const TO_ROMAN = { 1: 'i', 2: 'ii', 3: 'iii', 4: 'iv' };
const TO_DIGIT = { i: '1', ii: '2', iii: '3', iv: '4' };

// Sequences whose courses don't share a word with the nickname ("calc 3" is
// MA 26100 Multivariate Calculus). Keys are the canonical form below. Pinned
// courses still have to pass the search filters.
const NICKNAMES = {
  'calculus 1': ['MA 16500', 'MA 16100', 'MA 16010'],
  'calculus 2': ['MA 16600', 'MA 16200', 'MA 16020'],
  'calculus 3': ['MA 26100'],
  'linear algebra': ['MA 26500', 'MA 35100'],
  'differential equations': ['MA 26600'],
  'general chemistry': ['CHM 11500', 'CHM 11600', 'CHM 11100'],
  'general chemistry 1': ['CHM 11500', 'CHM 11100'],
  'general chemistry 2': ['CHM 11600'],
  'organic chemistry': ['CHM 25500', 'CHM 26100', 'CHM 25700', 'CHM 25600', 'CHM 26200'],
  'organic chemistry 1': ['CHM 25500', 'CHM 26100', 'CHM 25700'],
  'organic chemistry 2': ['CHM 25600', 'CHM 26200'],
  'physics 1': ['PHYS 17200', 'PHYS 22000', 'PHYS 23300'],
  'physics 2': ['PHYS 27200', 'PHYS 22100', 'PHYS 24100', 'PHYS 23400'],
};

const words = query => query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const expand = list => list.flatMap(word => (ABBREVIATIONS[word] ?? word).split(' '));

// Abbreviations expanded, sequence numbers as digits: "calc iii" → "calculus 3".
const canonical = query => expand(words(query)).map(word => TO_DIGIT[word] ?? word).join(' ');

// Course codes pinned to the top for this query, if it's a known nickname.
export const nicknameCourses = query => NICKNAMES[canonical(query)] ?? [];

// Texts to search, best first: abbreviations expanded (with sequence numbers both
// ways, since titles say "Level III" or "Calculus I"), then exactly as typed.
export function queryVariants(query) {
  const typed = words(query);
  const expanded = expand(typed);
  const swapped = expanded.map(word => TO_ROMAN[word] ?? TO_DIGIT[word] ?? word);
  // A lone "i" or "1" isn't a sequence number. A typed digit 1-4 ("spanish 3") is
  // read as a sequence ("Spanish Level III") before it's read as the start of a
  // course number, which would match every 3xxxx course.
  const digitTyped = expanded.some(word => word in TO_ROMAN);
  const variants = expanded.length < 2 ? [expanded, typed]
    : digitTyped ? [swapped, expanded, typed] : [expanded, swapped, typed];
  return [...new Set(variants.map(list => list.join(' ')))];
}

// What semantic search embeds: "calc iii" → "calculus iii".
export const semanticQuery = query => expand(words(query)).join(' ');
