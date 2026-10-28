import { Injectable, NotFoundException } from '@nestjs/common';
import { ListingStatus, SearchRunStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';

@Injectable()
export class AdminOverviewService {
  private static readonly OPERATIONAL_CACHE_PREFIXES = [
    'search:results:',
    'search:google:discovery:',
    'search:discovery:',
    'search:html:',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getOverview() {
    const [usersCount, conversationsCount, searchRunsCount, propertiesCacheCount, favoritesCount, leadsCount, blogArticlesCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.conversation.count(),
      this.prisma.searchRun.count(),
      this.prisma.propertyCache.count(),
      this.prisma.favorite.count(),
      this.prisma.lead.count(),
      this.prisma.blogArticle.count(),
    ]);

    return {
      usersCount,
      conversationsCount,
      searchRunsCount,
      propertiesCacheCount,
      favoritesCount,
      leadsCount,
      blogArticlesCount,
    };
  }

  async getMetrics() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [overview, usersLast7d, conversationsLast7d, searchRunsLast7d, favoritesLast7d, searchRunStatus, listingStatus, propertiesBySource] =
      await Promise.all([
        this.getOverview(),
        this.prisma.user.count({
          where: {
            createdAt: {
              gte: since,
            },
          },
        }),
        this.prisma.conversation.count({
          where: {
            createdAt: {
              gte: since,
            },
          },
        }),
        this.prisma.searchRun.count({
          where: {
            createdAt: {
              gte: since,
            },
          },
        }),
        this.prisma.favorite.count({
          where: {
            createdAt: {
              gte: since,
            },
          },
        }),
        Promise.all(
          Object.values(SearchRunStatus).map(async (status) => ({
            status,
            count: await this.prisma.searchRun.count({ where: { status } }),
          })),
        ),
        Promise.all(
          Object.values(ListingStatus).map(async (status) => ({
            status,
            count: await this.prisma.propertyCache.count({ where: { listingStatus: status } }),
          })),
        ),
        this.prisma.propertyCache.groupBy({
          by: ['source'],
          _count: {
            source: true,
          },
          orderBy: {
            _count: {
              source: 'desc',
            },
          },
          take: 10,
        }),
      ]);

    return {
      overview,
      activityLast7d: {
        users: usersLast7d,
        conversations: conversationsLast7d,
        searchRuns: searchRunsLast7d,
        favorites: favoritesLast7d,
      },
      searchRunsByStatus: searchRunStatus,
      propertiesByListingStatus: listingStatus,
      topPropertySources: propertiesBySource.map((item) => ({
        source: item.source,
        count: item._count.source,
      })),
    };
  }

  async listUsers(page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          role: true,
          emailVerifiedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              conversations: true,
              favorites: true,
              refreshTokens: true,
            },
          },
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        email: item.email,
        role: item.role,
        emailVerifiedAt: item.emailVerifiedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        conversationsCount: item._count.conversations,
        favoritesCount: item._count.favorites,
        refreshTokensCount: item._count.refreshTokens,
      })),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async listConversations(page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        orderBy: {
          updatedAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          lastSearchAt: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
          _count: {
            select: {
              messages: true,
              searchRuns: true,
            },
          },
        },
      }),
      this.prisma.conversation.count(),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        lastSearchAt: item.lastSearchAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        user: item.user,
        messagesCount: item._count.messages,
        searchRunsCount: item._count.searchRuns,
      })),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async listSearchRuns(page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.searchRun.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          queryText: true,
          status: true,
          resultCount: true,
          createdAt: true,
          conversation: {
            select: {
              id: true,
              title: true,
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.searchRun.count(),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        queryText: item.queryText,
        status: item.status,
        resultCount: item.resultCount,
        createdAt: item.createdAt,
        conversation: item.conversation,
      })),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async listProperties(page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.propertyCache.findMany({
        orderBy: {
          scrapedAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          source: true,
          sourceUrl: true,
          title: true,
          operation: true,
          propertyType: true,
          listingStatus: true,
          city: true,
          neighborhood: true,
          priceAmount: true,
          priceCurrency: true,
          scrapedAt: true,
          createdAt: true,
          _count: {
            select: {
              favorites: true,
              searchRunProperties: true,
            },
          },
        },
      }),
      this.prisma.propertyCache.count(),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        source: item.source,
        sourceUrl: item.sourceUrl,
        title: item.title,
        operation: item.operation,
        propertyType: item.propertyType,
        listingStatus: item.listingStatus,
        city: item.city,
        neighborhood: item.neighborhood,
        price: item.priceAmount === null ? null : Number(item.priceAmount),
        currency: item.priceCurrency,
        scrapedAt: item.scrapedAt,
        createdAt: item.createdAt,
        favoritesCount: item._count.favorites,
        appearancesCount: item._count.searchRunProperties,
      })),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async listLeads(page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.lead.count(),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async listScrapingSources(page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.scrapingSourceStatus.findMany({
        orderBy: {
          source: 'asc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.scrapingSourceStatus.count(),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async updateUserRole(userId: string, role: UserRole) {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { role },
        select: {
          id: true,
          email: true,
          role: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      if (this.isPrismaNotFound(error)) {
        throw new NotFoundException('User not found');
      }

      throw error;
    }
  }

  async getConversationDetail(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        title: true,
        status: true,
        lastSearchAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        searchState: {
          select: {
            filtersJson: true,
            version: true,
            updatedAt: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
        searchRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            queryText: true,
            status: true,
            resultCount: true,
            createdAt: true,
            filtersSnapshotJson: true,
            sourcesUsedJson: true,
            results: {
              orderBy: { position: 'asc' },
              take: 10,
              select: {
                position: true,
                rankScore: true,
                rankReasonJson: true,
                propertyCache: {
                  select: {
                    id: true,
                    title: true,
                    source: true,
                    sourceUrl: true,
                    city: true,
                    neighborhood: true,
                    locationText: true,
                    priceAmount: true,
                    priceCurrency: true,
                    scrapedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const lastSearchRun = conversation.searchRuns[0] ?? null;

    return {
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      lastSearchAt: conversation.lastSearchAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      user: conversation.user,
      searchState: conversation.searchState
        ? {
            filters: conversation.searchState.filtersJson,
            version: conversation.searchState.version,
            updatedAt: conversation.searchState.updatedAt,
          }
        : null,
      messages: conversation.messages,
      lastSearchRun: lastSearchRun
        ? {
            id: lastSearchRun.id,
            queryText: lastSearchRun.queryText,
            status: lastSearchRun.status,
            resultCount: lastSearchRun.resultCount,
            createdAt: lastSearchRun.createdAt,
            filtersSnapshot: lastSearchRun.filtersSnapshotJson,
            sourcesUsed: this.parseStringArray(lastSearchRun.sourcesUsedJson),
          }
        : null,
      lastSearchResults:
        lastSearchRun?.results.map((item) => ({
          position: item.position,
          rankScore: Number(item.rankScore),
          rankReasons: this.parseStringArray(item.rankReasonJson),
          property: {
            id: item.propertyCache.id,
            title: item.propertyCache.title,
            source: item.propertyCache.source,
            sourceUrl: item.propertyCache.sourceUrl,
            city: item.propertyCache.city,
            neighborhood: item.propertyCache.neighborhood,
            locationText: item.propertyCache.locationText,
            price: item.propertyCache.priceAmount === null ? null : Number(item.propertyCache.priceAmount),
            currency: item.propertyCache.priceCurrency,
            scrapedAt: item.propertyCache.scrapedAt,
          },
        })) ?? [],
    };
  }

  async getSearchRunDetail(searchRunId: string) {
    const searchRun = await this.prisma.searchRun.findUnique({
      where: { id: searchRunId },
      select: {
        id: true,
        queryText: true,
        status: true,
        resultCount: true,
        errorSummary: true,
        createdAt: true,
        filtersSnapshotJson: true,
        sourcesUsedJson: true,
        conversation: {
          select: {
            id: true,
            title: true,
            user: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
        },
        results: {
          orderBy: { position: 'asc' },
          select: {
            position: true,
            rankScore: true,
            rankReasonJson: true,
            propertyCache: {
              select: {
                id: true,
                title: true,
                source: true,
                sourceUrl: true,
                city: true,
                neighborhood: true,
                locationText: true,
                priceAmount: true,
                priceCurrency: true,
                listingStatus: true,
                scrapedAt: true,
              },
            },
          },
        },
      },
    });

    if (!searchRun) {
      throw new NotFoundException('Search run not found');
    }

    return {
      id: searchRun.id,
      queryText: searchRun.queryText,
      status: searchRun.status,
      resultCount: searchRun.resultCount,
      errorSummary: searchRun.errorSummary,
      createdAt: searchRun.createdAt,
      filtersSnapshot: searchRun.filtersSnapshotJson,
      sourcesUsed: this.parseStringArray(searchRun.sourcesUsedJson),
      conversation: searchRun.conversation,
      results: searchRun.results.map((item) => ({
        position: item.position,
        rankScore: Number(item.rankScore),
        rankReasons: this.parseStringArray(item.rankReasonJson),
        property: {
          id: item.propertyCache.id,
          title: item.propertyCache.title,
          source: item.propertyCache.source,
          sourceUrl: item.propertyCache.sourceUrl,
          city: item.propertyCache.city,
          neighborhood: item.propertyCache.neighborhood,
          locationText: item.propertyCache.locationText,
          price: item.propertyCache.priceAmount === null ? null : Number(item.propertyCache.priceAmount),
          currency: item.propertyCache.priceCurrency,
          listingStatus: item.propertyCache.listingStatus,
          scrapedAt: item.propertyCache.scrapedAt,
        },
      })),
    };
  }

  async invalidateOperationalCaches() {
    const result = await this.redisService.deleteByPrefixes(AdminOverviewService.OPERATIONAL_CACHE_PREFIXES);

    return {
      prefixes: AdminOverviewService.OPERATIONAL_CACHE_PREFIXES,
      redisAvailable: result.available,
      matchedKeys: result.matchedKeys,
      deletedKeys: result.deletedKeys,
    };
  }

  private parseStringArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private isPrismaNotFound(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2025'
    );
  }
}
