import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/services/auth.store';
import { readApiErrorMessage } from '../../core/services/real-state-api.service';
import { BlogDataService } from '../../shared/blog/blog-data.service';
import { BlogDetailComponent } from '../../shared/blog/blog-detail.component';
import { BlogArticle } from '../../shared/blog/blog.types';

@Component({
  selector: 'app-blog-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, BlogDetailComponent],
  templateUrl: './blog-detail-page.component.html',
  styleUrl: './blog-shell.component.scss',
})
export class BlogDetailPageComponent {
  protected readonly authStore = inject(AuthStore);
  private readonly blogData = inject(BlogDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly article = signal<BlogArticle | null>(null);
  protected readonly related = signal<BlogArticle[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  async ngOnInit() {
    await this.loadArticle();
  }

  protected async openSearch() {
    await this.router.navigate(['/search']);
  }

  protected async searchRelated(prompt: string) {
    await this.router.navigate(['/search'], {
      state: {
        preparedPrompt: prompt,
        autoSend: true,
      },
    });
  }

  protected getUserInitial() {
    return (this.authStore.user()?.email ?? 'U').charAt(0).toUpperCase();
  }

  private async loadArticle() {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.loading.set(true);
    this.error.set('');

    try {
      const article = await firstValueFrom(this.blogData.getArticleFromApi(slug));
      this.article.set(article);
      const list = await firstValueFrom(this.blogData.listArticlesFromApi(1, 4, article.category));
      this.related.set(list.items.filter((item) => item.id !== article.id).slice(0, 3));
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo cargar el articulo.'));
      const fallback = this.blogData.findBySlug(slug);
      this.article.set(fallback);
      this.related.set(fallback ? this.blogData.relatedArticles(fallback, 3) : []);
    } finally {
      this.loading.set(false);
    }
  }
}
