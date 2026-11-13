import terms from '@/data/terms.json';
import { termCode } from '@/lib/terms';
import { resolveSharedPlan } from '@/lib/sharedPlan';
import { getAllSections } from '@/lib/sectionsStore';
import { getTermData } from '@/lib/termDataStore';
import { courseExamRows, examsFor } from '@/lib/termData';
import { toOptions } from '@/lib/schedule';
import { buildCalendar } from '@/lib/ics';

// A plan as an iCalendar feed: GET /api/calendar.ics?s=<share string>[&blocks=0][&download=1]
// Calendar apps re-fetch it, so exams and room changes reach subscribers when Purdue
// publishes them. The plan itself lives in the link and never changes.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const plan = await resolveSharedPlan(req.query.s ?? '');
  const termName = plan && terms.all.find(name => termCode(name) === plan.term);
  if (!termName) return res.status(400).send('Not a BoilerClasses schedule link');

  const sections = (await getAllSections())?.[plan.term] ?? {};
  const { dates, exams } = await getTermData(plan.term);

  const courses = plan.courses.map(course => ({
    name: course.name,
    options: toOptions(sections[course.detailId] ?? []).filter(o => course.crns.includes(o.crn)),
  }));
  const courseExams = plan.courses.flatMap(course => {
    const [subject, code] = course.name.split(' ');
    return examsFor(courseExamRows(exams, subject, code), course.crns)
      .map(exam => ({ ...exam, courseName: course.name }));
  });

  const calendar = buildCalendar({
    termName,
    termCode: plan.term,
    dates,
    courses,
    exams: courseExams,
    blocks: req.query.blocks === '0' ? [] : plan.blocks,
  });

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  // shared caches (Cloudflare) can hold a feed for an hour; exams change far less often
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  if (req.query.download === '1') {
    res.setHeader('Content-Disposition', `attachment; filename="${termName.replace(' ', '_')}_BoilerClasses.ics"`);
  }
  res.status(200).send(calendar);
}
