import { convertTo12HourFormat } from '@/lib/timeUtils';
import { normalizeInstructorName } from '@/components/schedule/utils/scheduleUtils';
import { CURRENT_SEMESTER_CODE } from '@/lib/terms';

// A term's sections scraped from Banner, or null if the course isn't offered that term.
export const getSections = async (detailId, term = CURRENT_SEMESTER_CODE) => {
  try {
    const params = new URLSearchParams({ detailId, term });
    const response = await fetch(`/api/sections?${params}`);
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`);
    }
    return (await response.json()).sections;
  } catch (e) {
    console.error('Error fetching sections:', e);
    return null;
  }
};

const toMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const toMilitary = (minutes) => Math.floor(minutes / 60) * 100 + minutes % 60;

// One entry per meeting; sectionResults[i] holds the sections for courses[i].
export const processLectureData = (sectionResults, courses) => {
  const coursesArray = [];

  sectionResults.forEach((sections, index) => {
    if (!sections) return;

    const course = courses[index];
    const courseName = `${course.subjectCode} ${course.courseCode}`;
    const instructors = section => section.instructors.map(name =>
      normalizeInstructorName(name, course.instructor)
    );

    sections.forEach(section => {
      section.meetings.forEach((meeting, i) => {
        const start = meeting.start ? toMinutes(meeting.start) : 0;
        const length = meeting.start && meeting.end ? toMinutes(meeting.end) - start : 0;

        coursesArray.push({
          id: `${section.crn}-${i}`,
          name: courseName,
          classId: section.classId,
          type: section.type,
          start: toMilitary(start),
          end: toMilitary(start + length),
          day: meeting.days.length ? meeting.days : ["None"],
          instructors: instructors(section),
          startTime: meeting.start ? convertTo12HourFormat(meeting.start) : "No Meeting Time",
          room: meeting.room,
          duration: `${Math.floor(length / 60)}H${length % 60}M`,
          crn: section.crn,
          courseDetails: course,
          startDate: meeting.startDate,
          endDate: meeting.endDate
        });
      });
    });
  });

  return coursesArray;
};
