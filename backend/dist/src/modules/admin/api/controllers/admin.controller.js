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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const roles_decorator_1 = require("../../../auth/presentation/decorators/roles.decorator");
const access_token_guard_1 = require("../../../auth/presentation/guards/access-token.guard");
const roles_guard_1 = require("../../../auth/presentation/guards/roles.guard");
const rate_limit_decorator_1 = require("../../../../infrastructure/security/decorators/rate-limit.decorator");
const rate_limit_guard_1 = require("../../../../infrastructure/security/guards/rate-limit.guard");
const admin_list_query_dto_1 = require("../dto/admin-list-query.dto");
const update_admin_user_role_dto_1 = require("../dto/update-admin-user-role.dto");
const admin_overview_service_1 = require("../../application/services/admin-overview.service");
const ADMIN_RATE_LIMITS = process.env.NODE_ENV === 'production'
    ? {
        read: { limit: 120, windowSeconds: 60 },
        write: { limit: 20, windowSeconds: 60 },
    }
    : {
        read: { limit: 30, windowSeconds: 60 },
        write: { limit: 10, windowSeconds: 60 },
    };
let AdminController = class AdminController {
    adminOverviewService;
    constructor(adminOverviewService) {
        this.adminOverviewService = adminOverviewService;
    }
    getOverview() {
        return this.adminOverviewService.getOverview();
    }
    getMetrics() {
        return this.adminOverviewService.getMetrics();
    }
    listUsers(query) {
        return this.adminOverviewService.listUsers(query.page, query.limit);
    }
    updateUserRole(userId, body) {
        return this.adminOverviewService.updateUserRole(userId, body.role);
    }
    listConversations(query) {
        return this.adminOverviewService.listConversations(query.page, query.limit);
    }
    getConversationDetail(conversationId) {
        return this.adminOverviewService.getConversationDetail(conversationId);
    }
    listSearchRuns(query) {
        return this.adminOverviewService.listSearchRuns(query.page, query.limit);
    }
    getSearchRunDetail(searchRunId) {
        return this.adminOverviewService.getSearchRunDetail(searchRunId);
    }
    listProperties(query) {
        return this.adminOverviewService.listProperties(query.page, query.limit);
    }
    listLeads(query) {
        return this.adminOverviewService.listLeads(query.page, query.limit);
    }
    listScrapingSources(query) {
        return this.adminOverviewService.listScrapingSources(query.page, query.limit);
    }
    invalidateOperationalCaches() {
        return this.adminOverviewService.invalidateOperationalCaches();
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('overview'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-read',
        limit: ADMIN_RATE_LIMITS.read.limit,
        windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getOverview", null);
__decorate([
    (0, common_1.Get)('metrics'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-read',
        limit: ADMIN_RATE_LIMITS.read.limit,
        windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getMetrics", null);
__decorate([
    (0, common_1.Get)('users'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-read',
        limit: ADMIN_RATE_LIMITS.read.limit,
        windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_list_query_dto_1.AdminListQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "listUsers", null);
__decorate([
    (0, common_1.Patch)('users/:id/role'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-write',
        limit: ADMIN_RATE_LIMITS.write.limit,
        windowSeconds: ADMIN_RATE_LIMITS.write.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_admin_user_role_dto_1.UpdateAdminUserRoleDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateUserRole", null);
__decorate([
    (0, common_1.Get)('conversations'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-read',
        limit: ADMIN_RATE_LIMITS.read.limit,
        windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_list_query_dto_1.AdminListQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "listConversations", null);
__decorate([
    (0, common_1.Get)('conversations/:id'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-read',
        limit: ADMIN_RATE_LIMITS.read.limit,
        windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getConversationDetail", null);
__decorate([
    (0, common_1.Get)('search-runs'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-read',
        limit: ADMIN_RATE_LIMITS.read.limit,
        windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_list_query_dto_1.AdminListQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "listSearchRuns", null);
__decorate([
    (0, common_1.Get)('search-runs/:id'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-read',
        limit: ADMIN_RATE_LIMITS.read.limit,
        windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getSearchRunDetail", null);
__decorate([
    (0, common_1.Get)('properties'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-read',
        limit: ADMIN_RATE_LIMITS.read.limit,
        windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_list_query_dto_1.AdminListQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "listProperties", null);
__decorate([
    (0, common_1.Get)('leads'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-read',
        limit: ADMIN_RATE_LIMITS.read.limit,
        windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_list_query_dto_1.AdminListQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "listLeads", null);
__decorate([
    (0, common_1.Get)('scraping-sources'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-read',
        limit: ADMIN_RATE_LIMITS.read.limit,
        windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_list_query_dto_1.AdminListQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "listScrapingSources", null);
__decorate([
    (0, common_1.Post)('cache/invalidate'),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'admin-write',
        limit: ADMIN_RATE_LIMITS.write.limit,
        windowSeconds: ADMIN_RATE_LIMITS.write.windowSeconds,
        keyStrategy: 'user_or_ip',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "invalidateOperationalCaches", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(access_token_guard_1.AccessTokenGuard, roles_guard_1.RolesGuard, rate_limit_guard_1.RateLimitGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __metadata("design:paramtypes", [admin_overview_service_1.AdminOverviewService])
], AdminController);
