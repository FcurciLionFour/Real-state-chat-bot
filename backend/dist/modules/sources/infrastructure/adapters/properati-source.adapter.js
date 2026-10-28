"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProperatiSourceAdapter = void 0;
const common_1 = require("@nestjs/common");
let ProperatiSourceAdapter = class ProperatiSourceAdapter {
    sourceName = 'properati';
    canHandle(url) {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.hostname === 'www.properati.com.ar' || parsedUrl.hostname.endsWith('.properati.com.ar');
        }
        catch {
            return false;
        }
    }
    isDetailUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return /-properati-[a-z0-9]+$/i.test(parsedUrl.pathname.toLowerCase());
        }
        catch {
            return false;
        }
    }
    async extract(url, html) {
        const metadata = this.extractMetadata(html);
        const jsonLd = this.extractJsonLdPayload(html);
        const scrapedAt = new Date().toISOString();
        const title = metadata.title ?? this.extractString(jsonLd, ['name', 'headline']);
        if (!title) {
            return null;
        }
        const description = metadata.description ?? this.extractString(jsonLd, ['description']);
        const price = metadata.price ?? this.extractNumber(jsonLd, ['offers.price', 'price']);
        const currency = metadata.currency ?? this.normalizeCurrency(this.extractString(jsonLd, ['offers.priceCurrency', 'priceCurrency']));
        const locationText = metadata.locationText ??
            this.extractLocationText(jsonLd) ??
            this.extractLocationFromTitle(title) ??
            this.extractString(jsonLd, ['address.streetAddress']);
        const neighborhood = this.extractNeighborhood(locationText, title);
        const city = this.extractCity(locationText, title);
        const operation = this.detectOperation(`${title} ${description ?? ''} ${url}`);
        const propertyType = this.detectPropertyType(`${title} ${description ?? ''} ${url}`);
        const images = this.extractImages(metadata.images, jsonLd);
        const features = this.detectFeatures(`${title} ${description ?? ''} ${html}`);
        return {
            externalId: this.extractExternalId(url),
            source: this.sourceName,
            sourceUrl: url,
            title,
            description,
            operation,
            propertyType,
            price,
            currency,
            expenses: this.extractExpenses(`${title} ${description ?? ''} ${html}`),
            country: 'Argentina',
            province: this.detectProvince(locationText, title),
            city,
            neighborhood,
            locationText,
            rooms: metadata.rooms ?? this.extractNumber(jsonLd, ['numberOfRooms', 'numberOfBedrooms']) ?? this.extractRooms(title),
            bedrooms: metadata.bedrooms ?? this.extractNumber(jsonLd, ['numberOfBedrooms']),
            bathrooms: metadata.bathrooms ?? this.extractNumber(jsonLd, ['numberOfBathroomsTotal']),
            areaTotal: metadata.areaTotal ?? this.extractNumber(jsonLd, ['floorSize.value']),
            areaCovered: metadata.areaCovered ?? this.extractCoveredArea(html),
            features,
            images,
            publishedAt: metadata.publishedAt ?? this.extractString(jsonLd, ['datePublished']),
            scrapedAt,
        };
    }
    extractMetadata(html) {
        return {
            title: this.findMetaContent(html, 'og:title') ?? this.extractTitleTag(html),
            description: this.findMetaContent(html, 'og:description') ?? this.findMetaContent(html, 'description'),
            price: this.parseNumber(this.findMetaContent(html, 'product:price:amount') ?? this.findMetaContent(html, 'og:price:amount')),
            currency: this.normalizeCurrency(this.findMetaContent(html, 'product:price:currency') ?? this.findMetaContent(html, 'og:price:currency')),
            locationText: this.findMetaContent(html, 'og:locality') ??
                this.findMetaContent(html, 'twitter:data1') ??
                this.findMetaContent(html, 'geo.position'),
            publishedAt: this.findMetaContent(html, 'article:published_time'),
            rooms: this.extractRooms(html),
            bedrooms: this.parseNumber(this.findMetaContent(html, 'twitter:data2')),
            bathrooms: this.extractBathrooms(html),
            areaTotal: this.extractArea(html),
            areaCovered: this.extractCoveredArea(html),
            images: this.collectMetaImages(html),
        };
    }
    extractJsonLdPayload(html) {
        const scripts = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
        for (const script of scripts) {
            const rawContent = script[1]?.trim();
            if (!rawContent) {
                continue;
            }
            try {
                const parsed = JSON.parse(rawContent);
                const flattened = this.flattenJsonLd(parsed);
                const candidate = flattened.find((item) => this.looksLikePropertyMetadata(item));
                if (candidate) {
                    return candidate;
                }
            }
            catch {
                continue;
            }
        }
        return null;
    }
    flattenJsonLd(payload) {
        if (!payload) {
            return [];
        }
        if (Array.isArray(payload)) {
            return payload.flatMap((item) => this.flattenJsonLd(item));
        }
        if (typeof payload !== 'object') {
            return [];
        }
        const objectPayload = payload;
        const graphItems = Array.isArray(objectPayload['@graph']) ? objectPayload['@graph'] : [];
        return [objectPayload, ...graphItems.flatMap((item) => this.flattenJsonLd(item))];
    }
    looksLikePropertyMetadata(payload) {
        const type = String(payload['@type'] ?? '').toLowerCase();
        return (type.includes('product') ||
            type.includes('offer') ||
            type.includes('residence') ||
            type.includes('apartment') ||
            type.includes('house') ||
            Boolean(payload['offers']) ||
            Boolean(payload['address']));
    }
    extractString(payload, paths) {
        for (const path of paths) {
            const value = this.getNestedValue(payload, path);
            if (typeof value === 'string' && value.trim().length > 0) {
                return this.cleanText(value);
            }
        }
        return null;
    }
    extractNumber(payload, paths) {
        for (const path of paths) {
            const value = this.getNestedValue(payload, path);
            const parsed = this.parseNumber(value);
            if (parsed !== null) {
                return parsed;
            }
        }
        return null;
    }
    getNestedValue(payload, path) {
        if (!payload) {
            return null;
        }
        return path.split('.').reduce((current, key) => {
            if (!current || typeof current !== 'object') {
                return null;
            }
            return current[key] ?? null;
        }, payload);
    }
    findMetaContent(html, property) {
        const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patterns = [
            new RegExp(`<meta[^>]+property=["']${escapedProperty}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
            new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapedProperty}["'][^>]*>`, 'i'),
            new RegExp(`<meta[^>]+name=["']${escapedProperty}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
            new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapedProperty}["'][^>]*>`, 'i'),
        ];
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match?.[1]) {
                return this.cleanText(match[1]);
            }
        }
        return null;
    }
    extractTitleTag(html) {
        const match = html.match(/<title>([\s\S]*?)<\/title>/i);
        return match?.[1] ? this.cleanText(match[1]) : null;
    }
    collectMetaImages(html) {
        return Array.from(html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi))
            .map((match) => match[1]?.trim())
            .filter((value) => Boolean(value));
    }
    extractImages(metaImages, payload) {
        const jsonLdImage = this.getNestedValue(payload, 'image');
        const imagesFromJsonLd = Array.isArray(jsonLdImage)
            ? jsonLdImage.filter((item) => typeof item === 'string')
            : typeof jsonLdImage === 'string'
                ? [jsonLdImage]
                : [];
        return Array.from(new Set([...metaImages, ...imagesFromJsonLd])).slice(0, 10);
    }
    extractLocationText(payload) {
        const address = this.getNestedValue(payload, 'address');
        if (typeof address === 'string') {
            return this.cleanText(address);
        }
        if (!address || typeof address !== 'object') {
            return null;
        }
        const addressObject = address;
        const parts = [
            addressObject.streetAddress,
            addressObject.addressLocality,
            addressObject.addressRegion,
            addressObject.addressCountry,
        ]
            .filter((value) => typeof value === 'string' && value.trim().length > 0)
            .map((value) => this.cleanText(value));
        return parts.length > 0 ? parts.join(', ') : null;
    }
    extractLocationFromTitle(title) {
        const match = title.match(/\ben\s+([^-|]+)/i);
        return match?.[1] ? this.cleanText(match[1]) : null;
    }
    extractNeighborhood(locationText, title) {
        const source = locationText ?? title;
        const normalized = source.toLowerCase();
        const knownNeighborhoods = [
            'palermo',
            'caballito',
            'belgrano',
            'almagro',
            'recoleta',
            'villa crespo',
            'nunez',
            'colegiales',
            'puerto madero',
            'san telmo',
        ];
        const match = knownNeighborhoods.find((candidate) => normalized.includes(candidate));
        return match ? this.capitalizeWords(match) : null;
    }
    extractCity(locationText, title) {
        const source = `${locationText ?? ''} ${title}`.toLowerCase();
        if (source.includes('capital federal') || source.includes('caba') || source.includes('ciudad de buenos aires')) {
            return 'CABA';
        }
        if (source.includes('buenos aires')) {
            return 'Buenos Aires';
        }
        return null;
    }
    detectProvince(locationText, title) {
        const city = this.extractCity(locationText, title);
        return city === 'CABA' ? 'CABA' : null;
    }
    detectOperation(text) {
        const normalized = text.toLowerCase();
        if (normalized.includes('venta') || normalized.includes('/venta-') || normalized.includes('comprar')) {
            return 'BUY';
        }
        if (normalized.includes('alquiler') || normalized.includes('/alquiler-') || normalized.includes('renta')) {
            return 'RENT';
        }
        return null;
    }
    detectPropertyType(text) {
        const normalized = text.toLowerCase();
        if (normalized.includes('departamento'))
            return 'APARTMENT';
        if (normalized.includes('casa'))
            return 'HOUSE';
        if (normalized.includes(' ph ') || normalized.includes(' p.h'))
            return 'PH';
        if (normalized.includes('terreno') || normalized.includes('lote'))
            return 'LAND';
        if (normalized.includes('oficina'))
            return 'OFFICE';
        if (normalized.includes('local'))
            return 'LOCAL';
        if (normalized.includes('cochera'))
            return 'GARAGE';
        return null;
    }
    detectFeatures(text) {
        const normalized = text.toLowerCase();
        const matches = [];
        const catalog = [
            ['BALCONY', ['balcon']],
            ['TERRACE', ['terraza']],
            ['PATIO', ['patio']],
            ['GARAGE', ['cochera']],
            ['POOL', ['pileta', 'piscina']],
            ['BARBECUE', ['parrilla', 'barbecue']],
            ['GYM', ['gimnasio', 'gym']],
            ['PROFESSIONAL_USE', ['apto profesional']],
            ['MORTGAGE_ELIGIBLE', ['apto credito']],
            ['FURNISHED', ['amoblado', 'amueblado']],
            ['PETS_ALLOWED', ['mascotas', 'pets allowed']],
        ];
        for (const [feature, tokens] of catalog) {
            if (tokens.some((token) => normalized.includes(token))) {
                matches.push(feature);
            }
        }
        return matches;
    }
    extractExpenses(text) {
        const match = text.match(/expensas[^0-9]*(\d[\d\.\,]*)/i);
        return match ? this.parseNumber(match[1]) : null;
    }
    extractRooms(text) {
        const match = text.match(/(\d+)\s+ambientes?/i);
        return match ? this.parseNumber(match[1]) : null;
    }
    extractBathrooms(text) {
        const match = text.match(/(\d+)\s+banos?/i);
        return match ? this.parseNumber(match[1]) : null;
    }
    extractArea(text) {
        const match = text.match(/(\d[\d\.\,]*)\s*m2/i);
        return match ? this.parseNumber(match[1]) : null;
    }
    extractCoveredArea(text) {
        const match = text.match(/cubiertos?[^0-9]*(\d[\d\.\,]*)\s*m2|(\d[\d\.\,]*)\s*m2[^a-zA-Z]*cubiertos?/i);
        return match ? this.parseNumber(match[1] ?? match[2]) : null;
    }
    extractExternalId(url) {
        const match = url.match(/\/([a-z0-9-]+)$/i);
        return match?.[1] ?? null;
    }
    normalizeCurrency(value) {
        if (!value) {
            return null;
        }
        const normalized = value.toUpperCase();
        if (normalized.includes('USD') || normalized.includes('U$S'))
            return 'USD';
        if (normalized.includes('ARS') || normalized.includes('$'))
            return 'ARS';
        return null;
    }
    parseNumber(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value !== 'string') {
            return null;
        }
        const cleaned = value.replace(/[^0-9,.-]/g, '').trim();
        if (!cleaned) {
            return null;
        }
        const normalized = cleaned.includes(',') && cleaned.includes('.')
            ? cleaned.replace(/\./g, '').replace(',', '.')
            : cleaned.replace(',', '.');
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }
    cleanText(value) {
        return value
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/\s+/g, ' ')
            .trim();
    }
    capitalizeWords(value) {
        return value
            .split(' ')
            .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
            .join(' ');
    }
};
exports.ProperatiSourceAdapter = ProperatiSourceAdapter;
exports.ProperatiSourceAdapter = ProperatiSourceAdapter = __decorate([
    (0, common_1.Injectable)()
], ProperatiSourceAdapter);
