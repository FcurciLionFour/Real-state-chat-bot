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
exports.FavoritesRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../infrastructure/prisma/prisma.service");
let FavoritesRepository = class FavoritesRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findByUserIdAndPropertyId(userId, propertyCacheId) {
        return this.prisma.favorite.findUnique({
            where: {
                userId_propertyCacheId: {
                    userId,
                    propertyCacheId,
                },
            },
            include: {
                propertyCache: true,
            },
        });
    }
    create(userId, propertyCacheId) {
        return this.prisma.favorite.create({
            data: {
                userId,
                propertyCacheId,
            },
            include: {
                propertyCache: true,
            },
        });
    }
    deleteByUserIdAndPropertyId(userId, propertyCacheId) {
        return this.prisma.favorite.deleteMany({
            where: {
                userId,
                propertyCacheId,
            },
        });
    }
    findManyByUserId(userId, page, limit) {
        const skip = (page - 1) * limit;
        return this.prisma.favorite.findMany({
            where: { userId },
            include: {
                propertyCache: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
            skip,
            take: limit,
        });
    }
    countByUserId(userId) {
        return this.prisma.favorite.count({
            where: { userId },
        });
    }
};
exports.FavoritesRepository = FavoritesRepository;
exports.FavoritesRepository = FavoritesRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FavoritesRepository);
