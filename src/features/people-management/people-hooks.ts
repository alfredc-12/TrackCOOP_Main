"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Returns a function that starts a request and cancels the previous one. A response is only used while
 * `isCurrent()` is true, so a slow earlier request can never overwrite a newer one.
 */
export function useRequestGuard() {
  const controller = useRef<AbortController | null>(null);
  const counter = useRef(0);

  useEffect(() => () => controller.current?.abort(), []);

  return useCallback(() => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    const id = ++counter.current;
    return { signal: next.signal, isCurrent: () => counter.current === id && !next.signal.aborted };
  }, []);
}

/** Text that follows `value` after the user pauses typing, or immediately via `flush`. */
export function useDebouncedText(value: string, onCommit: (text: string) => void, delay = 350) {
  const [text, setText] = useState(value);
  const commit = useRef(onCommit);
  const committed = useRef(value);

  useEffect(() => {
    commit.current = onCommit;
  });

  // Reflect external changes, such as "Clear all", in the box.
  useEffect(() => {
    committed.current = value;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the input mirrors the committed query value.
    setText(value);
  }, [value]);

  useEffect(() => {
    if (text === committed.current) return;
    const timer = window.setTimeout(() => {
      committed.current = text;
      commit.current(text);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [text, delay]);

  const flush = useCallback(() => {
    if (text !== committed.current) {
      committed.current = text;
      commit.current(text);
    }
  }, [text]);

  return { text, setText, flush };
}

/** Replaces the page's query string without adding history entries or scrolling. */
export function replaceUrlParams(update: (current: URLSearchParams) => URLSearchParams) {
  if (typeof window === "undefined") return;
  const next = update(new URLSearchParams(window.location.search)).toString();
  if (next === window.location.search.replace(/^\?/, "")) return;
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`);
}
