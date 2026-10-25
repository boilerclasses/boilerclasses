import React, { useState, useEffect, useMemo, useCallback } from 'react';
import TimeGrid from './TimeGrid';
import CalendarCourse from './CalendarCourse';
import { DAYS } from './utils/constants';
import { useToast, useDisclosure } from '@chakra-ui/react';
import FeedbackModal from '../feedbackModal';


import ScheduleManager from './scheduleManager';
import { getSections, processLectureData } from '@/lib/sections';
import { semesterStorageKey } from '@/lib/terms';

// Func to get course color index based on detailId
export const getCourseColorIndex = (detailId, courseColorMap) => {
  if (!courseColorMap.has(detailId)) {
    courseColorMap.set(detailId, courseColorMap.size);
  }
  return courseColorMap.get(detailId);
};

const ScheduleCalendar = ({ semester, courses = [], setIsLoading, setSelectedCourse, onCourseRemove }) => {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [hoveredCourse, setHoveredCourse] = useState(null);
  const [allLectures, setAllLectures] = useState([]);
  const [displayedLectures, setDisplayedLectures] = useState([]);

  const courseColorMap = useMemo(() => new Map(), []);
  const [selectedLectureIds, setSelectedLectureIds] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(semesterStorageKey('selectedLectures', semester.code));

        const parsedData = saved ? JSON.parse(saved) : [];
        const dataArray = Array.isArray(parsedData) ? parsedData : [];

        return new Set(dataArray);
      }
    } catch (error) {
      console.error('Error loading selected lectures:', error);
    }
    return new Set();
  });

  // Add effect to save selected lectures whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(semesterStorageKey('selectedLectures', semester.code), JSON.stringify([...selectedLectureIds]));
    }
  }, [selectedLectureIds, semester.code]);

  useEffect(() => {
    const fetchCourseData = async () => {
      if (!courses.length) {
        setIsLoading(false);
        setAllLectures([]); // Reset lectures when no courses
        setDisplayedLectures([]); // Reset displayed lectures
        setSelectedLectureIds(new Set());
        return;
      }

      setIsLoading(true);
      try {
        const coursePromises = courses.map(course => getSections(course.detailId, semester.code));

        const rawResults = await Promise.all(coursePromises);
        // Pass the full courses array to processLectureData
        const processedLectures = processLectureData(rawResults, courses);

        // Keep existing displayed lectures that are still valid
        const validLectureIds = new Set(processedLectures.map(lecture => lecture.id));
        const updatedSelectedIds = new Set(
          Array.from(selectedLectureIds).filter(id => validLectureIds.has(id))
        );

        // Find newly pinned courses and select their first lecture
        courses.forEach((course) => {
          if (course.initialPin) {
            // Find all lectures for this course
            const courseLectures = processedLectures.filter(
              lecture => lecture.courseDetails.detailId === course.detailId
            );

            // Find the first lecture-type meeting
            let firstLecture = courseLectures.find(lecture => lecture.type === "Lecture");
            // if not found, select first meeting
            if (!firstLecture) {
              courseLectures.sort((a, b) => a.start - b.start);
              firstLecture = courseLectures[0];
            }

            if (firstLecture) updatedSelectedIds.add(firstLecture.id);

            // delete course.initialPin;
          }
        });

        setAllLectures(processedLectures);
        setSelectedLectureIds(updatedSelectedIds);
        setDisplayedLectures(processedLectures.filter(lecture => updatedSelectedIds.has(lecture.id)));
      } catch (error) {
        console.error('Error fetching course data:', error);
        toast({
          render: () => (
            <div className="flex flex-col p-3 bg-red-600/50 rounded-md">
              <span className="font-bold text-primary mb-1">
                Something went wrong, please let us know!
              </span>
              <button
                onClick={onOpen}
                className="text-primary underline hover:text-gray-200 text-center"
              >
                Report Issue
              </button>
            </div>
          ),
          duration: 2000,
          isClosable: true,
          position: 'top'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourseData();
    // Add courses.length and a stringified version of the last course to dependencies
    // This ensures the effect runs when courses change or when a course is reselected
  }, [courses, courses.length, courses[courses.length - 1]?.tmp_inc]);

  // Optimize lecture selection handler
  const handleLectureSelectionChange = useCallback((selectedIds) => {
    const selectedSet = new Set(selectedIds);
    setSelectedLectureIds(selectedSet);
    setDisplayedLectures(allLectures.filter(lecture => selectedSet.has(lecture.id)));
  }, [allLectures]);

  /**
   * Finds all courses that overlap with a given course on a specific day
   */
  const getOverlappingCourses = (day, course) => {
    const coursesOnDay = displayedLectures.filter(c => c.day.includes(day));
    const overlappingGroup = new Set();

    const findOverlaps = (currentCourse) => {
      for (const otherCourse of coursesOnDay) {
        if (overlappingGroup.has(otherCourse)) continue;
        if (!(otherCourse.end <= currentCourse.start || otherCourse.start >= currentCourse.end)) {
          overlappingGroup.add(otherCourse);
          findOverlaps(otherCourse);
        }
      }
    };

    findOverlaps(course);
    return Array.from(overlappingGroup);
  };

  const calculateTimePosition = (militaryTime) => {
    const hours = Math.floor(militaryTime / 100);
    const minutes = militaryTime % 100;
    return hours + (minutes / 60);
  };


  const reselectCourseDetails = (overlappingCourse) => {
    for (const course of courses) {
      if (course.detailId === overlappingCourse.courseDetails.detailId) {
        const courseWithPin = {
          ...course,
          initialPin: true,
          tmp_inc: Date.now(),
          scrollToMeeting: overlappingCourse.id
        };

        setAllLectures(prevLectures =>
          prevLectures.map(lecture => {
            if (lecture.courseDetails.detailId === course.detailId) {
              return {
                ...lecture,
                courseDetails: courseWithPin
              };
            }
            return lecture;
          })
        );

        // uncomment if we want to reselect course (highlight it)
        // setSelectedCourse(courseWithPin);
        return;
      }
    }
    console.error(overlappingCourse.courseDetails.detailId + ' - Course not found by detailId');
  };

  return (
    <div id="schedule_calendar" className='flex flex-col w-full lg:w-auto'>
      <div className="flex flex-col w-full h-full relative overflow-x-auto">
        {/* Header Row */}
        <div className="flex flex-row">
          <div className="w-16"></div>
          {DAYS.map(day => (
            <div key={day} className="flex-1 text-center font-bold text-tertiary">
              {day}
            </div>
          ))}
        </div>

        {/* Grid with Lectures */}
        <TimeGrid>
          {(day) => (
            <div className='flex flex-row'>
              {(() => {
                const renderedGroups = new Set();

                return displayedLectures
                  .filter(course => course.day.includes(day))
                  .map((course, courseIndex) => {
                    if (renderedGroups.has(course.id)) return null;

                    const overlaps = getOverlappingCourses(day, course);
                    const sortedOverlaps = [...overlaps].sort((a, b) => a.start - b.start);

                    if (course.id === sortedOverlaps[0].id) {
                      sortedOverlaps.forEach(c => renderedGroups.add(c.id));

                      return (
                        <div className="flex flex-row absolute top-0 left-0 w-full h-full" key={courseIndex}>
                          {sortedOverlaps.map((overlappingCourse, index) => {
                            const colorIndex = getCourseColorIndex(overlappingCourse.courseDetails.detailId, courseColorMap);
                            const startPos = calculateTimePosition(overlappingCourse.start);
                            const endPos = calculateTimePosition(overlappingCourse.end);
                            const top = (startPos - 6) * 2;
                            const height = (endPos - startPos) * 2;

                            return (
                              <CalendarCourse
                                key={overlappingCourse.id}
                                course={overlappingCourse}
                                colorIndex={colorIndex}
                                isHovered={hoveredCourse === overlappingCourse.courseDetails.detailId}
                                onHover={(isHovered) => setHoveredCourse(isHovered ? overlappingCourse.courseDetails.detailId : null)}
                                onClick={() => reselectCourseDetails(overlappingCourse)}
                                width={100 / overlaps.length}
                                style={{
                                  top: `${top}rem`,
                                  height: `${height}rem`,
                                }}
                              />
                            );
                          })}
                        </div>
                      );
                    }
                    return null;
                  });
              })()}
            </div>
          )}
        </TimeGrid>
      </div>

      {/* Manager Section */}
      <div className="space-y-4 mt-4">
        <ScheduleManager
          semester={semester.name}
          lectures={allLectures}
          selectedLectureIds={selectedLectureIds}
          onLectureSelectionChange={handleLectureSelectionChange}
          setSelectedCourse={setSelectedCourse}
          onCourseRemove={onCourseRemove}
          courseColorMap={courseColorMap}
        />
      </div>
      <FeedbackModal isOpen={isOpen} onClose={onClose} />
    </div>

  );
};

export default ScheduleCalendar;