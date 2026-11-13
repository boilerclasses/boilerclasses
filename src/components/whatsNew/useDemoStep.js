import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

// The current frame of a looping demo. Each frame is held for its entry in `durations`
// (ms) before moving on, and the last one wraps back to the first. People who ask their
// device for less motion get `stillFrame` and no loop.
export function useDemoStep(durations, stillFrame = durations.length - 1) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timeout = setTimeout(() => setStep(current => (current + 1) % durations.length), durations[step]);
    return () => clearTimeout(timeout);
  }, [step, reduceMotion]);

  return reduceMotion ? stillFrame : step;
}
