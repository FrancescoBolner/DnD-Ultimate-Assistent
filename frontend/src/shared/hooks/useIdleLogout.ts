import { useEffect, useRef } from 'react';

const IDLE_EVENTS: (keyof DocumentEventMap)[] = [
  'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll',
];

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Calls `onIdle` after the user has been inactive for `timeoutMs`.
 * Only active when `enabled` is true (i.e. user is logged in).
 */
export function useIdleLogout(
  onIdle: () => void,
  enabled: boolean,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  });

  useEffect(() => {
    if (!enabled) return;

    const reset = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onIdleRef.current(), timeoutMs);
    };

    reset();
    for (const evt of IDLE_EVENTS) document.addEventListener(evt, reset, { passive: true });

    return () => {
      clearTimeout(timerRef.current);
      for (const evt of IDLE_EVENTS) document.removeEventListener(evt, reset);
    };
  }, [enabled, timeoutMs]);
}
