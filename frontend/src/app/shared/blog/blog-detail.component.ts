import { CommonModule, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogArticle, BLOG_CATEGORY_LABELS } from './blog.types';
import { BlogCardComponent } from './blog-card.component';

@Component({
  selector: 'app-blog-detail',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, BlogCardComponent],
  template: `
    <article class="blog-detail">
      <a routerLink="/blog" class="blog-detail__back">Volver al blog</a>
      <span class="blog-detail__category">{{ categoryLabel }}</span>
      <h1>{{ article.title }}</h1>
      <p class="blog-detail__meta">
        {{ article.publishedAt | date: 'dd MMM yyyy' }} · {{ article.readingMinutes }} min de lectura · Por {{ article.author }}
      </p>

      <img class="blog-detail__cover" [src]="article.coverImage" [alt]="article.title" />

      <div class="blog-detail__layout">
        <div class="blog-detail__content">
          @for (section of article.content; track section.heading ?? section.body) {
            <section>
              @if (section.heading) {
                <h2>{{ section.heading }}</h2>
              }
              <p>{{ section.body }}</p>
            </section>
          }
        </div>

        <aside class="blog-detail__aside">
          <section class="blog-detail__cta">
            <h3>Buscar propiedades en estas zonas</h3>
            <p>Encontra propiedades disponibles en las zonas que mencionamos en este articulo.</p>
            <button type="button" (click)="searchRelated.emit(article.relatedSearchPrompt)">Buscar en chat</button>
          </section>

          <section class="blog-detail__related">
            <h3>Articulos relacionados</h3>
            @for (item of related; track item.id) {
              <app-blog-card [article]="item" [compact]="true" [showExcerpt]="false" />
            }
          </section>
        </aside>
      </div>
    </article>
  `,
  styles: [
    `
      .blog-detail {
        display: grid;
        gap: 0.9rem;
      }

      .blog-detail__back {
        width: max-content;
        color: #2f5d50;
        font-size: 0.82rem;
        font-weight: 900;
        text-decoration: none;
      }

      .blog-detail__category {
        width: max-content;
        padding: 0.3rem 0.58rem;
        border-radius: 999px;
        background: #eef6f2;
        color: #2f5d50;
        font-size: 0.72rem;
        font-weight: 900;
        text-transform: uppercase;
      }

      .blog-detail h1 {
        max-width: 780px;
        margin: 0;
        font-size: clamp(2rem, 4vw, 3rem);
        line-height: 1.05;
        letter-spacing: -0.04em;
      }

      .blog-detail__meta {
        margin: 0;
        color: #6b7280;
        font-size: 0.88rem;
      }

      .blog-detail__cover {
        width: 100%;
        max-height: 430px;
        object-fit: cover;
        border-radius: 1rem;
        border: 1px solid #e5e7eb;
      }

      .blog-detail__layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        gap: 1.5rem;
        align-items: start;
      }

      .blog-detail__content {
        display: grid;
        gap: 1.1rem;
        font-size: 0.98rem;
        line-height: 1.75;
      }

      .blog-detail__content h2 {
        margin: 0 0 0.35rem;
        font-size: 1.2rem;
      }

      .blog-detail__content p {
        margin: 0;
        color: #344054;
      }

      .blog-detail__aside {
        position: sticky;
        top: 1rem;
        display: grid;
        gap: 1rem;
      }

      .blog-detail__cta,
      .blog-detail__related {
        display: grid;
        gap: 0.8rem;
        padding: 1rem;
        border: 1px solid #e5e7eb;
        border-radius: 1rem;
        background: #fff;
      }

      .blog-detail__cta {
        background: #eef6f2;
      }

      .blog-detail__cta h3,
      .blog-detail__related h3,
      .blog-detail__cta p {
        margin: 0;
      }

      .blog-detail__cta p {
        color: #466057;
        font-size: 0.84rem;
        line-height: 1.5;
      }

      .blog-detail__cta button {
        min-height: 2.55rem;
        border: 0;
        border-radius: 0.75rem;
        background: #2f5d50;
        color: #fff;
        font: inherit;
        font-weight: 900;
        cursor: pointer;
      }

      @media (max-width: 980px) {
        .blog-detail__layout {
          grid-template-columns: minmax(0, 1fr);
        }

        .blog-detail__aside {
          position: static;
        }
      }
    `,
  ],
})
export class BlogDetailComponent {
  @Input({ required: true }) article!: BlogArticle;
  @Input() related: BlogArticle[] = [];
  @Output() searchRelated = new EventEmitter<string>();

  protected get categoryLabel() {
    return BLOG_CATEGORY_LABELS[this.article.category];
  }
}
