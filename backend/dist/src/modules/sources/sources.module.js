"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourcesModule = void 0;
const common_1 = require("@nestjs/common");
const allowed_source_domains_service_1 = require("./application/services/allowed-source-domains.service");
const html_fetch_service_1 = require("./application/services/html-fetch.service");
const property_source_registry_service_1 = require("./application/services/property-source-registry.service");
const argenprop_source_adapter_1 = require("./infrastructure/adapters/argenprop-source.adapter");
const mudafy_source_adapter_1 = require("./infrastructure/adapters/mudafy-source.adapter");
const properati_source_adapter_1 = require("./infrastructure/adapters/properati-source.adapter");
const zonaprop_source_adapter_1 = require("./infrastructure/adapters/zonaprop-source.adapter");
let SourcesModule = class SourcesModule {
};
exports.SourcesModule = SourcesModule;
exports.SourcesModule = SourcesModule = __decorate([
    (0, common_1.Module)({
        providers: [
            allowed_source_domains_service_1.AllowedSourceDomainsService,
            html_fetch_service_1.HtmlFetchService,
            zonaprop_source_adapter_1.ZonapropSourceAdapter,
            argenprop_source_adapter_1.ArgenpropSourceAdapter,
            properati_source_adapter_1.ProperatiSourceAdapter,
            mudafy_source_adapter_1.MudafySourceAdapter,
            property_source_registry_service_1.PropertySourceRegistryService,
        ],
        exports: [
            allowed_source_domains_service_1.AllowedSourceDomainsService,
            html_fetch_service_1.HtmlFetchService,
            zonaprop_source_adapter_1.ZonapropSourceAdapter,
            argenprop_source_adapter_1.ArgenpropSourceAdapter,
            properati_source_adapter_1.ProperatiSourceAdapter,
            mudafy_source_adapter_1.MudafySourceAdapter,
            property_source_registry_service_1.PropertySourceRegistryService,
        ],
    })
], SourcesModule);
