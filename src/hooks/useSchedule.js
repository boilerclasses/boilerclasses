import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSections } from '@/lib/sections';
import { getBuildId } from '@/lib/localSearch';
import { semesterStorageKey } from '@/lib/terms';
import { examsFor } from '@/lib/termData';
import { choose, defaultPick, isTimed, nextColor, toOptions, courseName } from '@/lib/schedule';

const hasFullCourseData = course => course?.gpa != null && Array.isArray(course.gened);

// Search results and share links carry only part of a course; fetch the rest (grades, gened).
export const restoreFullCourse = async (course, signal) => {
  if (hasFullCourseData(course)) return course;
  const params = new URLSearchParams({ detailId: course.detailId, v: getBuildId() });
  const response = await fetch(`/api/get?${params}`, { signal });
  if (!response.ok) throw new Error('Could not restore schedule course');
  const data = await response.json();
  const full = data.course.documents[0]?.value;
  if (!hasFullCourseData(full)) throw new Error('Full schedule course not found');
  return { ...course, ...full };
};

const load = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    console.error(`Error loading ${key}:`, error);
    return fallback;
  }
};

const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
  }
};

const newId = () => Math.random().toString(36).slice(2, 10);

// Everything the planner keeps for one term: courses (in the order added, each with a
// colour), the CRNs picked for each, personal blocks, and which course is being edited.
// With `shared` (a decoded share link) it shows that schedule and saves nothing.
export const useSchedule = (semester, { shared = null } = {}) => {
  const key = (name) => semesterStorageKey(name, semester.code);
  const readOnly = Boolean(shared);

  const [courses, setCourses] = useState(() => {
    if (shared) return shared.courses.map(({ detailId, colorIndex }) => ({ detailId, colorIndex }));
    const saved = load(key('pinnedCourses'), []);
    // courses saved before colours were stored keep the order-based colour they had
    return saved.map(({ initialPin, tmp_inc, scrollToMeeting, ...course }, index) =>
      ({ ...course, colorIndex: course.colorIndex ?? index }));
  });
  const [picks, setPicks] = useState(() => shared
    ? Object.fromEntries(shared.courses.map(({ detailId, crns }) => [detailId, crns]))
    : load(key('sectionPicks'), null));
  const [blocks, setBlocks] = useState(() => shared ? shared.blocks : load(key('scheduleBlocks'), []));
  const [activeId, setActiveId] = useState(null);
  const [options, setOptions] = useState({});
  const [termData, setTermData] = useState({ dates: null, exams: {} });
  const legacyPicks = useRef(picks === null && !shared ? load(key('selectedLectures'), []) : null);

  // fill in courses saved or shared without their full data
  useEffect(() => {
    const controller = new AbortController();
    courses.filter(course => !hasFullCourseData(course)).forEach(course => {
      restoreFullCourse(course, controller.signal)
        .then(full => setCourses(previous => previous.map(c => c.detailId === full.detailId ? { ...full, colorIndex: c.colorIndex } : c)))
        .catch(error => { if (!controller.signal.aborted) console.error(error); });
    });
    return () => controller.abort();
  }, [courses.map(c => c.detailId).join()]);

  // sections for every course, fetched once each
  useEffect(() => {
    courses.forEach(({ detailId }) => {
      if (options[detailId]) return;
      setOptions(previous => ({ ...previous, [detailId]: previous[detailId] ?? 'loading' }));
      getSections(detailId, semester.code).then(sections =>
        setOptions(previous => ({ ...previous, [detailId]: toOptions(sections ?? []) })));
    });
  }, [courses.map(c => c.detailId).join(), semester.code]);

  // picks saved before CRNs were stored are meeting ids ("12345-0"); keep their CRNs
  useEffect(() => {
    if (picks !== null) return;
    if (courses.some(({ detailId }) => !Array.isArray(options[detailId]))) return;
    const crns = new Set((legacyPicks.current ?? []).map(id => Number(String(id).split('-')[0])));
    setPicks(Object.fromEntries(courses.map(({ detailId }) =>
      [detailId, options[detailId].filter(o => crns.has(o.crn)).map(o => o.crn)])));
  }, [picks, options, courses]);

  // class dates and exams for the courses in the plan
  const courseNames = courses.filter(hasFullCourseData).map(courseName).join(',');
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ term: semester.code, courses: courseNames });
    fetch(`/api/term-data?${params}`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data) setTermData(data); })
      .catch(() => {});
    return () => controller.abort();
  }, [semester.code, courseNames]);

  useEffect(() => {
    if (readOnly) return;
    save(key('pinnedCourses'), courses);
  }, [courses]);
  useEffect(() => {
    if (readOnly || picks === null) return;
    save(key('sectionPicks'), picks);
    localStorage.removeItem(key('selectedLectures'));
  }, [picks]);
  useEffect(() => {
    if (readOnly) return;
    save(key('scheduleBlocks'), blocks);
  }, [blocks]);

  // every chosen meeting with its course, ready for the calendar and the exports
  const meetings = useMemo(() => courses.flatMap(course => {
    const courseOptions = Array.isArray(options[course.detailId]) ? options[course.detailId] : [];
    const chosen = picks?.[course.detailId] ?? [];
    return courseOptions.filter(o => chosen.includes(o.crn)).flatMap(option =>
      option.meetings.map((meeting, index) => ({
        ...meeting,
        id: `${option.crn}-${index}`,
        detailId: course.detailId,
        course,
        crn: option.crn,
        type: option.type,
        instructors: option.instructors,
        colorIndex: course.colorIndex,
        timed: isTimed(meeting),
      })));
  }), [courses, options, picks]);

  const usedColors = () => [...courses.map(c => c.colorIndex), ...blocks.map(b => b.colorIndex)];

  // a new course gets the next free colour and its earliest lecture, then opens for picking
  const addCourse = useCallback(async (course) => {
    if (courses.some(c => c.detailId === course.detailId)) {
      setActiveId(course.detailId);
      return;
    }
    const full = await restoreFullCourse(course);
    const sections = toOptions(await getSections(full.detailId, semester.code) ?? []);
    setOptions(previous => ({ ...previous, [full.detailId]: sections }));
    setCourses(previous => previous.some(c => c.detailId === full.detailId)
      ? previous : [...previous, { ...full, colorIndex: nextColor(usedColors()) }]);
    const first = defaultPick(sections, [...meetings.filter(m => m.timed), ...blocks]);
    setPicks(previous => ({ ...previous, [full.detailId]: first == null ? [] : [first] }));
    setActiveId(full.detailId);
  }, [courses, blocks, meetings, semester.code]);

  const removeCourse = useCallback((detailId) => {
    setCourses(previous => previous.filter(c => c.detailId !== detailId));
    setPicks(previous => {
      const { [detailId]: _, ...rest } = previous ?? {};
      return rest;
    });
    setActiveId(previous => (previous === detailId ? null : previous));
  }, []);

  const pickSection = useCallback((detailId, crn) => {
    setPicks(previous => ({ ...previous, [detailId]: choose(previous?.[detailId], options[detailId], crn) }));
  }, [options]);

  const unpickSection = useCallback((detailId, crn) => {
    setPicks(previous => ({ ...previous, [detailId]: (previous?.[detailId] ?? []).filter(c => c !== crn) }));
  }, []);

  const addBlock = useCallback((block) => {
    const created = { id: newId(), title: '', colorIndex: nextColor(usedColors()), ...block };
    setBlocks(previous => [...previous, created]);
    return created.id;
  }, [courses, blocks]);
  const updateBlock = useCallback((id, changes) =>
    setBlocks(previous => previous.map(b => (b.id === id ? { ...b, ...changes } : b))), []);
  const removeBlock = useCallback((id) => setBlocks(previous => previous.filter(b => b.id !== id)), []);

  const exams = useMemo(() => courses.filter(hasFullCourseData).flatMap(course => {
    return examsFor(termData.exams?.[courseName(course)] ?? [], picks?.[course.detailId] ?? [])
      .map(exam => ({ ...exam, course, colorIndex: course.colorIndex }));
  }), [courses, picks, termData]);

  // the plan in the shape share links and the calendar feed use
  const snapshot = useMemo(() => ({
    term: semester.code,
    courses: courses.map(({ detailId, colorIndex }) => ({ detailId, colorIndex, crns: picks?.[detailId] ?? [] })),
    blocks,
  }), [semester.code, courses, picks, blocks]);

  return {
    courses, options, picks: picks ?? {}, blocks, meetings, exams, dates: termData.dates,
    activeId, setActiveId, readOnly, snapshot,
    addCourse, removeCourse, pickSection, unpickSection, addBlock, updateBlock, removeBlock,
    isReady: hasFullCourseData,
  };
};
