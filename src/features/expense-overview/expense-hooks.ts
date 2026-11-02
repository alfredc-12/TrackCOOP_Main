"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, isAbort } from "./expense-client";

type Settled<T> = { key: string; data?: T; error?: string };

/**
 * Loads data for `key` and ignores anything that arrives for an earlier key, so a slow response can never
 * replace a newer one. `data` is only ever the result for the current key (null while it loads), which
 * means a card can never show the previous filter's number under the new filter's label.
 */
export function useExpenseData<T>(key: string, load: (signal: AbortSignal) => Promise<T>, enabled = true) {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loader = useRef(load);
  const token = `${key}#${attempt}`;

  useEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    loader.current(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setSettled({ key: token, data }); })
      .catch((error) => { if (!controller.signal.aborted && !isAbort(error)) setSettled({ key: token, error: errorMessage(error) }); });
    return () => controller.abort();
  }, [token, enabled]);

  const current = settled?.key === token ? settled : null;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: enabled && !current,
    retry,
  };
}
