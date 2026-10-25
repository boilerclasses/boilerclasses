import { getCourse } from "../../lib/redis"
import { setCacheHeaders } from "../../lib/cache"

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const detailId = req.query.detailId;
    const course = await getCourse(detailId);
    setCacheHeaders(req, res);
    res.status(200).json({ course });
  }
}