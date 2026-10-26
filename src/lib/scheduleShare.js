// A whole plan packed into a short URL-safe string, for share links (/schedule?s=...) and
// the calendar feed (/api/calendar.ics?s=...). No storage: the link is the schedule.
//
// Packed as bytes, then base64url. Courses are stored by their picked CRNs alone, since a
// CRN names its course; the server looks the course up (src/lib/sharedPlan.js). A course
// with nothing picked yet is stored by its code ("CS18000") instead.
//   version, term - 200000
//   course count, then per course: colour << 4 | CRN count, then the CRNs (or the code)
//   block count, then per block: colour, weekday bits, start and end in 15-minute steps, title
// Numbers are varints (7 bits a byte), so most CRNs take 3 bytes.
import { WEEK } from '@/lib/schedule';

const VERSION = 2;
const STEP = 15; // minutes; blocks snap to this on the calendar

const writer = () => {
  const bytes = [];
  const number = (value) => {
    let rest = Math.max(0, Math.floor(value));
    while (rest >= 0x80) {
      bytes.push((rest & 0x7f) | 0x80);
      rest = Math.floor(rest / 0x80);
    }
    bytes.push(rest);
  };
  const text = (value) => {
    const encoded = new TextEncoder().encode(value);
    number(encoded.length);
    bytes.push(...encoded);
  };
  return { bytes, number, text };
};

const reader = (bytes) => {
  let at = 0;
  const number = () => {
    let value = 0;
    for (let shift = 1; ; shift *= 0x80) {
      if (at >= bytes.length) throw new Error('truncated');
      const byte = bytes[at++];
      value += (byte & 0x7f) * shift;
      if (byte < 0x80) return value;
    }
  };
  const text = () => {
    const length = number();
    if (at + length > bytes.length) throw new Error('truncated');
    const value = new TextDecoder().decode(bytes.slice(at, at + length));
    at += length;
    return value;
  };
  return { number, text, done: () => at === bytes.length };
};

const toBase64Url = (bytes) => {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value) =>
  Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));

// "CS18000" from a detailId like "CS18000ProblemSolving..."
const courseCode = (detailId) => String(detailId).match(/^[A-Z]+\d+/)?.[0] ?? '';

export const encodeSchedule = ({ term, courses, blocks }) => {
  const out = writer();
  out.number(VERSION);
  out.number(Number(term) - 200000);
  out.number(courses.length);
  courses.forEach(course => {
    const crns = course.crns.slice(0, 15);
    out.number(((course.colorIndex & 0xf) << 4) | crns.length);
    if (crns.length) crns.forEach(crn => out.number(crn));
    else out.text(courseCode(course.detailId));
  });
  out.number(blocks.length);
  blocks.forEach(block => {
    out.number(block.colorIndex);
    out.number(block.days.reduce((bits, day) => bits | (1 << WEEK.indexOf(day)), 0));
    out.number(Math.round(block.start / STEP));
    out.number(Math.round(block.end / STEP));
    out.text(block.title);
  });
  return toBase64Url(out.bytes);
};

// The plan in a share string, or null if it isn't one. Courses come back as
// {colorIndex, crns, code}; sharedPlan.js resolves them to full courses.
export const decodeSchedule = (value) => {
  try {
    const input = reader(fromBase64Url(String(value)));
    if (input.number() !== VERSION) return null;
    const term = String(input.number() + 200000);
    const courses = Array.from({ length: input.number() }, () => {
      const head = input.number();
      const count = head & 0xf;
      const crns = Array.from({ length: count }, () => input.number());
      return { colorIndex: head >> 4, crns, code: count ? null : input.text() };
    });
    const blocks = Array.from({ length: input.number() }, (_, index) => {
      const colorIndex = input.number();
      const bits = input.number();
      const start = input.number() * STEP;
      const end = input.number() * STEP;
      return {
        id: `shared-${index}`, title: input.text(), colorIndex,
        days: WEEK.filter((_, i) => bits & (1 << i)), start, end,
      };
    }).filter(b => b.days.length && b.end > b.start);
    if (!input.done()) return null;
    return { term, courses, blocks };
  } catch {
    return null;
  }
};
