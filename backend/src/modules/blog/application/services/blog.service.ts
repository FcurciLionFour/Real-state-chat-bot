import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BlogArticle, BlogArticleStatus } from '@prisma/client';
import {
  BlogArticleContentBlock,
  BlogArticleCreateInput,
  BlogArticleUpdateInput,
  BlogArticlesRepository,
} from '../../infrastructure/repositories/blog-articles.repository';
import { CreateBlogArticleDto, UpdateBlogArticleDto } from '../../api/dto/upsert-blog-article.dto';
import { AdminListBlogArticlesQueryDto, ListBlogArticlesQueryDto } from '../../api/dto/list-blog-articles-query.dto';

type BlogArticleWithAuthor = BlogArticle & {
  author: {
    id: string;
    email: string;
  } | null;
};

@Injectable()
export class BlogService {
  constructor(private readonly blogArticlesRepository: BlogArticlesRepository) {}

  async listPublished(query: ListBlogArticlesQueryDto) {
    const { items, total } = await this.blogArticlesRepository.listPublished({
      page: query.page,
      limit: query.limit,
      category: query.category,
      query: query.query,
    });

    return this.paginated(items.map((item) => this.toPublicArticle(item)), total, query.page, query.limit);
  }

  async getPublishedBySlug(slug: string) {
    const article = await this.blogArticlesRepository.findPublishedBySlug(this.normalizeSlug(slug));

    if (!article) {
      throw new NotFoundException('Articulo no encontrado.');
    }

    return this.toPublicArticle(article);
  }

  async listAdmin(query: AdminListBlogArticlesQueryDto) {
    const { items, total } = await this.blogArticlesRepository.listAdmin({
      page: query.page,
      limit: query.limit,
      category: query.category,
      status: query.status,
      query: query.query,
    });

    return this.paginated(items.map((item) => this.toAdminArticle(item)), total, query.page, query.limit);
  }

  async createAdminArticle(authorId: string, body: CreateBlogArticleDto) {
    const slug = await this.ensureAvailableSlug(body.slug ?? body.title);
    const status = body.status ?? BlogArticleStatus.DRAFT;
    const content = this.normalizeContent(body.content);
    const input: BlogArticleCreateInput = {
      authorId,
      slug,
      title: this.compact(body.title),
      excerpt: this.compact(body.excerpt),
      category: body.category,
      coverImageUrl: this.optionalString(body.coverImageUrl),
      content,
      status,
      readingMinutes: body.readingMinutes ?? this.estimateReadingMinutes(content),
      relatedSearchPrompt: this.optionalString(body.relatedSearchPrompt),
      seoTitle: this.optionalString(body.seoTitle),
      seoDescription: this.optionalString(body.seoDescription),
      publishedAt: status === BlogArticleStatus.PUBLISHED ? new Date() : null,
    };

    return this.toAdminArticle(await this.blogArticlesRepository.create(input));
  }

  async updateAdminArticle(id: string, body: UpdateBlogArticleDto) {
    const existing = await this.blogArticlesRepository.findById(id);

    if (!existing) {
      throw new NotFoundException('Articulo no encontrado.');
    }

    const content = body.content ? this.normalizeContent(body.content) : undefined;
    const input: BlogArticleUpdateInput = {};

    if (body.title !== undefined) input.title = this.compact(body.title);
    if (body.slug !== undefined) input.slug = await this.ensureAvailableSlug(body.slug, id);
    if (body.excerpt !== undefined) input.excerpt = this.compact(body.excerpt);
    if (body.category !== undefined) input.category = body.category;
    if (body.coverImageUrl !== undefined) input.coverImageUrl = this.optionalString(body.coverImageUrl);
    if (content !== undefined) input.content = content;
    if (body.readingMinutes !== undefined) input.readingMinutes = body.readingMinutes;
    if (body.relatedSearchPrompt !== undefined) input.relatedSearchPrompt = this.optionalString(body.relatedSearchPrompt);
    if (body.seoTitle !== undefined) input.seoTitle = this.optionalString(body.seoTitle);
    if (body.seoDescription !== undefined) input.seoDescription = this.optionalString(body.seoDescription);

    if (body.status !== undefined) {
      input.status = body.status;
      input.publishedAt =
        body.status === BlogArticleStatus.PUBLISHED
          ? existing.publishedAt ?? new Date()
          : null;
    }

    return this.toAdminArticle(await this.blogArticlesRepository.update(id, input));
  }

  async publishAdminArticle(id: string) {
    await this.assertArticleExists(id);

    return this.toAdminArticle(
      await this.blogArticlesRepository.update(id, {
        status: BlogArticleStatus.PUBLISHED,
        publishedAt: new Date(),
      }),
    );
  }

  async unpublishAdminArticle(id: string) {
    await this.assertArticleExists(id);

    return this.toAdminArticle(
      await this.blogArticlesRepository.update(id, {
        status: BlogArticleStatus.DRAFT,
        publishedAt: null,
      }),
    );
  }

  async archiveAdminArticle(id: string) {
    await this.assertArticleExists(id);

    return this.toAdminArticle(
      await this.blogArticlesRepository.update(id, {
        status: BlogArticleStatus.ARCHIVED,
        publishedAt: null,
      }),
    );
  }

  async deleteAdminArticle(id: string) {
    await this.assertArticleExists(id);
    await this.blogArticlesRepository.delete(id);

    return { success: true };
  }

  private async assertArticleExists(id: string) {
    const article = await this.blogArticlesRepository.findById(id);

    if (!article) {
      throw new NotFoundException('Articulo no encontrado.');
    }

    return article;
  }

  private async ensureAvailableSlug(value: string, currentArticleId?: string) {
    const slug = this.normalizeSlug(value);

    if (!slug) {
      throw new ConflictException('El slug del articulo no es valido.');
    }

    const existing = await this.blogArticlesRepository.findBySlug(slug);

    if (existing && existing.id !== currentArticleId) {
      throw new ConflictException('Ya existe un articulo con ese slug.');
    }

    return slug;
  }

  private normalizeSlug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private normalizeContent(content: BlogArticleContentBlock[]) {
    return content
      .map((block) => {
        const heading = this.optionalString(block.heading);

        return {
          ...(heading ? { heading } : {}),
          body: this.compact(block.body),
        };
      })
      .filter((block) => block.body.length > 0);
  }

  private estimateReadingMinutes(content: BlogArticleContentBlock[]) {
    const words = content
      .flatMap((block) => [block.heading, block.body])
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    return Math.max(1, Math.ceil(words / 180));
  }

  private compact(value: string) {
    return value.trim().replace(/\s+/g, ' ');
  }

  private optionalString(value: string | undefined) {
    const normalized = value?.trim().replace(/\s+/g, ' ') ?? '';
    return normalized.length > 0 ? normalized : null;
  }

  private paginated<T>(items: T[], total: number, page: number, limit: number) {
    return {
      items,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  private toPublicArticle(article: BlogArticleWithAuthor) {
    return {
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      category: article.category,
      coverImageUrl: article.coverImageUrl,
      content: article.contentJson,
      readingMinutes: article.readingMinutes,
      relatedSearchPrompt: article.relatedSearchPrompt,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      publishedAt: article.publishedAt,
      author: article.author ? { id: article.author.id, email: article.author.email } : null,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };
  }

  private toAdminArticle(article: BlogArticleWithAuthor) {
    return {
      ...this.toPublicArticle(article),
      status: article.status,
    };
  }
}
