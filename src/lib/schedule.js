// Pure helpers for the schedule planner: section options, picking rules, conflicts and
// calendar layout. Times are minutes since midnight; days are 'Mon'..'Sun'.

export const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAYS = WEEK.slice(0, 5);

export const toMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const toClock = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// "9:30", "12 PM", "1:15 PM": compact like a calendar app, with the period only when asked
export const formatTime = (minutes, { period = true } = {}) => {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const hour12 = hours % 12 || 12;
  const time = mins ? `${hour12}:${String(mins).padStart(2, '0')}` : `${hour12}`;
  return period ? `${time} ${hours >= 12 ? 'PM' : 'AM'}` : time;
};

export const formatRange = (start, end) => {
  const samePeriod = (start < 720) === (end < 720);
  return `${formatTime(start, { period: !samePeriod })} – ${formatTime(end)}`;
};

export const shortType = (type) => ({
  'Practice Study Observation': 'PSO',
  Laboratory: 'Lab',
  'Distance Learning': 'Online',
  'Individual Study': 'Ind. Study',
})[type] ?? type;

const TYPE_ORDER = ['Lecture', 'Recitation', 'Laboratory', 'Studio', 'Clinic', 'Practice Study Observation'];
export const typeRank = (type) => {
  const rank = TYPE_ORDER.findIndex(name => type.startsWith(name));
  return rank === -1 ? TYPE_ORDER.length : rank;
};

// A course's sections from /api/sections as options: one per CRN with its timed meetings.
export const toOptions = (sections = []) => sections.map(section => ({
  crn: section.crn,
  classId: section.classId,
  type: section.type,
  instructors: section.instructors ?? [],
  meetings: section.meetings.map(meeting => ({
    days: meeting.days,
    start: meeting.start ? toMinutes(meeting.start) : null,
    end: meeting.end ? toMinutes(meeting.end) : null,
    room: meeting.room,
    startDate: meeting.startDate,
    endDate: meeting.endDate,
  })),
}));

export const isTimed = (meeting) => meeting.start != null && meeting.days.length > 0;

// Banner links a lecture to its labs by giving them one classId (a "bundle"). A course
// with no links has a classId per section, and its types are picked independently.
export const isLinked = (options) => {
  const counts = {};
  options.forEach(o => { counts[o.classId] = (counts[o.classId] ?? 0) + 1; });
  return Object.values(counts).some(count => count > 1);
};

// Types a student has to take within one bundle, e.g. Lecture + Laboratory.
export const requiredTypes = (options, classId) =>
  [...new Set(options.filter(o => o.classId === classId).map(o => o.type))]
    .sort((a, b) => typeRank(a) - typeRank(b));

export const courseTypes = (options) =>
  [...new Set(options.map(o => o.type))].sort((a, b) => typeRank(a) - typeRank(b));

// The bundle a course is using, if any of its sections are picked.
export const pickedClassId = (picked = [], options) =>
  options.find(o => picked.includes(o.crn))?.classId ?? null;

// Choosing a CRN keeps one CRN per type, and for linked courses one bundle: picking a
// lecture from another bundle drops the old bundle's labs.
export const choose = (picked = [], options, crn) => {
  const option = options.find(o => o.crn === crn);
  if (!option) return picked;
  const linked = isLinked(options);
  const kept = picked
    .map(p => options.find(o => o.crn === p))
    .filter(o => o && o.type !== option.type && (!linked || o.classId === option.classId))
    .map(o => o.crn);
  return [...kept, crn];
};

// What a linked course still needs: types in its bundle with nothing picked yet.
export const missingTypes = (picked = [], options) => {
  if (!options.length) return [];
  const have = new Set(options.filter(o => picked.includes(o.crn)).map(o => o.type));
  if (!have.size) return [courseTypes(options)[0]];
  if (!isLinked(options)) return [];
  return requiredTypes(options, pickedClassId(picked, options)).filter(type => !have.has(type));
};

// The sections offered for one type: for a linked course's secondary types (labs,
// recitations), only those in the bundle already picked.
export const candidates = (options, picked = [], type) => {
  const ofType = options.filter(o => o.type === type);
  const classId = pickedClassId(picked, options);
  if (!classId || !isLinked(options) || type === courseTypes(options)[0]) return ofType;
  const inBundle = ofType.filter(o => o.classId === classId);
  return inBundle.length ? inBundle : ofType;
};

// The first section a newly added course gets: its earliest lecture that fits around
// what's already planned (busy meetings and blocks), else its earliest lecture.
export const defaultPick = (options, busy = []) => {
  const timed = options.filter(o => o.meetings.some(isTimed));
  const pool = timed.length ? timed : options;
  const earliest = (o) => Math.min(...o.meetings.map(m => m.start ?? 24 * 60));
  const fits = (o) => !o.meetings.filter(isTimed).some(m => busy.some(b => clashes(m, b)));
  const ranked = [...pool].sort((a, b) => typeRank(a.type) - typeRank(b.type) || earliest(a) - earliest(b));
  const firstType = ranked[0]?.type;
  return (ranked.find(o => o.type === firstType && fits(o)) ?? ranked[0])?.crn ?? null;
};

// Fill in every type that has only one section to choose from (a lone recitation).
export const pickOnlyChoices = (picked, options) => {
  let result = picked;
  for (const type of missingTypes(result, options)) {
    const only = candidates(options, result, type);
    if (only.length === 1) result = choose(result, options, only[0].crn);
  }
  return result;
};

// Two meetings clash when they share a day, overlap in time and run in overlapping weeks
// (a first-half and a second-half course can share a slot).
const datesOverlap = (a, b) =>
  !a.startDate || !b.startDate || (a.startDate <= b.endDate && b.startDate <= a.endDate);
export const clashes = (a, b) =>
  a.start < b.end && b.start < a.end && a.days.some(day => b.days.includes(day)) && datesOverlap(a, b);

// Lay out one day's events side by side where they overlap, like a calendar app: each gets
// a column and the number of columns in its overlapping cluster.
export const layoutDay = (events) => {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const columns = Math.max(...cluster.map(e => e.column + 1));
    cluster.forEach(e => placed.push({ ...e, columns }));
    cluster = [];
  };
  for (const event of sorted) {
    if (cluster.length && event.start >= clusterEnd) flush();
    const used = new Set(cluster.filter(e => e.end > event.start).map(e => e.column));
    let column = 0;
    while (used.has(column)) column++;
    cluster.push({ ...event, column });
    clusterEnd = Math.max(clusterEnd, event.end);
  }
  if (cluster.length) flush();
  return placed;
};

// Accent colours for courses and personal blocks: CSS variables (--event-N) so each theme
// picks a shade that reads on its background.
export const EVENT_COLORS = 10;
export const eventColor = (index, alpha = 1) =>
  `rgb(var(--event-${(index % EVENT_COLORS) + 1}) / ${alpha})`;

// The lowest colour no other course or block is using.
export const nextColor = (used) => {
  for (let i = 0; i < EVENT_COLORS; i++) if (!used.includes(i)) return i;
  return used.length % EVENT_COLORS;
};

export const courseName = (course) => `${course.subjectCode} ${course.courseCode}`;
