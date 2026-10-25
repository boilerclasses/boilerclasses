import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import embed
from embeddings import EMBEDDING_DIM, VECTOR_FIELD_NAME


def course(code, description, gpa=3.0):
    return {
        'subjectCode': 'CS', 'courseCode': code, 'title': f'Course {code}',
        'description': description, 'terms': ['Fall 2026'], 'gened': [],
        'sched': ['Lecture'], 'credits': [3, 3], 'gpa': gpa,
    }


def fake_embed(texts):
    return np.ones((len(texts), EMBEDDING_DIM), dtype=np.float32)


class EmbedCacheTests(unittest.TestCase):
    def run_embed(self, directory, courses):
        data = Path(directory) / 'classes_out.json'
        data.write_text(json.dumps(courses))
        argv = ['embed.py', '--data', str(data), '--cache', str(Path(directory) / 'cache.sqlite3')]
        with patch('sys.argv', argv), \
                patch('embed.embed_texts', side_effect=fake_embed) as model, \
                patch('redis.Redis') as client:
            embed.main()
        embedded = sum(len(call.args[0]) for call in model.call_args_list)
        hsets = client.return_value.pipeline.return_value.hset.call_args_list
        return embedded, hsets

    def test_only_new_or_edited_text_is_embedded(self):
        courses = [course(18000, 'Problem solving'), course(25100, 'Data structures')]
        with tempfile.TemporaryDirectory() as directory:
            embedded, hsets = self.run_embed(directory, courses)
            self.assertEqual(embedded, 2)
            self.assertEqual(len(hsets), 2)

            # grades aren't part of the embedded text
            courses[0]['gpa'] = 3.9
            embedded, hsets = self.run_embed(directory, courses)
            self.assertEqual(embedded, 0)
            self.assertEqual(len(hsets), 2)

            courses[1]['description'] = 'Data structures and algorithms'
            courses.append(course(25200, 'Systems programming'))
            embedded, hsets = self.run_embed(directory, courses)
            self.assertEqual(embedded, 2)
            self.assertEqual(len(hsets), 3)

    def test_vectors_line_up_with_course_keys(self):
        courses = [course(18000, 'Problem solving'), course(25100, 'Data structures')]
        with tempfile.TemporaryDirectory() as directory:
            _, hsets = self.run_embed(directory, courses)
        for count, call in enumerate(hsets, start=1):
            self.assertEqual(call.args[0], f'class-vectors:{count}')
            mapping = call.kwargs['mapping']
            self.assertEqual(mapping['courseKey'], f'classes:{count}')
            self.assertEqual(len(mapping[VECTOR_FIELD_NAME]), EMBEDDING_DIM * 4)


if __name__ == '__main__':
    unittest.main()
