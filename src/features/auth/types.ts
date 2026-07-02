export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff" | "viewer";
};
