"use client";

import { useEffect, useRef } from "react";
import { env } from "@/config/env";

export type RealtimeEvent = {
  channel: string;
  type: string;
  entityId?: string | null;
  actorRole?: string | null;
  message?: string;
  emittedAt: string;
};

export function useRealtimeEvents(
  onEvent: (event: RealtimeEvent) => void,
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled ?? true;
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource(`${env.apiUrl}/api/events`, {
      withCredentials: true,
    });

    source.addEventListener("message", (event) => {
      try {
        onEventRef.current(JSON.parse(event.data) as RealtimeEvent);
      } catch {
        // Ignore malformed event payloads and keep the stream alive.
      }
    });

    return () => {
      source.close();
    };
  }, [enabled]);
}
