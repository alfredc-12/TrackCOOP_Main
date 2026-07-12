import type {
  Announcement,
  CooperativeService,
  User,
} from "@trackcoop/shared-types";

export const demoUser: User = {
  id: "demo-member",
  firstName: "Maria",
  lastName: "Santos",
  email: "maria.santos@example.com",
  role: "member",
};

export const announcements: Announcement[] = [
  {
    id: "harvest-schedule",
    title: "Harvest Coordination",
    body: "Field coordinators will post the weekly harvest assistance schedule here.",
    publishedAt: "2026-07-12",
  },
  {
    id: "member-orientation",
    title: "Member Orientation",
    body: "New member orientation placeholders are ready for future backend updates.",
    publishedAt: "2026-07-10",
  },
];

export const services: CooperativeService[] = [
  {
    id: "membership",
    name: "Membership Assistance",
    description: "Application follow-up, member records, and cooperative inquiries.",
  },
  {
    id: "farm-programs",
    name: "Farm and Fishery Programs",
    description: "Seasonal activity tracking for farmer and fisherfolk members.",
  },
  {
    id: "documents",
    name: "Documents",
    description: "A future home for certificates, forms, and member references.",
  },
];
