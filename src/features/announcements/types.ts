export type Announcement = {
  id: string;
  title: string;
  content: string;
  images: string[];
  sourceUrl: string;
  originalAuthorName: string;
  originalAuthorUrl: string;
  postedAt?: string;
  importedAt: string;
  type: string;
};

export type PublicAnnouncement = {
  id: string | number;
  title?: string;
  message?: string;
  content?: string;
  createdAt?: string;
  postedAt?: string;
  featuredImagePath?: string | null;
  images?: string[];
  sourceUrl?: string | null;
  audienceType?: string;
  announcementStatus?: string;
};
