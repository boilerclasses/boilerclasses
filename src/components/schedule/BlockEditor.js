import React, { useEffect, useRef } from 'react';
import { IoMdTrash } from 'react-icons/io';
import FloatingCard from './FloatingCard';
import { EVENT_COLORS, WEEK, eventColor, formatRange } from '@/lib/schedule';

// Name, colour, days and delete for a personal block on the calendar.
// A new block focuses its name; an existing one doesn't, so Delete/Backspace removes it.
const BlockEditor = ({ block, anchor, readOnly, isNew, onChange, onDelete, onClose }) => {
  const inputRef = useRef(null);
  useEffect(() => {
    if (!readOnly && isNew) inputRef.current?.focus();
  }, [block.id]);

  const toggleDay = (day) => {
    const days = block.days.includes(day) ? block.days.filter(d => d !== day) : [...block.days, day];
    if (days.length) onChange({ days: WEEK.filter(d => days.includes(d)) });
  };

  return (
    <FloatingCard anchor={anchor} onClose={onClose}>
      <div className='p-3 flex flex-col gap-3'>
        <input
          ref={inputRef}
          value={block.title}
          readOnly={readOnly}
          onChange={(e) => onChange({ title: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') onClose(); }}
          placeholder='Untitled (work, gym, club…)'
          className='w-full bg-transparent text-base font-semibold placeholder:text-tertiary focus:outline-none'
        />
        <div className='text-xs text-secondary'>{formatRange(block.start, block.end)}</div>
        {!readOnly && (
          <>
            <div className='flex gap-1'>
              {WEEK.map(day => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`flex-1 rounded-md py-1 text-[11px] font-medium transition
                    ${block.days.includes(day) ? 'bg-background-opposite text-opposite' : 'bg-background-secondary text-secondary hover:brightness-110'}`}
                >
                  {day.slice(0, 2)}
                </button>
              ))}
            </div>
            <div className='flex items-center justify-between'>
              <div className='flex gap-1.5'>
                {Array.from({ length: EVENT_COLORS }, (_, index) => (
                  <button
                    key={index}
                    aria-label={`Colour ${index + 1}`}
                    onClick={() => onChange({ colorIndex: index })}
                    className={`h-4 w-4 rounded-full transition ${block.colorIndex === index ? 'ring-2 ring-offset-2 ring-offset-[rgb(var(--background-color))]' : ''}`}
                    style={{ background: eventColor(index), '--tw-ring-color': eventColor(index) }}
                  />
                ))}
              </div>
              <button
                onClick={onDelete}
                aria-label='Delete block'
                className='rounded-md p-1.5 text-secondary hover:bg-red-500/15 hover:text-red-500 transition'
              >
                <IoMdTrash />
              </button>
            </div>
          </>
        )}
      </div>
    </FloatingCard>
  );
};

export default BlockEditor;
