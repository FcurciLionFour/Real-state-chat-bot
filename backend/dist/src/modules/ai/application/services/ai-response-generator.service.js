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
var AiResponseGeneratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiResponseGeneratorService = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("../../../../infrastructure/observability/logger.service");
const openai_service_1 = require("../../../../infrastructure/openai/openai.service");
let AiResponseGeneratorService = AiResponseGeneratorService_1 = class AiResponseGeneratorService {
    openAiService;
    logger;
    constructor(openAiService, logger) {
        this.openAiService = openAiService;
        this.logger = logger;
    }
    async generate(input) {
        if (this.isMockModeEnabled()) {
            return this.generateMockResponse(input);
        }
        const apiKey = this.openAiService.getApiKey();
        if (!apiKey) {
            return null;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
            const response = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: this.openAiService.getModel(),
                    instructions: this.buildSystemPrompt(),
                    input: this.buildUserPrompt(input),
                    tool_choice: 'none',
                    max_output_tokens: 150,
                }),
                signal: controller.signal,
            });
            if (!response.ok) {
                return null;
            }
            const payload = (await response.json());
            const text = payload.output_text ?? this.extractOutputText(payload.output);
            const normalized = text?.trim();
            return normalized && normalized.length > 0 ? normalized : null;
        }
        catch (error) {
            this.logger.warn(`AI response generation failed, caller will use fallback: ${error instanceof Error ? error.message : 'unknown'}`, AiResponseGeneratorService_1.name);
            return null;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    isMockModeEnabled() {
        return process.env.OPENAI_MOCK_MODE === 'true';
    }
    buildSystemPrompt() {
        return 'Sos un asistente inmobiliario argentino experto. Tu trabajo es analizar los resultados de b\u00fasqueda y dar una respuesta conversacional \u00fatil al usuario: comparar opciones, destacar la mejor relaci\u00f3n precio/m, mencionar puntos fuertes o d\u00e9biles de las propiedades, y hacer UNA pregunta concreta para afinar la b\u00fasqueda si tiene sentido.\n\nReglas:\n- M\u00e1ximo 3 oraciones. Nunca m\u00e1s.\n- No listes las propiedades una por una. Comparalas y destac\u00e1 las m\u00e1s relevantes.\n- Si hay una clara ganadora, decilo. Si hay un trade-off interesante (precio vs espacio, por ejemplo), mencionalo.\n- Nunca invent\u00e9s datos que no est\u00e9n en el input.\n- Respond\u00e9 siempre en espa\u00f1ol rioplatense, tono directo y amigable.\n- No uses markdown, no uses listas, no uses asteriscos.\n- Termin\u00e1 con una pregunta solo si agrega valor. Si el usuario ya fue claro, no preguntes.';
    }
    buildUserPrompt(input) {
        const locations = input.searchState.locations.length > 0 ? input.searchState.locations.join(', ') : 'null';
        if (!input.searchExecuted) {
            return [
                `El usuario pidi\u00f3: '${input.userMessage}'`,
                `Filtros aplicados: operaci\u00f3n=${input.searchState.operation}, zona=${locations}, precioMax=${input.searchState.priceMax}`,
                'No se ejecut\u00f3 b\u00fasqueda. Confirm\u00e1 al usuario qu\u00e9 entendiste o ped\u00ed aclaraci\u00f3n si corresponde.',
                '',
                'Gener\u00e1 la respuesta del asistente.',
            ].join('\n');
        }
        if (!input.results || input.results.count === 0) {
            return [
                `El usuario pidi\u00f3: '${input.userMessage}'`,
                `Filtros aplicados: operaci\u00f3n=${input.searchState.operation}, zona=${locations}, precioMax=${input.searchState.priceMax}`,
                'No se encontraron propiedades. Explicale honestamente al usuario y suger\u00ed una acci\u00f3n concreta: ampliar zona, subir presupuesto, o cambiar tipo de propiedad. M\u00e1ximo 2 oraciones.',
                '',
                'Gener\u00e1 la respuesta del asistente.',
            ].join('\n');
        }
        const properties = input.results.properties
            .map((property) => `- ${property.address}: ${property.currency} ${property.price}/mes, ${property.rooms ?? 'sin dato'} amb, ${property.area ?? 'sin dato'}m, features: ${property.features.join(', ') || 'sin datos'}`)
            .join('\n');
        return [
            `El usuario pidi\u00f3: '${input.userMessage}'`,
            `Filtros aplicados: operaci\u00f3n=${input.searchState.operation}, zona=${locations}, precioMax=${input.searchState.priceMax}`,
            `Resultados (${input.results.count} propiedades):`,
            properties,
            '',
            'Gener\u00e1 la respuesta del asistente.',
        ].join('\n');
    }
    generateMockResponse(input) {
        if (!input.searchExecuted) {
            return 'Entendido, \u00bfqu\u00e9 est\u00e1s buscando exactamente?';
        }
        if (!input.results || input.results.count === 0) {
            return 'No encontr\u00e9 propiedades con esos filtros. \u00bfProbamos ampliar la zona?';
        }
        return `Encontr\u00e9 ${input.results.count} propiedades que coinciden con tu b\u00fasqueda.`;
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
exports.AiResponseGeneratorService = AiResponseGeneratorService;
exports.AiResponseGeneratorService = AiResponseGeneratorService = AiResponseGeneratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_1.OpenAiService,
        logger_service_1.LoggerService])
], AiResponseGeneratorService);
