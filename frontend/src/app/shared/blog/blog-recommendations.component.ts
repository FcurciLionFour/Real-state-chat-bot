import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogArticle } from './blog.types';
import { BlogCardComponent } from './blog-card.component';

@Component({
  selector: 'app-blog-recommendations',
  standalone: true,
  imports: [CommonModule, RouterLink, BlogCardComponent],
  template: `
    @if (articles.length > 0) {
      <section class="blog-recommendations">
        <header>
          <div>
            <h2>{{ title }}</h2>
            <p>{{ subtitle }}</p>
          </div>
          <a routerLink="/blog">Ver todos</a>
        </header>
        <div class="blog-recommendations__rail">
          @for (article of articles; track article.id) {
            <app-blog-card [article]="article" [compact]="true" [showExcerpt]="false" />
          }
        </div>
      </section>
    }
  `,
  styles: [
    `
      .blog-recommendations {
        display: grid;
        gap: 0.85rem;
        width: 100%;
      }

      .blog-recommendations header {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 1rem;
      }

      .blog-recommendations h2,
      .blog-recommendations p {
        margin: 0;
      }

      .blog-recommendations h2 {
        font-size: 1rem;
        letter-spacing: -0.02em;
      }

      .blog-recommendations p {
        color: #6b7280;
        font-size: 0.82rem;
      }

      .blog-recommendations a {
        color: #2f5d50;
        font-size: 0.82rem;
        font-weight: 900;
        text-decoration: none;
      }

      .blog-recommendations__rail {
        display: grid;
        grid-auto-columns: minmax(210px, 1fr);
        grid-auto-flow: column;
        gap: 0.8rem;
        overflow-x: auto;
        padding-bottom: 0.15rem;
        scrollbar-width: thin;
      }
    `,
  ],
})
export class BlogRecommendationsComponent {
  @Input() articles: BlogArticle[] = [];
  @Input() title = 'Insights del mercado';
  @Input() subtitle = 'Lecturas cortas para decidir mejor.';
}
