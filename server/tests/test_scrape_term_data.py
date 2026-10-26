import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import scrape_term_data

# Trimmed from the registrar's Fall 2026 evening exam PDF, as pypdf extracts it.
EVENING = """\
UniTime 4.9.41 (Purdue)                                  SCHEDULE BY COURSE                                                   EVENING
Sat 10/24, 2026                                                                                                       Fall 2026 (PWL)
=====================================================================================================================================
Subject Course   Section    Meeting Times                        Enrl  Date And Time                  Room          Cap ExCap
------- -------- ---------- ----------------------------------- -----  ------------------------------ ----------- ----- -----
AAE     20300                                                     303  Wed 10/07 08:00p - 10:00p      BHEE  170     170    87
                                                                                                      ME    1061    158    85

                                                                  303  Mon 11/09 08:00p - 10:00p      UC    114     273   136

        20400    10002-001  TR     7:30a -  8:45a                 112  Thu 10/29 08:00p - 10:00p      PHYS  114     276   156

CS      51400                                                       5  Mon 12/14 08:00a - 10:00a      KNOY  B033     60    32
w/MA    51400                                                      23
"""


class ExamParseTest(unittest.TestCase):
    def setUp(self):
        self.term, self.exams = scrape_term_data.parse_exam_text(EVENING, "evening")

    def test_term_from_header(self):
        self.assertEqual(self.term, "Fall 2026")

    def test_repeated_course_rows_and_extra_rooms(self):
        self.assertEqual(self.exams["AAE 20300"], [
            {"kind": "evening", "date": "2026-10-07", "start": "20:00", "end": "22:00",
             "rooms": ["BHEE 170", "ME 1061"], "crn": None},
            {"kind": "evening", "date": "2026-11-09", "start": "20:00", "end": "22:00",
             "rooms": ["UC 114"], "crn": None},
        ])

    def test_section_rows_keep_the_crn(self):
        self.assertEqual([exam["crn"] for exam in self.exams["AAE 20400"]], [10002])

    def test_cross_listed_course_shares_the_exam(self):
        self.assertEqual(self.exams["MA 51400"], self.exams["CS 51400"])
        self.assertEqual(self.exams["MA 51400"][0]["start"], "08:00")


class ClassDatesTest(unittest.TestCase):
    EVENTS = [
        ("Fall 2026 Semester Classes Begin", ["2026-08-24"]),
        ("Labor Day", ["2026-09-07"]),
        ("Fall Break", ["2026-10-12", "2026-10-13"]),
        ("Fall 2026 Semester Classes End", ["2026-12-12"]),
        ("Fall 2026 Semester Ends", ["2026-12-19"]),
        ("Summer Session Ends", ["2026-08-07"]),
    ]

    def test_breaks_are_the_events_inside_the_class_window(self):
        self.assertEqual(scrape_term_data.class_dates("Fall 2026", self.EVENTS), {
            "classesBegin": "2026-08-24", "classesEnd": "2026-12-12",
            "noClassDays": ["2026-09-07", "2026-10-12", "2026-10-13"]})

    def test_missing_term_events(self):
        self.assertIsNone(scrape_term_data.class_dates("Spring 2027", self.EVENTS))


if __name__ == "__main__":
    unittest.main()
