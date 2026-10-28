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
exports.AccessTokenGuard = void 0;
const common_1 = require("@nestjs/common");
const request_context_service_1 = require("../../../../infrastructure/observability/request-context.service");
const access_token_service_1 = require("../../application/services/access-token.service");
let AccessTokenGuard = class AccessTokenGuard {
    accessTokenService;
    requestContextService;
    constructor(accessTokenService, requestContextService) {
        this.accessTokenService = accessTokenService;
        this.requestContextService = requestContextService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const authorizationHeader = request.headers.authorization;
        if (!authorizationHeader?.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('Missing bearer token');
        }
        const token = authorizationHeader.slice('Bearer '.length).trim();
        const payload = this.accessTokenService.verifyAccessToken(token);
        request.user = {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
        };
        this.requestContextService?.set({
            userId: payload.sub,
        });
        return true;
    }
};
exports.AccessTokenGuard = AccessTokenGuard;
exports.AccessTokenGuard = AccessTokenGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [access_token_service_1.AccessTokenService,
        request_context_service_1.RequestContextService])
], AccessTokenGuard);
