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
  const activeRef = useRef(false);
  callbackRef.current = callback;

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      if (activeRef.current) callbackRef.current();
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

    activeRef.current = true;

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else if (activeRef.current) {
        callbackRef.current();
        startPolling();
      }
    };

    // Initial call + start polling
    startPolling();

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      activeRef.current = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, startPolling, stopPolling]);
}
