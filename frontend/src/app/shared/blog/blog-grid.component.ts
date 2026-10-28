import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { BlogArticle } from './blog.types';
import { BlogCardComponent } from './blog-card.component';

@Component({
  selector: 'app-blog-grid',
  standalone: true,
  imports: [CommonModule, BlogCardComponent],
  template: `
    <div class="blog-grid" [class.blog-grid--compact]="compact">
      @for (article of articles; track article.id) {
        <app-blog-card [article]="article" [compact]="compact" [showExcerpt]="showExcerpt" />
      }
    </div>
  `,
  styles: [
    `
      .blog-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
      }

      .blog-grid--compact {
        gap: 0.8rem;
      }

      @media (max-width: 1120px) {
        .blog-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 720px) {
        .blog-grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class BlogGridComponent {
  @Input() articles: BlogArticle[] = [];
  @Input() compact = false;
  @Input() showExcerpt = true;
}
