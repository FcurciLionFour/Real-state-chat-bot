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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const logger_service_1 = require("../../../../infrastructure/observability/logger.service");
const request_context_service_1 = require("../../../../infrastructure/observability/request-context.service");
const users_service_1 = require("../../../users/application/services/users.service");
const auth_constants_1 = require("../../domain/constants/auth.constants");
const auth_identities_repository_1 = require("../../infrastructure/repositories/auth-identities.repository");
const access_token_service_1 = require("./access-token.service");
const password_hash_service_1 = require("./password-hash.service");
const refresh_tokens_repository_1 = require("../../infrastructure/repositories/refresh-tokens.repository");
let AuthService = AuthService_1 = class AuthService {
    configService;
    usersService;
    passwordHashService;
    accessTokenService;
    refreshTokensRepository;
    authIdentitiesRepository;
    logger;
    requestContextService;
    constructor(configService, usersService, passwordHashService, accessTokenService, refreshTokensRepository, authIdentitiesRepository, logger, requestContextService) {
        this.configService = configService;
        this.usersService = usersService;
        this.passwordHashService = passwordHashService;
        this.accessTokenService = accessTokenService;
        this.refreshTokensRepository = refreshTokensRepository;
        this.authIdentitiesRepository = authIdentitiesRepository;
        this.logger = logger;
        this.requestContextService = requestContextService;
    }
    async register(email, password, context) {
        const existingUser = await this.usersService.findByEmail(email);
        if (existingUser) {
            this.logger.warnEvent('register rejected because email is already registered', {
                module: 'AuthService',
                action: 'auth_register_rejected',
                emailDomain: this.extractEmailDomain(email),
                reason: 'email_already_registered',
            }, AuthService_1.name);
            throw new common_1.ConflictException('Email already registered');
        }
        const passwordHash = await this.passwordHashService.hash(password);
        const user = await this.usersService.createUser(email, passwordHash);
        await this.authIdentitiesRepository.createPasswordIdentity(user.id, user.email);
        const session = await this.issueSession(user, context);
        this.requestContextService?.set({ userId: user.id });
        this.logger.logEvent('user registered successfully', {
            module: 'AuthService',
            action: 'auth_register_succeeded',
            userId: user.id,
        }, AuthService_1.name);
        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt,
            },
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
        };
    }
    async login(email, password, context) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            this.logger.warnEvent('login rejected because user does not exist', {
                module: 'AuthService',
                action: 'auth_login_rejected',
                emailDomain: this.extractEmailDomain(email),
                reason: 'user_not_found',
            }, AuthService_1.name);
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (!user.passwordHash) {
            this.logger.warnEvent('login rejected because password auth is disabled for this account', {
                module: 'AuthService',
                action: 'auth_login_rejected',
                userId: user.id,
                reason: 'password_login_disabled',
            }, AuthService_1.name);
            throw new common_1.UnauthorizedException('Password login is not enabled for this account');
        }
        const isValidPassword = await this.passwordHashService.verify(password, user.passwordHash);
        if (!isValidPassword) {
            this.logger.warnEvent('login rejected because password verification failed', {
                module: 'AuthService',
                action: 'auth_login_rejected',
                userId: user.id,
                reason: 'invalid_password',
            }, AuthService_1.name);
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const session = await this.issueSession(user, context);
        this.requestContextService?.set({ userId: user.id });
        this.logger.logEvent('user logged in successfully', {
            module: 'AuthService',
            action: 'auth_login_succeeded',
            userId: user.id,
        }, AuthService_1.name);
        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
        };
    }
    async refresh(refreshToken) {
        const storedToken = await this.refreshTokensRepository.findActiveByTokenHash(this.accessTokenService.hashRefreshToken(refreshToken));
        if (!storedToken) {
            this.logger.warnEvent('refresh rejected because token is invalid', {
                module: 'AuthService',
                action: 'auth_refresh_rejected',
                reason: 'invalid_refresh_token',
            }, AuthService_1.name);
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        this.requestContextService?.set({ userId: storedToken.user.id });
        this.logger.logEvent('access token refreshed successfully', {
            module: 'AuthService',
            action: 'auth_refresh_succeeded',
            userId: storedToken.user.id,
        }, AuthService_1.name);
        return {
            accessToken: this.accessTokenService.signAccessToken({
                id: storedToken.user.id,
                email: storedToken.user.email,
                role: storedToken.user.role,
            }),
        };
    }
    async logout(refreshToken) {
        if (refreshToken) {
            await this.refreshTokensRepository.revokeByTokenHash(this.accessTokenService.hashRefreshToken(refreshToken));
        }
        this.logger.logEvent('user logged out successfully', {
            module: 'AuthService',
            action: 'auth_logout_succeeded',
            hadRefreshToken: Boolean(refreshToken),
        }, AuthService_1.name);
        return {
            success: true,
        };
    }
    async me(user) {
        const persistedUser = await this.usersService.findById(user.id);
        if (!persistedUser) {
            this.logger.warnEvent('me rejected because user was not found', {
                module: 'AuthService',
                action: 'auth_me_rejected',
                userId: user.id,
            }, AuthService_1.name);
            throw new common_1.UnauthorizedException('User not found');
        }
        this.requestContextService?.set({ userId: persistedUser.id });
        return {
            id: persistedUser.id,
            email: persistedUser.email,
            role: persistedUser.role,
        };
    }
    getRefreshCookieOptions() {
        const domain = this.configService.get('auth.refreshCookie.domain', null);
        return {
            httpOnly: true,
            secure: this.configService.get('auth.refreshCookie.secure', false),
            sameSite: this.configService.get('auth.refreshCookie.sameSite', 'lax'),
            path: this.configService.get('auth.refreshCookie.path', '/api/auth'),
            ...(domain ? { domain } : {}),
            maxAge: this.accessTokenService.getRefreshCookieMaxAge(),
        };
    }
    clearRefreshCookie(response) {
        const domain = this.configService.get('auth.refreshCookie.domain', null);
        response.clearCookie(auth_constants_1.REFRESH_TOKEN_COOKIE_NAME, {
            httpOnly: true,
            secure: this.configService.get('auth.refreshCookie.secure', false),
            sameSite: this.configService.get('auth.refreshCookie.sameSite', 'lax'),
            path: this.configService.get('auth.refreshCookie.path', '/api/auth'),
            ...(domain ? { domain } : {}),
        });
    }
    extractRefreshToken(cookieHeader) {
        if (!cookieHeader) {
            return null;
        }
        const parts = cookieHeader.split(';');
        for (const part of parts) {
            const [name, ...rest] = part.trim().split('=');
            if (name === auth_constants_1.REFRESH_TOKEN_COOKIE_NAME) {
                return rest.join('=');
            }
        }
        return null;
    }
    async issueSession(user, context) {
        const refreshToken = this.accessTokenService.generateRefreshToken();
        const expiresAt = this.accessTokenService.getRefreshTokenExpiresAt();
        await this.refreshTokensRepository.create({
            userId: user.id,
            tokenHash: this.accessTokenService.hashRefreshToken(refreshToken),
            expiresAt,
            userAgent: context.userAgent ?? null,
            ipAddress: context.ipAddress ?? null,
        });
        return {
            accessToken: this.accessTokenService.signAccessToken(user),
            refreshToken,
        };
    }
    extractEmailDomain(email) {
        const atIndex = email.lastIndexOf('@');
        if (atIndex === -1 || atIndex === email.length - 1) {
            return 'unknown';
        }
        return email.slice(atIndex + 1).toLowerCase();
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(7, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [config_1.ConfigService,
        users_service_1.UsersService,
        password_hash_service_1.PasswordHashService,
        access_token_service_1.AccessTokenService,
        refresh_tokens_repository_1.RefreshTokensRepository,
        auth_identities_repository_1.AuthIdentitiesRepository,
        logger_service_1.LoggerService,
        request_context_service_1.RequestContextService])
], AuthService);
