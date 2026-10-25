import React, { useMemo } from 'react';
import { Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerHeader, DrawerOverlay } from '@chakra-ui/react';
import { IoMdOpen, IoMdAdd } from 'react-icons/io';
import Graph from '@/components/graph';
import Prereqs from '@/components/prereqs';
import { ScheduleGpaModal } from '@/components/detail/gpaModal';
import { collectAllProfessors, calculateGradesAndGPA, averageAllData } from '@/lib/gpaUtils';
import { genedsOptions, labels, sanitizeDescription } from '@/lib/utils';
import { courseName } from '@/lib/schedule';

const Section = ({ title, children }) => (
  <div className='flex flex-col gap-1'>
    <h3 className='text-xs font-semibold uppercase tracking-wide text-tertiary'>{title}</h3>
    {children}
  </div>
);

// Everything about one course (grades, instructors, prerequisites) in a panel that
// slides over the planner, so the calendar keeps the page.
const CourseDetailsDrawer = ({ course, semester, inPlan, onAdd, onClose }) => {
  const graph = useMemo(() => {
    if (!course?.instructor) return null;
    sanitizeDescription(course);
    const { grades } = calculateGradesAndGPA(collectAllProfessors(course.instructor), course.gpa);
    const datasets = averageAllData(grades);
    return datasets.length && !datasets[0].data.every(value => value === 0) ? { labels, datasets } : null;
  }, [course]);

  const instructors = course?.instructor?.[semester.name] ?? [];
  const offered = instructors.length > 0;

  return (
    <Drawer isOpen={Boolean(course)} placement='right' onClose={onClose} size='md'>
      <DrawerOverlay bg='blackAlpha.400' />
      <DrawerContent bg='rgb(var(--background-color))' color='rgb(var(--text-color))'>
        <DrawerCloseButton />
        {course && (
          <>
            <DrawerHeader className='pr-12'>
              <div className='text-2xl font-bold'>{courseName(course)}</div>
              <div className='text-base font-medium text-secondary'>{course.title}</div>
              <div className='mt-3 flex gap-2'>
                <a
                  href={`/detail/${course.detailId}`}
                  target='_blank'
                  rel='noreferrer'
                  className='flex items-center gap-1 rounded-full border border-[rgb(var(--background-secondary-color))] px-3 py-1 text-sm font-normal hover:bg-background-secondary transition'
                >
                  <IoMdOpen /> Full page
                </a>
                {!inPlan && offered && (
                  <button
                    onClick={() => onAdd(course)}
                    className='flex items-center gap-1 rounded-full bg-yellow-600 px-3 py-1 text-sm font-normal text-white hover:bg-yellow-700 transition'
                  >
                    <IoMdAdd /> Add to schedule
                  </button>
                )}
                {!offered && (
                  <span className='rounded-full bg-yellow-900/40 px-3 py-1 text-sm font-normal text-yellow-600'>
                    Not offered in {semester.name}
                  </span>
                )}
              </div>
            </DrawerHeader>
            <DrawerBody className='flex flex-col gap-5 pb-8'>
              <p className='text-sm text-secondary'>{course.description}</p>
              <div className='grid grid-cols-2 gap-4'>
                <Section title='Credits'>
                  <span className='text-sm'>
                    {course.credits[0] === course.credits[1] ? course.credits[0] : `${course.credits[0]} – ${course.credits[1]}`}
                  </span>
                </Section>
                <Section title='Type'>
                  <div className='flex flex-wrap gap-1'>
                    {[...course.sched, ...course.gened.map(g => genedsOptions.find(x => x.value === g)?.label).filter(Boolean)].map(tag => (
                      <span key={tag} className='rounded-full bg-background-secondary px-2 py-0.5 text-xs'>{tag}</span>
                    ))}
                  </div>
                </Section>
              </div>
              <Section title={`Instructors · ${semester.name}`}>
                {offered ? (
                  <div className='flex flex-wrap gap-x-2 text-sm text-blue-500'>
                    {instructors.map(name => (
                      <a
                        key={name}
                        href={`https://www.ratemyprofessors.com/search/professors/783?q=${name.split(' ')[0]} ${name.split(' ').at(-1)}`}
                        target='_blank'
                        rel='noreferrer'
                        className='underline decoration-dotted hover:text-blue-400'
                      >
                        {name}
                      </a>
                    ))}
                  </div>
                ) : <span className='text-sm text-tertiary'>None listed</span>}
              </Section>
              {course.prereqs && (
                <Section title='Prerequisites'>
                  <Prereqs course={course} scheduler={true} />
                </Section>
              )}
              <Section title='GPA by semester'>
                <ScheduleGpaModal course={course} semester={semester.name} />
              </Section>
              <Section title='Grade distribution'>
                {graph ? (
                  <div className='rounded-xl border border-[rgb(var(--background-secondary-color))]'>
                    <Graph data={graph} scheduler />
                  </div>
                ) : <span className='text-sm text-tertiary'>No grade data yet.</span>}
              </Section>
            </DrawerBody>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};

export default CourseDetailsDrawer;
