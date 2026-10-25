
// Properly format date for iCalendar format with America/New_York timezone
const formatICSDate = (date) => {
  const d = new Date(date);

  // Format as YYYYMMDDTHHMMSS
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  // Construct the properly formatted date string
  // For VTIMEZONE events, we use local time with TZID reference
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
};

const parseDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getNextDayOccurrence = (dayAbbr, afterDate) => {
  const days = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5 };
  const targetDay = days[dayAbbr];

  let nextOccurrence = new Date(afterDate);
  while (nextOccurrence.getDay() !== targetDay) {
    nextOccurrence.setDate(nextOccurrence.getDate() + 1);
  }
  return nextOccurrence;
};

export const generateICS = (lectures) => {
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BoilerClasses//Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:America/New_York',
    'BEGIN:STANDARD',
    'DTSTART:20071104T020000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:20070311T020000',
    'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'END:DAYLIGHT',
    'END:VTIMEZONE'
  ];

  lectures.forEach(lecture => {
    const semesterStart = parseDate(lecture.startDate);
    const semesterEnd = parseDate(lecture.endDate);

    lecture.day.forEach(day => {
      if (day === 'None') return;

      const startDate = getNextDayOccurrence(day, semesterStart);
      const [startHour, startMinute] = lecture.startTime.match(/(\d+):(\d+)/).slice(1);
      startDate.setHours(
        lecture.startTime.includes('PM') && startHour !== '12'
          ? parseInt(startHour) + 12
          : parseInt(startHour)
      );
      startDate.setMinutes(parseInt(startMinute));

      const endDate = new Date(startDate);
      const durationMatch = lecture.duration.match(/(?:(\d+)H)?(?:(\d+)M)?/);
      const hours = parseInt(durationMatch[1] || 0);
      const minutes = parseInt(durationMatch[2] || 0);
      endDate.setHours(endDate.getHours() + hours);
      endDate.setMinutes(endDate.getMinutes() + minutes);

      icsContent = icsContent.concat([
        'BEGIN:VEVENT',
        `UID:${lecture.id}-${day}@boilerclasses.com`,
        `DTSTAMP:${formatICSDate(new Date())}Z`, // Current time in UTC
        // Use TZID parameter to specify timezone for start/end times
        `DTSTART;TZID=America/New_York:${formatICSDate(startDate)}`,
        `DTEND;TZID=America/New_York:${formatICSDate(endDate)}`,
        // Format the UNTIL value in UTC with Z suffix
        `RRULE:FREQ=WEEKLY;UNTIL=${formatICSDate(semesterEnd)}Z`,
        `SUMMARY:${lecture.name} - ${lecture.type}`,
        `LOCATION:${lecture.room}`,
        `DESCRIPTION:${lecture.type}\\nInstructor(s): ${lecture.instructors.join(', ')}`,
        'END:VEVENT'
      ]);
    });
  });

  icsContent.push('END:VCALENDAR');
  return icsContent.join('\r\n');
};

export const downloadICS = (lectures, semester) => {
  const icsContent = generateICS(lectures);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', `${semester}_BoilerClasses.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};