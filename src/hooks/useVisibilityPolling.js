import { useEffect, useRef, useCallback } from "react";

/**
 * Smart polling hook that pauses when tab is hidden.
 * Resumes immediately when tab becomes visible again.
 *
 * @param {Function} callback - Async function to call on each interval
 * @param {number} intervalMs - Polling interval in milliseconds
 * @param {boolean} enabled - Whether polling is active (default: true)
 */
export function useVisibilityPolling(callback, intervalMs, enabled = true) {
  const intervalRef = useRef(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      callbackRef.current();
    }, intervalMs);
  }, [intervalMs]);

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

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        callbackRef.current();
        startPolling();
      }
    };

    // Initial call + start polling
    startPolling();

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, startPolling, stopPolling]);
}
