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
exports.AuthIdentitiesRepository = void 0;
const client_1 = require("@prisma/client");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../infrastructure/prisma/prisma.service");
let AuthIdentitiesRepository = class AuthIdentitiesRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findByProviderIdentity(provider, providerUserId) {
        return this.prisma.authIdentity.findUnique({
            where: {
                provider_providerUserId: {
                    provider,
                    providerUserId,
                },
            },
            include: {
                user: true,
            },
        });
    }
    createPasswordIdentity(userId, email) {
        return this.prisma.authIdentity.create({
            data: {
                userId,
                provider: client_1.AuthProvider.PASSWORD,
                providerUserId: userId,
                providerEmail: email,
            },
        });
    }
};
exports.AuthIdentitiesRepository = AuthIdentitiesRepository;
exports.AuthIdentitiesRepository = AuthIdentitiesRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuthIdentitiesRepository);
