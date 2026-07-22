import type { Role } from "@/config/roles";

export type AuthUser = {
  id: string;
  displayName: string;
  email: string;
  username: string | null;
  role: Role;
};

export type LoginInput = {
  identifier: string;
  password: string;
};
