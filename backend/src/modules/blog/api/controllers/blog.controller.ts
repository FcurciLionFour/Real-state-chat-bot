import { Controller, Get, Param, Query } from '@nestjs/common';
import { BlogService } from '../../application/services/blog.service';
import { ListBlogArticlesQueryDto } from '../dto/list-blog-articles-query.dto';

@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  listArticles(@Query() query: ListBlogArticlesQueryDto) {
    return this.blogService.listPublished(query);
  }

  @Get(':slug')
  getArticle(@Param('slug') slug: string) {
    return this.blogService.getPublishedBySlug(slug);
  }
}
