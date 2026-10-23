'use client';
/** True while a running activity is tucked away (closed mid-play, waiting to be resumed). */
import { createContext, useContext, useEffect, useRef } from 'react';

export const ActivityPaused = createContext(false);

export const useActivityPaused = () => useContext(ActivityPaused);

/** A ref that follows the paused flag, for rAF loops and intervals that shouldn't restart. */
export function usePausedRef() {
  const paused = useContext(ActivityPaused);
  const ref = useRef(paused);
  useEffect(() => {
    ref.current = paused;
  }, [paused]);
  return ref;
}
