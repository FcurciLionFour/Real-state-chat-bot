"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const users_module_1 = require("../users/users.module");
const auth_controller_1 = require("./api/controllers/auth.controller");
const access_token_service_1 = require("./application/services/access-token.service");
const auth_service_1 = require("./application/services/auth.service");
const password_hash_service_1 = require("./application/services/password-hash.service");
const auth_identities_repository_1 = require("./infrastructure/repositories/auth-identities.repository");
const email_verification_tokens_repository_1 = require("./infrastructure/repositories/email-verification-tokens.repository");
const refresh_tokens_repository_1 = require("./infrastructure/repositories/refresh-tokens.repository");
const access_token_guard_1 = require("./presentation/guards/access-token.guard");
const roles_guard_1 = require("./presentation/guards/roles.guard");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [users_module_1.UsersModule],
        controllers: [auth_controller_1.AuthController],
        providers: [
            auth_service_1.AuthService,
            password_hash_service_1.PasswordHashService,
            access_token_service_1.AccessTokenService,
            auth_identities_repository_1.AuthIdentitiesRepository,
            email_verification_tokens_repository_1.EmailVerificationTokensRepository,
            refresh_tokens_repository_1.RefreshTokensRepository,
            access_token_guard_1.AccessTokenGuard,
            roles_guard_1.RolesGuard,
        ],
        exports: [auth_service_1.AuthService, access_token_service_1.AccessTokenService, access_token_guard_1.AccessTokenGuard, roles_guard_1.RolesGuard],
    })
], AuthModule);
