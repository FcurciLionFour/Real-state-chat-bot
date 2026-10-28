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
            .sort((left, right) => this.compareRankedResults(searchState, left, right));
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
        if (searchState.currency && result.price !== null) {
            if (!result.currency || result.currency !== searchState.currency) {
                return false;
            }
        }
        if (searchState.priceMax !== null && result.price !== null && result.price > this.maxAllowedPrice(searchState)) {
            return false;
        }
        if (searchState.priceMin !== null && result.price !== null && result.price < this.minAllowedPrice(searchState)) {
            return false;
        }
        if ((searchState.roomsAnyOf ?? []).length > 0 && result.rooms !== null && !searchState.roomsAnyOf.includes(result.rooms)) {
            return false;
        }
        if (searchState.rooms !== null && result.rooms !== null && result.rooms !== searchState.rooms) {
            return false;
        }
        if (searchState.locations.length > 0) {
            const normalizedLocation = this.normalizeLocation(result);
            if (normalizedLocation && !searchState.locations.some((location) => normalizedLocation.includes(location.toLowerCase()))) {
                return false;
            }
        }
        const geoConstraints = searchState.geoConstraints ?? [];
        if (geoConstraints.length > 0) {
            return geoConstraints.every((constraint) => this.passesGeoConstraint(constraint, result));
        }
        return true;
    }
    computeReasonDetails(searchState, result) {
        const locationScore = this.computeLocationScore(searchState, result);
        const budgetScore = this.computeBudgetScore(searchState, result);
        const propertyTypeScore = this.computePropertyTypeScore(searchState, result);
        const roomsScore = this.computeRoomsScore(searchState, result.rooms);
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
        if ((searchState.geoConstraints ?? []).length > 0) {
            return this.computeGeoConstraintScore(searchState, result);
        }
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
    passesGeoConstraint(constraint, result) {
        if (this.isClearlyOutsideAdministrativeConstraint(constraint, result)) {
            return false;
        }
        if (constraint.kind === 'PROXIMITY' &&
            constraint.latitude !== null &&
            constraint.longitude !== null &&
            result.geo &&
            (result.geo.precision === 'exact' || result.geo.precision === 'street')) {
            const radius = constraint.radiusMeters ?? 1000;
            return this.distanceMeters(constraint.latitude, constraint.longitude, result.geo.latitude, result.geo.longitude) <= radius;
        }
        return true;
    }
    isClearlyOutsideAdministrativeConstraint(constraint, result) {
        const resultLocation = this.normalizeLocation(result);
        const resultAdmin = this.normalizeAdminText(`${result.province ?? ''} ${result.city ?? ''} ${resultLocation}`);
        const expectedProvince = this.normalizeAdminText(constraint.province ?? '');
        const expectedCity = this.normalizeAdminText(constraint.city ?? '');
        const expectedNeighborhood = this.normalizeAdminText(constraint.neighborhood ?? '');
        if ((expectedProvince === 'caba' || expectedCity === 'caba') && /\bcordoba\b/.test(resultAdmin)) {
            return true;
        }
        if ((expectedProvince === 'caba' || expectedCity === 'caba') && result.city) {
            const resultCity = this.normalizeAdminText(result.city);
            if (resultCity !== 'caba' && resultCity !== 'capital federal' && resultCity !== 'ciudad autonoma de buenos aires') {
                return true;
            }
        }
        if (expectedNeighborhood && result.neighborhood) {
            const resultNeighborhood = this.normalizeAdminText(result.neighborhood);
            if (resultNeighborhood !== expectedNeighborhood && !resultAdmin.includes(expectedNeighborhood)) {
                return true;
            }
        }
        return false;
    }
    computeGeoConstraintScore(searchState, result) {
        const scores = (searchState.geoConstraints ?? []).map((constraint) => this.computeSingleGeoConstraintScore(constraint, result));
        return scores.length > 0 ? Math.max(...scores) : 1;
    }
    computeSingleGeoConstraintScore(constraint, result) {
        if (!this.passesGeoConstraint(constraint, result)) {
            return 0;
        }
        if (constraint.kind === 'PROXIMITY' &&
            constraint.latitude !== null &&
            constraint.longitude !== null &&
            result.geo) {
            if (result.geo.precision === 'exact' || result.geo.precision === 'street') {
                const distance = this.distanceMeters(constraint.latitude, constraint.longitude, result.geo.latitude, result.geo.longitude);
                const radius = constraint.radiusMeters ?? 1000;
                if (distance <= radius * 0.5)
                    return 1;
                if (distance <= radius)
                    return 0.85;
                if (distance <= radius * 1.5)
                    return 0.35;
                return 0;
            }
            if (this.matchesConstraintNeighborhood(constraint, result)) {
                return 0.55;
            }
        }
        if (this.matchesConstraintNeighborhood(constraint, result)) {
            return 0.75;
        }
        return 0.35;
    }
    matchesConstraintNeighborhood(constraint, result) {
        const expectedNeighborhood = this.normalizeAdminText(constraint.neighborhood ?? '');
        if (!expectedNeighborhood) {
            return false;
        }
        return this.normalizeLocation(result).includes(expectedNeighborhood);
    }
    computeBudgetScore(searchState, result) {
        if (searchState.currency && result.price !== null && result.currency !== searchState.currency) {
            return 0;
        }
        if (result.price === null) {
            return searchState.priceMin !== null || searchState.priceMax !== null ? 0.15 : 0.3;
        }
        if (searchState.priceMin === null && searchState.priceMax === null) {
            return 1;
        }
        if ((searchState.priceMin === null || result.price >= searchState.priceMin) &&
            (searchState.priceMax === null || result.price <= searchState.priceMax)) {
            return this.computeWithinBudgetScore(searchState, result.price);
        }
        if (searchState.priceMax !== null) {
            return this.computeOverBudgetScore(searchState, result.price);
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
    computeRoomsScore(searchState, actual) {
        const roomsAnyOf = searchState.roomsAnyOf ?? [];
        if (roomsAnyOf.length === 0) {
            return this.computeDiscreteScore(searchState.rooms, actual);
        }
        if (actual === null) {
            return 0.35;
        }
        return roomsAnyOf.includes(actual) ? 1 : 0;
    }
    maxAllowedPrice(searchState) {
        const priceMax = searchState.priceMax ?? Number.POSITIVE_INFINITY;
        if (searchState.operation === 'RENT' && searchState.currency === 'ARS') {
            return priceMax + 150000;
        }
        return priceMax * 1.05;
    }
    computeWithinBudgetScore(searchState, price) {
        if (searchState.priceMax === null) {
            return 1;
        }
        const ratio = price / searchState.priceMax;
        if (searchState.operation === 'RENT' && searchState.currency === 'ARS') {
            if (ratio <= 0.85) {
                return 1;
            }
            return Number(Math.max(0.85, 1 - (ratio - 0.85)).toFixed(2));
        }
        if (ratio <= 0.95) {
            return 1;
        }
        return 0.9;
    }
    computeOverBudgetScore(searchState, price) {
        if (searchState.priceMax === null) {
            return 0.3;
        }
        if (searchState.operation === 'RENT' && searchState.currency === 'ARS') {
            const overflowAmount = price - searchState.priceMax;
            if (overflowAmount <= 0) {
                return 1;
            }
            if (overflowAmount <= 50000) {
                return 0.65;
            }
            if (overflowAmount <= 100000) {
                return 0.45;
            }
            if (overflowAmount <= 150000) {
                return 0.25;
            }
            return 0;
        }
        const overflow = (price - searchState.priceMax) / searchState.priceMax;
        if (overflow <= 0.05)
            return 0.7;
        if (overflow <= 0.15)
            return 0.3;
        return 0;
    }
    minAllowedPrice(searchState) {
        const priceMin = searchState.priceMin ?? 0;
        return priceMin * 0.95;
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
        return `${result.neighborhood ?? ''} ${result.city ?? ''} ${result.province ?? ''} ${result.locationText ?? ''}`
            .trim()
            .toLowerCase();
    }
    normalizeAdminText(value) {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }
    distanceMeters(latA, lonA, latB, lonB) {
        const earthRadiusMeters = 6371000;
        const deltaLat = this.toRadians(latB - latA);
        const deltaLon = this.toRadians(lonB - lonA);
        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(this.toRadians(latA)) *
                Math.cos(this.toRadians(latB)) *
                Math.sin(deltaLon / 2) *
                Math.sin(deltaLon / 2);
        return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    toRadians(value) {
        return (value * Math.PI) / 180;
    }
    compareRankedResults(searchState, left, right) {
        if (searchState.sortPreference === 'PRICE_ASC') {
            const priceComparison = this.comparePriceAsc(left, right);
            if (priceComparison !== 0) {
                return priceComparison;
            }
        }
        if (searchState.sortPreference === 'PRICE_DESC') {
            const priceComparison = this.comparePriceDesc(left, right);
            if (priceComparison !== 0) {
                return priceComparison;
            }
        }
        const scoreComparison = right.rank.score - left.rank.score;
        if (scoreComparison !== 0) {
            return scoreComparison;
        }
        return this.comparePriceAsc(left, right);
    }
    comparePriceAsc(left, right) {
        if (left.price === null && right.price === null) {
            return 0;
        }
        if (left.price === null) {
            return 1;
        }
        if (right.price === null) {
            return -1;
        }
        return left.price - right.price;
    }
    comparePriceDesc(left, right) {
        if (left.price === null && right.price === null) {
            return 0;
        }
        if (left.price === null) {
            return 1;
        }
        if (right.price === null) {
            return -1;
        }
        return right.price - left.price;
    }
};
exports.SearchRankingService = SearchRankingService;
exports.SearchRankingService = SearchRankingService = __decorate([
    (0, common_1.Injectable)()
], SearchRankingService);
