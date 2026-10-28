import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlogController } from './api/controllers/blog.controller';
import { AdminBlogController } from './api/controllers/admin-blog.controller';
import { BlogService } from './application/services/blog.service';
import { BlogArticlesRepository } from './infrastructure/repositories/blog-articles.repository';

@Module({
  imports: [AuthModule],
  controllers: [BlogController, AdminBlogController],
  providers: [BlogService, BlogArticlesRepository],
  exports: [BlogService],
})
export class BlogModule {}
