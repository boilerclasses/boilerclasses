import React, { useState, useEffect } from 'react';
import { IoMdDownload } from "react-icons/io";
import HoverMenu from './HoverMenu';
import CourseGroup from './CourseGroup';
import { downloadICS } from '@/lib/ics';
import { openPDFInNewTab } from '@/lib/pdf';  // Update import

const ScheduleManager = ({ semester, lectures, selectedLectureIds, onLectureSelectionChange, setSelectedCourse, onCourseRemove, courseColorMap }) => {
  const [minCredits, setMinCredits] = useState(0);
  const [maxCredits, setMaxCredits] = useState(0);

  useEffect(() => {
    const credits = Array.from(selectedLectureIds).reduce((acc, id) => {
      const lecture = lectures.find(lecture => lecture.id === id);
      if (lecture) {
        if (!acc[2].has(lecture.courseDetails.detailId)) {
          acc[0] += lecture.courseDetails.credits[0] || 0;
          acc[1] += lecture.courseDetails.credits[1] || 0;
          acc[2].add(lecture.courseDetails.detailId);
        }
      }
      return acc;
    }, [0, 0, new Set()]);

    setMinCredits(credits[0]);
    setMaxCredits(credits[1]);
  }, [selectedLectureIds, lectures]);

  const handleLectureToggle = (lectureId, classId) => {
    const newSelectedLectures = new Set(selectedLectureIds);
    const clickedLecture = lectures.find(lecture => lecture.id === lectureId);

    // If selecting a new lecture
    if (!selectedLectureIds.has(lectureId)) {
      // Remove other lectures from the same course (but keep other courses)
      lectures
        .filter(lecture => lecture.courseDetails.detailId === clickedLecture.courseDetails.detailId)
        .forEach(lecture => {
          newSelectedLectures.delete(lecture.id);
        });

      // Add the selected lecture and any other lectures from its class
      lectures
        .filter(lecture => lecture.classId === classId)
        .forEach(lecture => {
          if (selectedLectureIds.has(lecture.id) || lecture.id === lectureId) {
            newSelectedLectures.add(lecture.id);
          }
        });
    } else {
      // If deselecting, just remove this specific lecture
      newSelectedLectures.delete(lectureId);
    }

    onLectureSelectionChange([...newSelectedLectures]);
  };

  // Group lectures by course name - Update this grouping to use detailId
  const courseGroups = lectures.reduce((acc, lecture) => {
    const key = lecture.courseDetails.detailId;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(lecture);
    return acc;
  }, {});

  const selectedLectures = lectures.filter(lecture => selectedLectureIds.has(lecture.id));

  return (
    <div className="flex flex-col space-y-2 py-4 pl-4">
      <div className='flex flex-row justify-between mb-4'>
        <div className='flex md:flex-row flex-col gap-2'>
          <h2 className="text-lg font-semibold text-primary">Course Sections</h2>
          {selectedLectures.length > 0 && (
            <HoverMenu
              items={[
                {
                  label: 'Export as ICS',
                  icon: <IoMdDownload />,
                  onClick: () => downloadICS(selectedLectures, semester)
                },
                {
                  label: 'Export as PDF',
                  icon: <IoMdDownload />,
                  onClick: () => openPDFInNewTab(selectedLectures, semester)
                }
              ]}
            >
              <button
                className="flex items-center gap-2 px-3 py-1 text-sm text-secondary bg-background hover:brightness-125 transition rounded shadow"
              >
                <IoMdDownload />
                Export Schedule
              </button>
            </HoverMenu>
          )}
        </div>
        <h2 className="text-xs text-tertiary self-end">
          Total Credits: {minCredits === maxCredits ? minCredits : `${minCredits} - ${maxCredits}`}
        </h2>
      </div>
      {courseGroups && Object.keys(courseGroups).length !== 0 ? Object.entries(courseGroups).map(([detailId, courseLectures]) => (
        <CourseGroup
          key={detailId}
          parentCourse={courseLectures[0].courseDetails}
          lectures={courseLectures}
          selectedLectures={selectedLectureIds}
          onLectureToggle={handleLectureToggle}
          setSelectedCourse={setSelectedCourse}
          onCourseRemove={onCourseRemove}
          courseColorMap={courseColorMap}
        />
      )) : (
        <p className="text-tertiary text-sm">Search for a course by using the search bar, then add a course to show up here!</p>
      )}
    </div>
  );
};

export default ScheduleManager;