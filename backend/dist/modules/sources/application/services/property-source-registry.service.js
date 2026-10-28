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
exports.PropertySourceRegistryService = void 0;
const common_1 = require("@nestjs/common");
const argenprop_source_adapter_1 = require("../../infrastructure/adapters/argenprop-source.adapter");
const mudafy_source_adapter_1 = require("../../infrastructure/adapters/mudafy-source.adapter");
const properati_source_adapter_1 = require("../../infrastructure/adapters/properati-source.adapter");
const zonaprop_source_adapter_1 = require("../../infrastructure/adapters/zonaprop-source.adapter");
let PropertySourceRegistryService = class PropertySourceRegistryService {
    zonapropSourceAdapter;
    argenpropSourceAdapter;
    properatiSourceAdapter;
    mudafySourceAdapter;
    adapters;
    constructor(zonapropSourceAdapter, argenpropSourceAdapter, properatiSourceAdapter, mudafySourceAdapter) {
        this.zonapropSourceAdapter = zonapropSourceAdapter;
        this.argenpropSourceAdapter = argenpropSourceAdapter;
        this.properatiSourceAdapter = properatiSourceAdapter;
        this.mudafySourceAdapter = mudafySourceAdapter;
        this.adapters = [
            this.zonapropSourceAdapter,
            this.argenpropSourceAdapter,
            this.properatiSourceAdapter,
            this.mudafySourceAdapter,
        ];
    }
    getAdapters() {
        return [...this.adapters];
    }
    hasRegisteredAdapters() {
        return this.adapters.length > 0;
    }
    findAdapterForUrl(url) {
        return this.adapters.find((adapter) => adapter.canHandle(url)) ?? null;
    }
    filterSupportedUrls(urls) {
        const supportedEntries = urls
            .map((url) => ({
            url,
            adapter: this.findAdapterForUrl(url),
        }))
            .filter((entry) => entry.adapter !== null);
        const detailEntries = supportedEntries.filter((entry) => entry.adapter.isDetailUrl?.(entry.url) ?? true);
        return (detailEntries.length > 0 ? detailEntries : supportedEntries).map((entry) => entry.url);
    }
};
exports.PropertySourceRegistryService = PropertySourceRegistryService;
exports.PropertySourceRegistryService = PropertySourceRegistryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [zonaprop_source_adapter_1.ZonapropSourceAdapter,
        argenprop_source_adapter_1.ArgenpropSourceAdapter,
        properati_source_adapter_1.ProperatiSourceAdapter,
        mudafy_source_adapter_1.MudafySourceAdapter])
], PropertySourceRegistryService);
