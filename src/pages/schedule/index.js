// boilerclasses.com/schedule (schedule.boilerclasses.com redirects here)

import Head from 'next/head';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBreakpointValue, useToast } from '@chakra-ui/react';

import { useSearchFilters } from '@/hooks/useSearchFilters';
import { useSchedule, restoreFullCourse } from '@/hooks/useSchedule';
import { SCHEDULE_SEMESTERS, migrateScheduleStorage, semesterStorageKey } from '@/lib/terms';
import { decodeSchedule, encodeSchedule } from '@/lib/scheduleShare';
import { convertTo12HourFormat } from '@/lib/timeUtils';
import { EXAM_LABELS } from '@/lib/termData';
import {
  WEEK, WEEKDAYS, candidates, choose, clashes, courseName, courseTypes, eventColor, formatRange,
  isTimed, missingTypes, shortType, toClock, toMinutes,
} from '@/lib/schedule';
import CourseSearch from '@/components/schedule/courseSearch';
import WeekCalendar from '@/components/schedule/WeekCalendar';
import CourseList from '@/components/schedule/CourseList';
import SectionPicker from '@/components/schedule/SectionPicker';
import BlockEditor from '@/components/schedule/BlockEditor';
import FloatingCard from '@/components/schedule/FloatingCard';
import CourseDetailsDrawer from '@/components/schedule/CourseDetailsDrawer';
import ExportMenu from '@/components/schedule/ExportMenu';
import Footer from '@/components/footer';

const inter = Inter({ subsets: ['latin'] });

const SEMESTER_STORAGE_KEY = 'scheduleSemester';

const Schedule = () => {
  const searchFilters = useSearchFilters({ view: 'card' });

  // null until mounted: the page is prerendered without localStorage, so the saved term
  // (and every per-term planner initializer) is only read on the client
  const [semester, setSemester] = useState(null);
  // a schedule opened from a share link (?s=...), shown read-only until copied or dismissed
  const [shared, setShared] = useState(null);

  useEffect(() => {
    const newest = SCHEDULE_SEMESTERS[SCHEDULE_SEMESTERS.length - 1];
    const plan = decodeSchedule(new URLSearchParams(window.location.search).get('s') ?? '');
    const sharedTerm = plan && SCHEDULE_SEMESTERS.find(option => option.code === plan.term);
    if (sharedTerm) {
      setShared(plan);
      setSemester(sharedTerm);
      return;
    }
    let saved = null;
    try {
      migrateScheduleStorage();
      saved = localStorage.getItem(SEMESTER_STORAGE_KEY);
    } catch (error) {
      console.error('Error loading schedule semester:', error);
    }
    // defaults to the newest term, which is what most people are planning for
    setSemester(SCHEDULE_SEMESTERS.find(option => option.code === saved) ?? newest);
  }, []);

  useEffect(() => {
    if (!semester || shared) return;
    try {
      localStorage.setItem(SEMESTER_STORAGE_KEY, semester.code);
    } catch (error) {
      console.error('Error saving schedule semester:', error);
    }
  }, [semester, shared]);

  // leave a shared schedule for your own plan, optionally saving the shared one as it
  const leaveShared = (copyIt) => {
    if (copyIt) {
      const key = (name) => semesterStorageKey(name, shared.term);
      const existing = JSON.parse(localStorage.getItem(key('pinnedCourses')) || '[]');
      if (existing.length && !window.confirm(`Replace your ${semester.name} plan (${existing.length} course${existing.length === 1 ? '' : 's'}) with this one?`)) return;
      localStorage.setItem(key('pinnedCourses'), JSON.stringify(shared.courses.map(({ detailId, colorIndex, name }) => ({ detailId, colorIndex, name }))));
      localStorage.setItem(key('sectionPicks'), JSON.stringify(Object.fromEntries(shared.courses.map(c => [c.detailId, c.crns]))));
      localStorage.setItem(key('scheduleBlocks'), JSON.stringify(shared.blocks.map(({ id, ...block }) => ({ ...block, id: Math.random().toString(36).slice(2, 10) }))));
      localStorage.setItem(SEMESTER_STORAGE_KEY, shared.term);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('s');
    window.history.replaceState(null, '', url);
    setShared(null);
    if (!copyIt) {
      const saved = localStorage.getItem(SEMESTER_STORAGE_KEY);
      setSemester(SCHEDULE_SEMESTERS.find(option => option.code === saved) ?? semester);
    }
  };

  const description = 'BoilerClasses Scheduling Assistant - Plan your next courses from over 13000 Purdue University courses. Find geneds, grades, prerequisites, schedules, and more.';
  const image = 'https://opengraph.b-cdn.net/production/images/0413e8c7-edd6-4344-bc7a-8fc27d840783.png?token=XWki0pXYsNvGaeuQwxsWOq1GkgkT-SJQTrP2LtDWKyE&height=776&width=1200&expires=33268877667';

  return (
    <>
      <Head>
        <title>Schedule Assistant | BoilerClasses</title>
        <meta name="title" content="Schedule Assistant | BoilerClasses" />
        <meta name="description" content={description} />
        <meta name="keywords" content="Purdue, Purdue Univesity, Purdue Courses, BoilerClasses, Boiler Classes, Boiler, Classes, Courses, Schedule, Scheduling, Assistant, BoilerCourses, Boiler Class, Catalog, Catalogue, Purdue Course Search, Purdue Course Catalog, Boilermakers" />
        <meta name='og:locality' content='West Lafayette' />
        <meta name='og:region' content='IN' />
        <meta name='og:postal-code' content='47906' />
        <meta name='og:postal-code' content='47907' />

        <meta property="og:url" content="https://boilerclasses.com/schedule" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Schedule Assistant | BoilerClasses" />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={image} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta property="twitter:domain" content="boilerclasses.com" />
        <meta property="twitter:url" content="https://boilerclasses.com/schedule" />
        <meta name="twitter:title" content="Schedule Assistant | BoilerClasses" />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={image} />

        <link rel="canonical" href="https://boilerclasses.com/schedule" />
      </Head>

      <div className={`min-h-screen bg-super text-primary ${inter.className}`}>
        {/* remount per term so every piece of schedule state reloads from that term's storage */}
        {semester && (
          <SchedulePlanner
            key={`${semester.code}-${shared ? 'shared' : 'mine'}`}
            semester={semester}
            setSemester={(option) => { setShared(null); setSemester(option); }}
            shared={shared}
            onLeaveShared={leaveShared}
            {...searchFilters}
          />
        )}
      </div>
      <Footer />
    </>
  );
};

const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const SchedulePlanner = ({ semester, setSemester, shared, onLeaveShared, updateFilter, courses: searchResults, filters }) => {
  const toast = useToast();
  const schedule = useSchedule(semester, { shared });
  const { courses, options, picks, blocks, meetings, exams, dates, activeId, setActiveId, readOnly } = schedule;

  const [activeType, setActiveType] = useState(null);
  const [hoveredCrns, setHoveredCrns] = useState(null);
  const [editing, setEditing] = useState(null);      // {id, anchor} of the block being edited
  const [ghostMenu, setGhostMenu] = useState(null);  // {ghost, anchor} for stacked sections
  const [details, setDetails] = useState(null);      // course shown in the drawer
  const isMobile = useBreakpointValue({ base: true, md: false }, { ssr: false });
  const [mobileDay, setMobileDay] = useState(() => WEEKDAYS[(new Date().getDay() + 6) % 7] ?? 'Mon');
  const [capturing, setCapturing] = useState(false);
  const calendarRef = useRef(null);

  const activeCourse = courses.find(c => c.detailId === activeId) ?? null;
  const activeOptions = activeCourse && Array.isArray(options[activeId]) ? options[activeId] : [];
  const activePicked = picks[activeId] ?? [];

  // opening a course starts on the first type it still needs (else its first type)
  useEffect(() => {
    if (!activeCourse || !activeOptions.length) return setActiveType(null);
    setActiveType(missingTypes(activePicked, activeOptions)[0] ?? courseTypes(activeOptions)[0]);
  }, [activeId, activeOptions.length]);

  const timedMeetings = useMemo(() => meetings.filter(m => m.timed), [meetings]);
  const unscheduled = meetings.filter(m => !m.timed);

  // what a section would clash with if picked: other courses' meetings, the course's own
  // sections it would keep, and personal blocks
  const conflictFor = useCallback((option) => {
    const courseOptions = Array.isArray(options[activeId]) ? options[activeId] : [];
    const kept = choose(picks[activeId] ?? [], courseOptions, option.crn).filter(crn => crn !== option.crn);
    const others = timedMeetings.filter(m => m.detailId !== activeId || kept.includes(m.crn));
    for (const meeting of option.meetings.filter(isTimed)) {
      const hit = others.find(other => clashes(meeting, other));
      if (hit) return courseName(hit.course);
      const block = blocks.find(b => clashes(meeting, b));
      if (block) return block.title || 'a block';
    }
    return null;
  }, [options, activeId, picks, timedMeetings, blocks]);

  // the days each chosen meeting or block overlaps something else: {id: [days]}
  const conflicting = useMemo(() => {
    const days = {};
    const mark = (x, y) => x.days.filter(day => y.days.includes(day)).forEach(day => {
      (days[x.id] ??= new Set()).add(day);
      (days[y.id] ??= new Set()).add(day);
    });
    timedMeetings.forEach((a, i) => {
      timedMeetings.slice(i + 1).forEach(b => { if (a.crn !== b.crn && clashes(a, b)) mark(a, b); });
      blocks.forEach(block => { if (clashes(a, block)) mark(a, block); });
    });
    blocks.forEach((a, i) => blocks.slice(i + 1).forEach(b => { if (clashes(a, b)) mark(a, b); }));
    return Object.fromEntries(Object.entries(days).map(([id, set]) => [id, [...set]]));
  }, [timedMeetings, blocks]);

  const calendarMeetings = timedMeetings.map(m => ({
    ...m,
    label: courseName(m.course),
    subtitle: `${shortType(m.type)} · ${formatRange(m.start, m.end)}`,
    detail: m.room,
    tooltip: `${courseName(m.course)} ${m.type}\n${formatRange(m.start, m.end)} · ${m.room}${m.instructors.length ? `\n${m.instructors.join(', ')}` : ''}`,
    conflictDays: conflicting[m.id] ?? [],
  }));
  const calendarBlocks = blocks.map(b => ({ ...b, conflictDays: conflicting[b.id] ?? [] }));

  // the active course's other sections for the type being picked, as dashed blocks;
  // sections meeting at the same time (labs in different rooms) share one block
  const ghosts = useMemo(() => {
    if (!activeCourse || !activeType || readOnly) return [];
    const groups = new Map();
    candidates(activeOptions, activePicked, activeType)
      .filter(option => !activePicked.includes(option.crn))
      .forEach(option => option.meetings.filter(isTimed).forEach(meeting => {
        const key = `${meeting.days.join('')}-${meeting.start}-${meeting.end}`;
        const group = groups.get(key) ?? { ...meeting, id: key, options: [] };
        group.options.push(option);
        groups.set(key, group);
      }));
    return [...groups.values()].map(group => {
      const count = group.options.length;
      return {
        ...group,
        crns: group.options.map(o => o.crn),
        colorIndex: activeCourse.colorIndex,
        label: `${shortType(activeType)} · ${courseName(activeCourse)}`,
        subtitle: count > 1 ? `${formatRange(group.start, group.end)} · ${count} sections` : formatRange(group.start, group.end),
        detail: count > 1 ? null : group.room,
        tooltip: `Click to pick this ${shortType(activeType).toLowerCase()}`,
        conflict: group.options.every(o => conflictFor(o)),
      };
    });
  }, [activeCourse, activeType, activeOptions, activePicked, readOnly, conflictFor]);

  const pickGhost = (ghost, anchor) => {
    if (ghost.options.length === 1) {
      schedule.pickSection(activeId, ghost.options[0].crn);
      setHoveredCrns(null);
    } else {
      setGhostMenu({ ghost, anchor });
    }
  };

  // search: add courses offered this term, show the rest in the details drawer
  const handleSelect = ({ value: course }) => {
    updateFilter('searchTerm', '');
    if (course.terms?.includes(semester.name)) {
      schedule.addCourse(course).catch(error => {
        console.error(error);
        toast({ title: `Couldn't add ${courseName(course)}`, status: 'error', duration: 3000, position: 'top' });
      });
    } else {
      restoreFullCourse(course).then(setDetails).catch(console.error);
    }
  };

  const createBlock = useCallback((block) => {
    const id = schedule.addBlock(block);
    // open the editor on the new block once it has rendered
    requestAnimationFrame(() => {
      const element = calendarRef.current?.querySelector(`[data-block-id="${id}"]`) ?? calendarRef.current;
      setEditing({ id, anchor: element });
    });
  }, [schedule.addBlock]);

  // the image is the week as it is: no picker, hover or open course
  const saveImage = async () => {
    setActiveId(null);
    setHoveredCrns(null);
    setCapturing(true);
    try {
      // let the calendar re-render without the picker before taking the picture
      await new Promise(resolve => setTimeout(resolve, 50));
      const { toPng } = await import('html-to-image');
      const node = calendarRef.current;
      const url = await toPng(node, { pixelRatio: 2, backgroundColor: getComputedStyle(node).backgroundColor });
      const link = document.createElement('a');
      link.href = url;
      link.download = `${semester.name} schedule.png`;
      link.click();
    } finally {
      setCapturing(false);
    }
  };

  // the PDF export still takes the old lecture shape (military times, "12:30 PM" strings)
  const military = (minutes) => Math.floor(minutes / 60) * 100 + (minutes % 60);
  const savePdf = async () => {
    // jsPDF and its embedded fonts are large, so they load only when asked for
    const { openPDFInNewTab } = await import('@/lib/pdf');
    openPDFInNewTab(meetings.map(m => ({
      name: courseName(m.course),
      type: m.type,
      day: m.timed ? m.days : ['None'],
      start: m.timed ? military(m.start) : 0,
      end: m.timed ? military(m.end) : 0,
      startTime: m.timed ? convertTo12HourFormat(toClock(m.start)) : 'No Meeting Time',
      room: m.room,
      instructors: m.instructors,
      crn: m.crn,
      courseDetails: m.course,
    })), semester.name);
  };

  const shareCode = encodeSchedule(schedule.snapshot);
  const origin = typeof window === 'undefined' ? 'https://boilerclasses.com' : window.location.origin;
  const shareUrl = `${origin}/schedule?s=${shareCode}`;
  const feedUrl = `${origin}/api/calendar.ics?s=${shareCode}`;

  const editingBlock = editing && blocks.find(b => b.id === editing.id);
  const totalCredits = courses.filter(schedule.isReady).reduce((sum, c) => [sum[0] + c.credits[0], sum[1] + c.credits[1]], [0, 0]);
  const usedWeekend = [...timedMeetings, ...blocks].some(e => e.days.some(d => !WEEKDAYS.includes(d)));
  const mobileDays = usedWeekend ? WEEK : WEEKDAYS;

  return (
    <div className='mx-auto max-w-[1600px] px-4 pb-10'>
      {/* top bar */}
      <header className='flex flex-wrap items-center gap-3 py-4 pr-12'>
        <Link href='/' className='flex items-center gap-2'>
          <img src='/boilerclasses-FULL.png' className='h-7 w-7' alt='BoilerClasses Logo' />
          <span className='font-semibold'>BoilerClasses</span>
        </Link>
        <span className='text-tertiary'>/</span>
        <span className='font-semibold'>Schedule</span>
        <div role='radiogroup' aria-label='Semester' className='flex rounded-full border border-[rgb(var(--background-secondary-color))] bg-background p-0.5'>
          {SCHEDULE_SEMESTERS.map(option => (
            <button
              key={option.code}
              role='radio'
              aria-checked={option.code === semester.code}
              onClick={() => setSemester(option)}
              className={`px-3 py-1 text-sm rounded-full transition ${option.code === semester.code
                ? 'bg-yellow-600 text-white'
                : 'text-secondary hover:bg-background-secondary'}`}
            >
              {option.name}
            </button>
          ))}
        </div>
        <span className='text-xs text-tertiary'>
          {totalCredits[0] === totalCredits[1] ? totalCredits[0] : `${totalCredits[0]}–${totalCredits[1]}`} credits
        </span>
        <div className='flex-1' />
        <ExportMenu
          shareUrl={shareUrl}
          feedUrl={feedUrl}
          termName={semester.name}
          hasBlocks={blocks.length > 0}
          disabled={!courses.length && !blocks.length}
          onImage={saveImage}
          onPdf={savePdf}
        />
      </header>

      {readOnly && (
        <div className='mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-yellow-600/40 bg-yellow-600/10 px-4 py-3 text-sm'>
          <span className='flex-1 min-w-[200px]'>
            You&apos;re viewing a shared {semester.name} schedule. Copy it to start planning from it, or go back to yours.
          </span>
          <button
            onClick={() => onLeaveShared(true)}
            className='rounded-full bg-yellow-600 px-3 py-1 text-white font-medium hover:bg-yellow-700 transition'
          >
            Copy to my planner
          </button>
          <button
            onClick={() => onLeaveShared(false)}
            className='rounded-full border border-[rgb(var(--background-secondary-color))] bg-background px-3 py-1 hover:bg-background-secondary transition'
          >
            Back to my schedule
          </button>
        </div>
      )}

      <div className='flex flex-col lg:flex-row gap-4'>
        {/* sidebar */}
        <aside className='flex flex-col gap-4 lg:w-[360px] lg:shrink-0'>
          {!readOnly && (
            <CourseSearch
              courses={searchResults}
              semester={semester.name}
              onSelect={handleSelect}
              searchTerm={filters.searchTerm}
              updateFilter={updateFilter}
            />
          )}
          <CourseList
            courses={courses}
            options={options}
            picks={picks}
            activeId={activeId}
            readOnly={readOnly}
            isReady={schedule.isReady}
            onSelect={setActiveId}
            onRemove={schedule.removeCourse}
            onDetails={setDetails}
            renderPicker={(course, courseOptions) => (
              <SectionPicker
                course={course}
                options={courseOptions}
                picked={picks[course.detailId] ?? []}
                activeType={activeType ?? courseTypes(courseOptions)[0]}
                setActiveType={setActiveType}
                conflictFor={conflictFor}
                hoveredCrns={hoveredCrns}
                onHover={setHoveredCrns}
                onPick={(crn) => schedule.pickSection(course.detailId, crn)}
                onUnpick={(crn) => schedule.unpickSection(course.detailId, crn)}
              />
            )}
          />

          {courses.length > 0 && (
            <section className='flex flex-col gap-2'>
              <h2 className='text-xs font-semibold uppercase tracking-wide text-tertiary px-1'>Exams</h2>
              {exams.length ? (
                <ul className='flex flex-col gap-1'>
                  {exams.map(exam => (
                    <li key={`${exam.course.detailId}-${exam.kind}-${exam.date}`} className='flex items-start gap-2 rounded-lg bg-background px-3 py-2 text-xs'>
                      <span className='mt-1 h-2 w-2 shrink-0 rounded-full' style={{ background: eventColor(exam.colorIndex) }} />
                      <span className='flex-1'>
                        <span className='font-semibold'>{courseName(exam.course)}</span>{' '}
                        <span className='text-secondary'>{EXAM_LABELS[exam.kind]}</span>
                        <span className='block text-tertiary'>
                          {shortDate(exam.date)} · {exam.sittings.map(s => formatRange(toMinutes(s.start), toMinutes(s.end))).join(' or ')}
                          {exam.rooms.length ? ` · ${exam.rooms.slice(0, 2).join(', ')}${exam.rooms.length > 2 ? '…' : ''}` : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className='px-1 text-xs text-tertiary'>
                  No exam times yet. They show up here, and in your calendar subscription, once the registrar publishes them.
                </p>
              )}
            </section>
          )}
        </aside>

        {/* calendar */}
        <main className='flex-1 min-w-0 flex flex-col gap-2'>
          {isMobile && (
            <div className='flex gap-1'>
              {mobileDays.map(day => (
                <button
                  key={day}
                  onClick={() => setMobileDay(day)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium ${mobileDay === day ? 'bg-background-opposite text-opposite' : 'bg-background text-secondary'}`}
                >
                  {day}
                </button>
              ))}
            </div>
          )}
          <WeekCalendar
            ref={calendarRef}
            meetings={calendarMeetings}
            blocks={calendarBlocks}
            ghosts={ghosts}
            dates={dates}
            days={isMobile && !capturing ? [mobileDay] : null}
            caption={capturing ? `${semester.name} schedule` : null}
            activeId={activeId}
            hoveredCrns={hoveredCrns}
            readOnly={readOnly}
            onMeetingClick={(meeting) => setActiveId(meeting.detailId)}
            onGhostClick={pickGhost}
            onGhostHover={setHoveredCrns}
            onBlockCreate={createBlock}
            onBlockChange={schedule.updateBlock}
            onBlockClick={(id, anchor) => setEditing({ id, anchor })}
          />
          {unscheduled.length > 0 && (
            <p className='px-1 text-xs text-tertiary'>
              Not on the calendar (no set time): {[...new Set(unscheduled.map(m => `${courseName(m.course)} ${shortType(m.type)}${m.room ? ` (${m.room})` : ''}`))].join(', ')}
            </p>
          )}
          {!readOnly && (
            <p className='px-1 text-xs text-tertiary'>
              Tip: drag on empty space to block off time for work, clubs or the gym.
            </p>
          )}
        </main>
      </div>

      {editingBlock && (
        <BlockEditor
          block={editingBlock}
          anchor={editing.anchor}
          readOnly={readOnly}
          onChange={(changes) => schedule.updateBlock(editingBlock.id, changes)}
          onDelete={() => { schedule.removeBlock(editingBlock.id); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}

      {ghostMenu && (
        <FloatingCard anchor={ghostMenu.anchor} onClose={() => setGhostMenu(null)}>
          <div className='p-2 flex flex-col gap-1'>
            <div className='px-2 py-1 text-xs text-tertiary'>
              {ghostMenu.ghost.options.length} sections at {formatRange(ghostMenu.ghost.start, ghostMenu.ghost.end)}
            </div>
            {ghostMenu.ghost.options.map(option => {
              const conflict = conflictFor(option);
              return (
                <button
                  key={option.crn}
                  onMouseEnter={() => setHoveredCrns([option.crn])}
                  onMouseLeave={() => setHoveredCrns(null)}
                  onClick={() => {
                    schedule.pickSection(activeId, option.crn);
                    setGhostMenu(null);
                    setHoveredCrns(null);
                  }}
                  className='rounded-lg px-2 py-1.5 text-left text-xs hover:bg-background-secondary transition'
                >
                  <div className='font-medium'>{option.meetings.find(isTimed)?.room ?? 'TBA'} · CRN {option.crn}</div>
                  <div className='text-tertiary'>
                    {option.instructors.join(', ') || 'Instructor TBA'}
                    {conflict && <span className='text-red-500'> · overlaps {conflict}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </FloatingCard>
      )}

      <CourseDetailsDrawer
        course={details}
        semester={semester}
        inPlan={Boolean(details && courses.some(c => c.detailId === details.detailId))}
        onAdd={(course) => { schedule.addCourse(course); setDetails(null); }}
        onClose={() => setDetails(null)}
      />
    </div>
  );
};

export default Schedule;
