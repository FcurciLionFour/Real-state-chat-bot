import { BlogArticleCategory, BlogArticleStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BlogContentBlockDto {
  @IsOptional()
  @IsString()
  heading?: string;

  @IsString()
  body!: string;
}

export class CreateBlogArticleDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  excerpt!: string;

  @IsEnum(BlogArticleCategory)
  category!: BlogArticleCategory;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlogContentBlockDto)
  content!: BlogContentBlockDto[];

  @IsOptional()
  @IsEnum(BlogArticleStatus)
  status?: BlogArticleStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  readingMinutes?: number;

  @IsOptional()
  @IsString()
  relatedSearchPrompt?: string;

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;
}

export class UpdateBlogArticleDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsEnum(BlogArticleCategory)
  category?: BlogArticleCategory;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlogContentBlockDto)
  content?: BlogContentBlockDto[];

  @IsOptional()
  @IsEnum(BlogArticleStatus)
  status?: BlogArticleStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  readingMinutes?: number;

  @IsOptional()
  @IsString()
  relatedSearchPrompt?: string;

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;
}
