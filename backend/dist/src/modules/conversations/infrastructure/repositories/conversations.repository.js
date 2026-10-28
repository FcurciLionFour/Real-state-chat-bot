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
exports.ConversationsRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../../infrastructure/prisma/prisma.service");
let ConversationsRepository = class ConversationsRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(userId, title) {
        return this.prisma.conversation.create({
            data: {
                userId,
                title,
                status: client_1.ConversationStatus.ACTIVE,
            },
        });
    }
    findManyByUserId(userId, page, limit) {
        const skip = (page - 1) * limit;
        return this.prisma.conversation.findMany({
            where: { userId },
            orderBy: {
                updatedAt: 'desc',
            },
            skip,
            take: limit,
        });
    }
    countByUserId(userId) {
        return this.prisma.conversation.count({
            where: { userId },
        });
    }
    findDetailById(id) {
        return this.prisma.conversation.findUnique({
            where: { id },
            include: {
                messages: {
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
                searchState: true,
                searchRuns: {
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: 1,
                },
            },
        });
    }
    findById(id) {
        return this.prisma.conversation.findUnique({
            where: { id },
        });
    }
    touch(conversationId) {
        return this.prisma.conversation.update({
            where: { id: conversationId },
            data: {
                updatedAt: new Date(),
            },
        });
    }
    markSearchExecuted(conversationId, at = new Date()) {
        return this.prisma.conversation.update({
            where: { id: conversationId },
            data: {
                lastSearchAt: at,
                updatedAt: at,
            },
        });
    }
};
exports.ConversationsRepository = ConversationsRepository;
exports.ConversationsRepository = ConversationsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ConversationsRepository);
