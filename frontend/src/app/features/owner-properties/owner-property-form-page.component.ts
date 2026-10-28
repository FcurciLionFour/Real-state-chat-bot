import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  BadgeCheck,
  CircleCheck,
  Clock,
  FileCheck,
  LUCIDE_ICONS,
  LucideAngularModule,
  LucideIconProvider,
  ShieldCheck,
} from 'lucide-angular';
import { AuthStore } from '../../core/services/auth.store';
import { RealStateApiService, readApiErrorMessage } from '../../core/services/real-state-api.service';
import { AppSidebarComponent } from '../../shared/app-sidebar/app-sidebar.component';
import {
  CreateOwnerPropertyPayload,
  CurrencyCode,
  OwnerProperty,
  OwnerPropertyOperationType,
  OwnerPropertyType,
} from '../../core/types/api.types';

type OwnerPropertyDraft = {
  operationType: OwnerPropertyOperationType;
  propertyType: OwnerPropertyType;
  title: string;
  description: string;
  province: string;
  city: string;
  neighborhood: string;
  address: string;
  showExactAddress: boolean;
  currency: CurrencyCode;
  price: number | null;
  expenses: number | null;
  acceptsCredit: boolean;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  coveredAreaM2: number | null;
  totalAreaM2: number | null;
  floor: number | null;
  age: number | null;
  featuresText: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactWhatsapp: string;
};

const MOBILE_FORM_STEPS = ['Basica', 'Caracteristicas', 'Ubicacion', 'Fotos'] as const;

function defaultDraft(): OwnerPropertyDraft {
  return {
    operationType: 'SALE',
    propertyType: 'APARTMENT',
    title: '',
    description: '',
    province: 'Buenos Aires',
    city: 'CABA',
    neighborhood: '',
    address: '',
    showExactAddress: false,
    currency: 'USD',
    price: null,
    expenses: null,
    acceptsCredit: false,
    rooms: null,
    bedrooms: null,
    bathrooms: null,
    coveredAreaM2: null,
    totalAreaM2: null,
    floor: null,
    age: null,
    featuresText: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactWhatsapp: '',
  };
}

@Component({
  selector: 'app-owner-property-form-page',
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule, AppSidebarComponent],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        BadgeCheck,
        CircleCheck,
        Clock,
        FileCheck,
        ShieldCheck,
      }),
    },
  ],
  templateUrl: './owner-property-form-page.component.html',
  styleUrl: './owner-property-form-page.component.scss',
})
export class OwnerPropertyFormPageComponent {
  protected draft = defaultDraft();
  protected readonly images = signal<string[]>([]);
  protected readonly mainImageUrl = signal<string | null>(null);
  protected readonly started = signal(false);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly editingPropertyId = signal<string | null>(null);
  protected readonly currentStatus = signal<OwnerProperty['status'] | null>(null);
  protected readonly mobileStep = signal(0);
  protected readonly mobileSteps = MOBILE_FORM_STEPS;

  private readonly api = inject(RealStateApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly authStore = inject(AuthStore);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.editingPropertyId.set(id);
    this.started.set(true);
    this.loading.set(true);

    try {
      const property = await firstValueFrom(this.api.getMyOwnerProperty(id));
      this.hydrate(property);
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo cargar la propiedad.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected get canPublish() {
    const role = this.authStore.user()?.role;
    return role === 'OWNER' || role === 'ADMIN';
  }

  protected begin() {
    this.started.set(true);
    this.mobileStep.set(0);
  }

  protected getUserInitial() {
    const email = this.authStore.user()?.email ?? 'U';
    return email.charAt(0).toUpperCase();
  }

  protected async openSearch() {
    await this.router.navigate(['/search']);
  }

  protected async saveDraft() {
    await this.persist(false);
  }

  protected async submitForReview() {
    await this.persist(true);
  }

  protected async cancel() {
    await this.router.navigate(['/app/my-properties']);
  }

  protected setMobileStep(index: number) {
    this.mobileStep.set(Math.max(0, Math.min(index, this.mobileSteps.length - 1)));
  }

  protected previousMobileStep() {
    this.setMobileStep(this.mobileStep() - 1);
  }

  protected nextMobileStep() {
    this.setMobileStep(this.mobileStep() + 1);
  }

  protected isMobileStepVisible(...steps: number[]) {
    return steps.includes(this.mobileStep());
  }

  protected async handleFiles(event: Event) {
    const files = Array.from((event.target as HTMLInputElement | null)?.files ?? []);
    await this.readFiles(files);
  }

  protected async handleDrop(event: DragEvent) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    await this.readFiles(files);
  }

  protected setMainImage(image: string) {
    this.mainImageUrl.set(image);
  }

  protected removeImage(image: string) {
    this.images.update((items) => items.filter((item) => item !== image));
    if (this.mainImageUrl() === image) {
      this.mainImageUrl.set(this.images()[0] ?? null);
    }
  }

  protected moveImage(image: string, direction: -1 | 1) {
    this.images.update((items) => {
      const index = items.indexOf(image);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= items.length) {
        return items;
      }
      const next = [...items];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  protected statusLabel(status: OwnerProperty['status'] | null) {
    const labels: Record<OwnerProperty['status'], string> = {
      DRAFT: 'Borrador',
      PENDING_REVIEW: 'En revision',
      APPROVED: 'Aprobada',
      REJECTED: 'Rechazada',
      PUBLISHED: 'Publicada',
      UNPUBLISHED: 'Despublicada',
    };

    return status ? labels[status] : 'Nuevo borrador';
  }

  private hydrate(property: OwnerProperty) {
    this.draft = {
      operationType: property.operationType,
      propertyType: property.propertyType,
      title: property.title,
      description: property.description,
      province: property.province,
      city: property.city,
      neighborhood: property.neighborhood,
      address: property.address,
      showExactAddress: property.showExactAddress,
      currency: property.currency,
      price: property.price,
      expenses: property.expenses,
      acceptsCredit: property.acceptsCredit,
      rooms: property.rooms,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      coveredAreaM2: property.coveredAreaM2,
      totalAreaM2: property.totalAreaM2,
      floor: property.floor,
      age: property.age,
      featuresText: property.features.join(', '),
      contactName: property.contactName,
      contactEmail: property.contactEmail,
      contactPhone: property.contactPhone ?? '',
      contactWhatsapp: property.contactWhatsapp ?? '',
    };
    this.images.set(property.images);
    this.mainImageUrl.set(property.mainImageUrl ?? property.images[0] ?? null);
    this.currentStatus.set(property.status);
  }

  private async persist(submit: boolean) {
    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    try {
      const payload = this.buildPayload();
      const existingId = this.editingPropertyId();
      const property = existingId
        ? await firstValueFrom(this.api.updateMyOwnerProperty(existingId, payload))
        : await firstValueFrom(this.api.createOwnerPropertyDraft(payload));

      this.editingPropertyId.set(property.id);
      this.currentStatus.set(property.status);

      if (submit) {
        const submitted = await firstValueFrom(this.api.submitMyOwnerProperty(property.id));
        this.currentStatus.set(submitted.status);
        this.success.set('Propiedad enviada a revision.');
        await this.router.navigate(['/app/my-properties']);
        return;
      }

      this.success.set('Borrador guardado.');
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo guardar la propiedad.'));
    } finally {
      this.saving.set(false);
    }
  }

  private buildPayload(): CreateOwnerPropertyPayload {
    const features = this.draft.featuresText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const images = this.images();

    return {
      operationType: this.draft.operationType,
      propertyType: this.draft.propertyType,
      title: this.draft.title.trim(),
      description: this.draft.description.trim(),
      province: this.draft.province.trim(),
      city: this.draft.city.trim(),
      neighborhood: this.draft.neighborhood.trim(),
      address: this.draft.address.trim(),
      showExactAddress: this.draft.showExactAddress,
      currency: this.draft.currency,
      price: Number(this.draft.price ?? 0),
      expenses: this.nullableNumber(this.draft.expenses),
      acceptsCredit: this.draft.acceptsCredit,
      rooms: this.nullableNumber(this.draft.rooms),
      bedrooms: this.nullableNumber(this.draft.bedrooms),
      bathrooms: this.nullableNumber(this.draft.bathrooms),
      coveredAreaM2: this.nullableNumber(this.draft.coveredAreaM2),
      totalAreaM2: this.nullableNumber(this.draft.totalAreaM2),
      floor: this.nullableNumber(this.draft.floor),
      age: this.nullableNumber(this.draft.age),
      features,
      images,
      mainImageUrl: this.mainImageUrl() ?? images[0] ?? null,
      contactName: this.draft.contactName.trim(),
      contactEmail: this.draft.contactEmail.trim(),
      contactPhone: this.draft.contactPhone.trim() || null,
      contactWhatsapp: this.draft.contactWhatsapp.trim() || null,
    };
  }

  private nullableNumber(value: number | null) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return null;
    }

    return Number(value);
  }

  private async readFiles(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith('image/')).slice(0, 20 - this.images().length);
    if (imageFiles.length === 0) {
      return;
    }

    const encoded = await Promise.all(
      imageFiles.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );

    this.images.update((items) => [...items, ...encoded].slice(0, 20));
    if (!this.mainImageUrl()) {
      this.mainImageUrl.set(encoded[0] ?? null);
    }
  }
}
