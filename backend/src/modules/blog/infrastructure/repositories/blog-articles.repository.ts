import { Injectable } from '@nestjs/common';
import { BlogArticleCategory, BlogArticleStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

export type BlogArticleContentBlock = {
  heading?: string;
  body: string;
};

export type BlogArticleCreateInput = {
  authorId: string;
  slug: string;
  title: string;
  excerpt: string;
  category: BlogArticleCategory;
  coverImageUrl?: string | null;
  content: BlogArticleContentBlock[];
  status: BlogArticleStatus;
  readingMinutes: number;
  relatedSearchPrompt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  publishedAt?: Date | null;
};

export type BlogArticleUpdateInput = Partial<Omit<BlogArticleCreateInput, 'authorId' | 'publishedAt'>> & {
  publishedAt?: Date | null;
};

@Injectable()
export class BlogArticlesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(input: {
    page: number;
    limit: number;
    category?: BlogArticleCategory;
    query?: string;
  }) {
    const where = this.buildListWhere({
      category: input.category,
      query: input.query,
      status: BlogArticleStatus.PUBLISHED,
    });

    const [items, total] = await Promise.all([
      this.prisma.blogArticle.findMany({
        where,
        include: { author: { select: { id: true, email: true } } },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.blogArticle.count({ where }),
    ]);

    return { items, total };
  }

  async listAdmin(input: {
    page: number;
    limit: number;
    category?: BlogArticleCategory;
    status?: BlogArticleStatus;
    query?: string;
  }) {
    const where = this.buildListWhere(input);

    const [items, total] = await Promise.all([
      this.prisma.blogArticle.findMany({
        where,
        include: { author: { select: { id: true, email: true } } },
        orderBy: [{ updatedAt: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.blogArticle.count({ where }),
    ]);

    return { items, total };
  }

  findPublishedBySlug(slug: string) {
    return this.prisma.blogArticle.findFirst({
      where: {
        slug,
        status: BlogArticleStatus.PUBLISHED,
      },
      include: { author: { select: { id: true, email: true } } },
    });
  }

  findById(id: string) {
    return this.prisma.blogArticle.findUnique({
      where: { id },
      include: { author: { select: { id: true, email: true } } },
    });
  }

  findBySlug(slug: string) {
    return this.prisma.blogArticle.findUnique({
      where: { slug },
      include: { author: { select: { id: true, email: true } } },
    });
  }

  create(input: BlogArticleCreateInput) {
    return this.prisma.blogArticle.create({
      data: {
        authorId: input.authorId,
        slug: input.slug,
        title: input.title,
        excerpt: input.excerpt,
        category: input.category,
        coverImageUrl: input.coverImageUrl,
        contentJson: input.content as unknown as Prisma.InputJsonValue,
        status: input.status,
        readingMinutes: input.readingMinutes,
        relatedSearchPrompt: input.relatedSearchPrompt,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        publishedAt: input.publishedAt,
      },
      include: { author: { select: { id: true, email: true } } },
    });
  }

  update(id: string, input: BlogArticleUpdateInput) {
    const data: Prisma.BlogArticleUpdateInput = {};

    if (input.slug !== undefined) data.slug = input.slug;
    if (input.title !== undefined) data.title = input.title;
    if (input.excerpt !== undefined) data.excerpt = input.excerpt;
    if (input.category !== undefined) data.category = input.category;
    if (input.coverImageUrl !== undefined) data.coverImageUrl = input.coverImageUrl;
    if (input.content !== undefined) data.contentJson = input.content as unknown as Prisma.InputJsonValue;
    if (input.status !== undefined) data.status = input.status;
    if (input.readingMinutes !== undefined) data.readingMinutes = input.readingMinutes;
    if (input.relatedSearchPrompt !== undefined) data.relatedSearchPrompt = input.relatedSearchPrompt;
    if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle;
    if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription;
    if (input.publishedAt !== undefined) data.publishedAt = input.publishedAt;

    return this.prisma.blogArticle.update({
      where: { id },
      data,
      include: { author: { select: { id: true, email: true } } },
    });
  }

  delete(id: string) {
    return this.prisma.blogArticle.delete({
      where: { id },
    });
  }

  private buildListWhere(input: {
    category?: BlogArticleCategory;
    status?: BlogArticleStatus;
    query?: string;
  }): Prisma.BlogArticleWhereInput {
    const where: Prisma.BlogArticleWhereInput = {};

    if (input.category) {
      where.category = input.category;
    }

    if (input.status) {
      where.status = input.status;
    }

    const query = input.query?.trim();

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { excerpt: { contains: query, mode: 'insensitive' } },
        { slug: { contains: query, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
