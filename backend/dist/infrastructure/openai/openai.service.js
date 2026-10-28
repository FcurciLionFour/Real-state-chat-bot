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
var OpenAiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const logger_service_1 = require("../observability/logger.service");
let OpenAiService = OpenAiService_1 = class OpenAiService {
    configService;
    logger;
    hasWarnedMissingApiKey = false;
    constructor(configService, logger) {
        this.configService = configService;
        this.logger = logger;
    }
    getApiKey() {
        return this.configService.get('openai.apiKey', '');
    }
    getModel() {
        return this.configService.get('openai.model', 'gpt-4.1-mini');
    }
    async createStructuredJsonResponse(request) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            if (!this.hasWarnedMissingApiKey) {
                this.logger.warn('OPENAI_API_KEY is not configured. AI requests will use the safe fallback until a key is provided.', OpenAiService_1.name);
                this.hasWarnedMissingApiKey = true;
            }
            throw new Error('OPENAI_API_KEY is not configured');
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: this.getModel(),
                    instructions: request.systemPrompt,
                    input: JSON.stringify(request.userInput),
                    tool_choice: 'none',
                    temperature: 0,
                    text: {
                        format: {
                            type: 'json_schema',
                            name: request.schemaName,
                            description: request.schemaDescription,
                            schema: request.schema,
                            strict: true,
                        },
                    },
                }),
                signal: controller.signal,
            });
            if (!response.ok) {
                const errorText = await response.text();
                this.logger.error(`OpenAI Responses API failed with status ${response.status}.`, errorText, OpenAiService_1.name);
                throw new Error(`OpenAI request failed with ${response.status}: ${errorText}`);
            }
            const payload = (await response.json());
            const outputText = payload.output_text ?? this.extractOutputText(payload.output);
            if (!outputText) {
                this.logger.error('OpenAI response did not contain output_text.', undefined, OpenAiService_1.name);
                throw new Error('OpenAI response did not contain output_text');
            }
            return outputText;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown OpenAI error';
            this.logger.error(`OpenAI structured response failed: ${message}`, undefined, OpenAiService_1.name);
            throw error;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    extractOutputText(output) {
        if (!output) {
            return null;
        }
        for (const item of output) {
            for (const contentPart of item.content ?? []) {
                if (contentPart.type === 'output_text' && contentPart.text) {
                    return contentPart.text;
                }
            }
        }
        return null;
    }
};
exports.OpenAiService = OpenAiService;
exports.OpenAiService = OpenAiService = OpenAiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        logger_service_1.LoggerService])
], OpenAiService);
