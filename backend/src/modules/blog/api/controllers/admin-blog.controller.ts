import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { AccessTokenGuard } from '../../../auth/presentation/guards/access-token.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { AuthenticatedUser } from '../../../auth/domain/types/authenticated-user.type';
import { RateLimit } from '../../../../infrastructure/security/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../../../infrastructure/security/guards/rate-limit.guard';
import { BlogService } from '../../application/services/blog.service';
import { AdminListBlogArticlesQueryDto } from '../dto/list-blog-articles-query.dto';
import { CreateBlogArticleDto, UpdateBlogArticleDto } from '../dto/upsert-blog-article.dto';

const ADMIN_BLOG_RATE_LIMITS =
  process.env.NODE_ENV === 'production'
    ? {
        read: { limit: 120, windowSeconds: 60 },
        write: { limit: 20, windowSeconds: 60 },
      }
    : {
        read: { limit: 30, windowSeconds: 60 },
        write: { limit: 10, windowSeconds: 60 },
      };

@Controller('admin/blog')
@UseGuards(AccessTokenGuard, RolesGuard, RateLimitGuard)
@Roles(UserRole.ADMIN)
export class AdminBlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  @RateLimit({
    namespace: 'admin-blog-read',
    limit: ADMIN_BLOG_RATE_LIMITS.read.limit,
    windowSeconds: ADMIN_BLOG_RATE_LIMITS.read.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  listArticles(@Query() query: AdminListBlogArticlesQueryDto) {
    return this.blogService.listAdmin(query);
  }

  @Post()
  @RateLimit({
    namespace: 'admin-blog-write',
    limit: ADMIN_BLOG_RATE_LIMITS.write.limit,
    windowSeconds: ADMIN_BLOG_RATE_LIMITS.write.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  createArticle(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateBlogArticleDto) {
    return this.blogService.createAdminArticle(user.id, body);
  }

  @Patch(':id')
  @RateLimit({
    namespace: 'admin-blog-write',
    limit: ADMIN_BLOG_RATE_LIMITS.write.limit,
    windowSeconds: ADMIN_BLOG_RATE_LIMITS.write.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  updateArticle(@Param('id') id: string, @Body() body: UpdateBlogArticleDto) {
    return this.blogService.updateAdminArticle(id, body);
  }

  @Post(':id/publish')
  @RateLimit({
    namespace: 'admin-blog-write',
    limit: ADMIN_BLOG_RATE_LIMITS.write.limit,
    windowSeconds: ADMIN_BLOG_RATE_LIMITS.write.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  publishArticle(@Param('id') id: string) {
    return this.blogService.publishAdminArticle(id);
  }

  @Post(':id/unpublish')
  @RateLimit({
    namespace: 'admin-blog-write',
    limit: ADMIN_BLOG_RATE_LIMITS.write.limit,
    windowSeconds: ADMIN_BLOG_RATE_LIMITS.write.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  unpublishArticle(@Param('id') id: string) {
    return this.blogService.unpublishAdminArticle(id);
  }

  @Post(':id/archive')
  @RateLimit({
    namespace: 'admin-blog-write',
    limit: ADMIN_BLOG_RATE_LIMITS.write.limit,
    windowSeconds: ADMIN_BLOG_RATE_LIMITS.write.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  archiveArticle(@Param('id') id: string) {
    return this.blogService.archiveAdminArticle(id);
  }

  @Delete(':id')
  @RateLimit({
    namespace: 'admin-blog-write',
    limit: ADMIN_BLOG_RATE_LIMITS.write.limit,
    windowSeconds: ADMIN_BLOG_RATE_LIMITS.write.windowSeconds,
    keyStrategy: 'user_or_ip',
  })
  deleteArticle(@Param('id') id: string) {
    return this.blogService.deleteAdminArticle(id);
  }
}
