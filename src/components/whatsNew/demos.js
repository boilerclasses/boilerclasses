import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IoMdCheckmarkCircle } from 'react-icons/io';
import { eventColor } from '@/lib/schedule';
import { getColor } from '@/lib/gpaUtils';
import { useDemoStep } from './useDemoStep';

// Looping, non-interactive previews of the new Schedule Assistant for the What's New popup.
// Each is a miniature of the real UI drawn in code, so it stays sharp and follows the theme.

const LINE = 'rgb(var(--background-secondary-color))';

// Fake pointer that glides between targets and ripples when `click` changes.
// x is a CSS percentage of its container and y is px from the container's top.
const Cursor = ({ x, y, click = null }) => (
  <motion.div
    className='absolute z-30'
    initial={false}
    animate={{ left: x, top: y }}
    transition={{ type: 'spring', stiffness: 170, damping: 22 }}
  >
    {click !== null && (
      // the ripple waits for the pointer to arrive
      <motion.span
        key={click}
        className='absolute -left-2 -top-2 h-4 w-4 rounded-full border-2 border-yellow-500'
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 1.9], opacity: [1, 0] }}
        transition={{ duration: 0.55, delay: 0.3, ease: 'easeOut' }}
      />
    )}
    <svg width='12' height='16' viewBox='0 0 14 18' className='drop-shadow'>
      <path d='M1 1 L1 15 L4.8 11.4 L7.6 17 L10 15.9 L7.3 10.4 L12.6 10.4 Z' fill='black' stroke='white' />
    </svg>
  </motion.div>
);

// --- a small week, the shape of the real calendar ---------------------------------------

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const FIRST_HOUR = 9;
const HOURS = 7; // 9 AM to 4 PM
const ROW = 20; // px per hour

const dayX = (day) => `${day * 20}%`;
const timeY = (hour) => (hour - FIRST_HOUR) * ROW;

// Children are placed over the day columns, x as a percentage across them and y from 9 AM.
const MiniWeek = ({ children }) => (
  <div className='absolute inset-0 flex flex-col text-[9px] text-tertiary'>
    <div className='flex h-5 shrink-0 border-b' style={{ borderColor: LINE }}>
      <div className='w-6 shrink-0' />
      {DAYS.map(day => <div key={day} className='flex-1 text-center uppercase leading-5 tracking-wide'>{day}</div>)}
    </div>
    <div className='flex flex-1'>
      <div className='w-6 shrink-0'>
        {Array.from({ length: HOURS }, (_, i) => (
          <div key={i} style={{ height: ROW }} className='pr-1 text-right leading-none'>{(FIRST_HOUR + i - 1) % 12 + 1}</div>
        ))}
      </div>
      <div
        className='relative flex-1'
        style={{ backgroundImage: `repeating-linear-gradient(to bottom, ${LINE} 0 1px, transparent 1px ${ROW}px)` }}
      >
        <div className='absolute inset-0 flex'>
          {DAYS.map(day => <div key={day} className='flex-1 border-l' style={{ borderColor: LINE }} />)}
        </div>
        {children}
      </div>
    </div>
  </div>
);

// A class (solid), a section to choose from (dashed) or a personal block, as on the calendar.
// Overlapping items share their day's width, `column` of `columns`, like the real calendar.
const Block = ({ day, start, end, color, label = '', ghost = false, clash = false, show = true, grow = 0.35, column = 0, columns = 1 }) => (
  <motion.div
    className='absolute p-px'
    style={{ top: timeY(start) }}
    initial={false}
    animate={{
      opacity: show ? 1 : 0,
      height: (end - start) * ROW,
      left: `${day * 20 + (column * 20) / columns}%`,
      width: `${20 / columns}%`,
    }}
    transition={{ duration: grow }}
  >
    <div
      className={`h-full overflow-hidden rounded px-1 py-0.5 text-[8px] font-semibold leading-tight text-primary ${clash ? 'ring-1 ring-inset ring-red-500' : ''}`}
      style={ghost
        ? { border: `1px dashed ${eventColor(color, 0.8)}`, background: eventColor(color, 0.08) }
        : { background: eventColor(color, 0.22), borderLeft: `2px solid ${eventColor(color)}` }}
    >
      {label}
    </div>
  </motion.div>
);

const LECTURES = [
  ...[0, 2, 4].map(day => ({ day, start: 10.5, end: 11.33, color: 0, label: 'CS 18000' })),
  ...[1, 3].map(day => ({ day, start: 11.5, end: 12.33, color: 3, label: 'CHM 11510' })),
];
const LAB_OPTIONS = [
  { day: 1, start: 11.5, end: 13.33, clash: true },
  { day: 2, start: 13.5, end: 15.33 },
  { day: 3, start: 9.5, end: 11.33, pick: true },
];
const PICKED_LAB = { day: 3, start: 9.5, end: 11.33, color: 0, label: 'CS 18000 Lab' };

// Opening a course lays its other sections on the calendar; one that clashes is outlined in
// red, and clicking one picks it.
export const PickDemo = () => {
  const step = useDemoStep([900, 1300, 1500, 1100], 2);
  return (
    <MiniWeek>
      {LECTURES.map((block, i) => {
        // the class a lab option clashes with makes room for it while the options show
        const shared = step === 1 && LAB_OPTIONS.some(lab => lab.clash && lab.day === block.day);
        return <Block key={i} {...block} columns={shared ? 2 : 1} />;
      })}
      {LAB_OPTIONS.map((lab, i) => {
        const picked = lab.pick && step >= 2;
        return (
          <Block
            key={`lab-${i}`}
            day={lab.day} start={lab.start} end={lab.end} color={0}
            label={picked ? PICKED_LAB.label : 'Lab'}
            ghost={!picked}
            clash={lab.clash}
            show={picked || step === 1}
            column={lab.clash ? 1 : 0}
            columns={lab.clash ? 2 : 1}
          />
        );
      })}
      <Cursor
        x={step === 0 ? '92%' : step === 3 ? '78%' : '68%'}
        y={step === 0 ? 118 : step === 3 ? 70 : 24}
        click={step === 2 ? 'pick' : null}
      />
    </MiniWeek>
  );
};

// Dragging on empty space draws out a block, which is kept once it has a name.
export const BlockDemo = () => {
  const step = useDemoStep([900, 450, 1100, 1000, 1700], 4);
  return (
    <MiniWeek>
      {[...LECTURES, PICKED_LAB].map((block, i) => <Block key={i} {...block} />)}
      <Block
        day={4} start={13} end={step >= 2 ? 15 : 13.25} color={6}
        ghost={step < 3}
        label={step >= 4 ? 'Gym' : step === 3 ? 'Untitled' : ''}
        show={step >= 1}
        grow={step === 2 ? 0.9 : 0.35}
      />
      <Cursor
        x={step === 0 ? '76%' : '88%'}
        y={step === 0 ? 66 : step === 1 ? timeY(13) + 2 : timeY(15) + 2}
        click={step === 1 ? 'press' : null}
      />
    </MiniWeek>
  );
};

// --- open seats, class GPA and the CRN list ----------------------------------------------

const SECTIONS = [
  { crn: 13157, days: 'Thu', time: '9:30 – 11:20 AM', room: 'LWSN B158', seats: '12 of 30 seats open' },
  { crn: 13152, days: 'Wed', time: '1:30 – 3:20 PM', room: 'LWSN B148', seats: 'Full · 4 on waitlist', full: true },
];
const MENU = ['Save as image', 'Copy share link', 'Copy CRNs…', 'Add to calendar app…'];

// Seats fill in on the section cards, one is picked, and Export > Copy CRNs lists the CRNs.
export const SeatsDemo = () => {
  const step = useDemoStep([700, 1100, 1000, 1000, 1000, 2000], 5);
  const cursor = [
    { x: '62%', y: 128 }, { x: '45%', y: 44 }, { x: '45%', y: 44, click: 'section' },
    { x: '90%', y: 14, click: 'export' }, { x: '78%', y: 78, click: 'copy' }, { x: '64%', y: 132 },
  ][step];
  return (
    <div className='absolute inset-0 flex flex-col gap-1.5 p-2.5 text-[9px]'>
      <div className='flex items-center gap-1.5'>
        <span className='h-2 w-2 rounded-full' style={{ background: eventColor(0) }} />
        <span className='text-[11px] font-semibold text-primary'>CS 18000</span>
        <span className='text-tertiary'>4 cr</span>
        <span className='rounded px-1 text-[8px] font-bold text-white' style={{ background: getColor(2.86) }}>GPA 2.86</span>
        <span className='ml-auto rounded-full bg-background-opposite px-2 py-0.5 font-medium text-opposite'>Export</span>
      </div>
      {SECTIONS.map((section, i) => {
        const picked = step >= 2 && i === 0;
        return (
          // the other sections make way for the copied CRNs panel
          <motion.div
            key={section.crn}
            className='flex items-start gap-1.5 rounded-md border px-2 py-1.5 transition-colors'
            style={{ borderColor: picked ? eventColor(0) : LINE }}
            initial={false}
            animate={{ opacity: step === 5 && !picked ? 0 : 1 }}
          >
            <span className='mt-px' style={{ color: picked ? eventColor(0) : 'rgb(var(--text-tertiary-color))' }}>
              {picked
                ? <IoMdCheckmarkCircle size={11} />
                : <span className='block h-[11px] w-[11px] rounded-full border-[1.5px] border-current opacity-60' />}
            </span>
            <span className='flex flex-col gap-0.5'>
              <span className='text-primary'>
                <span className='font-semibold'>{section.days}</span> {section.time} <span className='text-tertiary'>{section.room}</span>
              </span>
              <span className='text-tertiary'>
                CRN {section.crn} ·{' '}
                <motion.span
                  className={section.full ? 'font-medium text-red-500' : ''}
                  initial={false}
                  animate={{ opacity: step >= 1 ? 1 : 0 }}
                >
                  {section.seats}
                </motion.span>
              </span>
            </span>
          </motion.div>
        );
      })}
      <AnimatePresence>
        {(step === 3 || step === 4) && (
          <motion.div
            key='menu'
            className='absolute right-2.5 top-8 z-20 w-32 whitespace-nowrap rounded-md border bg-background py-1 shadow-lg'
            style={{ borderColor: LINE }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.35 } }}
            exit={{ opacity: 0 }}
          >
            {MENU.map(item => (
              <div key={item} className={`px-2 py-0.5 text-primary ${step === 4 && item === 'Copy CRNs…' ? 'bg-background-secondary' : ''}`}>
                {item}
              </div>
            ))}
          </motion.div>
        )}
        {step === 5 && (
          <motion.div
            key='crns'
            className='absolute inset-x-2.5 bottom-2.5 z-20 rounded-md border bg-background px-2 py-1.5 shadow-lg'
            style={{ borderColor: LINE }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className='flex items-center gap-1.5'>
              <span className='w-12 font-semibold text-primary'>CS 18000</span>
              {[['13105', 'Lecture'], ['13157', 'Lab']].map(([crn, type]) => (
                <span key={crn} className='rounded bg-background-secondary px-1.5 py-0.5'>
                  <span className='font-mono font-medium text-primary'>{crn}</span> <span className='text-tertiary'>{type}</span>
                </span>
              ))}
            </div>
            <div className='mt-1 flex items-center gap-1 font-medium text-green-500'>
              <IoMdCheckmarkCircle size={10} /> Copied 2 CRNs
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Cursor {...cursor} />
    </div>
  );
};

// --- the calendar app subscription -------------------------------------------------------

const WEEKS = [
  { label: 'Mar 8', classes: true },
  { label: 'Mar 15', note: 'Spring break, no class' },
  { label: 'Mar 22', classes: true },
  { label: 'May 3', exam: 'CS 18000 final' },
];
// each weekday's classes as event colors, the same plan as the other demos
const DAY_CLASSES = [[0], [3], [0], [0, 3], [0]];

// Subscribing fills the weeks with classes, skips spring break and adds the final exam.
export const CalendarDemo = () => {
  const step = useDemoStep([900, 500, 1100, 1000, 1200, 1600], 5);
  const added = step >= 2;
  return (
    <div className='absolute inset-0 flex flex-col p-2.5 text-[9px] text-tertiary'>
      <div className='mb-1.5 flex items-center'>
        <span className='text-[10px] font-semibold text-primary'>Your calendar app</span>
        <span
          className={`ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors ${added
            ? 'bg-background-secondary text-green-500'
            : 'bg-background-opposite text-opposite'}`}
        >
          {added && <IoMdCheckmarkCircle size={9} />}
          {added ? 'Subscribed' : 'Add to calendar app'}
        </span>
      </div>
      <div className='flex'>
        <span className='w-9 shrink-0' />
        {DAYS.map(day => <div key={day} className='flex-1 text-center uppercase tracking-wide'>{day}</div>)}
      </div>
      {WEEKS.map((week, w) => (
        <div key={week.label} className='flex h-[22px] items-center border-t' style={{ borderColor: LINE }}>
          <span className='w-9 shrink-0'>{week.label}</span>
          <div className='relative flex h-full flex-1 items-center'>
            {DAYS.map((day, i) => (
              <div key={day} className='flex flex-1 justify-center gap-0.5'>
                {week.classes && DAY_CLASSES[i].map((color, j) => (
                  <motion.span
                    key={j}
                    className='h-2.5 w-2 rounded-sm'
                    style={{ background: eventColor(color, 0.85) }}
                    initial={false}
                    animate={{ opacity: added ? 1 : 0, scale: added ? 1 : 0.4 }}
                    transition={{ delay: added ? (w * 5 + i) * 0.03 : 0 }}
                  />
                ))}
              </div>
            ))}
            {week.note && (
              <motion.span
                className='absolute inset-x-1 inset-y-1 flex items-center justify-center rounded bg-background-secondary text-secondary'
                initial={false}
                animate={{ opacity: step >= 3 ? 1 : 0 }}
              >
                {week.note}
              </motion.span>
            )}
            {week.exam && (
              <motion.span
                className='absolute inset-y-1 left-[30%] flex w-[40%] items-center justify-center whitespace-nowrap rounded font-semibold text-white'
                style={{ background: eventColor(0) }}
                initial={false}
                animate={{ opacity: step >= 4 ? 1 : 0, scale: step >= 4 ? 1 : 0.6 }}
              >
                {week.exam}
              </motion.span>
            )}
          </div>
        </div>
      ))}
      <Cursor
        x={step === 0 ? '60%' : step === 1 ? '86%' : '72%'}
        y={step === 0 ? 120 : step === 1 ? 12 : 136}
        click={step === 1 ? 'subscribe' : null}
      />
    </div>
  );
};
