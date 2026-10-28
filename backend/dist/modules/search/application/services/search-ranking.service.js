"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchRankingService = void 0;
const common_1 = require("@nestjs/common");
let SearchRankingService = class SearchRankingService {
    rank(searchState, results) {
        const ranked = results
            .filter((result) => this.passesEssentialFilters(searchState, result))
            .map((result) => {
            const details = this.computeReasonDetails(searchState, result);
            return {
                ...result,
                rank: {
                    position: 0,
                    score: details.totalScore,
                    reasons: this.buildHumanReasons(details),
                    reasonDetails: details,
                },
            };
        })
            .sort((left, right) => right.rank.score - left.rank.score);
        return ranked.map((result, index) => ({
            ...result,
            rank: {
                ...result.rank,
                position: index + 1,
            },
        }));
    }
    passesEssentialFilters(searchState, result) {
        if (searchState.operation && result.operation && searchState.operation !== result.operation) {
            return false;
        }
        if (searchState.propertyTypes.length > 0 &&
            result.propertyType &&
            !searchState.propertyTypes.includes(result.propertyType)) {
            return false;
        }
        if (searchState.locations.length > 0) {
            const normalizedLocation = this.normalizeLocation(result);
            if (normalizedLocation && !searchState.locations.some((location) => normalizedLocation.includes(location.toLowerCase()))) {
                return false;
            }
        }
        return true;
    }
    computeReasonDetails(searchState, result) {
        const locationScore = this.computeLocationScore(searchState, result);
        const budgetScore = this.computeBudgetScore(searchState, result);
        const propertyTypeScore = this.computePropertyTypeScore(searchState, result);
        const roomsScore = this.computeDiscreteScore(searchState.rooms, result.rooms);
        const bedroomsScore = this.computeDiscreteScore(searchState.bedrooms, result.bedrooms);
        const bathroomsScore = this.computeDiscreteScore(searchState.bathrooms, result.bathrooms);
        const { score: featuresScore, matchedFeatures } = this.computeFeaturesScore(searchState, result);
        const completenessScore = this.computeCompletenessScore(result);
        const freshnessScore = this.computeFreshnessScore(result.scrapedAt);
        const weightedScore = locationScore * 0.25 +
            budgetScore * 0.2 +
            propertyTypeScore * 0.15 +
            roomsScore * 0.1 +
            bedroomsScore * 0.05 +
            bathroomsScore * 0.05 +
            featuresScore * 0.1 +
            completenessScore * 0.07 +
            freshnessScore * 0.03;
        return {
            locationScore,
            budgetScore,
            propertyTypeScore,
            roomsScore,
            bedroomsScore,
            bathroomsScore,
            featuresScore,
            completenessScore,
            freshnessScore,
            matchedFeatures,
            withinBudget: budgetScore >= 0.7,
            totalScore: Number(Math.max(0, Math.min(0.99, weightedScore)).toFixed(2)),
        };
    }
    buildHumanReasons(details) {
        const reasons = ['Resultado real extraido desde una fuente permitida'];
        if (details.locationScore >= 0.7) {
            reasons.push('Coincide con tu zona');
        }
        if (details.budgetScore >= 0.7) {
            reasons.push('Esta dentro de tu presupuesto');
        }
        if (details.matchedFeatures.length > 0) {
            reasons.push(`Cumple ${details.matchedFeatures.length} feature(s) solicitadas`);
        }
        if (details.freshnessScore >= 0.8) {
            reasons.push('Fue actualizado recientemente');
        }
        return reasons;
    }
    computeLocationScore(searchState, result) {
        if (searchState.locations.length === 0) {
            return 1;
        }
        const locationText = this.normalizeLocation(result);
        if (!locationText) {
            return 0.3;
        }
        for (const location of searchState.locations) {
            const normalizedLocation = location.toLowerCase();
            if (result.neighborhood?.toLowerCase() === normalizedLocation) {
                return 1;
            }
            if (locationText.includes(normalizedLocation)) {
                return 0.7;
            }
        }
        return result.city?.toLowerCase() === 'caba' ? 0.3 : 0;
    }
    computeBudgetScore(searchState, result) {
        if (result.price === null) {
            return 0.3;
        }
        if (searchState.priceMin === null && searchState.priceMax === null) {
            return 1;
        }
        if ((searchState.priceMin === null || result.price >= searchState.priceMin) &&
            (searchState.priceMax === null || result.price <= searchState.priceMax)) {
            return 1;
        }
        if (searchState.priceMax !== null) {
            const overflow = (result.price - searchState.priceMax) / searchState.priceMax;
            if (overflow <= 0.05)
                return 0.7;
            if (overflow <= 0.15)
                return 0.3;
            return 0;
        }
        if (searchState.priceMin !== null) {
            const underflow = (searchState.priceMin - result.price) / searchState.priceMin;
            if (underflow <= 0.05)
                return 0.7;
            if (underflow <= 0.15)
                return 0.3;
            return 0;
        }
        return 0.3;
    }
    computePropertyTypeScore(searchState, result) {
        if (searchState.propertyTypes.length === 0) {
            return 1;
        }
        if (!result.propertyType) {
            return 0.5;
        }
        return searchState.propertyTypes.includes(result.propertyType) ? 1 : 0;
    }
    computeDiscreteScore(target, actual) {
        if (target === null) {
            return 1;
        }
        if (actual === null) {
            return 0.5;
        }
        const difference = Math.abs(target - actual);
        if (difference === 0)
            return 1;
        if (difference === 1)
            return 0.7;
        return 0;
    }
    computeFeaturesScore(searchState, result) {
        if (searchState.features.length === 0) {
            return {
                score: 1,
                matchedFeatures: [],
            };
        }
        const matchedFeatures = searchState.features.filter((feature) => result.features.includes(feature));
        return {
            score: matchedFeatures.length / searchState.features.length,
            matchedFeatures,
        };
    }
    computeCompletenessScore(result) {
        const fields = [
            result.price !== null && result.currency !== null,
            Boolean(result.neighborhood ?? result.city),
            Boolean(result.propertyType),
            result.rooms !== null,
            result.areaTotal !== null || result.areaCovered !== null,
            result.images.length > 0,
            Boolean(result.description),
        ];
        const present = fields.filter(Boolean).length;
        return Number((present / fields.length).toFixed(2));
    }
    computeFreshnessScore(scrapedAt) {
        const scrapedTimestamp = Date.parse(scrapedAt);
        if (Number.isNaN(scrapedTimestamp)) {
            return 0.3;
        }
        const ageHours = Math.max(0, (Date.now() - scrapedTimestamp) / (1000 * 60 * 60));
        if (ageHours <= 24)
            return 1;
        if (ageHours <= 72)
            return 0.8;
        if (ageHours <= 168)
            return 0.5;
        return 0.2;
    }
    normalizeLocation(result) {
        return `${result.neighborhood ?? ''} ${result.city ?? ''} ${result.locationText ?? ''}`.trim().toLowerCase();
    }
};
exports.SearchRankingService = SearchRankingService;
exports.SearchRankingService = SearchRankingService = __decorate([
    (0, common_1.Injectable)()
], SearchRankingService);
