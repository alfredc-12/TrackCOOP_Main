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
