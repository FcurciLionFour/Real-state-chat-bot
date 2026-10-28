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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminBlogController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../../../auth/presentation/decorators/current-user.decorator");
const roles_decorator_1 = require("../../../auth/presentation/decorators/roles.decorator");
const access_token_guard_1 = require("../../../auth/presentation/guards/access-token.guard");
const roles_guard_1 = require("../../../auth/presentation/guards/roles.guard");
const rate_limit_decorator_1 = require("../../../../infrastructure/security/decorators/rate-limit.decorator");
const rate_limit_guard_1 = require("../../../../infrastructure/security/guards/rate-limit.guard");
const blog_service_1 = require("../../application/services/blog.service");
const list_blog_articles_query_dto_1 = require("../dto/list-blog-articles-query.dto");
const upsert_blog_article_dto_1 = require("../dto/upsert-blog-article.dto");
const ADMIN_BLOG_RATE_LIMITS = process.env.NODE_ENV === 'production'
    ? {
        read: { limit: 120, windowSeconds: 60 },
        write: { limit: 20, windowSeconds: 60 },
    }
    : {
        read: { limit: 30, windowSeconds: 60 },
        write: { limit: 10, windowSeconds: 60 },
    };
let AdminBlogController = class AdminBlogController {
    blogService;
    constructor(blogService) {
        this.blogService = blogService;
    }
    listArticles(query) {
        return this.blogService.listAdmin(query);
    }
    createArticle(user, body) {
        return this.blogService.createAdminArticle(user.id, body);
    }
    updateArticle(id, body) {
        return this.blogService.updateAdminArticle(id, body);
    }
    publishArticle(id) {
        return this.blogService.publishAdminArticle(id);
    }
    unpublishArticle(id) {
        return this.blogService.unpublishAdminArticle(id);
    }
    archiveArticle(id) {
        return this.blogService.archiveAdminArticle(id);
    }
    deleteArticle(id) {
        return this.blogService.deleteAdminArticle(id);
    }
};
exports.AdminBlogController = AdminBlogController;
__decorate([
    (0, common_1.Get)(),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-blog-read',
        limit: ADMIN_BLOG_RATE_LIMITS.read.limit,
        windowSeconds: ADMIN_BLOG_RATE_LIMITS.read.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_blog_articles_query_dto_1.AdminListBlogArticlesQueryDto]),
    __metadata("design:returntype", void 0)
], AdminBlogController.prototype, "listArticles", null);
__decorate([
    (0, common_1.Post)(),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-blog-write',
        limit: ADMIN_BLOG_RATE_LIMITS.write.limit,
        windowSeconds: ADMIN_BLOG_RATE_LIMITS.write.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upsert_blog_article_dto_1.CreateBlogArticleDto]),
    __metadata("design:returntype", void 0)
], AdminBlogController.prototype, "createArticle", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-blog-write',
        limit: ADMIN_BLOG_RATE_LIMITS.write.limit,
        windowSeconds: ADMIN_BLOG_RATE_LIMITS.write.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, upsert_blog_article_dto_1.UpdateBlogArticleDto]),
    __metadata("design:returntype", void 0)
], AdminBlogController.prototype, "updateArticle", null);
__decorate([
    (0, common_1.Post)(':id/publish'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-blog-write',
        limit: ADMIN_BLOG_RATE_LIMITS.write.limit,
        windowSeconds: ADMIN_BLOG_RATE_LIMITS.write.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminBlogController.prototype, "publishArticle", null);
__decorate([
    (0, common_1.Post)(':id/unpublish'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-blog-write',
        limit: ADMIN_BLOG_RATE_LIMITS.write.limit,
        windowSeconds: ADMIN_BLOG_RATE_LIMITS.write.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminBlogController.prototype, "unpublishArticle", null);
__decorate([
    (0, common_1.Post)(':id/archive'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-blog-write',
        limit: ADMIN_BLOG_RATE_LIMITS.write.limit,
        windowSeconds: ADMIN_BLOG_RATE_LIMITS.write.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminBlogController.prototype, "archiveArticle", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-blog-write',
        limit: ADMIN_BLOG_RATE_LIMITS.write.limit,
        windowSeconds: ADMIN_BLOG_RATE_LIMITS.write.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminBlogController.prototype, "deleteArticle", null);
exports.AdminBlogController = AdminBlogController = __decorate([
    (0, common_1.Controller)('admin/blog'),
    (0, common_1.UseGuards)(access_token_guard_1.AccessTokenGuard, roles_guard_1.RolesGuard, rate_limit_guard_1.RateLimitGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __metadata("design:paramtypes", [blog_service_1.BlogService])
], AdminBlogController);
