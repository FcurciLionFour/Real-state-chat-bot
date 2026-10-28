import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  Bell,
  Heart,
  House,
  LUCIDE_ICONS,
  LucideAngularModule,
  LucideIconProvider,
  LogOut,
  Search,
  User,
} from 'lucide-angular';
import { AuthStore } from '../../core/services/auth.store';
import { AppSidebarComponent } from '../../shared/app-sidebar/app-sidebar.component';

@Component({
  selector: 'app-profile-page',
  imports: [CommonModule, RouterLink, LucideAngularModule, AppSidebarComponent],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Bell,
        Heart,
        House,
        LogOut,
        Search,
        User,
      }),
    },
  ],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
})
export class ProfilePageComponent {
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected getUserInitial() {
    return (this.authStore.user()?.email ?? 'U').charAt(0).toUpperCase();
  }

  protected async logout() {
    await this.authStore.logout();
    await this.router.navigate(['/login']);
  }
}
