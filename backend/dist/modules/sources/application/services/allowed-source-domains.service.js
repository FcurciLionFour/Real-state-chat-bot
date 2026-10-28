"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllowedSourceDomainsService = void 0;
const common_1 = require("@nestjs/common");
let AllowedSourceDomainsService = class AllowedSourceDomainsService {
    allowedDomains = ['zonaprop.com.ar', 'argenprop.com', 'properati.com.ar', 'mudafy.com.ar'];
    getAllowedDomains() {
        return [...this.allowedDomains];
    }
    canUseUrl(rawUrl) {
        return this.normalizeUrl(rawUrl) !== null;
    }
    normalizeUrl(rawUrl) {
        try {
            const url = new URL(rawUrl);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return null;
            }
            const hostname = url.hostname.toLowerCase();
            const matchedDomain = this.findAllowedDomain(hostname);
            if (!matchedDomain) {
                return null;
            }
            url.hostname = hostname;
            url.hash = '';
            return url.toString();
        }
        catch {
            return null;
        }
    }
    filterCandidateUrls(rawUrls, totalLimit = 20, perDomainLimit = 5) {
        const seen = new Set();
        const perDomainCounts = new Map();
        const normalizedUrls = [];
        for (const rawUrl of rawUrls) {
            const normalized = this.normalizeUrl(rawUrl);
            if (!normalized || seen.has(normalized)) {
                continue;
            }
            const hostname = new URL(normalized).hostname.toLowerCase();
            const matchedDomain = this.findAllowedDomain(hostname);
            if (!matchedDomain) {
                continue;
            }
            const currentCount = perDomainCounts.get(matchedDomain) ?? 0;
            if (currentCount >= perDomainLimit) {
                continue;
            }
            perDomainCounts.set(matchedDomain, currentCount + 1);
            seen.add(normalized);
            normalizedUrls.push(normalized);
            if (normalizedUrls.length >= totalLimit) {
                break;
            }
        }
        return normalizedUrls;
    }
    findAllowedDomain(hostname) {
        return this.allowedDomains.find((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) ?? null;
    }
};
exports.AllowedSourceDomainsService = AllowedSourceDomainsService;
exports.AllowedSourceDomainsService = AllowedSourceDomainsService = __decorate([
    (0, common_1.Injectable)()
], AllowedSourceDomainsService);
