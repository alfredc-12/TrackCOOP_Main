export type MemberActivityQuery = {
  page?: string | number;
  pageSize?: string | number;
  search?: string;
};

export type MemberProfileInput = {
  contact_number?: string | null;
  email?: string | null;
  barangay?: string | null;
  municipality?: string | null;
  province?: string | null;
};

export type MemberPasswordInput = {
  currentPassword?: string;
  newPassword?: string;
};

export type MemberSupportInput = {
  subject?: string;
  message?: string;
};
