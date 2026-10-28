import { CommonModule, DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogArticle, BLOG_CATEGORY_LABELS } from './blog.types';

@Component({
  selector: 'app-blog-card',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  template: `
    <a class="blog-card" [class.blog-card--compact]="compact" [routerLink]="['/blog', article.slug]">
      <div class="blog-card__media">
        <img [src]="article.coverImage" [alt]="article.title" loading="lazy" />
        <span>{{ categoryLabel }}</span>
      </div>
      <div class="blog-card__body">
        <h3>{{ article.title }}</h3>
        @if (showExcerpt) {
          <p>{{ article.excerpt }}</p>
        }
        <small>{{ article.publishedAt | date: 'dd MMM yyyy' }} · {{ article.readingMinutes }} min de lectura</small>
      </div>
    </a>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .blog-card {
        display: grid;
        overflow: hidden;
        height: 100%;
        border: 1px solid #e5e7eb;
        border-radius: 1rem;
        background: #fff;
        color: #1f2933;
        text-decoration: none;
        box-shadow: 0 8px 22px rgba(16, 24, 40, 0.045);
        transition:
          transform 160ms ease,
          border-color 160ms ease,
          box-shadow 160ms ease;
      }

      .blog-card:hover {
        transform: translateY(-2px);
        border-color: rgba(47, 93, 80, 0.26);
        box-shadow: 0 14px 28px rgba(16, 24, 40, 0.08);
      }

      .blog-card__media {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #eef1ef;
      }

      .blog-card__media img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .blog-card__media span {
        position: absolute;
        left: 0.72rem;
        bottom: 0.72rem;
        padding: 0.3rem 0.55rem;
        border-radius: 999px;
        background: rgba(238, 246, 242, 0.96);
        color: #2f5d50;
        font-size: 0.7rem;
        font-weight: 900;
        text-transform: uppercase;
      }

      .blog-card__body {
        display: grid;
        gap: 0.42rem;
        padding: 0.82rem 0.9rem 0.95rem;
      }

      .blog-card h3 {
        display: -webkit-box;
        margin: 0;
        overflow: hidden;
        font-size: 0.98rem;
        line-height: 1.32;
        letter-spacing: -0.01em;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
      }

      .blog-card p {
        display: -webkit-box;
        margin: 0;
        overflow: hidden;
        color: #6b7280;
        font-size: 0.82rem;
        line-height: 1.45;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
      }

      .blog-card small {
        color: #6b7280;
        font-size: 0.76rem;
      }

      .blog-card--compact .blog-card__body {
        padding: 0.7rem 0.78rem;
      }

      .blog-card--compact h3 {
        font-size: 0.86rem;
      }
    `,
  ],
})
export class BlogCardComponent {
  @Input({ required: true }) article!: BlogArticle;
  @Input() compact = false;
  @Input() showExcerpt = true;

  protected get categoryLabel() {
    return BLOG_CATEGORY_LABELS[this.article.category];
  }
}
