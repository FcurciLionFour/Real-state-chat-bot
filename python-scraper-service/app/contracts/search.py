from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


SourceName = Literal["zonaprop", "argenprop", "properati", "mudafy"]
DiscoveryProviderName = Literal["google", "portal-native"]
OperationType = Literal["buy", "rent"]


class SearchFilters(BaseModel):
    operation: OperationType | None = None
    propertyType: str | None = None
    locations: list[str] = Field(default_factory=list)
    priceMin: int | None = None
    priceMax: int | None = None
    currency: str | None = None
    rooms: int | None = None
    roomsAnyOf: list[int] = Field(default_factory=list)
    bedrooms: int | None = None
    bathrooms: int | None = None
    features: list[str] = Field(default_factory=list)
    areaMin: int | None = None
    areaMax: int | None = None


class DiscoveryOptions(BaseModel):
    providers: list[DiscoveryProviderName] = Field(default_factory=lambda: ["portal-native"])
    allowDomains: list[str] = Field(default_factory=list)
    maxCandidateUrls: int = 40


class ExecutionOptions(BaseModel):
    limitPerSource: int = 10
    timeoutMs: int = 12000
    preferDetailPages: bool = True
    allowBrowserFallback: bool = False


class SearchRequest(BaseModel):
    requestId: str
    conversationId: str | None = None
    searchRunId: str | None = None
    filters: SearchFilters
    sources: list[SourceName] = Field(default_factory=list)
    discovery: DiscoveryOptions = Field(default_factory=DiscoveryOptions)
    execution: ExecutionOptions = Field(default_factory=ExecutionOptions)


class ListingSourceEntry(BaseModel):
    source: SourceName
    sourceUrl: str
    externalId: str | None = None


class PropertyListing(BaseModel):
    externalId: str | None = None
    source: SourceName
    sourceUrl: str
    publisher: str | None = None
    contactPhone: str | None = None
    contactWhatsApp: str | None = None
    title: str
    description: str | None = None
    operation: OperationType | None = None
    propertyType: str | None = None
    price: int | None = None
    currency: str | None = None
    expenses: int | None = None
    locationText: str | None = None
    city: str | None = None
    neighborhood: str | None = None
    rooms: int | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    areaTotal: int | None = None
    areaCovered: int | None = None
    features: list[str] = Field(default_factory=list)
    images: list[str] = Field(default_factory=list)
    latitude: float | None = None
    longitude: float | None = None
    sourceEntries: list[ListingSourceEntry] = Field(default_factory=list)
    duplicateGroupId: str | None = None
    duplicateCount: int = 1
    publishedAt: str | None = None
    scrapedAt: str


class PartialFailure(BaseModel):
    source: SourceName | str
    stage: str
    reason: str


class SearchMeta(BaseModel):
    sourcesRequested: list[str]
    sourcesUsed: list[str]
    discoveryProvidersUsed: list[str]
    candidateUrlsFound: int = 0
    candidateUrlsProcessed: int = 0
    detailPagesAccepted: int = 0
    rawItemsBeforeDedupe: int = 0
    duplicatesCollapsed: int = 0
    itemsReturned: int = 0
    durationsMs: dict[str, int] = Field(default_factory=dict)
    partialFailures: list[PartialFailure] = Field(default_factory=list)
    stubMode: bool = True


class SearchResponse(BaseModel):
    items: list[PropertyListing] = Field(default_factory=list)
    meta: SearchMeta


class ExtractUrlRequest(BaseModel):
    url: str
    sourceHint: str | None = None
    allowBrowserFallback: bool = False


class ExtractUrlResponse(BaseModel):
    item: PropertyListing | None = None
    meta: dict[str, object] = Field(default_factory=dict)
