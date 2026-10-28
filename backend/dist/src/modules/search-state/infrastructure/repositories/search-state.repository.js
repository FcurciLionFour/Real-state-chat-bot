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
exports.SearchStateRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../infrastructure/prisma/prisma.service");
let SearchStateRepository = class SearchStateRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findByConversationId(conversationId) {
        return this.prisma.searchState.findUnique({
            where: { conversationId },
        });
    }
    create(conversationId, filters) {
        return this.prisma.searchState.create({
            data: {
                conversationId,
                filtersJson: filters,
            },
        });
    }
    update(conversationId, filters) {
        return this.prisma.searchState.update({
            where: { conversationId },
            data: {
                filtersJson: filters,
                version: {
                    increment: 1,
                },
            },
        });
    }
};
exports.SearchStateRepository = SearchStateRepository;
exports.SearchStateRepository = SearchStateRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SearchStateRepository);
