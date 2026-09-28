import type { Response } from "express";
import type { AuthContext } from "../auth/auth.types";

export type RealtimeEvent = {
  channel: string;
  type: string;
  entityId?: string | null;
  actorRole?: string | null;
  message?: string;
};

type RealtimeClient = {
  id: number;
  auth: AuthContext;
  response: Response;
  heartbeat: NodeJS.Timeout;
};

let nextClientId = 1;
const clients = new Map<number, RealtimeClient>();

function writeEvent(response: Response, event: string, data: unknown) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function subscribeRealtimeClient(input: {
  auth: AuthContext;
  response: Response;
  onClose: (handler: () => void) => void;
}) {
  const id = nextClientId++;

  input.response.status(200);
  input.response.setHeader("Content-Type", "text/event-stream");
  input.response.setHeader("Cache-Control", "no-cache, no-transform");
  input.response.setHeader("Connection", "keep-alive");
  input.response.setHeader("X-Accel-Buffering", "no");
  input.response.flushHeaders?.();

  writeEvent(input.response, "ready", {
    connected: true,
    connectedAt: new Date().toISOString(),
  });

  const heartbeat = setInterval(() => {
    writeEvent(input.response, "heartbeat", {
      at: new Date().toISOString(),
    });
  }, 25_000);

  clients.set(id, {
    id,
    auth: input.auth,
    response: input.response,
    heartbeat,
  });

  input.onClose(() => {
    const client = clients.get(id);
    if (!client) return;
    clearInterval(client.heartbeat);
    clients.delete(id);
  });
}

export function publishRealtimeEvent(event: RealtimeEvent) {
  const payload = {
    ...event,
    emittedAt: new Date().toISOString(),
  };

  for (const client of clients.values()) {
    if (client.response.destroyed) {
      clearInterval(client.heartbeat);
      clients.delete(client.id);
      continue;
    }

    writeEvent(client.response, "message", payload);
  }
}

export function realtimeClientCount() {
  return clients.size;
}
