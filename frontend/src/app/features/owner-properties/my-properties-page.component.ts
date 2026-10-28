import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/services/auth.store';
import { RealStateApiService, readApiErrorMessage } from '../../core/services/real-state-api.service';
import { OwnerProperty, OwnerPropertyStatus } from '../../core/types/api.types';
import { AppSidebarComponent } from '../../shared/app-sidebar/app-sidebar.component';

type StatusFilter = 'ALL' | OwnerPropertyStatus;

@Component({
  selector: 'app-my-properties-page',
  imports: [CommonModule, DatePipe, RouterLink, AppSidebarComponent],
  templateUrl: './my-properties-page.component.html',
  styleUrl: './my-properties-page.component.scss',
})
export class MyPropertiesPageComponent {
  protected readonly properties = signal<OwnerProperty[]>([]);
  protected readonly loading = signal(true);
  protected readonly busyId = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly statusFilter = signal<StatusFilter>('ALL');
  protected readonly filteredProperties = computed(() => {
    const filter = this.statusFilter();
    return this.properties().filter((property) => (filter === 'ALL' ? true : property.status === filter));
  });

  private readonly api = inject(RealStateApiService);
  private readonly router = inject(Router);
  protected readonly authStore = inject(AuthStore);

  async ngOnInit() {
    await this.loadProperties();
  }

  protected get canPublish() {
    const role = this.authStore.user()?.role;
    return role === 'OWNER' || role === 'ADMIN';
  }

  protected getUserInitial() {
    const email = this.authStore.user()?.email ?? 'U';
    return email.charAt(0).toUpperCase();
  }

  protected async openSearch() {
    await this.router.navigate(['/search']);
  }

  protected setStatusFilter(status: StatusFilter) {
    this.statusFilter.set(status);
  }

  protected statusCount(status: StatusFilter) {
    return this.properties().filter((property) => (status === 'ALL' ? true : property.status === status)).length;
  }

  protected statusLabel(status: OwnerPropertyStatus) {
    const labels: Record<OwnerPropertyStatus, string> = {
      DRAFT: 'Borrador',
      PENDING_REVIEW: 'En revision',
      APPROVED: 'Aprobada',
      REJECTED: 'Rechazada',
      PUBLISHED: 'Publicada',
      UNPUBLISHED: 'Despublicada',
    };

    return labels[status];
  }

  protected formatPrice(property: OwnerProperty) {
    const amount = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(property.price);
    return `${property.currency} ${amount}`;
  }

  protected formatLocation(property: OwnerProperty) {
    return [property.neighborhood, property.city].filter(Boolean).join(', ') || 'Ubicacion no informada';
  }

  protected canEdit(property: OwnerProperty) {
    return property.status === 'DRAFT' || property.status === 'REJECTED';
  }

  protected canSubmit(property: OwnerProperty) {
    return property.status === 'DRAFT' || property.status === 'REJECTED';
  }

  protected canUnpublish(property: OwnerProperty) {
    return property.status === 'PUBLISHED' || property.status === 'APPROVED';
  }

  protected canDelete(property: OwnerProperty) {
    return property.status === 'DRAFT';
  }

  protected async submit(property: OwnerProperty) {
    await this.mutate(property.id, () => this.api.submitMyOwnerProperty(property.id), 'Propiedad enviada a revision.');
  }

  protected async unpublish(property: OwnerProperty) {
    await this.mutate(property.id, () => this.api.unpublishMyOwnerProperty(property.id), 'Propiedad despublicada.');
  }

  protected async deleteDraft(property: OwnerProperty) {
    this.busyId.set(property.id);
    this.error.set('');

    try {
      await firstValueFrom(this.api.deleteMyOwnerDraft(property.id));
      this.properties.update((items) => items.filter((item) => item.id !== property.id));
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo eliminar el borrador.'));
    } finally {
      this.busyId.set(null);
    }
  }

  protected trackProperty(_index: number, property: OwnerProperty) {
    return property.id;
  }

  private async mutate(id: string, action: () => ReturnType<RealStateApiService['submitMyOwnerProperty']>, successMessage: string) {
    this.busyId.set(id);
    this.error.set('');

    try {
      const updated = await firstValueFrom(action());
      this.properties.update((items) => items.map((item) => (item.id === id ? updated : item)));
    } catch (error) {
      this.error.set(readApiErrorMessage(error, successMessage.replace('.', '').toLowerCase()));
    } finally {
      this.busyId.set(null);
    }
  }

  private async loadProperties() {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(this.api.listMyOwnerProperties(1, 50));
      this.properties.set(response.items);
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudieron cargar tus propiedades.'));
    } finally {
      this.loading.set(false);
    }
  }
}
