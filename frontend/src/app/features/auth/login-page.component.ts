import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/services/auth.store';

@Component({
  selector: 'app-login-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  protected email = '';
  protected password = '';
  protected loading = false;
  protected error = '';

  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  async submit() {
    if (this.loading) {
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      await this.authStore.login(this.email, this.password);
      await this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('redirectTo') || '/search');
    } catch (error) {
      this.error = this.authStore.readError(error, 'No se pudo iniciar sesión.');
    } finally {
      this.loading = false;
    }
  }
}
