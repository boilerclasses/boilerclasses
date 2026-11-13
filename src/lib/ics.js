// iCalendar for a plan: weekly class meetings that skip Purdue's breaks and holidays, final
// and evening exams, and (optionally) personal blocks. Built by /api/calendar.ics, which
// serves both the subscription feed and the one-time download.
import { EXAM_LABELS } from '@/lib/termData';
import { formatRange, shortType, toClock, toMinutes } from '@/lib/schedule';

const TZ = 'America/New_York';
const BYDAY = { Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA', Sun: 'SU' };
const JS_DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const TIMEZONE = [
  'BEGIN:VTIMEZONE', `TZID:${TZ}`,
  'BEGIN:STANDARD', 'DTSTART:20071104T020000', 'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
  'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'TZNAME:EST', 'END:STANDARD',
  'BEGIN:DAYLIGHT', 'DTSTART:20070311T020000', 'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
  'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'TZNAME:EDT', 'END:DAYLIGHT',
  'END:VTIMEZONE',
];

// Dates are plain "YYYY-MM-DD" strings handled in UTC so the host's timezone never shifts them.
const parseDate = (iso) => new Date(`${iso}T00:00:00Z`);
const isoDate = (date) => date.toISOString().slice(0, 10);
const addDays = (iso, days) => isoDate(new Date(parseDate(iso).getTime() + days * 86400000));
const weekday = (iso) => parseDate(iso).getUTCDay();
const local = (iso, minutes) => `${iso.replace(/-/g, '')}T${toClock(minutes).replace(':', '')}00`;
const utcStamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

// RFC 5545 text escaping and 75-octet line folding
const escape = (text) => String(text ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const encoder = new TextEncoder();
const fold = (line) => {
  if (encoder.encode(line).length <= 75) return line;
  const parts = [];
  let current = '';
  for (const char of line) {
    // continuation lines start with a space, so they hold one octet less
    if (encoder.encode(current + char).length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join('\r\n ');
};

// The first date on or after `from` that falls on one of `days`.
const firstOn = (from, days) => {
  const wanted = new Set(days.map(day => JS_DAY[day]));
  for (let i = 0; i < 7; i++) {
    const date = addDays(from, i);
    if (wanted.has(weekday(date))) return date;
  }
  return from;
};

// A weekly event from `startDate` to `endDate` on `days`, minus no-class dates.
const weekly = ({ uid, summary, location, description, days, start, end, startDate, endDate, skip = [] }) => {
  const first = firstOn(startDate, days);
  if (first > endDate) return null;
  const wanted = new Set(days.map(day => JS_DAY[day]));
  const excluded = skip.filter(date => date >= first && date <= endDate && wanted.has(weekday(date)));
  return [
    `UID:${uid}`,
    `DTSTART;TZID=${TZ}:${local(first, start)}`,
    `DTEND;TZID=${TZ}:${local(first, end)}`,
    // the last class ends before midnight Eastern, which is before 04:00 UTC the next day
    `RRULE:FREQ=WEEKLY;BYDAY=${days.map(day => BYDAY[day]).join(',')};UNTIL=${addDays(endDate, 1).replace(/-/g, '')}T035959Z`,
    ...(excluded.length ? [`EXDATE;TZID=${TZ}:${excluded.map(date => local(date, start)).join(',')}`] : []),
    `SUMMARY:${escape(summary)}`,
    ...(location ? [`LOCATION:${escape(location)}`] : []),
    ...(description ? [`DESCRIPTION:${escape(description)}`] : []),
  ];
};

/**
 * @param termName  "Spring 2027"
 * @param dates     {classesBegin, classesEnd, noClassDays}, or null when unknown
 * @param courses   [{name, title, options}] with only the picked sections in options
 * @param exams     [{courseName, kind, date, start, end, rooms, sittings}]
 * @param blocks    personal blocks, or [] to leave them out
 */
export const buildCalendar = ({ termName, termCode, dates, courses, exams, blocks }) => {
  const skip = dates?.noClassDays ?? [];
  const events = [];

  courses.forEach(course => course.options.forEach(option => option.meetings.forEach((meeting, index) => {
    if (meeting.start == null || !meeting.days.length) return;
    // a section can't meet before classes begin or after they end
    const startDate = dates && dates.classesBegin > meeting.startDate ? dates.classesBegin : meeting.startDate;
    const endDate = dates && dates.classesEnd < meeting.endDate ? dates.classesEnd : meeting.endDate;
    events.push(weekly({
      uid: `${termCode}-${option.crn}-${index}@boilerclasses.com`,
      summary: `${course.name} ${shortType(option.type)}`,
      location: meeting.room,
      description: [
        course.title,
        `${option.type} · CRN ${option.crn}`,
        option.instructors.length ? `Instructor: ${option.instructors.join(', ')}` : null,
      ].filter(Boolean).join('\n'),
      days: meeting.days, start: meeting.start, end: meeting.end, startDate, endDate, skip,
    }));
  })));

  exams.forEach(exam => {
    const sittings = exam.sittings?.length > 1
      ? `Held in ${exam.sittings.length} sittings: ${exam.sittings.map(s => formatRange(toMinutes(s.start), toMinutes(s.end))).join(' or ')}. Check which one is yours.`
      : null;
    events.push([
      `UID:${termCode}-${exam.courseName.replace(/\s/g, '')}-${exam.kind}-${exam.date}@boilerclasses.com`,
      `DTSTART;TZID=${TZ}:${local(exam.date, toMinutes(exam.start))}`,
      `DTEND;TZID=${TZ}:${local(exam.date, toMinutes(exam.end))}`,
      `SUMMARY:${escape(`${exam.courseName} ${EXAM_LABELS[exam.kind]}`)}`,
      ...(exam.rooms.length ? [`LOCATION:${escape(exam.rooms.join(', '))}`] : []),
      `DESCRIPTION:${escape([sittings, "From the registrar's exam schedule. Big exams split rooms by section or last name."].filter(Boolean).join('\n'))}`,
    ]);
  });

  // personal blocks repeat through the class weeks, holidays included
  const meetingDates = courses.flatMap(c => c.options.flatMap(o => o.meetings));
  const span = dates
    ? [dates.classesBegin, dates.classesEnd]
    : [meetingDates.map(m => m.startDate).sort()[0], meetingDates.map(m => m.endDate).sort().at(-1)];
  if (span[0] && span[1]) {
    blocks.forEach((block, index) => events.push(weekly({
      uid: `${termCode}-block-${index}-${block.days.join('')}-${block.start}@boilerclasses.com`,
      summary: block.title || 'Busy',
      days: block.days, start: block.start, end: block.end, startDate: span[0], endDate: span[1],
    })));
  }

  const stamp = utcStamp(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BoilerClasses//Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(`${termName} classes`)}`,
    `X-WR-TIMEZONE:${TZ}`,
    // how often subscribed apps should check back for exams and room changes
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
    ...TIMEZONE,
    ...events.filter(Boolean).flatMap(event => ['BEGIN:VEVENT', `DTSTAMP:${stamp}`, ...event, 'END:VEVENT']),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
};
