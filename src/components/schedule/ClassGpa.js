import React from 'react';

// A course's average GPA across its instructors and semesters (overallGpa, worked out by
// server/push.py), colored like the GPA everywhere else. Nothing when there are no grades.
const ClassGpa = ({ overallGpa }) => {
  if (!Number(overallGpa?.gpa)) return null;
  const { gpa, color, profCount, totalSemCount } = overallGpa;
  return (
    <span
      className='shrink-0 rounded px-1 text-[10px] font-bold text-white'
      style={{ backgroundColor: color }}
      title={`Average GPA across ${totalSemCount} semester${totalSemCount === 1 ? '' : 's'} and ${profCount} instructor${profCount === 1 ? '' : 's'}`}
    >
      GPA {gpa}
    </span>
  );
};

export default ClassGpa;
