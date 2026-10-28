import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  BookOpen,
  Building2,
  Map,
  House,
  LayoutGrid,
  LUCIDE_ICONS,
  LucideAngularModule,
  LucideIconProvider,
  MessagesSquare,
  Plus,
  Settings,
  Star,
  User,
} from 'lucide-angular';
import { AuthStore } from '../../core/services/auth.store';

export type AppSidebarSection = 'home' | 'map' | 'chats' | 'favorites' | 'blog' | 'publish' | 'properties' | 'admin' | 'profile';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        BookOpen,
        Building2,
        Map,
        House,
        LayoutGrid,
        MessagesSquare,
        Plus,
        Settings,
        Star,
        User,
      }),
    },
  ],
  templateUrl: './app-sidebar.component.html',
  styleUrl: './app-sidebar.component.scss',
})
export class AppSidebarComponent {
  @Input({ required: true })
  activeSection: AppSidebarSection = 'home';

  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected async openSearch() {
    await this.router.navigate(['/search']);
  }

  protected getUserInitial() {
    return (this.authStore.user()?.email ?? 'U').charAt(0).toUpperCase();
  }

  protected getAccountLabel() {
    const role = this.authStore.user()?.role;

    if (role === 'ADMIN') {
      return 'Cuenta admin';
    }

    if (role === 'OWNER') {
      return 'Cuenta owner';
    }

    return this.authStore.isAuthenticated() ? 'Cuenta activa' : 'Visitante';
  }
}
