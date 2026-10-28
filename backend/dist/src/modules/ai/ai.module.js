"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiModule = void 0;
const common_1 = require("@nestjs/common");
const ai_response_generator_service_1 = require("./application/services/ai-response-generator.service");
const ai_search_decision_service_1 = require("./application/services/ai-search-decision.service");
let AiModule = class AiModule {
};
exports.AiModule = AiModule;
exports.AiModule = AiModule = __decorate([
    (0, common_1.Module)({
        providers: [ai_search_decision_service_1.AiSearchDecisionService, ai_response_generator_service_1.AiResponseGeneratorService],
        exports: [ai_search_decision_service_1.AiSearchDecisionService, ai_response_generator_service_1.AiResponseGeneratorService],
    })
], AiModule);
