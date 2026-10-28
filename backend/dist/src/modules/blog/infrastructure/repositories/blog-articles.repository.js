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
exports.BlogArticlesRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../../infrastructure/prisma/prisma.service");
let BlogArticlesRepository = class BlogArticlesRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listPublished(input) {
        const where = this.buildListWhere({
            category: input.category,
            query: input.query,
            status: client_1.BlogArticleStatus.PUBLISHED,
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
    async listAdmin(input) {
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
    findPublishedBySlug(slug) {
        return this.prisma.blogArticle.findFirst({
            where: {
                slug,
                status: client_1.BlogArticleStatus.PUBLISHED,
            },
            include: { author: { select: { id: true, email: true } } },
        });
    }
    findById(id) {
        return this.prisma.blogArticle.findUnique({
            where: { id },
            include: { author: { select: { id: true, email: true } } },
        });
    }
    findBySlug(slug) {
        return this.prisma.blogArticle.findUnique({
            where: { slug },
            include: { author: { select: { id: true, email: true } } },
        });
    }
    create(input) {
        return this.prisma.blogArticle.create({
            data: {
                authorId: input.authorId,
                slug: input.slug,
                title: input.title,
                excerpt: input.excerpt,
                category: input.category,
                coverImageUrl: input.coverImageUrl,
                contentJson: input.content,
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
    update(id, input) {
        const data = {};
        if (input.slug !== undefined)
            data.slug = input.slug;
        if (input.title !== undefined)
            data.title = input.title;
        if (input.excerpt !== undefined)
            data.excerpt = input.excerpt;
        if (input.category !== undefined)
            data.category = input.category;
        if (input.coverImageUrl !== undefined)
            data.coverImageUrl = input.coverImageUrl;
        if (input.content !== undefined)
            data.contentJson = input.content;
        if (input.status !== undefined)
            data.status = input.status;
        if (input.readingMinutes !== undefined)
            data.readingMinutes = input.readingMinutes;
        if (input.relatedSearchPrompt !== undefined)
            data.relatedSearchPrompt = input.relatedSearchPrompt;
        if (input.seoTitle !== undefined)
            data.seoTitle = input.seoTitle;
        if (input.seoDescription !== undefined)
            data.seoDescription = input.seoDescription;
        if (input.publishedAt !== undefined)
            data.publishedAt = input.publishedAt;
        return this.prisma.blogArticle.update({
            where: { id },
            data,
            include: { author: { select: { id: true, email: true } } },
        });
    }
    delete(id) {
        return this.prisma.blogArticle.delete({
            where: { id },
        });
    }
    buildListWhere(input) {
        const where = {};
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
};
exports.BlogArticlesRepository = BlogArticlesRepository;
exports.BlogArticlesRepository = BlogArticlesRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BlogArticlesRepository);
