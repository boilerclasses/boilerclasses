import NextCors from 'nextjs-cors';
import ratings from '@/lib/ratings';

async function handler(req, res) {
   // Run the cors middleware
   // nextjs-cors uses the cors package, so we invite you to check the documentation https://github.com/expressjs/cors
   await NextCors(req, res, {
      // Options
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
      origin: '*',
      optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
   });

   if (req.method === 'GET') {
      const id = req.query.id;
      const RMPrating = await ratings.getTeacher(id);
      // the server caches RMP for a week (src/lib/ratings.js); browsers can keep it a day
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).json({ RMPrating });
    }
  
}

export default handler;
