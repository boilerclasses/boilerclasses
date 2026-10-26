import { decodeSchedule } from '@/lib/scheduleShare';
import { getAllSections } from '@/lib/sectionsStore';

// Server only. A share string's courses are CRNs (or a bare code for a course with nothing
// picked); this finds each course's detailId and "SUBJ 12345" name in the term's sections.
const indexes = new Map(); // term -> {byCrn: Map(crn -> detailId), byCode: Map(code -> detailId)}

const termIndex = (term, sections) => {
  if (!indexes.has(term)) {
    const byCrn = new Map();
    const byCode = new Map();
    Object.entries(sections).forEach(([detailId, list]) => {
      list.forEach(section => byCrn.set(section.crn, detailId));
      const code = detailId.match(/^[A-Z]+\d+/)?.[0];
      if (code && !byCode.has(code)) byCode.set(code, detailId);
    });
    indexes.set(term, { byCrn, byCode });
  }
  return indexes.get(term);
};

const nameOf = (detailId) => detailId.match(/^([A-Z]+)(\d+)/)?.slice(1).join(' ') ?? detailId;

// The plan in a share string with full courses, or null if it isn't one. Courses whose
// sections are no longer listed are left out.
export async function resolveSharedPlan(value) {
  const plan = decodeSchedule(value);
  if (!plan) return null;
  const sections = (await getAllSections())?.[plan.term];
  if (!sections) return null;
  const { byCrn, byCode } = termIndex(plan.term, sections);
  const seen = new Set();
  const courses = plan.courses.flatMap(({ colorIndex, crns, code }) => {
    const detailId = crns.length ? byCrn.get(crns[0]) : byCode.get(code);
    if (!detailId || seen.has(detailId)) return [];
    seen.add(detailId);
    return [{ detailId, name: nameOf(detailId), colorIndex, crns: crns.filter(crn => byCrn.get(crn) === detailId) }];
  });
  return { ...plan, courses };
}
