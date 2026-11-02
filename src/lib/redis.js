
import { createClient } from 'redis';

// Input: "data structures"
// Output: "((data | %data%) (structures* | %structures%))"
// Input: "cs 250" → Output: "(cs 250*)" (no fuzzy matching for short words/numbers).
export function buildSearchText(query) {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const terms = words.map((word, i) => {
    const escaped = word.replace(/([\\,.<>{}\[\]"':;!@#$%^&*()\-+=~|/?])/g, '\\$1');
    // Preserve the trailing prefix search while adding one-edit typo tolerance.
    const exact = escaped + (i === words.length - 1 ? '*' : '');
    return /^\p{L}{4,}$/u.test(word) ? `(${exact} | %${escaped}%)` : exact;
  });
  return `(${terms.join(' ')})`;
}

const client = createClient();

async function connect() {
  if (!client.isOpen) {
    await client.connect();
  }
}

// Plain key-value cache in the same Redis; misses and Redis errors both return null.
export async function cacheGet(key) {
  try {
    await connect();
    const value = await client.get(key);
    return value === null ? null : JSON.parse(value);
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, seconds) {
  try {
    await connect();
    await client.set(key, JSON.stringify(value), { EX: seconds });
  } catch {
    // a failed write only means the next request asks the source again
  }
}

function filterQuery(sub, term, gen, cmin, cmax, levels, sched, gpa) {
  const formattedLevels = levels.map(level => `@courseCode:[${parseInt(level)*100}, ${parseInt(level)*100 + 9999}]`)
  return `${sub[0].length > 0 ? ` @subjectCode:{${sub.join("|")}}` : ""}${term[0].length > 0 ? ` @terms:{${term.join("|")}}` : ""}${gen[0].length > 0 ? gen.map((g) => ` @gened:{${g}}`) : ""} (@creditMin:[${cmin}, ${cmax}] | @creditMax:[${cmin}, ${cmax}])${levels[0].length > 0 ? ` (${formattedLevels.join(" | ")})` : " @courseCode:[0, 0]"}${sched[0].length > 0 ? ` @sched:{${sched.join("|")}}` : " @sched:{}"}${gpa ? ` @averageGpa:[${Number(gpa[0])}, ${Number(gpa[1])}]` : ""}`;
}

async function run(text, size) {
  await connect();
  try {
    return await client.ft.search('idx:classes', text, { LIMIT: { size: size, from: 0 } });
  } catch {
    return {'documents': []};
  }
}

export async function searchCourses(q, sub, term, gen, cmin, cmax, levels, sched, gpa, size) {
  return run(`${buildSearchText(q)}${filterQuery(sub, term, gen, cmin, cmax, levels, sched, gpa)}`, size);
}

// Courses by code ("MA 26100"), with the same filters; used for pinned nicknames.
export async function searchCodes(codes, sub, term, gen, cmin, cmax, levels, sched, gpa, size) {
  const byCode = codes.map(code => {
    const [subject, number] = code.split(' ');
    return `(@subjectCode:{${subject}} @courseCode:[${number}, ${number}])`;
  });
  return run(`(${byCode.join(' | ')})${filterQuery(sub, term, gen, cmin, cmax, levels, sched, gpa)}`, size);
}


export async function getCourse(detailId) {
  await connect();
  try {
    const res = await client.ft.search('idx:classes', `@detailId:{${detailId}}`, {
      LIMIT: { size: 1, from: 0 }
    });
    return res;
  } catch {
    return {'documents': []};
  }
}
