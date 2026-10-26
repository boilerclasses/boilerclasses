import { resolveSharedPlan } from '@/lib/sharedPlan';

// GET /api/shared-plan?s=<share string>: the plan in a share link with its courses looked up.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const plan = await resolveSharedPlan(req.query.s ?? '');
  if (!plan) return res.status(400).json({ error: 'Not a BoilerClasses schedule link' });
  // the same link always means the same plan
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.status(200).json(plan);
}
