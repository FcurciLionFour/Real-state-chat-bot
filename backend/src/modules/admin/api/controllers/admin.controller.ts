import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { AccessTokenGuard } from '../../../auth/presentation/guards/access-token.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { RateLimit } from '../../../../infrastructure/security/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../../../infrastructure/security/guards/rate-limit.guard';
import { AdminListQueryDto } from '../dto/admin-list-query.dto';
import { UpdateAdminUserRoleDto } from '../dto/update-admin-user-role.dto';
import { AdminOverviewService } from '../../application/services/admin-overview.service';

const ADMIN_RATE_LIMITS =
  process.env.NODE_ENV === 'production'
    ? {
        read: { limit: 120, windowSeconds: 60 },
        write: { limit: 20, windowSeconds: 60 },
      }
    : {
        read: { limit: 30, windowSeconds: 60 },
        write: { limit: 10, windowSeconds: 60 },
      };

@Controller('admin')
@UseGuards(AccessTokenGuard, RolesGuard, RateLimitGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminOverviewService: AdminOverviewService) {}

  @Get('overview')
  @RateLimit({
    namespace: 'admin-read',
    limit: ADMIN_RATE_LIMITS.read.limit,
    windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  getOverview() {
    return this.adminOverviewService.getOverview();
  }

  @Get('metrics')
  @RateLimit({
    namespace: 'admin-read',
    limit: ADMIN_RATE_LIMITS.read.limit,
    windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  getMetrics() {
    return this.adminOverviewService.getMetrics();
  }

  @Get('users')
  @RateLimit({
    namespace: 'admin-read',
    limit: ADMIN_RATE_LIMITS.read.limit,
    windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  listUsers(@Query() query: AdminListQueryDto) {
    return this.adminOverviewService.listUsers(query.page, query.limit);
  }

  @Patch('users/:id/role')
  @RateLimit({
    namespace: 'admin-write',
    limit: ADMIN_RATE_LIMITS.write.limit,
    windowSeconds: ADMIN_RATE_LIMITS.write.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  updateUserRole(@Param('id') userId: string, @Body() body: UpdateAdminUserRoleDto) {
    return this.adminOverviewService.updateUserRole(userId, body.role);
  }

  @Get('conversations')
  @RateLimit({
    namespace: 'admin-read',
    limit: ADMIN_RATE_LIMITS.read.limit,
    windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  listConversations(@Query() query: AdminListQueryDto) {
    return this.adminOverviewService.listConversations(query.page, query.limit);
  }

  @Get('conversations/:id')
  @RateLimit({
    namespace: 'admin-read',
    limit: ADMIN_RATE_LIMITS.read.limit,
    windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  getConversationDetail(@Param('id') conversationId: string) {
    return this.adminOverviewService.getConversationDetail(conversationId);
  }

  @Get('search-runs')
  @RateLimit({
    namespace: 'admin-read',
    limit: ADMIN_RATE_LIMITS.read.limit,
    windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  listSearchRuns(@Query() query: AdminListQueryDto) {
    return this.adminOverviewService.listSearchRuns(query.page, query.limit);
  }

  @Get('search-runs/:id')
  @RateLimit({
    namespace: 'admin-read',
    limit: ADMIN_RATE_LIMITS.read.limit,
    windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  getSearchRunDetail(@Param('id') searchRunId: string) {
    return this.adminOverviewService.getSearchRunDetail(searchRunId);
  }

  @Get('properties')
  @RateLimit({
    namespace: 'admin-read',
    limit: ADMIN_RATE_LIMITS.read.limit,
    windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  listProperties(@Query() query: AdminListQueryDto) {
    return this.adminOverviewService.listProperties(query.page, query.limit);
  }

  @Get('leads')
  @RateLimit({
    namespace: 'admin-read',
    limit: ADMIN_RATE_LIMITS.read.limit,
    windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  listLeads(@Query() query: AdminListQueryDto) {
    return this.adminOverviewService.listLeads(query.page, query.limit);
  }

  @Get('scraping-sources')
  @RateLimit({
    namespace: 'admin-read',
    limit: ADMIN_RATE_LIMITS.read.limit,
    windowSeconds: ADMIN_RATE_LIMITS.read.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  listScrapingSources(@Query() query: AdminListQueryDto) {
    return this.adminOverviewService.listScrapingSources(query.page, query.limit);
  }

  @Post('cache/invalidate')
  @RateLimit({
    namespace: 'admin-write',
    limit: ADMIN_RATE_LIMITS.write.limit,
    windowSeconds: ADMIN_RATE_LIMITS.write.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  invalidateOperationalCaches() {
    return this.adminOverviewService.invalidateOperationalCaches();
  }
}
