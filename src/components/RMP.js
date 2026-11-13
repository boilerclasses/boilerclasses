/*
 * This file contains functions to fetch RateMyProfessor ratings for professors.
 */

// purdue IDs for West Lafayette (deploy/check_ratings.py looks professors up the same way)
import schools from '@/data/rmpSchools.json';


// Get RateMyProfessor ratings for instructor
async function getRMPRating(instructor) {
  if (!instructor) return 0;

  try {
    // TO SEARCH FOR "PURDUE UNIVERSITY"
    // const params = new URLSearchParams({ q: "Purdue University" });
    // const responseSchools = await fetch("/api/ratings/searchSchool?" + params);
    // const schools = await responseSchools.json();
    // const purdues = schools.schools.filter(school => school.city === "West Lafayette");

    let rating = 0;

    // for all Purdue University schools in West Lafayette, search prof
    for (const school of schools) {
      const paramsTeacher = new URLSearchParams({ name: instructor, id: school });
      const responseProf = await fetch("/api/ratings/searchTeacher?" + paramsTeacher);
      const prof = await responseProf.json();
      const profs = prof.prof.filter(Boolean);

      if (profs.length > 0) {
        const bestMatch = isSimilar(instructor, profs);
        if (bestMatch) {
        //const paramsGetTeacher = new URLSearchParams({ id: profs[0].id });
        const paramsGetTeacher = new URLSearchParams({ id: bestMatch.id });
        const responseRMP = await fetch("/api/ratings/getTeacher?" + paramsGetTeacher);
        const RMPrating = await responseRMP.json();
        rating = RMPrating.RMPrating.avgRating;
        break;
        }
      }
    }

    return rating;
  } catch (error) {
    console.error(error);
    return 0;
  }
}

// Using O(n^2) Levenshtein distance 
function isSimilar(targetInstructor, searchedInstructorArray) {
  const LEVENSHTEIN_THRESHOLD = 0.8;  // Threshold for "similarity"
  function similarityScore(fullName1, fullName2) {
      const len1 = fullName1.length;
      const len2 = fullName2.length;
      const dp = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

      for (let i = 0; i <= len1; i++) dp[i][0] = i;
      for (let j = 0; j <= len2; j++) dp[0][j] = j;

      for (let i = 1; i <= len1; i++) {
          for (let j = 1; j <= len2; j++) {
              if (fullName1[i - 1] === fullName2[j - 1]) {
                  dp[i][j] = dp[i - 1][j - 1];
              } else {
                  dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
              }
          }
      }
      const maxLen = Math.max(len1, len2);
      return 1 - dp[len1][len2] / maxLen;
  }

  let bestMatch = null;
  let highestScore = 0;

  for (const entry of searchedInstructorArray) {
      const { firstName = "", lastName = "" } = entry;
      const fullName = `${firstName} ${lastName}`.trim();
      const score = similarityScore(fullName, targetInstructor);

      if (score > highestScore) {
          highestScore = score;
          bestMatch = entry;
      }
  }

  return highestScore > LEVENSHTEIN_THRESHOLD ? bestMatch : null; 
}

// Batched RMP ratings fetch for allProfs
async function getAllRMPRatings(allProfs) {
  if (!Array.isArray(allProfs) || allProfs.length === 0) return {};

  const batchSize = 10; // Number of requests to send in each batch
  const batches = []; // Array to hold batches of professors
  const ratings = {}; // Object to store ratings

  // Split allProfs into batches
  for (let i = 0; i < allProfs.length; i += batchSize) {
    batches.push(allProfs.slice(i, i + batchSize));
  }

  // Process batches in parallel
  await Promise.all(
    batches.map(async (batch) => {
      const ratingsBatch = await Promise.all(batch.map((instructor) => getRMPRating(instructor)));
      batch.forEach((instructor, index) => {
        ratings[instructor] = ratingsBatch[index];
      });
    })
  );

  return ratings;
}


// Add these new utility functions before loadRatingsForProfs
export function getRMPScore(rmpData, instructor) {
  if (!rmpData || !instructor) return null;
  return rmpData[instructor] || null;
}


// Asynchronously fetch RMP rating for all professors
export async function loadRatingsForProfs(course, onUpdate = null) {
  if (!course) return Promise.resolve({});

  const allProfs = [];
  for (const semester in course.instructor) {
    for (const instructor of course.instructor[semester]) {
      if (!allProfs.includes(instructor)) {
        allProfs.push(instructor);
      }
    }
  }

  const ratings = {};
  try {
    // Process professors individually for streaming updates
    const promises = allProfs.map(async (instructor) => {
      const rating = await getRMPRating(instructor);
      ratings[instructor] = rating;
      // Call callback with accumulated ratings so far
      if (onUpdate) onUpdate({...ratings});
    });

    await Promise.all(promises);
    return ratings;
  } catch (error) {
    console.error("Error loading ratings:", error);
    return Promise.resolve({});
  }
}
