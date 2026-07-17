import type { AuthUser } from "./types";

export function getDemoUser(): AuthUser {
  return {
    id: "U-001",
    name: "TrackCOOP Admin",
    email: "admin@trackcoop.local",
    role: "admin",
  };
}
