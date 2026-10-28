"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlogModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const blog_controller_1 = require("./api/controllers/blog.controller");
const admin_blog_controller_1 = require("./api/controllers/admin-blog.controller");
const blog_service_1 = require("./application/services/blog.service");
const blog_articles_repository_1 = require("./infrastructure/repositories/blog-articles.repository");
let BlogModule = class BlogModule {
};
exports.BlogModule = BlogModule;
exports.BlogModule = BlogModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule],
        controllers: [blog_controller_1.BlogController, admin_blog_controller_1.AdminBlogController],
        providers: [blog_service_1.BlogService, blog_articles_repository_1.BlogArticlesRepository],
        exports: [blog_service_1.BlogService],
    })
], BlogModule);
