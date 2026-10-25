import React, { useState, useEffect, useRef, useMemo } from 'react';

const CourseSearch = ({ courses, semester, onSelect, searchTerm, updateFilter }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const coursesRef = useRef([]);

  const shouldShowDropdown = isOpen && (searchTerm ?? '').trim().length > 0;

  const displayedCourses = useMemo(() => {
    if (!shouldShowDropdown) return [];

    // Stable sort preserves Redis relevance within each availability group.
    return [...courses].sort((a, b) =>
      Number(b.value.terms.includes(semester)) -
      Number(a.value.terms.includes(semester))
    ).slice(0, 10);
  }, [courses, semester, shouldShowDropdown]);

  // Update coursesRef when displayedCourses changes
  useEffect(() => {
    coursesRef.current = displayedCourses;
  }, [displayedCourses]);

  // Reset selected index when courses change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [courses]);

  // Close dropdown when clicking outside
  useEffect(() => {
    updateFilter('semesters', []);

    const handleClickOutside = (event) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target) &&
        inputRef.current !== event.target
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setSelectedIndex(prev =>
        prev < coursesRef.current.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setSelectedIndex(prev =>
        prev <= 0 ? coursesRef.current.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (coursesRef.current.length > 0) {
        const courseToSelect = selectedIndex >= 0 ? coursesRef.current[selectedIndex] : coursesRef.current[0];
        handleSelect(courseToSelect);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (course) => {
    if (!course) return;
    onSelect(course);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  };

  const handleInputChange = (e) => {
    updateFilter('searchTerm', e.target.value);
    setIsOpen(true);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          autoComplete="off"
          id="search"
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="placeholder:text-tertiary text-primary text-xl bg-super w-full pb-2 border-b-2 border-[rgb(var(--background-opposite))] focus:outline-none focus:border-blue-500 transition duration-300"
          placeholder="Search for courses..."
        />
      </div>

      {shouldShowDropdown && (
        <div className="absolute z-50 w-full mt-2 bg-background rounded-lg shadow-lg border border-[rgb(var(--background-secondary-color))] max-h-96 overflow-y-auto">
          {displayedCourses.length > 0 ? (
            displayedCourses.map((course, index) => (
              <div
                key={course.id}
                onClick={() => handleSelect(course)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex flex-row justify-between px-4 py-2 cursor-pointer ${selectedIndex === index
                  ? 'bg-background-secondary text-primary'
                  : 'text-primary hover:bg-background-secondary'
                  }`}
              >
                <div>
                  <div className="font-medium flex items-center justify-between">
                    <span>{course.value.subjectCode} {course.value.courseCode}</span>
                  </div>
                  <div className="text-sm text-tertiary truncate">
                    {course.value.title}
                  </div>
                  {!course.value.terms.includes(semester) && (
                    <span className="md:hidden block text-xs px-2 py-1 rounded h-fit w-fit self-start bg-orange-500/50 text-orange-100/50">
                      Not Offered in {semester}
                    </span>
                  )}
                </div>
                {!course.value.terms.includes(semester) && (
                  <span className="hidden md:block text-xs px-2 py-1 rounded h-fit self-start bg-orange-500/50 text-orange-100/50">
                    Not Offered in {semester}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="px-4 py-2 text-tertiary">
              No courses found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CourseSearch;
