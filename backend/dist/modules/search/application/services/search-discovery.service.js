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
exports.SearchDiscoveryService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const google_discovery_service_1 = require("./google-discovery.service");
const vertex_discovery_service_1 = require("./vertex-discovery.service");
let SearchDiscoveryService = class SearchDiscoveryService {
    configService;
    googleDiscoveryService;
    vertexDiscoveryService;
    constructor(configService, googleDiscoveryService, vertexDiscoveryService) {
        this.configService = configService;
        this.googleDiscoveryService = googleDiscoveryService;
        this.vertexDiscoveryService = vertexDiscoveryService;
    }
    async discover(queries) {
        return this.resolveActiveService().discover(queries);
    }
    getStatus() {
        const activeService = this.resolveActiveService();
        return {
            provider: activeService.getProvider(),
            configured: activeService.isConfigured(),
            credentialGaps: activeService.getCredentialGaps(),
        };
    }
    resolveActiveService() {
        return this.getConfiguredProvider() === 'vertex-ai-search'
            ? this.vertexDiscoveryService
            : this.googleDiscoveryService;
    }
    getConfiguredProvider() {
        const provider = this.configService.get('search.discoveryProvider', 'google-programmable-search');
        return provider === 'vertex-ai-search' ? 'vertex-ai-search' : 'google-programmable-search';
    }
};
exports.SearchDiscoveryService = SearchDiscoveryService;
exports.SearchDiscoveryService = SearchDiscoveryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        google_discovery_service_1.GoogleDiscoveryService,
        vertex_discovery_service_1.VertexDiscoveryService])
], SearchDiscoveryService);
