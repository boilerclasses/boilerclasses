import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { useRouter } from 'next/router';
import { CURRENT_SEMESTER } from '@/lib/terms';
import { getBuildId, isLocalSearchReady, searchLocally, startLocalSearch } from '@/lib/localSearch';
import { semanticQuery } from '@/lib/queryAliases.mjs';

const DEFAULT_FILTERS = {
  subjects: [],
  semesters: [],
  genEds: [],
  credits: { min: 0, max: 18 },
  gpa: { min: 0, max: 4 },
  levels: [100, 200, 300, 400, 500, 600, 700, 800, 900],
  scheduleTypes: [
    "Clinic",
    "Distance Learning",
    "Experiential",
    "Individual Study",
    "Laboratory",
    "Laboratory Preparation",
    "Lecture",
    "Practice Study Observation",
    "Presentation",
    "Recitation",
    "Research",
    "Studio"
  ]
};

export { CURRENT_SEMESTER, CURRENT_SEMESTER_CODE } from '@/lib/terms';

// Storage key for filters
const FILTERS_STORAGE_KEY = "boilerclasses_filters";
const SEMANTIC_SEARCH_DELAY_MS = 100;

const abortableDelay = (milliseconds, signal) => new Promise((resolve, reject) => {
  const handleAbort = () => {
    clearTimeout(timeout);
    reject(new DOMException('Aborted', 'AbortError'));
  };
  const timeout = setTimeout(() => {
    signal.removeEventListener('abort', handleAbort);
    resolve();
  }, milliseconds);
  signal.addEventListener('abort', handleAbort, { once: true });
});

export const useSearchFilters = ({ view = 'full' } = {}) => {
  const router = useRouter();
  const { query } = router;

  // Load filters from sessionStorage on initial render
  const getInitialFilters = () => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return {
        ...DEFAULT_FILTERS,
        semesters: [{ label: CURRENT_SEMESTER, value: CURRENT_SEMESTER }],
        searchTerm: '',
      };
    }

    try {
      const savedFilters = sessionStorage.getItem(FILTERS_STORAGE_KEY);
      if (savedFilters) {
        const parsedFilters = JSON.parse(savedFilters);
        return {
          // Filters added since the session's filters were saved start at their defaults
          ...DEFAULT_FILTERS,
          ...parsedFilters,
          // Always ensure searchTerm from URL takes precedence
          searchTerm: query.q || parsedFilters.searchTerm || '',
        };
      }
    } catch (err) {
      console.error("Error loading filters from sessionStorage:", err);
    }

    return {
      ...DEFAULT_FILTERS,
      semesters: [{ label: CURRENT_SEMESTER, value: CURRENT_SEMESTER }],
      searchTerm: query.q || '',
    };
  };

  // Combined filters state
  const [filters, setFilters] = useState(getInitialFilters);

  // UI state
  const [displayLanding, setDisplayLanding] = useState(true);
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  const [courses, setCourses] = useState([]);
  const [latency, setLatency] = useState(null);
  // The latency shown is what the user waits: from their keystroke (or filter
  // change) until the new results are on screen, not just the search itself.
  const changedAt = useRef(null);
  const measureFrom = useRef(null);
  const [semanticSearching, setSemanticSearching] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Update specific filter
  const updateFilter = useCallback((filterName, value) => {
    changedAt.current = performance.now();
    setFilters(prevFilters => {
      if (Object.is(prevFilters[filterName], value)) return prevFilters;
      const newFilters = {
        ...prevFilters,
        [filterName]: value
      };

      // Save to sessionStorage
      try {
        sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(newFilters));
      } catch (err) {
        console.error("Error saving filters to sessionStorage:", err);
      }

      return newFilters;
    });
  }, []);

  // Transform search query
  const transformQuery = (query) => {
    if (!query) return "";
    return query.trim()
      .replaceAll(/[-;+]/g, " ")
      .replaceAll(/[~!#%$^&*()\[\]\{\}:'<>,@=|?.`"""]/g, "")
      .replaceAll(/[–—…«»'']/g, " ")
      .replaceAll(/([a-zA-Z])(\d)/g, '$1 $2')
      .trim();
  };

  // Check if we should show landing or results page
  useEffect(() => {
    // Wait for client-side rendering to complete
    if (typeof window === 'undefined') return;

    // Initialize the component
    if (!initialized) {
      // Check if we have any active filters to determine if we should show landing
      const hasActiveFilters =
        filters.searchTerm?.length > 1 ||
        filters.subjects.length > 0 ||
        filters.genEds.length > 0 ||
        (filters.semesters.length > 0 &&
         (filters.semesters.length !== 1 || filters.semesters[0].value !== CURRENT_SEMESTER));

      setDisplayLanding(!hasActiveFilters);
      setInitialized(true);
    }
  }, [filters, initialized]);

  // Handle search term from URL
  useEffect(() => {
    if (!router.isReady) return;

    if (query.q && query.q !== filters.searchTerm) {
      updateFilter('searchTerm', query.q);
    }
  }, [query.q, router.isReady]);

  // Search function
  const search = async (signal) => {
    let { searchTerm, subjects, semesters, genEds, credits, gpa, levels, scheduleTypes } = filters;
    let wordMatches = 0;
    const searchStartedAt = changedAt.current ?? performance.now();
    setSemanticSearching(false);

    if (searchTerm && searchTerm.length <= 1 && subjects.length === 0 && semesters.length === 0 && genEds.length === 0) {
      setCourses([]);
      setLatency(null);
      return;
    }

    const query = {
      q: transformQuery(searchTerm),
      sub: subjects.map(x => x.value),
      term: semesters.map(x => x.value),
      gen: genEds.map(x => x.value),
      cmin: credits.min,
      cmax: credits.max,
      levels,
      sched: scheduleTypes,
      // Left out at the full range, so courses without grades still show
      ...(gpa.min > 0 || gpa.max < 4 ? { gmin: gpa.min, gmax: gpa.max } : {}),
    };

    try {
      let documents;
      if (view === 'card' && isLocalSearchReady()) {
        documents = await searchLocally({ ...query, limit: 100 });
        if (!documents) return;
      } else {
        const params = new URLSearchParams({ ...query, maxlim: 100, view, v: getBuildId() });
        const response = await fetch(`/api/search?${params}`, { signal });
        if (!response.ok) throw new Error(`Search failed: ${response.status}`);
        documents = (await response.json()).courses.documents;
      }
      if (signal.aborted) return;

      // Clean up descriptions
      const processedCourses = documents.map(item =>
        item.value.description.startsWith("<a href=")
          ? { ...item, value: { ...item.value, description: "No Description Available" } }
          : item
      );

      const semanticPending = transformQuery(searchTerm).length >= 2;
      startTransition(() => {
        // With no word matches, semantic results are still on the way; keep the
        // previous results up until they land instead of flashing an empty page.
        if (processedCourses.length > 0 || !semanticPending) {
          measureFrom.current = searchStartedAt;
          setCourses(processedCourses);
        }
      });
      wordMatches = processedCourses.length;
    } catch (error) {
      if (signal.aborted) return;
      console.error('Search failed:', error);
      setCourses([]);
      setLatency(null);
      return;
    }

    if (transformQuery(searchTerm).length < 2) return;

    // Expanded abbreviations embed far better: "calc iii" → "calculus iii".
    const semanticParams = new URLSearchParams({ ...query, q: semanticQuery(query.q), maxlim: 8, v: getBuildId() });
    setSemanticSearching(true);

    try {
      // Avoid starting expensive semantic work for every intermediate keystroke.
      await abortableDelay(SEMANTIC_SEARCH_DELAY_MS, signal);
      const semanticResponse = await fetch(`/api/search-semantic?${semanticParams}`, { signal });
      if (!semanticResponse.ok) throw new Error(`Semantic search failed: ${semanticResponse.status}`);
      const semanticData = await semanticResponse.json();
      if (signal.aborted) return;

      const semanticCourses = semanticData.courses.documents.map(item => ({
        ...item,
        value: {
          ...item.value,
          description: item.value.description.startsWith("<a href=")
            ? "No Description Available"
            : item.value.description
        }
      }));

      // Semantic matches go after courses matching every word but before partial
      // matches, which are weaker guesses; a partial match they repeat moves up.
      setCourses(currentCourses => {
        // The list on screen is the previous search's when nothing matched by word,
        // so these are the first new results the user sees.
        if (wordMatches === 0) {
          measureFrom.current = searchStartedAt;
          return semanticCourses;
        }
        const full = currentCourses.filter(course => !course.partial);
        const fullIds = new Set(full.map(course => course.value.detailId));
        const semantic = semanticCourses.filter(course => !fullIds.has(course.value.detailId));
        const semanticIds = new Set(semantic.map(course => course.value.detailId));
        const partial = currentCourses.filter(course => course.partial && !semanticIds.has(course.value.detailId));
        return [...full, ...semantic, ...partial];
      });
    } catch (error) {
      if (!signal.aborted) {
        console.error('Semantic search failed:', error);
        // Nothing matched by word either, so drop the previous search's results.
        if (wordMatches === 0) setCourses([]);
      }
    } finally {
      if (!signal.aborted) {
        setSemanticSearching(false);
      }
    }
  };

  // Once new results are committed, wait for the browser to paint them (the next
  // frame, then a task after it) and show how long the user waited.
  useEffect(() => {
    const from = measureFrom.current;
    if (from === null) return;
    measureFrom.current = null;
    // Background tabs don't paint frames; fall back to when the results were committed.
    const committed = performance.now();
    let shown = false;
    const show = at => {
      if (shown) return;
      shown = true;
      setLatency(Math.round(at - from));
    };
    requestAnimationFrame(() => setTimeout(() => show(performance.now())));
    setTimeout(() => show(committed), 200);
  }, [courses]);

  // Load browser-side search as soon as the page is up; it downloads in the background.
  useEffect(() => {
    if (view === 'card') startLocalSearch();
  }, [view]);

  // Search effect
  useEffect(() => {
    if (!initialized) return;
    const controller = new AbortController();
    // Browser search is cheap and drops stale searches itself; only server requests wait.
    const timeout = setTimeout(() => search(controller.signal), isLocalSearchReady() ? 0 : 25);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [
    initialized,
    view,
    filters.subjects,
    filters.semesters,
    filters.genEds,
    transformQuery(filters.searchTerm),
    filters.credits.min,
    filters.credits.max,
    filters.gpa.min,
    filters.gpa.max,
    filters.levels,
    filters.scheduleTypes,
  ]);

  // Update search term in URL for shareable links
  useEffect(() => {
    if (!initialized || !router.isReady) return;

    const url = new URL(window.location.href);
    if (filters.searchTerm) {
      url.searchParams.set('q', filters.searchTerm);
    } else {
      url.searchParams.delete('q');
    }
    if (url.href === window.location.href) return;

    // Update the shareable URL without starting a Next router transition.
    // Preserve Next's history metadata for back/forward navigation.
    const href = `${url.pathname}${url.search}${url.hash}`;
    const state = window.history.state;
    window.history.replaceState(
      state?.__N ? { ...state, as: href, url: href } : state,
      '',
      href
    );
  }, [filters.searchTerm, initialized, router.isReady]);

  useEffect(() => {
    const onPopState = () => {
      updateFilter('searchTerm', new URL(window.location.href).searchParams.get('q') || '');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return {
    filters,
    updateFilter,
    displayLanding,
    setDisplayLanding,
    filtersCollapsed,
    setFiltersCollapsed,
    courses,
    latency,
    semanticSearching,
    transformQuery,
  };
};
