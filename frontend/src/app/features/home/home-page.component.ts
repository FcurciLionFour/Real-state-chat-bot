import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/services/auth.store';
import { BlogDataService } from '../../shared/blog/blog-data.service';
import { BlogGridComponent } from '../../shared/blog/blog-grid.component';

const PENDING_HOME_PROMPT_KEY = 'busca.ar.pendingHomePrompt';

type SearchExample = {
  label: string;
};

const SEARCH_EXAMPLES: SearchExample[] = [
  { label: 'Quiero alquilar en Palermo por menos de 500 USD' },
  { label: 'Busco casa con jardin en zona norte' },
  { label: 'Comparame deptos en Caballito vs Almagro' },
  { label: 'Departamento 2 ambientes con balcon y cochera' },
];

@Component({
  selector: 'app-home-page',
  imports: [CommonModule, FormsModule, RouterLink, BlogGridComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent {
  protected readonly authStore = inject(AuthStore);
  protected readonly examples = SEARCH_EXAMPLES;
  protected readonly featuredArticles = inject(BlogDataService).featuredArticles(3);
  protected query = '';

  private readonly router = inject(Router);

  async ngOnInit() {
    if (this.authStore.isAuthenticated()) {
      await this.router.navigateByUrl('/search', { replaceUrl: true });
    }
  }

  protected async submitSearch(value = this.query) {
    const preparedPrompt = value.trim();

    if (!preparedPrompt) {
      return;
    }

    if (!this.authStore.isAuthenticated()) {
      sessionStorage.setItem(PENDING_HOME_PROMPT_KEY, preparedPrompt);
    }

    await this.router.navigate(['/search'], {
      state: {
        preparedPrompt,
        autoSend: true,
      },
    });
  }
}
