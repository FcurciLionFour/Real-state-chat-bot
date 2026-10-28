import { Injectable } from '@nestjs/common';

@Injectable()
export class AllowedSourceDomainsService {
  private readonly allowedDomains = ['zonaprop.com.ar', 'argenprop.com', 'properati.com.ar', 'mudafy.com.ar'];

  getAllowedDomains() {
    return [...this.allowedDomains];
  }

  canUseUrl(rawUrl: string) {
    return this.normalizeUrl(rawUrl) !== null;
  }

  normalizeUrl(rawUrl: string) {
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
    } catch {
      return null;
    }
  }

  filterCandidateUrls(rawUrls: string[], totalLimit = 20, perDomainLimit = 5) {
    const seen = new Set<string>();
    const perDomainCounts = new Map<string, number>();
    const normalizedUrls: string[] = [];

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

  private findAllowedDomain(hostname: string) {
    return this.allowedDomains.find((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) ?? null;
  }
}
