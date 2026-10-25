// Builds the browser search index once at startup, from the course file
// push.py writes, so browsers load it instead of indexing 18k courses themselves.
import fs from 'fs';
import { buildIndex, decodeCourses } from '../src/lib/courseSearch.mjs';

const courses = decodeCourses(JSON.parse(fs.readFileSync('search_index.json', 'utf8')));
// Write then rename, so /api/search-index never serves a half-written file.
fs.writeFileSync('search_minisearch.json.tmp', JSON.stringify(buildIndex(courses)));
fs.renameSync('search_minisearch.json.tmp', 'search_minisearch.json');
