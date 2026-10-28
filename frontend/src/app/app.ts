import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import {
  Heart,
  LUCIDE_ICONS,
  LucideAngularModule,
  LucideIconProvider,
  Map,
  Scale,
  Search,
  User,
} from 'lucide-angular';
import { AuthStore } from './core/services/auth.store';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Heart,
        Map,
        Scale,
        Search,
        User,
      }),
    },
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly authStore = inject(AuthStore);
  protected readonly router = inject(Router);
  protected readonly isAdmin = computed(() => this.authStore.user()?.role === 'ADMIN');

  protected async logout() {
    await this.authStore.logout();
  }

  protected isWorkspaceRoute() {
    const url = this.router.url;
    return url.startsWith('/search') || url.startsWith('/chat') || url.startsWith('/blog') || url.startsWith('/app/chats') || url.startsWith('/app/favorites') || url.startsWith('/app/map') || url.startsWith('/app/admin') || url.startsWith('/app/publish-property') || url.startsWith('/app/my-properties') || url.startsWith('/app/compare') || url.startsWith('/app/profile');
  }

  protected isHomeRoute() {
    return this.router.url === '/';
  }

  protected isAuthRoute() {
    const url = this.router.url;
    return url.startsWith('/login') || url.startsWith('/register');
  }

  protected isLoginRoute() {
    return this.router.url.startsWith('/login');
  }
}
