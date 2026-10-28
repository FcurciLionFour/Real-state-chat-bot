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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerService = void 0;
const common_1 = require("@nestjs/common");
const request_context_service_1 = require("./request-context.service");
let LoggerService = class LoggerService extends common_1.ConsoleLogger {
    requestContextService;
    listeners = new Set();
    constructor(requestContextService) {
        super();
        this.requestContextService = requestContextService;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    logEvent(message, metadata, context) {
        super.log(this.serialize('log', message, metadata), context);
    }
    warnEvent(message, metadata, context) {
        super.warn(this.serialize('warn', message, metadata), context);
    }
    errorEvent(message, metadata, trace, context) {
        super.error(this.serialize('error', message, metadata), trace, context);
    }
    serialize(level, message, metadata) {
        const payload = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...(this.requestContextService?.snapshot() ?? {}),
            ...metadata,
        };
        for (const listener of this.listeners) {
            listener({
                level,
                message,
                metadata: payload,
            });
        }
        return JSON.stringify(payload);
    }
};
exports.LoggerService = LoggerService;
exports.LoggerService = LoggerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [request_context_service_1.RequestContextService])
], LoggerService);
