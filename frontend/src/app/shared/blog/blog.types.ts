export type BlogCategory = 'COMPRA' | 'ALQUILER' | 'INVERSION' | 'TIPS';
export type BlogStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type BlogArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  coverImage: string;
  publishedAt: string;
  readingMinutes: number;
  author: string;
  status: BlogStatus;
  relatedSearchPrompt: string;
  content: Array<{
    heading?: string;
    body: string;
  }>;
};

export const BLOG_CATEGORY_LABELS: Record<BlogCategory, string> = {
  COMPRA: 'Compra',
  ALQUILER: 'Alquiler',
  INVERSION: 'Inversion',
  TIPS: 'Tips',
};
