"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateBlogArticleDto = exports.CreateBlogArticleDto = exports.BlogContentBlockDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class BlogContentBlockDto {
    heading;
    body;
}
exports.BlogContentBlockDto = BlogContentBlockDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BlogContentBlockDto.prototype, "heading", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BlogContentBlockDto.prototype, "body", void 0);
class CreateBlogArticleDto {
    title;
    slug;
    excerpt;
    category;
    coverImageUrl;
    content;
    status;
    readingMinutes;
    relatedSearchPrompt;
    seoTitle;
    seoDescription;
}
exports.CreateBlogArticleDto = CreateBlogArticleDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBlogArticleDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBlogArticleDto.prototype, "slug", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBlogArticleDto.prototype, "excerpt", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.BlogArticleCategory),
    __metadata("design:type", typeof (_a = typeof client_1.BlogArticleCategory !== "undefined" && client_1.BlogArticleCategory) === "function" ? _a : Object)
], CreateBlogArticleDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBlogArticleDto.prototype, "coverImageUrl", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BlogContentBlockDto),
    __metadata("design:type", Array)
], CreateBlogArticleDto.prototype, "content", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.BlogArticleStatus),
    __metadata("design:type", typeof (_b = typeof client_1.BlogArticleStatus !== "undefined" && client_1.BlogArticleStatus) === "function" ? _b : Object)
], CreateBlogArticleDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(60),
    __metadata("design:type", Number)
], CreateBlogArticleDto.prototype, "readingMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBlogArticleDto.prototype, "relatedSearchPrompt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBlogArticleDto.prototype, "seoTitle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBlogArticleDto.prototype, "seoDescription", void 0);
class UpdateBlogArticleDto {
    title;
    slug;
    excerpt;
    category;
    coverImageUrl;
    content;
    status;
    readingMinutes;
    relatedSearchPrompt;
    seoTitle;
    seoDescription;
}
exports.UpdateBlogArticleDto = UpdateBlogArticleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateBlogArticleDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateBlogArticleDto.prototype, "slug", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateBlogArticleDto.prototype, "excerpt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.BlogArticleCategory),
    __metadata("design:type", typeof (_c = typeof client_1.BlogArticleCategory !== "undefined" && client_1.BlogArticleCategory) === "function" ? _c : Object)
], UpdateBlogArticleDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateBlogArticleDto.prototype, "coverImageUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BlogContentBlockDto),
    __metadata("design:type", Array)
], UpdateBlogArticleDto.prototype, "content", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.BlogArticleStatus),
    __metadata("design:type", typeof (_d = typeof client_1.BlogArticleStatus !== "undefined" && client_1.BlogArticleStatus) === "function" ? _d : Object)
], UpdateBlogArticleDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(60),
    __metadata("design:type", Number)
], UpdateBlogArticleDto.prototype, "readingMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateBlogArticleDto.prototype, "relatedSearchPrompt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateBlogArticleDto.prototype, "seoTitle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateBlogArticleDto.prototype, "seoDescription", void 0);
