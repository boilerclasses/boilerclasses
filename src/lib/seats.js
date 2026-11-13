// Server only. Open seats for a course's sections, asked of Banner when needed: they change
// by the minute during registration, so the weekly snapshot would be stale. Each course is
// looked up at most once every few minutes, and requests made during a lookup share it.
const BANNER = 'https://apps.mypurdue.purdue.edu/StudentRegistrationSsb/ssb/';
const HEADERS = { 'User-Agent': 'boilerclasses (+https://www.boilerclasses.com)' };
const FRESH_FOR = 5 * 60 * 1000;
const PAGE_SIZE = 500;

const lookups = new Map(); // "term SUBJ 12345" -> {at, promise}

// getSetCookie() is newer than some Node 18 builds; without it the cookies come joined by
// commas, which expiry dates also contain, so split only where a new name= starts
const setCookies = (headers) => headers.getSetCookie?.()
  ?? (headers.get('set-cookie') ?? '').split(/,\s*(?=[^;,\s]+=)/).filter(Boolean);

const banner = async (endpoint, options) => {
  // Banner redirects to a login or error page instead of failing, so a redirect is an error too
  const response = await fetch(BANNER + endpoint, { ...options, redirect: 'manual', signal: AbortSignal.timeout(5_000) });
  if (response.status !== 200) throw new Error(`Banner ${endpoint.split('?')[0]}: HTTP ${response.status}`);
  return response;
};

async function fetchSeats(term, subject, number) {
  // Banner keeps a session's first search, so every lookup starts a session of its own
  const start = await banner('term/search?mode=search', {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ term }),
  });
  const cookie = setCookies(start.headers).map(value => value.split(';')[0]).join('; ');

  const seats = {};
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const params = new URLSearchParams({
      txt_subject: subject, txt_courseNumber: number, txt_term: term,
      pageOffset: offset, pageMaxSize: PAGE_SIZE, sortColumn: 'subjectDescription', sortDirection: 'asc',
    });
    const page = await (await banner(`searchResults/searchResults?${params}`, { headers: { ...HEADERS, cookie } })).json();
    if (page.success !== true || page.pathMode !== 'search') throw new Error(`Banner did not search ${subject} ${number}`);
    const rows = page.data ?? [];
    rows.filter(row => row.term === term && row.subject === subject && row.courseNumber === number).forEach(row => {
      // a cross-listed section also shares the seats of the whole cross-list
      const open = row.crossList ? Math.min(row.seatsAvailable, row.crossListAvailable) : row.seatsAvailable;
      seats[row.courseReferenceNumber] = {
        open, capacity: row.maximumEnrollment, waitlist: row.waitCount, waitCapacity: row.waitCapacity,
      };
    });
    if (!rows.length) break;
    total = page.totalCount;
    offset += rows.length;
  }
  return seats;
}

// {seats: {crn: {open, capacity, waitlist, waitCapacity}}, checkedAt} for one course
export function getSeats(term, subject, number) {
  const now = Date.now();
  lookups.forEach((lookup, key) => {
    if (now - lookup.at > FRESH_FOR) lookups.delete(key);
  });
  const key = `${term} ${subject} ${number}`;
  if (!lookups.has(key)) {
    // Banner now and then leaves a request hanging, so a lookup gets one more try
    const promise = fetchSeats(term, subject, number)
      .catch(() => fetchSeats(term, subject, number))
      .then(seats => ({ seats, checkedAt: new Date().toISOString() }));
    // a failed lookup is forgotten so the next request tries again
    promise.catch(() => {
      if (lookups.get(key)?.promise === promise) lookups.delete(key);
    });
    lookups.set(key, { at: now, promise });
  }
  return lookups.get(key).promise;
}
