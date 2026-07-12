export type UserRole =
  | "admin"
  | "chairman"
  | "authorized_officer"
  | "bookkeeper"
  | "member"
  | "public";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
}

export interface CooperativeService {
  id: string;
  name: string;
  description: string;
}
