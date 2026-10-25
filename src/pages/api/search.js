import { searchCodes, searchCourses } from "../../lib/redis"
import { setCacheHeaders } from "../../lib/cache"
import { orderByCourseCode } from "../../lib/courseOrder.mjs"
import { nicknameCourses, queryVariants } from "../../lib/queryAliases.mjs"

const cardFields = [
  'detailId', 'subjectCode', 'courseCode', 'title', 'credits',
  'description', 'instructor', 'terms', 'sched', 'overallGpa',
];

const summarizeSearchDocument = ({ value, ...document }) => ({
  ...document,
  value: Object.fromEntries(
    // Keep browser GPA calculation working until Redis is reloaded.
    (value.overallGpa ? cardFields : [...cardFields, 'gpa'])
      .map(field => [field, value[field]])
  ),
});

// Query params may be missing (bots, malformed links) or repeated (arrays).
// Normalize to a string so .trim()/.split() never throw.
const param = (value, fallback = "") => {
  if (Array.isArray(value)) return value.join(",");
  return value ?? fallback;
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const profile = req.query.__profile === '1';
    const start = profile ? performance.now() : 0;
    const q = param(req.query.q).trim();
    const subjects = param(req.query.sub);
    const terms = param(req.query.term);
    const gen = param(req.query.gen);
    const cmin = param(req.query.cmin, "0");
    const cmax = param(req.query.cmax, "18");
    const levels = param(req.query.levels);
    const sched = param(req.query.sched);
    const maxlim = param(req.query.maxlim, "100");
    const filters = [subjects.split(","), terms.split(","), gen.split(","), cmin, cmax, levels.split(","), sched.split(",")];
    // Same reading of the query as browser search (src/lib/courseSearch.mjs): pinned
    // nicknames first, then each variant ("calculus 3", "calc 3") in order.
    const pinned = nicknameCourses(q);
    const variants = q ? queryVariants(q) : [q];
    const [pinnedFound, firstFound] = await Promise.all([
      pinned.length ? searchCodes(pinned, ...filters, maxlim) : { documents: [] },
      searchCourses(variants[0], ...filters, maxlim),
    ]);
    // Other readings only matter when the first didn't fill the page
    const full = pinnedFound.documents.length + firstFound.documents.length >= (Number(maxlim) || 100);
    const variantsFound = [firstFound, ...(full ? [] : await Promise.all(
      variants.slice(1).map(variant => searchCourses(variant, ...filters, maxlim)),
    ))];
    const code = document => `${document.value.subjectCode} ${document.value.courseCode}`;
    const merged = [];
    const seen = new Set();
    for (const document of [
      ...[...pinnedFound.documents].sort((a, b) => pinned.indexOf(code(a)) - pinned.indexOf(code(b))),
      ...variantsFound.flatMap((found, i) => orderByCourseCode(found.documents, variants[i])),
    ]) {
      if (!seen.has(document.id)) {
        seen.add(document.id);
        merged.push(document);
      }
    }
    const results = { total: merged.length, documents: merged.slice(0, Number(maxlim) || 100) };
    const courses = req.query.view === 'card'
      ? { ...results, documents: results.documents.map(summarizeSearchDocument) }
      : results;
    setCacheHeaders(req, res);
    if (profile) {
      const searched = performance.now();
      const body = JSON.stringify({ courses });
      const serialized = performance.now();
      res.setHeader('Server-Timing', `params;dur=${(searched - start).toFixed(3)}, serialize;dur=${(serialized - searched).toFixed(3)}`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).send(body);
      return;
    }
    res.status(200).json({ courses });
  }
}
