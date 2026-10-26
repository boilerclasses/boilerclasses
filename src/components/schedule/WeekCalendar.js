import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoIosWarning } from 'react-icons/io';
import { WEEK, WEEKDAYS, eventColor, formatRange, formatTime, layoutDay, shortType } from '@/lib/schedule';

const MIN_HOUR = 48; // px per hour; rows stretch to fill a taller calendar
const SNAP = 15; // minutes
const GUTTER = 52; // px for the hour labels

const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// A note for meetings that run only part of the term (first or second half courses).
const partialNote = (meeting, dates) => {
  if (!dates || !meeting.startDate) return null;
  const late = meeting.startDate > dates.classesBegin && daysBetween(dates.classesBegin, meeting.startDate) > 7;
  const early = meeting.endDate < dates.classesEnd && daysBetween(meeting.endDate, dates.classesEnd) > 7;
  if (late && early) return `${shortDate(meeting.startDate)} – ${shortDate(meeting.endDate)}`;
  if (late) return `from ${shortDate(meeting.startDate)}`;
  if (early) return `until ${shortDate(meeting.endDate)}`;
  return null;
};
const daysBetween = (a, b) => (new Date(b) - new Date(a)) / 86400000;

// One block on the grid: a course meeting, a personal block, or a section you could pick.
const EventCard = ({ item, dates, dimmed, highlighted, onPointerDown, onClick, onMouseEnter, onMouseLeave, resizable, onResizeStart }) => {
  const color = (alpha) => eventColor(item.colorIndex, alpha);
  const minutes = item.end - item.start;
  const compact = minutes < 50;
  const ghost = item.kind === 'ghost';
  const note = item.kind === 'class' ? partialNote(item, dates) : null;
  const title = item.kind === 'block' ? (item.title || 'Untitled') : item.label;

  return (
    <div
      data-event
      data-block-id={item.kind === 'block' ? item.id : undefined}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={item.tooltip}
      className={`absolute rounded-md overflow-hidden select-none transition-[opacity,box-shadow,background-color] duration-150
        ${ghost ? 'cursor-pointer' : item.kind === 'block' && !item.readOnly ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
        ${dimmed ? 'opacity-40' : ''}
        ${item.conflict ? 'ring-2 ring-red-500 ring-inset' : ''}
        ${highlighted ? 'shadow-lg z-20' : 'z-10'}`}
      style={{
        top: item.top,
        height: Math.max(item.height - 2, 18),
        left: `calc(${(item.column / item.columns) * 100}% + 2px)`,
        width: `calc(${100 / item.columns}% - 4px)`,
        background: ghost ? color(highlighted ? 0.22 : 0.06) : color(highlighted ? 0.32 : 0.18),
        borderLeft: ghost ? 'none' : `3px solid ${color(1)}`,
        border: ghost ? `1.5px dashed ${color(highlighted ? 1 : 0.7)}` : undefined,
      }}
    >
      <div className={`h-full px-1.5 ${compact ? 'py-0.5' : 'py-1'} text-[11px] leading-tight text-primary`}>
        <div className='flex items-center gap-1 font-semibold truncate'>
          {item.conflict && <IoIosWarning className='shrink-0 text-red-500' />}
          <span className='truncate'>{title}</span>
          {compact && <span className='font-normal text-secondary truncate'>{formatTime(item.start)}</span>}
        </div>
        {!compact && (
          <>
            <div className='text-secondary truncate'>{item.subtitle ?? formatRange(item.start, item.end)}</div>
            {item.detail && minutes >= 70 && <div className='text-tertiary truncate'>{item.detail}</div>}
            {note && minutes >= 60 && <div className='text-tertiary truncate italic'>{note}</div>}
          </>
        )}
      </div>
      {resizable && (
        <div
          onPointerDown={onResizeStart}
          className='absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize'
        />
      )}
    </div>
  );
};

// Notion-style week view. Meetings and blocks are {days, start, end} in minutes.
const WeekCalendar = forwardRef(({
  meetings = [], blocks = [], ghosts = [], dates = null, days: onlyDays = null,
  activeId = null, selectedBlockId = null, hoveredCrns = null, readOnly = false, caption = null, className = '',
  onMeetingClick, onGhostClick, onGhostHover,
  onBlockCreate, onBlockChange, onBlockDuplicate, onBlockClick, onSlotHover,
}, ref) => {
  const columnsRef = useRef(null);
  const [drag, setDrag] = useState(null);

  // Mon-Fri, plus the weekend when something meets then
  const days = useMemo(() => {
    if (onlyDays) return onlyDays;
    const used = new Set([...meetings, ...blocks, ...ghosts].flatMap(e => e.days));
    return WEEK.filter(day => WEEKDAYS.includes(day) || used.has(day));
  }, [onlyDays, meetings, blocks, ghosts]);

  // 7 AM to 9 PM, stretched to fit anything earlier or later
  const [startHour, endHour] = useMemo(() => {
    const all = [...meetings, ...blocks, ...ghosts];
    const first = Math.min(7 * 60, ...all.map(e => e.start));
    const last = Math.max(21 * 60, ...all.map(e => e.end));
    return [Math.floor(first / 60), Math.ceil(last / 60)];
  }, [meetings, blocks, ghosts]);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  // hour rows fill the space the page gives the calendar, never shorter than MIN_HOUR
  const rootRef = useRef(null);
  const headerRef = useRef(null);
  const [HOUR, setHour] = useState(MIN_HOUR);
  const setRoot = (element) => {
    rootRef.current = element;
    if (typeof ref === 'function') ref(element);
    else if (ref) ref.current = element;
  };
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      // everything above the hour grid: the export caption and the day headers
      const above = headerRef.current
        ? headerRef.current.getBoundingClientRect().bottom - root.getBoundingClientRect().top - root.clientTop
        : 0;
      const available = root.clientHeight - above;
      setHour(Math.max(MIN_HOUR, Math.floor(available / hours.length)));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    fit();
    return () => observer.disconnect();
  }, [hours.length]);
  const toY = (minutes) => ((minutes - startHour * 60) / 60) * HOUR;

  // the block being dragged shows where it will land; with Option/Alt held it's a copy
  // that moves and the original stays put
  const shownBlocks = useMemo(() => {
    if (!drag || drag.mode === 'create') return blocks;
    if (drag.copy) {
      return drag.moved ? [...blocks, { ...drag.block, ...drag.preview, id: `${drag.id}-copy` }] : blocks;
    }
    return blocks.map(b => (b.id === drag.id ? { ...b, ...drag.preview } : b));
  }, [blocks, drag]);

  const pointerToSlot = useCallback((event) => {
    const rect = columnsRef.current.getBoundingClientRect();
    const dayIndex = Math.min(days.length - 1, Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * days.length)));
    const raw = startHour * 60 + ((event.clientY - rect.top) / HOUR) * 60;
    const minutes = Math.min(endHour * 60, Math.max(startHour * 60, Math.round(raw / SNAP) * SNAP));
    return { dayIndex, minutes };
  }, [days, startHour, endHour, HOUR]);

  // drag state lives in a ref so pointer handlers always see the latest, and mirrors to
  // state for rendering
  const dragRef = useRef(null);
  const updateDrag = (next) => {
    dragRef.current = next;
    setDrag(next);
  };

  useEffect(() => {
    if (!drag) return;
    const move = (event) => {
      const current = dragRef.current;
      if (!current) return;
      const { dayIndex, minutes } = pointerToSlot(event);
      const moved = current.moved || Math.abs(event.clientX - current.x) + Math.abs(event.clientY - current.y) > 4;
      if (current.mode === 'create') {
        updateDrag({ ...current, moved, dayIndex, minutes });
      } else if (current.mode === 'resize') {
        updateDrag({ ...current, moved, preview: { end: Math.max(current.block.start + SNAP, minutes) } });
      } else {
        const shift = dayIndex - current.dayIndex;
        const length = current.block.end - current.block.start;
        const start = Math.min(endHour * 60 - length, Math.max(startHour * 60, current.block.start + minutes - current.minutes));
        const indexes = current.block.days.map(day => days.indexOf(day) + shift);
        const fits = indexes.every(i => i >= 0 && i < days.length);
        updateDrag({
          ...current, moved, preview: {
            start, end: start + length,
            days: fits ? indexes.map(i => days[i]) : current.block.days,
          },
        });
      }
    };
    const up = () => {
      const current = dragRef.current;
      updateDrag(null);
      if (!current) return;
      if (current.mode === 'create') {
        const from = Math.min(current.startMinutes, current.minutes);
        const to = Math.max(current.startMinutes, current.minutes);
        const [a, b] = [current.startDay, current.moved ? current.dayIndex : current.startDay].sort((x, y) => x - y);
        // a click without dragging makes an hour-long block
        onBlockCreate?.(current.moved && to - from >= SNAP
          ? { days: days.slice(a, b + 1), start: from, end: to }
          : { days: [days[current.startDay]], start: current.startMinutes, end: Math.min(current.startMinutes + 60, endHour * 60) });
      } else if (current.moved && current.copy) {
        onBlockDuplicate?.(current.id, current.preview);
      } else if (current.moved) {
        onBlockChange?.(current.id, current.preview);
      } else {
        onBlockClick?.(current.id, current.element);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag !== null, pointerToSlot, onBlockCreate, onBlockChange, onBlockDuplicate, onBlockClick]);

  const startCreate = (event) => {
    if (readOnly || event.button !== 0 || event.target.closest('[data-event]')) return;
    event.preventDefault();
    const { dayIndex, minutes } = pointerToSlot(event);
    updateDrag({ mode: 'create', x: event.clientX, y: event.clientY, startDay: dayIndex, dayIndex, startMinutes: minutes, minutes });
  };

  const startBlockDrag = (block, mode) => (event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (readOnly) {
      onBlockClick?.(block.id, event.currentTarget);
      return;
    }
    event.preventDefault();
    const { dayIndex, minutes } = pointerToSlot(event);
    updateDrag({
      mode, id: block.id, block, x: event.clientX, y: event.clientY, dayIndex, minutes,
      copy: mode === 'move' && event.altKey,
      element: event.currentTarget.closest('[data-event]'), preview: {},
    });
  };

  // one day's items laid out side by side where they overlap
  const columnItems = (day) => {
    const items = [
      ...meetings.filter(m => m.days.includes(day)).map(m => ({ ...m, kind: 'class' })),
      ...shownBlocks.filter(b => b.days.includes(day)).map(b => ({ ...b, kind: 'block', readOnly })),
      ...ghosts.filter(g => g.days.includes(day)).map(g => ({ ...g, kind: 'ghost' })),
    ];
    return layoutDay(items).map(item => ({
      ...item,
      conflict: item.kind === 'ghost' ? item.conflict : Boolean(item.conflictDays?.includes(day)),
      top: toY(item.start),
      height: ((item.end - item.start) / 60) * HOUR,
    }));
  };

  const createPreview = drag?.mode === 'create' && drag.moved ? (() => {
    const [a, b] = [drag.startDay, drag.dayIndex].sort((x, y) => x - y);
    const from = Math.min(drag.startMinutes, drag.minutes);
    const to = Math.max(drag.startMinutes, drag.minutes);
    return { a, b, from, to };
  })() : null;

  return (
    // its own scroll container, so the day headers stay put while the hours scroll
    <div ref={setRoot} className={`w-full bg-background rounded-xl border border-[rgb(var(--background-secondary-color))] overflow-auto ${className}`}>
      {caption && (
        <div className='flex items-baseline justify-between px-4 pt-3 pb-1'>
          <span className='text-base font-semibold text-primary'>{caption}</span>
          <span className='text-xs text-tertiary'>boilerclasses.com/schedule</span>
        </div>
      )}
      {/* day headers */}
      <div ref={headerRef} className='flex border-b border-[rgb(var(--background-secondary-color))] bg-background sticky top-0 z-30'>
        <div style={{ width: GUTTER }} className='shrink-0' />
        {days.map(day => (
          <div key={day} className='flex-1 py-2 text-center text-xs font-medium uppercase tracking-wide text-tertiary'>
            {day}
          </div>
        ))}
      </div>

      <div className='flex relative'>
        {/* hour labels */}
        <div style={{ width: GUTTER }} className='shrink-0 relative'>
          {hours.map(hour => (
            <div key={hour} style={{ height: HOUR }} className='relative'>
              {hour !== startHour && (
                <span className='absolute -top-2 right-2 text-[10px] text-tertiary whitespace-nowrap'>
                  {formatTime(hour * 60)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* day columns */}
        <div
          ref={columnsRef}
          className={`flex flex-1 relative ${readOnly ? '' : 'cursor-crosshair'} touch-none`}
          style={{
            height: hours.length * HOUR,
            backgroundImage: `repeating-linear-gradient(to bottom, rgb(var(--background-secondary-color)) 0 1px, transparent 1px ${HOUR}px)`,
          }}
          onPointerDown={startCreate}
          onPointerMove={onSlotHover ? (event) => {
            const { dayIndex, minutes } = pointerToSlot(event);
            onSlotHover({ day: days[dayIndex], minutes });
          } : undefined}
          onPointerLeave={onSlotHover ? () => onSlotHover(null) : undefined}
        >
          {days.map((day, dayIndex) => (
            <div key={day} className='flex-1 relative border-l border-[rgb(var(--background-secondary-color))]'>
              {columnItems(day).map(item => {
                const isGhost = item.kind === 'ghost';
                const isBlock = item.kind === 'block';
                const highlighted = isGhost
                  ? item.crns.some(crn => hoveredCrns?.includes(crn))
                  : item.kind === 'class' && hoveredCrns?.includes(item.crn);
                return (
                  <EventCard
                    key={`${item.kind}-${item.id}-${day}`}
                    item={item}
                    dates={dates}
                    highlighted={highlighted || (isBlock && (item.id === selectedBlockId || (drag && item.id === (drag.copy ? `${drag.id}-copy` : drag.id))))}
                    dimmed={Boolean(activeId) && item.kind === 'class' && item.detailId !== activeId}
                    resizable={isBlock && !readOnly}
                    onResizeStart={isBlock ? startBlockDrag(item, 'resize') : undefined}
                    onPointerDown={isBlock ? startBlockDrag(item, 'move') : (e) => e.stopPropagation()}
                    onClick={isGhost ? (e) => onGhostClick?.(item, e.currentTarget) : item.kind === 'class' ? () => onMeetingClick?.(item) : undefined}
                    onMouseEnter={isGhost ? () => onGhostHover?.(item.crns) : undefined}
                    onMouseLeave={isGhost ? () => onGhostHover?.(null) : undefined}
                  />
                );
              })}
              {createPreview && dayIndex >= createPreview.a && dayIndex <= createPreview.b && (
                <div
                  className='absolute left-0.5 right-0.5 rounded-md border-2 border-dashed border-[rgb(var(--text-tertiary-color))] bg-[rgb(var(--text-tertiary-color)/0.12)] z-20 px-1.5 py-1 text-[11px] text-secondary pointer-events-none'
                  style={{ top: toY(createPreview.from), height: ((createPreview.to - createPreview.from) / 60) * HOUR }}
                >
                  {formatRange(createPreview.from, createPreview.to)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

WeekCalendar.displayName = 'WeekCalendar';
export default WeekCalendar;
export { shortType };
