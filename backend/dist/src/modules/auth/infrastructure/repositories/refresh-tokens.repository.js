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
exports.RefreshTokensRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../infrastructure/prisma/prisma.service");
let RefreshTokensRepository = class RefreshTokensRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(input) {
        return this.prisma.refreshToken.create({
            data: {
                userId: input.userId,
                tokenHash: input.tokenHash,
                expiresAt: input.expiresAt,
                userAgent: input.userAgent ?? null,
                ipAddress: input.ipAddress ?? null,
            },
        });
    }
    async findActiveByTokenHash(tokenHash) {
        const refreshToken = await this.prisma.refreshToken.findUnique({
            where: { tokenHash },
            include: { user: true },
        });
        if (!refreshToken) {
            return null;
        }
        if (refreshToken.revokedAt || refreshToken.expiresAt <= new Date()) {
            return null;
        }
        return refreshToken;
    }
    revokeById(id) {
        return this.prisma.refreshToken.update({
            where: { id },
            data: {
                revokedAt: new Date(),
            },
        });
    }
    revokeByTokenHash(tokenHash) {
        return this.prisma.refreshToken.updateMany({
            where: {
                tokenHash,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        });
    }
};
exports.RefreshTokensRepository = RefreshTokensRepository;
exports.RefreshTokensRepository = RefreshTokensRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RefreshTokensRepository);
