import { Injectable } from '@nestjs/common';
import { SearchResultItem } from '../../domain/types/search-result.type';

type SearchCandidate = Omit<SearchResultItem, 'rank'>;

@Injectable()
export class SearchDedupeService {
  dedupe(results: SearchCandidate[]) {
    const deduped: SearchCandidate[] = [];

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

  private areDuplicates(left: SearchCandidate, right: SearchCandidate) {
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

  private isStrongCrossSourceMatch(left: SearchCandidate, right: SearchCandidate) {
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

  private pickRepresentative(left: SearchCandidate, right: SearchCandidate) {
    return this.computeCompletenessScore(right) > this.computeCompletenessScore(left) ? right : left;
  }

  private computeCompletenessScore(result: SearchCandidate) {
    let score = 0;

    if (result.price !== null && result.currency) score += 2;
    if (result.images.length > 0) score += 2;
    if (result.neighborhood || result.city) score += 1;
    if (result.propertyType) score += 1;
    if (result.rooms !== null) score += 1;
    if (result.areaTotal !== null || result.areaCovered !== null) score += 1;
    if (result.description) score += 1;

    const scrapedAt = Date.parse(result.scrapedAt);
    if (!Number.isNaN(scrapedAt)) {
      score += scrapedAt / 1_000_000_000_000;
    }

    return score;
  }

  private buildCanonicalFingerprint(result: SearchCandidate) {
    const title = this.normalizeTitle(result.title);
    const propertyType = result.propertyType ?? 'UNKNOWN';
    const neighborhood = this.normalizeLocation(result) ?? '';
    const price = this.normalizeComparablePrice(result.price) ?? 0;
    const area = this.normalizeComparableArea(result) ?? 0;

    return `${propertyType}::${neighborhood}::${price}::${area}::${title}`;
  }

  private normalizeLocation(result: SearchCandidate) {
    const rawLocation = result.neighborhood ?? result.locationText ?? result.city ?? '';
    const normalized = rawLocation.trim().toLowerCase().replace(/\s+/g, ' ');
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeComparablePrice(price: number | null) {
    if (price === null) {
      return null;
    }

    return Math.round(price / 5000) * 5000;
  }

  private normalizeComparableArea(result: SearchCandidate) {
    const area = result.areaTotal ?? result.areaCovered;

    if (area === null) {
      return null;
    }

    return Math.round(area);
  }

  private normalizeTitle(title: string) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private computeTitleSimilarity(leftTitle: string, rightTitle: string) {
    const leftTokens = new Set(this.normalizeTitle(leftTitle).split(' ').filter((token) => token.length > 2));
    const rightTokens = new Set(this.normalizeTitle(rightTitle).split(' ').filter((token) => token.length > 2));

    if (leftTokens.size === 0 || rightTokens.size === 0) {
      return 0;
    }

    const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
    const union = new Set([...leftTokens, ...rightTokens]).size;

    return intersection / union;
  }
}
