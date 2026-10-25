import React, { useEffect, useMemo, useState } from 'react';
import { IoMdCheckmarkCircle, IoIosWarning } from 'react-icons/io';
import { loadRatingsForProfs, getRMPScore } from '@/components/RMP';
import { calculateGradesAndGPA, collectAllProfessors, getColor } from '@/lib/gpaUtils';
import { isIndianapolisRoom } from './utils/indianapolisUtils';
import { candidates, courseTypes, eventColor, formatRange, isLinked, missingTypes, pickedClassId, requiredTypes, shortType, typeRank } from '@/lib/schedule';

const rmpCache = new Map();

const dayList = (days) => (days.length ? days.join(' ') : 'No set days');

// One section as a card: when it meets, who teaches it (with GPA and RateMyProfessors),
// where, and what it would clash with.
const SectionCard = ({ option, picked, color, gpas, rmp, conflict, hovered, onToggle, onHover }) => (
  <button
    onClick={onToggle}
    onMouseEnter={() => onHover([option.crn])}
    onMouseLeave={() => onHover(null)}
    className={`w-full text-left rounded-lg border px-3 py-2 transition flex gap-2 items-start
      ${picked ? 'bg-[rgb(var(--background-secondary-color))]' : 'bg-background hover:bg-[rgb(var(--background-secondary-color)/0.6)]'}
      ${hovered ? 'ring-2' : ''}`}
    style={{ borderColor: picked ? color : 'rgb(var(--background-secondary-color))', '--tw-ring-color': color }}
  >
    <span className='mt-0.5 shrink-0' style={{ color: picked ? color : 'rgb(var(--text-tertiary-color))' }}>
      {picked ? <IoMdCheckmarkCircle size={18} /> : <span className='block h-[18px] w-[18px] rounded-full border-2 border-current opacity-60' />}
    </span>
    <span className='flex flex-col gap-0.5 min-w-0 flex-1 text-xs'>
      {option.meetings.map((meeting, index) => (
        <span key={index} className='flex flex-wrap gap-x-2 text-primary'>
          <span className='font-semibold'>{dayList(meeting.days)}</span>
          <span>{meeting.start != null ? formatRange(meeting.start, meeting.end) : 'Time TBA'}</span>
          <span className='text-tertiary'>{meeting.room}</span>
          {isIndianapolisRoom(meeting.room) && (
            <span className='px-1 rounded bg-background-tertiary text-secondary text-[10px] font-bold'>INDY</span>
          )}
        </span>
      ))}
      {option.instructors.length > 0 && (
        <span className='flex flex-wrap items-center gap-1 text-secondary'>
          {option.instructors.map(name => (
            <span key={name} className='flex items-center gap-1'>
              {name}
              {gpas[name]?.[0] > 0 && (
                <span className='px-1 rounded text-[10px] font-bold text-white' style={{ backgroundColor: getColor(gpas[name][0]) }}>
                  {gpas[name][0].toFixed(2)}
                </span>
              )}
              {getRMPScore(rmp, name) && (
                <span className='px-1 rounded text-[10px] font-bold bg-background-tertiary text-primary' title='RateMyProfessors'>
                  ★ {getRMPScore(rmp, name)}
                </span>
              )}
            </span>
          ))}
        </span>
      )}
      <span className='flex items-center gap-2 text-[10px] text-tertiary'>
        CRN {option.crn}
        {conflict && (
          <span className='flex items-center gap-0.5 text-red-500 font-medium'>
            <IoIosWarning /> Overlaps {conflict}
          </span>
        )}
      </span>
    </span>
  </button>
);

// Picks a course's sections, a type at a time (Lecture, then its Lab...). The same
// choices show on the calendar as dashed blocks while this is open.
const SectionPicker = ({ course, options, picked, activeType, setActiveType, conflictFor, hoveredCrns, onHover, onPick, onUnpick }) => {
  const [rmp, setRmp] = useState(() => rmpCache.get(course.detailId) ?? {});
  const color = eventColor(course.colorIndex);

  useEffect(() => {
    if (rmpCache.has(course.detailId)) return;
    loadRatingsForProfs(course, (scores) => {
      rmpCache.set(course.detailId, scores);
      setRmp(scores);
    });
  }, [course.detailId]);

  const gpas = useMemo(() => {
    if (!course.instructor) return {};
    return calculateGradesAndGPA(Array.from(collectAllProfessors(course.instructor)), course.gpa).gpa;
  }, [course]);

  const linked = isLinked(options);
  const classId = pickedClassId(picked, options);
  const types = linked && classId ? requiredTypes(options, classId) : courseTypes(options);
  const missing = missingTypes(picked, options);
  const shown = candidates(options, picked, activeType)
    .sort((a, b) => {
      const first = (o) => o.meetings.find(m => m.start != null);
      return (first(a)?.start ?? 1e4) - (first(b)?.start ?? 1e4) || a.crn - b.crn;
    });

  if (!options.length) {
    return <p className='text-xs text-tertiary px-1'>No sections listed for this term.</p>;
  }

  return (
    <div className='flex flex-col gap-2'>
      {types.length > 1 && (
        <div className='flex gap-1 rounded-lg bg-[rgb(var(--background-secondary-color))] p-0.5'>
          {types.map(type => {
            const done = !missing.includes(type) && options.some(o => o.type === type && picked.includes(o.crn));
            return (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition
                  ${activeType === type ? 'bg-background text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
              >
                {shortType(type)}
                {done ? <IoMdCheckmarkCircle style={{ color }} /> : missing.includes(type) && <span className='h-1.5 w-1.5 rounded-full bg-red-500' />}
              </button>
            );
          })}
        </div>
      )}
      <p className='text-[11px] text-tertiary px-1'>
        {shown.length} {shortType(activeType).toLowerCase()} option{shown.length === 1 ? '' : 's'}
        {linked && classId && typeRank(activeType) > typeRank(types[0]) ? ' for your lecture' : ''} · hover to preview on the calendar
      </p>
      <div className='flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto pr-1'>
        {shown.map(option => {
          const isPicked = picked.includes(option.crn);
          return (
            <SectionCard
              key={option.crn}
              option={option}
              picked={isPicked}
              color={color}
              gpas={gpas}
              rmp={rmp}
              conflict={isPicked ? null : conflictFor(option)}
              hovered={hoveredCrns?.includes(option.crn)}
              onHover={onHover}
              onToggle={() => (isPicked ? onUnpick(option.crn) : onPick(option.crn))}
            />
          );
        })}
      </div>
    </div>
  );
};

export default SectionPicker;
