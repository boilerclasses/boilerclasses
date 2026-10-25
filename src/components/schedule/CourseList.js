import React from 'react';
import { Spinner } from '@chakra-ui/react';
import { IoIosArrowDown, IoIosClose, IoMdInformationCircleOutline } from 'react-icons/io';
import { courseName, eventColor, formatTime, missingTypes, shortType } from '@/lib/schedule';

const credits = ({ credits: [min, max] }) => (min === max ? `${min} cr` : `${min}–${max} cr`);

// What a course has picked so far, e.g. "Lecture MWF 10:30 · Lab Tue 11:30".
const summary = (options, picked) => options
  .filter(o => picked.includes(o.crn))
  .map(o => {
    const meeting = o.meetings.find(m => m.start != null);
    const days = meeting ? meeting.days.map(d => (d === 'Thu' ? 'R' : d === 'Sun' ? 'U' : d[0])).join('') : '';
    return `${shortType(o.type)}${meeting ? ` ${days} ${formatTime(meeting.start)}` : ''}`;
  })
  .join(' · ');

// The courses in the plan. The one being edited expands to show its section picker.
const CourseList = ({ courses, options, picks, activeId, readOnly, onSelect, onRemove, onDetails, renderPicker, isReady }) => {
  if (!courses.length) {
    return (
      <div className='rounded-xl border border-dashed border-[rgb(var(--background-secondary-color))] p-4 text-sm text-tertiary'>
        Search for a course above to add it. You can also drag on the calendar to block off time for work, clubs or anything else.
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-2'>
      {courses.map(course => {
        const color = eventColor(course.colorIndex);
        const courseOptions = Array.isArray(options[course.detailId]) ? options[course.detailId] : null;
        const picked = picks[course.detailId] ?? [];
        const missing = courseOptions ? missingTypes(picked, courseOptions) : [];
        const active = activeId === course.detailId;
        return (
          <div
            key={course.detailId}
            className={`rounded-xl border transition ${active ? 'bg-background shadow-md' : 'bg-background hover:shadow-sm'}`}
            style={{ borderColor: active ? color : 'rgb(var(--background-secondary-color))' }}
          >
            <div
              role='button'
              tabIndex={0}
              onClick={() => onSelect(active ? null : course.detailId)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelect(active ? null : course.detailId); }}
              className='flex items-start gap-2 p-3 cursor-pointer'
            >
              <span className='mt-1 h-2.5 w-2.5 shrink-0 rounded-full' style={{ background: color }} />
              <div className='min-w-0 flex-1'>
                <div className='flex items-baseline gap-2'>
                  <span className='font-semibold text-sm text-primary'>{isReady(course) ? courseName(course) : '…'}</span>
                  {isReady(course) && <span className='text-[11px] text-tertiary'>{credits(course)}</span>}
                </div>
                <div className='text-xs text-secondary truncate'>{course.title}</div>
                <div className='mt-1 text-[11px]'>
                  {!courseOptions ? (
                    <Spinner size='xs' />
                  ) : courseOptions.length === 0 ? (
                    <span className='text-tertiary'>No sections this term</span>
                  ) : missing.length ? (
                    <span className='text-red-500 font-medium'>Pick a {missing.map(t => shortType(t).toLowerCase()).join(' and ')}</span>
                  ) : (
                    <span className='text-tertiary'>{summary(courseOptions, picked)}</span>
                  )}
                </div>
              </div>
              <div className='flex items-center gap-0.5 text-secondary'>
                <button
                  aria-label='Course details'
                  onClick={(e) => { e.stopPropagation(); onDetails(course); }}
                  className='rounded-md p-1 hover:bg-background-secondary transition'
                >
                  <IoMdInformationCircleOutline size={16} />
                </button>
                {!readOnly && (
                  <button
                    aria-label={`Remove ${courseName(course)}`}
                    onClick={(e) => { e.stopPropagation(); onRemove(course.detailId); }}
                    className='rounded-md p-1 hover:bg-background-secondary transition'
                  >
                    <IoIosClose size={18} />
                  </button>
                )}
                {!readOnly && <IoIosArrowDown className={`transition ${active ? 'rotate-180' : ''}`} />}
              </div>
            </div>
            {active && !readOnly && courseOptions && (
              <div className='px-3 pb-3'>{renderPicker(course, courseOptions)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CourseList;
