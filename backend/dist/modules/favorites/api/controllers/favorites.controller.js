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
exports.FavoritesController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../../auth/presentation/decorators/current-user.decorator");
const access_token_guard_1 = require("../../../auth/presentation/guards/access-token.guard");
const favorites_service_1 = require("../../application/services/favorites.service");
const create_favorite_dto_1 = require("../dto/create-favorite.dto");
const list_favorites_query_dto_1 = require("../dto/list-favorites-query.dto");
let FavoritesController = class FavoritesController {
    favoritesService;
    constructor(favoritesService) {
        this.favoritesService = favoritesService;
    }
    listFavorites(user, query) {
        return this.favoritesService.listByUserId(user.id, query.page, query.limit);
    }
    async createFavorite(user, body, response) {
        const result = await this.favoritesService.create(user.id, body.propertyId);
        response.status(result.created ? common_1.HttpStatus.CREATED : common_1.HttpStatus.OK);
        return result.favorite;
    }
    deleteFavorite(user, propertyId) {
        return this.favoritesService.delete(user.id, propertyId);
    }
};
exports.FavoritesController = FavoritesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_favorites_query_dto_1.ListFavoritesQueryDto]),
    __metadata("design:returntype", void 0)
], FavoritesController.prototype, "listFavorites", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_favorite_dto_1.CreateFavoriteDto, Object]),
    __metadata("design:returntype", Promise)
], FavoritesController.prototype, "createFavorite", null);
__decorate([
    (0, common_1.Delete)(':propertyId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('propertyId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FavoritesController.prototype, "deleteFavorite", null);
exports.FavoritesController = FavoritesController = __decorate([
    (0, common_1.Controller)('favorites'),
    (0, common_1.UseGuards)(access_token_guard_1.AccessTokenGuard),
    __metadata("design:paramtypes", [favorites_service_1.FavoritesService])
], FavoritesController);
