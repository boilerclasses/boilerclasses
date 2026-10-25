// "ma 162" should list MA 16200 before MA 16290, and before courses that only
// mention 162 in their description. Text scores don't know that, so when the
// query has a number, courses whose own code starts with it go first, in code
// order; everything else keeps its search order after them.
export function orderByCourseCode(documents, query) {
  const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const numbers = words.filter(word => /^\d+$/.test(word));
  if (!numbers.length) return documents;
  const subjects = words.filter(word => /^\p{L}+$/u.test(word));

  const ownsCode = ({ value }) =>
    numbers.some(number => String(value.courseCode).startsWith(number)) &&
    (!subjects.length || subjects.includes(value.subjectCode.toLowerCase()));

  const owned = documents.filter(ownsCode).sort((a, b) =>
    a.value.courseCode - b.value.courseCode ||
    a.value.subjectCode.localeCompare(b.value.subjectCode));
  return [...owned, ...documents.filter(document => !ownsCode(document))];
}
