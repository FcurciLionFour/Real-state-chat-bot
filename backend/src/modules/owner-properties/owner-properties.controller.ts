import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OwnerPropertyStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/presentation/decorators/current-user.decorator';
import { Roles } from '../auth/presentation/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/domain/types/authenticated-user.type';
import { AccessTokenGuard } from '../auth/presentation/guards/access-token.guard';
import { RolesGuard } from '../auth/presentation/guards/roles.guard';
import { AdminListQueryDto } from '../admin/api/dto/admin-list-query.dto';
import { RateLimit } from '../../infrastructure/security/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../infrastructure/security/guards/rate-limit.guard';
import { CreateOwnerPropertyDto } from './api/dto/create-owner-property.dto';
import { ReviewOwnerPropertyDto } from './api/dto/review-owner-property.dto';
import { SubmitOwnerPropertyDto } from './api/dto/submit-owner-property.dto';
import { UpdateOwnerPropertyDto } from './api/dto/update-owner-property.dto';
import { OwnerPropertiesService } from './owner-properties.service';

const OWNER_RATE_LIMITS =
  process.env.NODE_ENV === 'production'
    ? {
        read: { limit: 120, windowSeconds: 60 },
        write: { limit: 30, windowSeconds: 60 },
      }
    : {
        read: { limit: 60, windowSeconds: 60 },
        write: { limit: 30, windowSeconds: 60 },
      };

@Controller('owner/properties')
@UseGuards(AccessTokenGuard, RolesGuard, RateLimitGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class OwnerPropertiesController {
  constructor(private readonly ownerPropertiesService: OwnerPropertiesService) {}

  @Post()
  @RateLimit({ namespace: 'owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' })
  createDraft(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateOwnerPropertyDto) {
    return this.ownerPropertiesService.createDraft(user.id, body);
  }

  @Get('my')
  @RateLimit({ namespace: 'owner-properties-read', limit: OWNER_RATE_LIMITS.read.limit, windowSeconds: OWNER_RATE_LIMITS.read.windowSeconds, keyStrategy: 'user_or_ip' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.ownerPropertiesService.listMine(user.id);
  }

  @Get('my/:id')
  @RateLimit({ namespace: 'owner-properties-read', limit: OWNER_RATE_LIMITS.read.limit, windowSeconds: OWNER_RATE_LIMITS.read.windowSeconds, keyStrategy: 'user_or_ip' })
  getMine(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ownerPropertiesService.getMine(user.id, id);
  }

  @Patch('my/:id')
  @RateLimit({ namespace: 'owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' })
  updateMine(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: UpdateOwnerPropertyDto) {
    return this.ownerPropertiesService.updateMine(user.id, id, body);
  }

  @Post('my/:id/submit')
  @RateLimit({ namespace: 'owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' })
  submitMine(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() _body: SubmitOwnerPropertyDto) {
    return this.ownerPropertiesService.submitMine(user.id, id);
  }

  @Post('my/:id/unpublish')
  @RateLimit({ namespace: 'owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' })
  unpublishMine(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ownerPropertiesService.unpublishMine(user.id, id);
  }

  @Delete('my/:id')
  @RateLimit({ namespace: 'owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' })
  deleteMine(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ownerPropertiesService.deleteMine(user.id, id);
  }
}

@Controller('admin/properties/owner-submitted')
@UseGuards(AccessTokenGuard, RolesGuard, RateLimitGuard)
@Roles(UserRole.ADMIN)
export class AdminOwnerPropertiesController {
  constructor(private readonly ownerPropertiesService: OwnerPropertiesService) {}

  @Get()
  @RateLimit({ namespace: 'admin-owner-properties-read', limit: OWNER_RATE_LIMITS.read.limit, windowSeconds: OWNER_RATE_LIMITS.read.windowSeconds, keyStrategy: 'user_or_ip' })
  listAll(@Query() query: AdminListQueryDto) {
    return this.ownerPropertiesService.listAdmin({ page: query.page, limit: query.limit });
  }

  @Get('pending')
  @RateLimit({ namespace: 'admin-owner-properties-read', limit: OWNER_RATE_LIMITS.read.limit, windowSeconds: OWNER_RATE_LIMITS.read.windowSeconds, keyStrategy: 'user_or_ip' })
  listPending(@Query() query: AdminListQueryDto) {
    return this.ownerPropertiesService.listAdmin({
      page: query.page,
      limit: query.limit,
      status: OwnerPropertyStatus.PENDING_REVIEW,
    });
  }

  @Get(':id')
  @RateLimit({ namespace: 'admin-owner-properties-read', limit: OWNER_RATE_LIMITS.read.limit, windowSeconds: OWNER_RATE_LIMITS.read.windowSeconds, keyStrategy: 'user_or_ip' })
  getOne(@Param('id') id: string) {
    return this.ownerPropertiesService.getAdmin(id);
  }

  @Post(':id/approve')
  @RateLimit({ namespace: 'admin-owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' })
  approve(@Param('id') id: string) {
    return this.ownerPropertiesService.approveAdmin(id);
  }

  @Post(':id/reject')
  @RateLimit({ namespace: 'admin-owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' })
  reject(@Param('id') id: string, @Body() body: ReviewOwnerPropertyDto) {
    return this.ownerPropertiesService.rejectAdmin(id, body);
  }

  @Patch(':id')
  @RateLimit({ namespace: 'admin-owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' })
  update(@Param('id') id: string, @Body() body: UpdateOwnerPropertyDto) {
    return this.ownerPropertiesService.updateAdmin(id, body);
  }

  @Post(':id/unpublish')
  @RateLimit({ namespace: 'admin-owner-properties-write', limit: OWNER_RATE_LIMITS.write.limit, windowSeconds: OWNER_RATE_LIMITS.write.windowSeconds, keyStrategy: 'user_or_ip' })
  unpublish(@Param('id') id: string) {
    return this.ownerPropertiesService.unpublishAdmin(id);
  }
}
