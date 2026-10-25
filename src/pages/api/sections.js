import { CURRENT_SEMESTER_CODE } from '@/lib/terms';
import { getAllSections } from '@/lib/sectionsStore';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const all = await getAllSections();
    const term = String(req.query.term ?? CURRENT_SEMESTER_CODE);
    res.status(200).json({ sections: all?.[term]?.[String(req.query.detailId)] ?? null });
  }
}
