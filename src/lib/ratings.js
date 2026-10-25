// Keep the wrapper's existing queries and response shapes, but avoid its old
// node-fetch gzip reader, which failed in production with ERR_STREAM_PREMATURE_CLOSE.
import {
  searchTeacherQuery,
  getTeacherQuery,
} from '@mtucourses/rate-my-professors/dist/src/queries';
import { AUTH_TOKEN } from '@mtucourses/rate-my-professors/dist/src/constants';

async function request(query, variables) {
  const response = await fetch('https://www.ratemyprofessors.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${AUTH_TOKEN}`,
      'Accept-Encoding': 'identity',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`RMP returned HTTP ${response.status}`);
  const { data, errors } = await response.json();
  if (errors?.length || !data) throw new Error('RMP returned an invalid GraphQL response');
  return data;
}

export default {
  async searchTeacher(text, schoolID) {
    const data = await request(searchTeacherQuery, { text, schoolID });
    return data.newSearch.teachers?.edges.map(edge => edge.node) || [];
  },
  async getTeacher(id) {
    const data = await request(getTeacherQuery, { id });
    return data.node;
  },
};
