// src/hooks/useFetch.js
// Small data-fetching hook: runs an async fetcher, tracks loading/error/data,
// re-runs when `deps` change, and aborts the in-flight request on unmount or
// dep change so a slow response can't overwrite a newer one.

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * @param {(opts: { signal: AbortSignal }) => Promise<any>} fetcher
 * @param {any[]} deps
 * @param {{ enabled?: boolean }} [options]  set enabled:false to defer the call
 */
export function useFetch(fetcher, deps = [], { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [reloadKey, setReloadKey] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    fetcherRef
      .current({ signal: controller.signal })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (err?.name === "AbortError" || !active) return;
        setError(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reloadKey, ...deps]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { data, error, loading, reload, setData };
}
