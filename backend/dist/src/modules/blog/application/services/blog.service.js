"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlogService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const blog_articles_repository_1 = require("../../infrastructure/repositories/blog-articles.repository");
let BlogService = class BlogService {
    blogArticlesRepository;
    constructor(blogArticlesRepository) {
        this.blogArticlesRepository = blogArticlesRepository;
    }
    async listPublished(query) {
        const { items, total } = await this.blogArticlesRepository.listPublished({
            page: query.page,
            limit: query.limit,
            category: query.category,
            query: query.query,
        });
        return this.paginated(items.map((item) => this.toPublicArticle(item)), total, query.page, query.limit);
    }
    async getPublishedBySlug(slug) {
        const article = await this.blogArticlesRepository.findPublishedBySlug(this.normalizeSlug(slug));
        if (!article) {
            throw new common_1.NotFoundException('Articulo no encontrado.');
        }
        return this.toPublicArticle(article);
    }
    async listAdmin(query) {
        const { items, total } = await this.blogArticlesRepository.listAdmin({
            page: query.page,
            limit: query.limit,
            category: query.category,
            status: query.status,
            query: query.query,
        });
        return this.paginated(items.map((item) => this.toAdminArticle(item)), total, query.page, query.limit);
    }
    async createAdminArticle(authorId, body) {
        const slug = await this.ensureAvailableSlug(body.slug ?? body.title);
        const status = body.status ?? client_1.BlogArticleStatus.DRAFT;
        const content = this.normalizeContent(body.content);
        const input = {
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
            publishedAt: status === client_1.BlogArticleStatus.PUBLISHED ? new Date() : null,
        };
        return this.toAdminArticle(await this.blogArticlesRepository.create(input));
    }
    async updateAdminArticle(id, body) {
        const existing = await this.blogArticlesRepository.findById(id);
        if (!existing) {
            throw new common_1.NotFoundException('Articulo no encontrado.');
        }
        const content = body.content ? this.normalizeContent(body.content) : undefined;
        const input = {};
        if (body.title !== undefined)
            input.title = this.compact(body.title);
        if (body.slug !== undefined)
            input.slug = await this.ensureAvailableSlug(body.slug, id);
        if (body.excerpt !== undefined)
            input.excerpt = this.compact(body.excerpt);
        if (body.category !== undefined)
            input.category = body.category;
        if (body.coverImageUrl !== undefined)
            input.coverImageUrl = this.optionalString(body.coverImageUrl);
        if (content !== undefined)
            input.content = content;
        if (body.readingMinutes !== undefined)
            input.readingMinutes = body.readingMinutes;
        if (body.relatedSearchPrompt !== undefined)
            input.relatedSearchPrompt = this.optionalString(body.relatedSearchPrompt);
        if (body.seoTitle !== undefined)
            input.seoTitle = this.optionalString(body.seoTitle);
        if (body.seoDescription !== undefined)
            input.seoDescription = this.optionalString(body.seoDescription);
        if (body.status !== undefined) {
            input.status = body.status;
            input.publishedAt =
                body.status === client_1.BlogArticleStatus.PUBLISHED
                    ? existing.publishedAt ?? new Date()
                    : null;
        }
        return this.toAdminArticle(await this.blogArticlesRepository.update(id, input));
    }
    async publishAdminArticle(id) {
        await this.assertArticleExists(id);
        return this.toAdminArticle(await this.blogArticlesRepository.update(id, {
            status: client_1.BlogArticleStatus.PUBLISHED,
            publishedAt: new Date(),
        }));
    }
    async unpublishAdminArticle(id) {
        await this.assertArticleExists(id);
        return this.toAdminArticle(await this.blogArticlesRepository.update(id, {
            status: client_1.BlogArticleStatus.DRAFT,
            publishedAt: null,
        }));
    }
    async archiveAdminArticle(id) {
        await this.assertArticleExists(id);
        return this.toAdminArticle(await this.blogArticlesRepository.update(id, {
            status: client_1.BlogArticleStatus.ARCHIVED,
            publishedAt: null,
        }));
    }
    async deleteAdminArticle(id) {
        await this.assertArticleExists(id);
        await this.blogArticlesRepository.delete(id);
        return { success: true };
    }
    async assertArticleExists(id) {
        const article = await this.blogArticlesRepository.findById(id);
        if (!article) {
            throw new common_1.NotFoundException('Articulo no encontrado.');
        }
        return article;
    }
    async ensureAvailableSlug(value, currentArticleId) {
        const slug = this.normalizeSlug(value);
        if (!slug) {
            throw new common_1.ConflictException('El slug del articulo no es valido.');
        }
        const existing = await this.blogArticlesRepository.findBySlug(slug);
        if (existing && existing.id !== currentArticleId) {
            throw new common_1.ConflictException('Ya existe un articulo con ese slug.');
        }
        return slug;
    }
    normalizeSlug(value) {
        return value
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
    normalizeContent(content) {
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
    estimateReadingMinutes(content) {
        const words = content
            .flatMap((block) => [block.heading, block.body])
            .filter((value) => Boolean(value))
            .join(' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean).length;
        return Math.max(1, Math.ceil(words / 180));
    }
    compact(value) {
        return value.trim().replace(/\s+/g, ' ');
    }
    optionalString(value) {
        const normalized = value?.trim().replace(/\s+/g, ' ') ?? '';
        return normalized.length > 0 ? normalized : null;
    }
    paginated(items, total, page, limit) {
        return {
            items,
            meta: {
                page,
                limit,
                total,
            },
        };
    }
    toPublicArticle(article) {
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
    toAdminArticle(article) {
        return {
            ...this.toPublicArticle(article),
            status: article.status,
        };
    }
};
exports.BlogService = BlogService;
exports.BlogService = BlogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [blog_articles_repository_1.BlogArticlesRepository])
], BlogService);
