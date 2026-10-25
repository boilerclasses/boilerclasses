import { jsPDF } from 'jspdf';
import { convertNumberToTime } from './timeUtils';
import { translateType } from '@/components/calendar';
import { DAYS, TIMES } from '@/components/schedule/utils/constants';
import { graphColors } from "@/lib/utils";

import { Inter_Normal, Inter_Bold } from '@/styles/inter';

// Constants for PDF styling
const STYLE = {
  titleSize: 20,
  headerSize: 12,
  textSize: 8,
  padding: 20,
  topMargin: 16,
  cellHeight: 16,
  cellWidth: 38,
  timeColWidth: 16,
  gridColor: '#d4d4d4', // light gray for grid
  bgColor: '#ffffff',   // white background
  textColor: '#000000', // black text
  courseOpacity: 0.8,
  firstHour: 6, // Add this to account for 6 AM start
  logoHeight: 8,
  pageHeight: 216,  // Updated for US Letter size (8.5" x 11")
};

// Add this function at the top level
const createCourseColorMap = (selectedLectures) => {
  const courseColorMap = new Map();
  let colorIndex = 0;

  // Define fixed hex colors for PDF
  const pdfColors = [
    '#4287f5', '#f54242', '#42f554', '#f5a742', '#a742f5',
    '#42f5e3', '#d442f5', '#f54275', '#87f542', '#4269f5',
    '#f5bb42', '#f54242', '#42c5f5', '#e342f5', '#f58442'
  ];

  selectedLectures.forEach(lecture => {
    const courseId = lecture.courseDetails.detailId;
    if (!courseColorMap.has(courseId)) {
      courseColorMap.set(courseId, pdfColors[colorIndex % pdfColors.length]);
      colorIndex++;
    }
  });
  return courseColorMap;
};

const drawCalendarGrid = (doc, startY) => {
  doc.setDrawColor(STYLE.gridColor);
  doc.setTextColor(STYLE.textColor);

  // Draw days header
  doc.setFontSize(STYLE.headerSize);
  doc.setFont('Inter', 'bold');  // Set bold for days
  DAYS.forEach((day, i) => {
    const x = STYLE.timeColWidth + (i * STYLE.cellWidth) + STYLE.cellWidth/2;
    doc.text(day, x, startY - 2, { align: 'center' });
  });
  doc.setFont('Inter', 'normal');  // Reset to normal

  // Draw time slots and grid
  doc.setFontSize(STYLE.textSize);
  TIMES.forEach((time, i) => {
    const y = startY + (i * STYLE.cellHeight);
    const timeLabel = i === 0 ? '6 AM' : time;
    doc.text(timeLabel, STYLE.timeColWidth - 2, y + 1, { align: 'right' });

    doc.setLineWidth(0.1);
    doc.line(
      STYLE.timeColWidth,
      y,
      STYLE.timeColWidth + (DAYS.length * STYLE.cellWidth),
      y
    );
  });

  // Draw vertical lines
  DAYS.forEach((_, i) => {
    const x = STYLE.timeColWidth + (i * STYLE.cellWidth);
    doc.line(x, startY - 5, x, startY + (TIMES.length * STYLE.cellHeight));
  });
};

const drawCourseBlocks = (doc, startY, selectedLectures, courseColorMap) => {
  const hexToRgb = (hex) => {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return [r, g, b];
  };

  selectedLectures.forEach((lecture) => {
    lecture.day.forEach(day => {
      const dayIndex = DAYS.indexOf(day);
      if (dayIndex === -1) return;

      const startHour = Math.floor(lecture.start / 100);
      const startMinutes = lecture.start % 100;
      const endHour = Math.floor(lecture.end / 100);
      const endMinutes = lecture.end % 100;

      const x = STYLE.timeColWidth + (dayIndex * STYLE.cellWidth) + 1;
      const startPosition = ((startHour - STYLE.firstHour) + (startMinutes / 60)) * STYLE.cellHeight;
      const endPosition = ((endHour - STYLE.firstHour) + (endMinutes / 60)) * STYLE.cellHeight;
      const y = startY + startPosition;
      const height = endPosition - startPosition;
      const width = STYLE.cellWidth - 2;

      const [r, g, b] = hexToRgb(courseColorMap.get(lecture.courseDetails.detailId));
      doc.setFillColor(r, g, b);
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({opacity: STYLE.courseOpacity}));
      doc.roundedRect(x, y, width, height, 2, 2, 'F');
      doc.restoreGraphicsState();

      doc.setTextColor('#000000');
      // Bold course name
      doc.setFont('Inter', 'bold');
      doc.text(translateType(lecture.type) + " | " + lecture.name, x + 2, y + 4, { maxWidth: width - 4 });
      // Normal weight for time and room
      doc.setFont('Inter', 'normal');
      doc.text(lecture.startTime + " - " + convertNumberToTime(lecture.end), x + 2, y + 8, { maxWidth: width - 4 });
      doc.text(lecture.room, x + 2, y + 12, { maxWidth: width - 4 });
    });
  });
};

const drawDetailedSchedule = (doc, selectedLectures, courseColorMap) => {
  console.log(selectedLectures);
  doc.addPage();
  let yPos = 20;

  doc.setFont('Inter', 'bold');
  doc.setFontSize(20);
  doc.text('Detailed Schedule', 20, yPos);
  yPos += 10;

  const courseGroups = selectedLectures.reduce((acc, lecture) => {
    const courseKey = `${lecture.courseDetails.subjectCode} ${lecture.courseDetails.courseCode}`;
    if (!acc[courseKey]) {
      acc[courseKey] = {
        title: lecture.courseDetails.title,
        sections: []
      };
    }
    acc[courseKey].sections.push({
      type: lecture.type,
      days: lecture.day.join(', '),
      time: `${lecture.startTime} - ${convertNumberToTime(lecture.end)}`,
      room: lecture.room,
      instructors: lecture.instructors.join(', ')
    });
    return acc;
  }, {});

  doc.setFontSize(10);
  Object.entries(courseGroups).forEach(([courseCode, course], index) => {
    const courseHeight = 6 + (course.sections.length * 12);

    if (yPos + courseHeight > STYLE.pageHeight) {
      doc.addPage();
      yPos = 20;
    }

    // Find the first section's detailId to get the course color
    const courseId = selectedLectures.find(l =>
      `${l.courseDetails.subjectCode} ${l.courseDetails.courseCode}` === courseCode
    ).courseDetails.detailId;

    const [r, g, b] = hexToRgb(courseColorMap.get(courseId));
    doc.setFillColor(r, g, b);
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({opacity: STYLE.courseOpacity}));
    doc.roundedRect(20, yPos - 4, 4, 4, 1, 1, 'F');
    doc.restoreGraphicsState();

    // Course title (moved slightly right to accommodate color square)
    doc.setFont('Inter', 'bold');
    doc.text(`${courseCode}: ${course.title}`, 26, yPos);
    yPos += 6;

    doc.setFont('Inter', 'normal');
    course.sections.forEach(section => {
      const sectionTime = section.time.includes('12:00 AM') ? 'No Meeting Time' : section.time.split(' - ')[0];

      // First line: Section type - Instructor
      doc.text(`${translateType(section.type)} ${section.instructors === '' ? '' : '-'} ${section.instructors}`, 30, yPos);
      yPos += 5;

      // Second line: Days • Time • Room
      doc.text(`${section.days} • ${sectionTime} • ${section.room}`, 30, yPos);
      yPos += 7;
    });
    yPos += 3;
  });
};

const hexToRgb = (hex) => {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return [r, g, b];
};

// main
export const openPDFInNewTab = (selectedLectures, semester) => {
  const doc = new jsPDF({
    format: 'letter',
    unit: 'mm'
  });

  // Create the course color map
  const courseColorMap = createCourseColorMap(selectedLectures);

  doc.addFileToVFS('Inter-Regular.ttf', Inter_Normal);
  doc.addFileToVFS('Inter-Bold.ttf', Inter_Bold);
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
  doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');

  // Draw main schedule title
  doc.setFont('Inter', 'bold');
  doc.setFontSize(STYLE.titleSize);
  doc.text(`${semester} Course Schedule`, STYLE.padding, STYLE.topMargin);

  // Calculate right side positions (215.9 is letter width in mm)
  const pageWidth = 215.9;
  const rightMargin = pageWidth - STYLE.padding;

  // Add logo and text aligned to the right
  const img = new Image();
  img.src = '/boilerclasses-FULL.png';
  doc.addImage(img, 'PNG', rightMargin - STYLE.logoHeight - 25, STYLE.topMargin - STYLE.logoHeight / 1.5, STYLE.logoHeight, STYLE.logoHeight);

  doc.setFontSize(STYLE.titleSize * 0.5);
  doc.text('BoilerClasses', rightMargin, STYLE.topMargin, { align: 'right' });
  doc.setFont('Inter', 'normal');

  const startY = STYLE.topMargin + 12;

  // Draw the calendar components
  drawCalendarGrid(doc, startY);
  drawCourseBlocks(doc, startY, selectedLectures, courseColorMap);
  drawDetailedSchedule(doc, selectedLectures, courseColorMap);

  doc.output('dataurlnewwindow', { filename: `${semester}_BoilerClasses.pdf` });
};