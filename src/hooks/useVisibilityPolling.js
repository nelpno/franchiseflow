import { useEffect, useRef, useCallback } from "react";

/**
 * Smart polling hook that pauses when tab is hidden.
 * Resumes immediately when tab becomes visible again.
 *
 * @param {Function} callback - Async function to call on each interval
 * @param {number} intervalMs - Polling interval in milliseconds
 * @param {boolean} enabled - Whether polling is active (default: true)
 */
const VISIBILITY_THROTTLE_MS = 60000;

export function useVisibilityPolling(callback, intervalMs, enabled = true) {
  const intervalRef = useRef(null);
  const callbackRef = useRef(callback);
  const activeRef = useRef(false);
  // Initialized to mount time so an alt-tab right after mount doesn't re-fire
  // (consumers run their own initial load before this hook subscribes).
  const lastRunRef = useRef(Date.now());
  callbackRef.current = callback;

  const runCallback = useCallback(() => {
    lastRunRef.current = Date.now();
    callbackRef.current();
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      if (activeRef.current) runCallback();
    }, intervalMs);
  }, [intervalMs, runCallback]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopPolling();
      return;
    }

    activeRef.current = true;

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else if (activeRef.current) {
        const since = Date.now() - lastRunRef.current;
        if (since > VISIBILITY_THROTTLE_MS) runCallback();
        startPolling();
      }
    };

    startPolling();

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      activeRef.current = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, startPolling, stopPolling, runCallback]);
}
