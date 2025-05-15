export type DBPost = {
  slug: string;
  content: string;
  title: string;
  description: string;
  date: string;
  excerpt: string;
  locale: string;
  cover: string | null;
  coverSquare: string | null;
  lastModified: string;
  shortened: string;
  shortExcerpt: string | null;
};

export type Post = DBPost & {
  tags: string[],
  keywords: string[],
};