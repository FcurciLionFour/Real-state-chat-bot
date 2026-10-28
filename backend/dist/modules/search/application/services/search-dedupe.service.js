"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchDedupeService = void 0;
const common_1 = require("@nestjs/common");
let SearchDedupeService = class SearchDedupeService {
    dedupe(results) {
        const deduped = [];
        for (const candidate of results) {
            const duplicateIndex = deduped.findIndex((existing) => this.areDuplicates(existing, candidate));
            if (duplicateIndex === -1) {
                deduped.push(candidate);
                continue;
            }
            const representative = this.pickRepresentative(deduped[duplicateIndex], candidate);
            deduped[duplicateIndex] = representative;
        }
        return deduped;
    }
    areDuplicates(left, right) {
        if (left.source === right.source && left.externalId && right.externalId && left.externalId === right.externalId) {
            return true;
        }
        if (left.sourceUrl === right.sourceUrl) {
            return true;
        }
        const leftCanonical = this.buildCanonicalFingerprint(left);
        const rightCanonical = this.buildCanonicalFingerprint(right);
        if (leftCanonical === rightCanonical) {
            return true;
        }
        return this.isStrongCrossSourceMatch(left, right);
    }
    isStrongCrossSourceMatch(left, right) {
        if (left.source === right.source) {
            return false;
        }
        if (left.propertyType && right.propertyType && left.propertyType !== right.propertyType) {
            return false;
        }
        const leftLocation = this.normalizeLocation(left);
        const rightLocation = this.normalizeLocation(right);
        if (!leftLocation || !rightLocation || leftLocation !== rightLocation) {
            return false;
        }
        const leftPrice = this.normalizeComparablePrice(left.price);
        const rightPrice = this.normalizeComparablePrice(right.price);
        const priceClose = leftPrice !== null && rightPrice !== null && Math.abs(leftPrice - rightPrice) <= 5000;
        const leftArea = this.normalizeComparableArea(left);
        const rightArea = this.normalizeComparableArea(right);
        const areaClose = leftArea !== null && rightArea !== null && Math.abs(leftArea - rightArea) <= 8;
        const titleSimilarity = this.computeTitleSimilarity(left.title, right.title);
        return titleSimilarity >= 0.6 && priceClose && areaClose;
    }
    pickRepresentative(left, right) {
        return this.computeCompletenessScore(right) > this.computeCompletenessScore(left) ? right : left;
    }
    computeCompletenessScore(result) {
        let score = 0;
        if (result.price !== null && result.currency)
            score += 2;
        if (result.images.length > 0)
            score += 2;
        if (result.neighborhood || result.city)
            score += 1;
        if (result.propertyType)
            score += 1;
        if (result.rooms !== null)
            score += 1;
        if (result.areaTotal !== null || result.areaCovered !== null)
            score += 1;
        if (result.description)
            score += 1;
        const scrapedAt = Date.parse(result.scrapedAt);
        if (!Number.isNaN(scrapedAt)) {
            score += scrapedAt / 1_000_000_000_000;
        }
        return score;
    }
    buildCanonicalFingerprint(result) {
        const title = this.normalizeTitle(result.title);
        const propertyType = result.propertyType ?? 'UNKNOWN';
        const neighborhood = this.normalizeLocation(result) ?? '';
        const price = this.normalizeComparablePrice(result.price) ?? 0;
        const area = this.normalizeComparableArea(result) ?? 0;
        return `${propertyType}::${neighborhood}::${price}::${area}::${title}`;
    }
    normalizeLocation(result) {
        const rawLocation = result.neighborhood ?? result.locationText ?? result.city ?? '';
        const normalized = rawLocation.trim().toLowerCase().replace(/\s+/g, ' ');
        return normalized.length > 0 ? normalized : null;
    }
    normalizeComparablePrice(price) {
        if (price === null) {
            return null;
        }
        return Math.round(price / 5000) * 5000;
    }
    normalizeComparableArea(result) {
        const area = result.areaTotal ?? result.areaCovered;
        if (area === null) {
            return null;
        }
        return Math.round(area);
    }
    normalizeTitle(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    computeTitleSimilarity(leftTitle, rightTitle) {
        const leftTokens = new Set(this.normalizeTitle(leftTitle).split(' ').filter((token) => token.length > 2));
        const rightTokens = new Set(this.normalizeTitle(rightTitle).split(' ').filter((token) => token.length > 2));
        if (leftTokens.size === 0 || rightTokens.size === 0) {
            return 0;
        }
        const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
        const union = new Set([...leftTokens, ...rightTokens]).size;
        return intersection / union;
    }
};
exports.SearchDedupeService = SearchDedupeService;
exports.SearchDedupeService = SearchDedupeService = __decorate([
    (0, common_1.Injectable)()
], SearchDedupeService);
