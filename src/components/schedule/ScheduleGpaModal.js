// FOR SCHEDULER - Component that displays GPA history for instructors teaching the course in the planned semester
import React, { useState, useEffect } from 'react';
import { processGpaData } from '@/lib/gpaUtils';

export const replaceZeroGpaWithDash = (gpa) => {
  return gpa === 0 ? '-' : gpa.toFixed(2);
};

const ScheduleGpaModal = ({ course, semester }) => {
  const [gpa, setGpa] = useState({});

  useEffect(() => {
    const grades = processGpaData(course, true);

    // only show instructors that are teaching in the planned semester
    if (!course.instructor[semester]) {
      setGpa({});
      return;
    }

    for (const instructor in grades) {
      if (!course.instructor[semester].includes(instructor)) {
        delete grades[instructor];
      }
    }

    setGpa(grades);
  }, [course, semester]);

  return (
    <div className='flex flex-col'>
      {Object.keys(gpa).length !== 0 ? (
        <>
          <div className='w-full grid font-bold mt-2 border-b'
            style={{
              gridTemplateColumns: `repeat(${Object.keys(gpa).length > 0 ?
                Math.min(Object.keys(gpa[Object.keys(gpa)[0]]).length, 5) : 1}, minmax(0, 1fr))`
            }}>
            {Object.keys(gpa).length > 0 &&
              Object.keys(gpa[Object.keys(gpa)[0]]).slice(0, 5).map((semester, i) => (
                <div key={i} className='flex flex-col'>
                  <h3 className='text-center text-[10px]'>{semester.split(" ")[0]}</h3>
                  <h3 className='text-center text-[10px]'>{" '" + semester.split(" ")[1].substring(2, 4)}</h3>
                </div>
              ))
            }
          </div>
          {Object.keys(gpa).map((instructor, index) => (
            <div key={index} className='grid grid-flow-row py-1 gap-1'>
              <h2 className='text-primary text-xs'>{instructor}</h2>
              <div className='w-full grid grid-flow-col auto-cols-fr justify-stretch gap-1'>
                {Object.keys(gpa[instructor]).map((semester, index) => {
                  const obj = gpa[instructor][semester];
                  const gpaValue = obj.gpa;
                  return <div key={index} className='flex flex-col'>
                    <div className='grid py-1 text-center rounded-md relative overflow-hidden' style={{ backgroundColor: `${obj.color}` }}>
                      <p className={`${gpaValue === 0 ? 'text-primary' : 'text-white'} m-auto text-sm font-bold relative z-10`}>
                        {replaceZeroGpaWithDash(gpaValue)}
                      </p>
                    </div>
                  </div>;
                })}
              </div>
            </div>
          ))}
        </>
      ) : (
        <div>
          <p className='text-primary text-sm font-light text-left'>No data for current instructors.</p>
        </div>
      )}
    </div>
  );
};

export default ScheduleGpaModal;
