/*
 * Details page for a specific course - includes course description, instructors, GPA, RMP ratings,
 * prerequisites, and a calendar view of lecture times.
 */

// ----- Next.js imports -----
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'] });
import ErrorPage from 'next/error';
import { useRouter } from 'next/router';
import { useBackOrHome } from '@/hooks/useRouteHistory';
// ---------------------

// ----- React imports -----
import { useEffect, useState, useMemo } from 'react';

// ----- Component imports -----
import { semesters, sanitizeDescription } from "@/lib/utils";
import { getCourse } from "@/lib/redis";

import Footer from '@/components/footer';
import Calendar from '@/components/calendar';
import { Spinner } from '@chakra-ui/react';

// Detail components
import DetailPageHead from '@/components/detail/DetailPageHead';
import CourseHeader from '@/components/detail/CourseHeader';
import CourseLinks from '@/components/detail/CourseLinks';
import CourseDescription from '@/components/detail/CourseDescription';
import InstructorTabs from '@/components/detail/InstructorTabs';
import Prereqs from '@/components/prereqs';

// Context Provider
import { DetailProvider } from '@/components/detail/context/DetailContext';
// ------------------------

const CardDetails = ({ courseData, semData }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const backOrHome = useBackOrHome();

  // Initialize the course data
  useEffect(() => {
    if (!courseData) return;

    // Sanitize description only needs to run once
    sanitizeDescription(courseData);
    setLoading(false);
  }, [courseData]);


  ///////////////////////////////////////  RENDER  /////////////////////////////////////////

  if (JSON.stringify(courseData) === '{}') {
    return <ErrorPage statusCode={404} />;
  }

  if (loading) {
    return (
      <div className='h-[calc(100vh-var(--banner-height,0px))] w-screen flex items-center justify-center'>
        <Spinner size="lg" color={`rgb(var(--text-color))`} />
      </div>
    );
  }

  // Use the courseId as a key to force DetailProvider to remount when ID changes
  const courseId = courseData.detailId || router.query.id;

  return (
    <DetailProvider
      courseData={courseData}
      initialSemester={semData}
      key={courseId}
    >
      <DetailPageHead />

      <div className={`flex flex-col min-h-screen bg-super container mx-auto p-5 ${inter.className} text-primary`}>
        <div className="flex md:flex-row flex-col md:gap-4">
          {/* Left panel */}
          <div className="flex flex-col w-full md:w-1/3 md:mr-3 justify-start h-full">
            <CourseHeader backOrHome={backOrHome} />
            <CourseLinks />
            <CourseDescription />
            {/* Prerequisites */}
            <div className='my-4'>
              <Prereqs course={courseData} />
            </div>
          </div>

          {/* Right panel */}
          <div className="flex flex-col w-full md:w-2/3">
            {/* Instructor tabs section */}
            <div className="mb-8">
              <InstructorTabs />
            </div>
          </div>
        </div>

        {/* Calendar View for Lecture Times */}
        <Calendar />

        <div className='mt-auto'>
          <Footer />
        </div>
      </div>
    </DetailProvider>
  );
};

export default CardDetails;


// Course data only changes with a deploy, so each page is rendered once on its
// first visit and then served from Next's page cache until the next build.
export async function getStaticPaths() {
  return { paths: [], fallback: 'blocking' };
}

export async function getStaticProps(context) {
  const res = await getCourse(context.params.id);
  const course = res.documents.length > 0 ? res.documents[0].value : {};
  const availableSemesters = [];
  semesters.forEach((sem) => {
    try {
      if (course.terms?.includes(sem)) {
        availableSemesters.push(sem);
      }
    } catch { }
  });
  return {
    props: {
      courseData: course,
      semData: availableSemesters.length > 0 ? availableSemesters[0] : ""
    },
    // A missing course is checked again later instead of staying cached for the whole build.
    revalidate: Object.keys(course).length > 0 ? false : 60,
  };
}
