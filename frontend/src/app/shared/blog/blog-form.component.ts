import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { BlogCategory, BlogStatus, CreateBlogArticlePayload } from '../../core/types/api.types';
import { RealStateApiService, readApiErrorMessage } from '../../core/services/real-state-api.service';

@Component({
  selector: 'app-blog-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="blog-form">
      <header>
        <div>
          <h2>Crear nuevo articulo</h2>
          <p>Blog / Articulos / Crear nuevo</p>
        </div>
      </header>

      <div class="blog-form__grid">
        <div class="blog-form__fields">
          <label>
            Titulo del articulo
            <input [(ngModel)]="title" name="blogTitle" placeholder="Escribi un titulo atractivo..." (ngModelChange)="syncSlug()" />
          </label>
          <label>
            Slug (URL)
            <input [ngModel]="slug()" name="blogSlug" placeholder="se-generara-automaticamente" (ngModelChange)="slug.set($event)" />
          </label>
          <label>
            Bajada / resumen
            <input [(ngModel)]="excerpt" name="blogExcerpt" placeholder="Resumen corto para la card del blog..." />
          </label>
          <label>
            Categoria
            <select [(ngModel)]="category" name="blogCategory">
              <option value="">Selecciona una categoria</option>
              <option value="COMPRA">Compra</option>
              <option value="ALQUILER">Alquiler</option>
              <option value="INVERSION">Inversion</option>
              <option value="TIPS">Tips</option>
            </select>
          </label>
        </div>

        <label class="blog-form__upload">
          <span>Imagen de portada</span>
          <div>
            <strong>URL de imagen</strong>
            <small>Por ahora el backend guarda URL. La carga de archivos queda preparada para una siguiente etapa.</small>
          </div>
          <input [(ngModel)]="coverImageUrl" name="blogCoverImageUrl" placeholder="https://..." />
        </label>
      </div>

      <div class="blog-form__grid blog-form__grid--status">
        <label>
          Estado
          <select [(ngModel)]="status" name="blogStatus">
            <option value="DRAFT">Borrador</option>
            <option value="PUBLISHED">Publicado</option>
          </select>
        </label>
      </div>

      <label class="blog-form__editor">
        Contenido
        <div class="blog-form__toolbar">
          <button type="button">B</button>
          <button type="button">I</button>
          <button type="button">H2</button>
          <button type="button">Lista</button>
          <button type="button">Link</button>
          <button type="button">Cita</button>
        </div>
        <textarea [(ngModel)]="content" name="blogContent" placeholder="Escribi el contenido del articulo..."></textarea>
      </label>

      <label>
        Prompt relacionado para el chat
        <input [(ngModel)]="relatedSearchPrompt" name="blogRelatedPrompt" placeholder="Quiero buscar propiedades relacionadas..." />
      </label>

      <footer>
        <button type="button" class="blog-form__ghost" (click)="resetForm()">Cancelar</button>
        <span></span>
        <button type="button" class="blog-form__ghost" (click)="saveDraft()" [disabled]="saving()">
          {{ saving() ? 'Guardando...' : 'Guardar borrador' }}
        </button>
        <button type="button" class="blog-form__primary" (click)="publish()" [disabled]="saving()">
          {{ saving() ? 'Publicando...' : 'Publicar articulo' }}
        </button>
      </footer>

      @if (summary()) {
        <p class="blog-form__summary">{{ summary() }}</p>
      }
    </section>
  `,
  styles: [
    `
      .blog-form {
        display: grid;
        gap: 1rem;
      }

      .blog-form h2,
      .blog-form p {
        margin: 0;
      }

      .blog-form h2 {
        font-size: 1.15rem;
      }

      .blog-form p,
      .blog-form label {
        color: #6b7280;
        font-size: 0.82rem;
      }

      .blog-form__grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(320px, 0.55fr);
        gap: 1rem;
      }

      .blog-form__grid--status {
        grid-template-columns: minmax(0, 1fr) minmax(320px, 0.55fr);
      }

      .blog-form__fields,
      .blog-form label {
        display: grid;
        gap: 0.5rem;
      }

      .blog-form__fields {
        gap: 0.85rem;
      }

      input,
      select,
      textarea {
        width: 100%;
        border: 1px solid #e5e7eb;
        border-radius: 0.78rem;
        background: #fff;
        color: #1f2933;
        font: inherit;
      }

      input,
      select {
        min-height: 2.55rem;
        padding: 0 0.8rem;
      }

      textarea {
        min-height: 12rem;
        padding: 0.85rem;
        resize: vertical;
      }

      .blog-form__upload {
        align-content: start;
      }

      .blog-form__upload div {
        min-height: 10.1rem;
        display: grid;
        place-items: center;
        gap: 0.3rem;
        padding: 1rem;
        border: 1px dashed #cbd5e1;
        border-radius: 0.9rem;
        background: #fafafa;
        text-align: center;
      }

      .blog-form__upload strong {
        color: #2f5d50;
      }

      .blog-form__toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        padding: 0.45rem;
        border: 1px solid #e5e7eb;
        border-bottom: 0;
        border-radius: 0.78rem 0.78rem 0 0;
        background: #fff;
      }

      .blog-form__toolbar button,
      footer button {
        min-height: 2.1rem;
        padding: 0 0.72rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.65rem;
        background: #fff;
        color: #1f2933;
        font: inherit;
        font-size: 0.78rem;
        font-weight: 800;
        cursor: pointer;
      }

      .blog-form__editor textarea {
        border-top-left-radius: 0;
        border-top-right-radius: 0;
      }

      footer {
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        gap: 0.7rem;
        align-items: center;
      }

      footer .blog-form__primary {
        border-color: #2f5d50;
        background: #2f5d50;
        color: #fff;
      }

      .blog-form__summary {
        padding: 0.75rem 0.9rem;
        border-radius: 0.85rem;
        background: #eef6f2;
        color: #2f5d50;
        font-weight: 800;
      }

      @media (max-width: 880px) {
        .blog-form__grid,
        .blog-form__grid--status,
        footer {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class BlogFormComponent {
  @Output() articleSaved = new EventEmitter<void>();

  private readonly api = inject(RealStateApiService);

  protected title = '';
  protected excerpt = '';
  protected category: BlogCategory | '' = '';
  protected status: BlogStatus = 'DRAFT';
  protected content = '';
  protected coverImageUrl = '';
  protected relatedSearchPrompt = '';
  protected readonly slug = signal('');
  protected readonly summary = signal('');
  protected readonly saving = signal(false);

  protected syncSlug() {
    this.slug.set(
      this.title
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    );
  }

  protected async saveDraft() {
    this.status = 'DRAFT';
    await this.saveArticle();
  }

  protected async publish() {
    this.status = 'PUBLISHED';
    await this.saveArticle();
  }

  protected resetForm() {
    this.title = '';
    this.excerpt = '';
    this.category = '';
    this.status = 'DRAFT';
    this.content = '';
    this.coverImageUrl = '';
    this.relatedSearchPrompt = '';
    this.slug.set('');
    this.summary.set('');
  }

  private async saveArticle() {
    this.summary.set('');

    if (!this.title.trim() || !this.excerpt.trim() || !this.category || !this.content.trim()) {
      this.summary.set('Completa titulo, bajada, categoria y contenido antes de guardar.');
      return;
    }

    this.saving.set(true);

    try {
      const payload: CreateBlogArticlePayload = {
        title: this.title,
        slug: this.slug(),
        excerpt: this.excerpt,
        category: this.category,
        coverImageUrl: this.coverImageUrl,
        content: this.parseContentBlocks(this.content),
        status: this.status,
        relatedSearchPrompt: this.relatedSearchPrompt,
      };

      const article = await firstValueFrom(this.api.createAdminBlogArticle(payload));
      this.summary.set(`${article.status === 'PUBLISHED' ? 'Articulo publicado' : 'Borrador guardado'}: ${article.title}`);
      this.articleSaved.emit();
      this.clearFields();
    } catch (error) {
      this.summary.set(readApiErrorMessage(error, 'No se pudo guardar el articulo.'));
    } finally {
      this.saving.set(false);
    }
  }

  private parseContentBlocks(value: string) {
    const paragraphs = value
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    return paragraphs.map((block) => {
      const [firstLine, ...rest] = block.split('\n').map((line) => line.trim());

      if (firstLine.startsWith('# ')) {
        return {
          heading: firstLine.replace(/^# /, '').trim(),
          body: rest.join(' ').trim() || firstLine.replace(/^# /, '').trim(),
        };
      }

      return { body: block.replace(/\s+/g, ' ') };
    });
  }

  private clearFields() {
    this.title = '';
    this.excerpt = '';
    this.category = '';
    this.status = 'DRAFT';
    this.content = '';
    this.coverImageUrl = '';
    this.relatedSearchPrompt = '';
    this.slug.set('');
  }
}
