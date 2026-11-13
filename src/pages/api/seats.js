import { SCHEDULE_SEMESTERS } from '@/lib/terms';
import { getSeats } from '@/lib/seats';

// Open seats for one course's sections in a schedule term, from Banner:
// GET ?term=202720&course=CHM 11510
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const term = String(req.query.term);
  const [subject = '', number = ''] = String(req.query.course ?? '').trim().split(' ');
  if (!SCHEDULE_SEMESTERS.some(option => option.code === term) || !/^[A-Z]{2,5}$/.test(subject) || !/^\d{5}$/.test(number)) {
    return res.status(400).json({ error: 'Unknown term or course' });
  }
  try {
    const seats = await getSeats(term, subject, number);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).json(seats);
  } catch (error) {
    console.error('Error loading seats:', error.message);
    res.status(502).json({ error: 'Could not reach Purdue for seats' });
  }
}
