import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/services/auth.store';
import { readApiErrorMessage } from '../../core/services/real-state-api.service';
import { BlogDataService } from '../../shared/blog/blog-data.service';
import { BlogGridComponent } from '../../shared/blog/blog-grid.component';
import { BlogArticle, BlogCategory } from '../../shared/blog/blog.types';
import { AppSidebarComponent } from '../../shared/app-sidebar/app-sidebar.component';

type BlogFilter = BlogCategory | 'TODAS';

@Component({
  selector: 'app-blog-shell',
  standalone: true,
  imports: [CommonModule, BlogGridComponent, AppSidebarComponent],
  templateUrl: './blog-shell.component.html',
  styleUrl: './blog-shell.component.scss',
})
export class BlogShellComponent {
  protected readonly authStore = inject(AuthStore);
  private readonly blogData = inject(BlogDataService);
  private readonly router = inject(Router);

  protected readonly filters: Array<{ label: string; value: BlogFilter }> = [
    { label: 'Todas', value: 'TODAS' },
    { label: 'Compra', value: 'COMPRA' },
    { label: 'Alquiler', value: 'ALQUILER' },
    { label: 'Inversion', value: 'INVERSION' },
    { label: 'Tips', value: 'TIPS' },
  ];
  protected readonly activeFilter = signal<BlogFilter>('TODAS');
  protected readonly query = signal('');
  protected readonly articles = signal<BlogArticle[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  async ngOnInit() {
    await this.loadArticles();
  }

  protected async setFilter(filter: BlogFilter) {
    this.activeFilter.set(filter);
    await this.loadArticles();
  }

  protected async updateQuery(value: string) {
    this.query.set(value);
    await this.loadArticles();
  }

  protected async openSearch() {
    await this.router.navigate(['/search']);
  }

  protected getUserInitial() {
    return (this.authStore.user()?.email ?? 'U').charAt(0).toUpperCase();
  }

  private async loadArticles() {
    this.loading.set(true);
    this.error.set('');

    try {
      const activeFilter = this.activeFilter();
      const category: BlogCategory | undefined = activeFilter === 'TODAS' ? undefined : activeFilter;
      const response = await firstValueFrom(this.blogData.listArticlesFromApi(1, 30, category, this.query()));
      this.articles.set(response.items);
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudieron cargar los articulos del blog.'));
      const fallback = this.blogData.filterByCategory(this.activeFilter());
      const query = this.query().trim().toLowerCase();
      this.articles.set(
        query
          ? fallback.filter((article) =>
              [article.title, article.excerpt, article.category].some((value) => value.toLowerCase().includes(query)),
            )
          : fallback,
      );
    } finally {
      this.loading.set(false);
    }
  }
}
