import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/services/auth.store';

@Component({
  selector: 'app-register-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class RegisterPageComponent {
  protected email = '';
  protected password = '';
  protected confirmPassword = '';
  protected loading = false;
  protected error = '';

  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  async submit() {
    if (this.loading) {
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      await this.authStore.register(this.email, this.password);
      await this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('redirectTo') || '/search');
    } catch (error) {
      this.error = this.authStore.readError(error, 'No se pudo crear la cuenta.');
    } finally {
      this.loading = false;
    }
  }
}
