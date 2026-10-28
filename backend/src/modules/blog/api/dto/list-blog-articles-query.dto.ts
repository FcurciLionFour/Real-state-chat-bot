import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { BlogArticleCategory, BlogArticleStatus } from '@prisma/client';

export class ListBlogArticlesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 12;

  @IsOptional()
  @IsEnum(BlogArticleCategory)
  category?: BlogArticleCategory;

  @IsOptional()
  @IsString()
  query?: string;
}

export class AdminListBlogArticlesQueryDto extends ListBlogArticlesQueryDto {
  @IsOptional()
  @IsEnum(BlogArticleStatus)
  status?: BlogArticleStatus;
}
