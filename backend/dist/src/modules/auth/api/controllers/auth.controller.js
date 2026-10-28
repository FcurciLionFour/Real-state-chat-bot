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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const request_context_service_1 = require("../../../../infrastructure/observability/request-context.service");
const rate_limit_decorator_1 = require("../../../../infrastructure/security/decorators/rate-limit.decorator");
const rate_limit_guard_1 = require("../../../../infrastructure/security/guards/rate-limit.guard");
const request_client_ip_service_1 = require("../../../../infrastructure/security/request-client-ip.service");
const auth_service_1 = require("../../application/services/auth.service");
const auth_constants_1 = require("../../domain/constants/auth.constants");
const current_user_decorator_1 = require("../../presentation/decorators/current-user.decorator");
const access_token_guard_1 = require("../../presentation/guards/access-token.guard");
const login_dto_1 = require("../dto/login.dto");
const register_dto_1 = require("../dto/register.dto");
const AUTH_RATE_LIMITS = process.env.NODE_ENV === 'production'
    ? {
        register: { limit: 5, windowSeconds: 300 },
        login: { limit: 10, windowSeconds: 300 },
        refresh: { limit: 20, windowSeconds: 300 },
    }
    : {
        register: { limit: 30, windowSeconds: 60 },
        login: { limit: 40, windowSeconds: 60 },
        refresh: { limit: 60, windowSeconds: 60 },
    };
let AuthController = class AuthController {
    authService;
    requestContextService;
    requestClientIpService;
    constructor(authService, requestContextService, requestClientIpService) {
        this.authService = authService;
        this.requestContextService = requestContextService;
        this.requestClientIpService = requestClientIpService;
    }
    async register(body, request, response) {
        const result = await this.authService.register(body.email, body.password, {
            userAgent: this.readHeader(request.headers['user-agent']),
            ipAddress: this.extractIpAddress(request),
        });
        response.cookie(auth_constants_1.REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, this.authService.getRefreshCookieOptions());
        this.requestContextService.set({ userId: result.user.id });
        return {
            user: result.user,
            accessToken: result.accessToken,
        };
    }
    async login(body, request, response) {
        const result = await this.authService.login(body.email, body.password, {
            userAgent: this.readHeader(request.headers['user-agent']),
            ipAddress: this.extractIpAddress(request),
        });
        response.cookie(auth_constants_1.REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, this.authService.getRefreshCookieOptions());
        this.requestContextService.set({ userId: result.user.id });
        return {
            user: result.user,
            accessToken: result.accessToken,
        };
    }
    async refresh(request) {
        const refreshToken = this.authService.extractRefreshToken(this.readHeader(request.headers.cookie));
        if (!refreshToken) {
            throw new common_1.UnauthorizedException('Missing refresh token');
        }
        return this.authService.refresh(refreshToken);
    }
    async logout(request, response) {
        const refreshToken = this.authService.extractRefreshToken(this.readHeader(request.headers.cookie));
        const result = await this.authService.logout(refreshToken);
        this.authService.clearRefreshCookie(response);
        return result;
    }
    me(user) {
        this.requestContextService.set({ userId: user.id });
        return this.authService.me(user);
    }
    extractIpAddress(request) {
        return this.requestClientIpService.extractClientIp(request);
    }
    readHeader(value) {
        if (Array.isArray(value)) {
            return value[0] ?? undefined;
        }
        return value;
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('register'),
    (0, common_1.UseGuards)(rate_limit_guard_1.RateLimitGuard),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'auth-register',
        limit: AUTH_RATE_LIMITS.register.limit,
        windowSeconds: AUTH_RATE_LIMITS.register.windowSeconds,
        keyStrategy: 'ip',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(rate_limit_guard_1.RateLimitGuard),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'auth-login',
        limit: AUTH_RATE_LIMITS.login.limit,
        windowSeconds: AUTH_RATE_LIMITS.login.windowSeconds,
        keyStrategy: 'ip',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(rate_limit_guard_1.RateLimitGuard),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'auth-refresh',
        limit: AUTH_RATE_LIMITS.refresh.limit,
        windowSeconds: AUTH_RATE_LIMITS.refresh.windowSeconds,
        keyStrategy: 'ip',
    }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(access_token_guard_1.AccessTokenGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        request_context_service_1.RequestContextService,
        request_client_ip_service_1.RequestClientIpService])
], AuthController);
