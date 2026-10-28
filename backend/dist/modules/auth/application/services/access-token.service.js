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
exports.AccessTokenService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
let AccessTokenService = class AccessTokenService {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    signAccessToken(user) {
        const nowInSeconds = Math.floor(Date.now() / 1000);
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            type: 'access',
            iat: nowInSeconds,
            exp: nowInSeconds + this.parseDurationToSeconds(this.configService.get('auth.accessExpiresIn', '15m')),
        };
        const header = {
            alg: 'HS256',
            typ: 'JWT',
        };
        const encodedHeader = this.encodeSegment(header);
        const encodedPayload = this.encodeSegment(payload);
        const signature = this.sign(`${encodedHeader}.${encodedPayload}`);
        return `${encodedHeader}.${encodedPayload}.${signature}`;
    }
    verifyAccessToken(token) {
        const [encodedHeader, encodedPayload, signature] = token.split('.');
        if (!encodedHeader || !encodedPayload || !signature) {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`);
        if (!this.safeCompare(signature, expectedSignature)) {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        const payload = this.decodeSegment(encodedPayload);
        if (!payload ||
            payload.type !== 'access' ||
            typeof payload.sub !== 'string' ||
            typeof payload.email !== 'string' ||
            !Object.values(client_1.UserRole).includes(payload.role) ||
            typeof payload.exp !== 'number') {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        if (payload.exp <= Math.floor(Date.now() / 1000)) {
            throw new common_1.UnauthorizedException('Access token expired');
        }
        return payload;
    }
    generateRefreshToken() {
        return (0, node_crypto_1.randomBytes)(48).toString('base64url');
    }
    hashRefreshToken(refreshToken) {
        return (0, node_crypto_1.createHmac)('sha256', this.getRefreshSecret()).update(refreshToken).digest('hex');
    }
    getRefreshTokenExpiresAt() {
        const seconds = this.parseDurationToSeconds(this.configService.get('auth.refreshExpiresIn', '30d'));
        return new Date(Date.now() + seconds * 1000);
    }
    getRefreshCookieMaxAge() {
        const seconds = this.parseDurationToSeconds(this.configService.get('auth.refreshExpiresIn', '30d'));
        return seconds * 1000;
    }
    getAccessSecret() {
        return this.configService.get('auth.accessSecret', '');
    }
    getRefreshSecret() {
        return this.configService.get('auth.refreshSecret', '');
    }
    sign(value) {
        return (0, node_crypto_1.createHmac)('sha256', this.getAccessSecret()).update(value).digest('base64url');
    }
    encodeSegment(value) {
        return Buffer.from(JSON.stringify(value)).toString('base64url');
    }
    decodeSegment(value) {
        try {
            return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
    }
    safeCompare(left, right) {
        const leftBuffer = Buffer.from(left);
        const rightBuffer = Buffer.from(right);
        if (leftBuffer.length !== rightBuffer.length) {
            return false;
        }
        return (0, node_crypto_1.timingSafeEqual)(leftBuffer, rightBuffer);
    }
    parseDurationToSeconds(value) {
        const normalizedValue = value.trim().toLowerCase();
        const match = normalizedValue.match(/^(\d+)(s|m|h|d)?$/);
        if (!match) {
            throw new Error(`Unsupported duration format: ${value}`);
        }
        const amount = Number(match[1]);
        const unit = match[2] ?? 's';
        const multipliers = {
            s: 1,
            m: 60,
            h: 60 * 60,
            d: 60 * 60 * 24,
        };
        return amount * multipliers[unit];
    }
};
exports.AccessTokenService = AccessTokenService;
exports.AccessTokenService = AccessTokenService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AccessTokenService);
