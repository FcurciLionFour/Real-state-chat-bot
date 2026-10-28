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
exports.AdminOwnerPropertiesController = exports.OwnerPropertiesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../auth/presentation/decorators/current-user.decorator");
const roles_decorator_1 = require("../auth/presentation/decorators/roles.decorator");
const access_token_guard_1 = require("../auth/presentation/guards/access-token.guard");
const roles_guard_1 = require("../auth/presentation/guards/roles.guard");
const admin_list_query_dto_1 = require("../admin/api/dto/admin-list-query.dto");
const rate_limit_decorator_1 = require("../../infrastructure/security/decorators/rate-limit.decorator");
const rate_limit_guard_1 = require("../../infrastructure/security/guards/rate-limit.guard");
const create_owner_property_dto_1 = require("./api/dto/create-owner-property.dto");
const review_owner_property_dto_1 = require("./api/dto/review-owner-property.dto");
const submit_owner_property_dto_1 = require("./api/dto/submit-owner-property.dto");
const update_owner_property_dto_1 = require("./api/dto/update-owner-property.dto");
const owner_properties_service_1 = require("./owner-properties.service");
const OWNER_RATE_LIMITS = process.env.NODE_ENV === 'production'
    ? {
        read: { limit: 120, windowSeconds: 60 },
        write: { limit: 30, windowSeconds: 60 },
    }
    : {
        read: { limit: 60, windowSeconds: 60 },
        write: { limit: 30, windowSeconds: 60 },
    };
let OwnerPropertiesController = class OwnerPropertiesController {
    ownerPropertiesService;
    constructor(ownerPropertiesService) {
        this.ownerPropertiesService = ownerPropertiesService;
    }
    createDraft(user, body) {
        return this.ownerPropertiesService.createDraft(user.id, body);
    }
    listMine(user) {
        return this.ownerPropertiesService.listMine(user.id);
    }
    getMine(user, id) {
        return this.ownerPropertiesService.getMine(user.id, id);
    }
    updateMine(user, id, body) {
        return this.ownerPropertiesService.updateMine(user.id, id, body);
    }
    submitMine(user, id, _body) {
        return this.ownerPropertiesService.submitMine(user.id, id);
    }
    unpublishMine(user, id) {
        return this.ownerPropertiesService.unpublishMine(user.id, id);
    }
    deleteMine(user, id) {
        return this.ownerPropertiesService.deleteMine(user.id, id);
    }
};
exports.OwnerPropertiesController = OwnerPropertiesController;
__decorate([
    (0, common_1.Post)(),
    (0, rate_limit_decorator_1.RateLimit)({ namespace: 'owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_owner_property_dto_1.CreateOwnerPropertyDto]),
    __metadata("design:returntype", void 0)
], OwnerPropertiesController.prototype, "createDraft", null);
__decorate([
    (0, common_1.Get)('my'),
    (0, rate_limit_decorator_1.RateLimit)({ namespace: 'owner-properties-read', limit: OWNER_RATE_LIMITS.read.limit, windowSeconds: OWNER_RATE_LIMITS.read.windowSeconds, keyStrategy: 'user_or_ip' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OwnerPropertiesController.prototype, "listMine", null);
__decorate([
    (0, common_1.Get)('my/:id'),
    (0, rate_limit_decorator_1.RateLimit)({ namespace: 'owner-properties-read', limit: OWNER_RATE_LIMITS.read.limit, windowSeconds: OWNER_RATE_LIMITS.read.windowSeconds, keyStrategy: 'user_or_ip' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OwnerPropertiesController.prototype, "getMine", null);
__decorate([
    (0, common_1.Patch)('my/:id'),
    (0, rate_limit_decorator_1.RateLimit)({ namespace: 'owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_owner_property_dto_1.UpdateOwnerPropertyDto]),
    __metadata("design:returntype", void 0)
], OwnerPropertiesController.prototype, "updateMine", null);
__decorate([
    (0, common_1.Post)('my/:id/submit'),
    (0, rate_limit_decorator_1.RateLimit)({ namespace: 'owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, submit_owner_property_dto_1.SubmitOwnerPropertyDto]),
    __metadata("design:returntype", void 0)
], OwnerPropertiesController.prototype, "submitMine", null);
__decorate([
    (0, common_1.Post)('my/:id/unpublish'),
    (0, rate_limit_decorator_1.RateLimit)({ namespace: 'owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OwnerPropertiesController.prototype, "unpublishMine", null);
__decorate([
    (0, common_1.Delete)('my/:id'),
    (0, rate_limit_decorator_1.RateLimit)({ namespace: 'owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OwnerPropertiesController.prototype, "deleteMine", null);
exports.OwnerPropertiesController = OwnerPropertiesController = __decorate([
    (0, common_1.Controller)('owner/properties'),
    (0, common_1.UseGuards)(access_token_guard_1.AccessTokenGuard, roles_guard_1.RolesGuard, rate_limit_guard_1.RateLimitGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.OWNER, client_1.UserRole.ADMIN),
    __metadata("design:paramtypes", [owner_properties_service_1.OwnerPropertiesService])
], OwnerPropertiesController);
let AdminOwnerPropertiesController = class AdminOwnerPropertiesController {
    ownerPropertiesService;
    constructor(ownerPropertiesService) {
        this.ownerPropertiesService = ownerPropertiesService;
    }
    listAll(query) {
        return this.ownerPropertiesService.listAdmin({ page: query.page, limit: query.limit });
    }
    listPending(query) {
        return this.ownerPropertiesService.listAdmin({
            page: query.page,
            limit: query.limit,
            status: client_1.OwnerPropertyStatus.PENDING_REVIEW,
        });
    }
    getOne(id) {
        return this.ownerPropertiesService.getAdmin(id);
    }
    approve(id) {
        return this.ownerPropertiesService.approveAdmin(id);
    }
    reject(id, body) {
        return this.ownerPropertiesService.rejectAdmin(id, body);
    }
    update(id, body) {
        return this.ownerPropertiesService.updateAdmin(id, body);
    }
    unpublish(id) {
        return this.ownerPropertiesService.unpublishAdmin(id);
    }
};
exports.AdminOwnerPropertiesController = AdminOwnerPropertiesController;
__decorate([
    (0, common_1.Get)(),
    (0, rate_limit_decorator_1.RateLimit)({ namespace: 'admin-owner-properties-read', limit: OWNER_RATE_LIMITS.read.limit, windowSeconds: OWNER_RATE_LIMITS.read.windowSeconds, keyStrategy: 'user_or_ip' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_list_query_dto_1.AdminListQueryDto]),
    __metadata("design:returntype", void 0)
], AdminOwnerPropertiesController.prototype, "listAll", null);
__decorate([
    (0, common_1.Get)('pending'),
    (0, rate_limit_decorator_1.RateLimit)({ namespace: 'admin-owner-properties-read', limit: OWNER_RATE_LIMITS.read.limit, windowSeconds: OWNER_RATE_LIMITS.read.windowSeconds, keyStrategy: 'user_or_ip' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_list_query_dto_1.AdminListQueryDto]),
    __metadata("design:returntype", void 0)
], AdminOwnerPropertiesController.prototype, "listPending", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, rate_limit_decorator_1.RateLimit)({ namespace: 'admin-owner-properties-read', limit: OWNER_RATE_LIMITS.read.limit, windowSeconds: OWNER_RATE_LIMITS.read.windowSeconds, keyStrategy: 'user_or_ip' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminOwnerPropertiesController.prototype, "getOne", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, rate_limit_decorator_1.RateLimit)({ namespace: 'admin-owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminOwnerPropertiesController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, rate_limit_decorator_1.RateLimit)({ namespace: 'admin-owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, review_owner_property_dto_1.ReviewOwnerPropertyDto]),
    __metadata("design:returntype", void 0)
], AdminOwnerPropertiesController.prototype, "reject", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, rate_limit_decorator_1.RateLimit)({ namespace: 'admin-owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_owner_property_dto_1.UpdateOwnerPropertyDto]),
    __metadata("design:returntype", void 0)
], AdminOwnerPropertiesController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/unpublish'),
    (0, rate_limit_decorator_1.RateLimit)({ namespace: 'admin-owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminOwnerPropertiesController.prototype, "unpublish", null);
exports.AdminOwnerPropertiesController = AdminOwnerPropertiesController = __decorate([
    (0, common_1.Controller)('admin/properties/owner-submitted'),
    (0, common_1.UseGuards)(access_token_guard_1.AccessTokenGuard, roles_guard_1.RolesGuard, rate_limit_guard_1.RateLimitGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __metadata("design:paramtypes", [owner_properties_service_1.OwnerPropertiesService])
], AdminOwnerPropertiesController);
