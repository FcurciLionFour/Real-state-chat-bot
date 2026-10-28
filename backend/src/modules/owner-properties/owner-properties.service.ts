import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CurrencyCode,
  ListingStatus,
  OperationType,
  OwnerProperty,
  OwnerPropertyOperationType,
  OwnerPropertyStatus,
  OwnerPropertyType,
  Prisma,
  PropertyType,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateOwnerPropertyDto } from './api/dto/create-owner-property.dto';
import { ReviewOwnerPropertyDto } from './api/dto/review-owner-property.dto';
import { UpdateOwnerPropertyDto } from './api/dto/update-owner-property.dto';

type OwnerPropertyWithOwner = OwnerProperty & {
  owner: {
    id: string;
    email: string;
    role: string;
  };
};

@Injectable()
export class OwnerPropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(ownerId: string, body: CreateOwnerPropertyDto) {
    const created = await this.prisma.ownerProperty.create({
      data: {
        ownerId,
        operationType: body.operationType,
        propertyType: body.propertyType,
        title: this.compact(body.title),
        description: this.compact(body.description),
        province: this.compact(body.province),
        city: this.compact(body.city),
        neighborhood: this.optionalString(body.neighborhood),
        address: this.optionalString(body.address),
        showExactAddress: body.showExactAddress ?? false,
        currency: body.currency,
        price: body.price,
        expenses: body.expenses ?? null,
        acceptsCredit: body.acceptsCredit ?? false,
        rooms: body.rooms ?? null,
        bedrooms: body.bedrooms ?? null,
        bathrooms: body.bathrooms ?? null,
        coveredAreaM2: body.coveredAreaM2 ?? null,
        totalAreaM2: body.totalAreaM2 ?? null,
        floor: this.optionalString(body.floor),
        age: body.age ?? null,
        features: this.normalizeStringArray(body.features ?? []),
        images: this.normalizeStringArray(body.images ?? []),
        mainImageUrl: this.resolveMainImage(body.mainImageUrl, body.images ?? []),
        contactName: this.compact(body.contactName),
        contactEmail: body.contactEmail.trim().toLowerCase(),
        contactPhone: this.optionalString(body.contactPhone),
        contactWhatsapp: this.optionalString(body.contactWhatsapp),
      },
      include: this.ownerInclude(),
    });

    return this.serialize(created);
  }

  async listMine(ownerId: string) {
    const items = await this.prisma.ownerProperty.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      include: this.ownerInclude(),
    });

    return {
      items: items.map((item) => this.serialize(item)),
      meta: {
        page: 1,
        limit: items.length,
        total: items.length,
      },
    };
  }

  async getMine(ownerId: string, id: string) {
    return this.serialize(await this.getOwnedProperty(ownerId, id));
  }

  async updateMine(ownerId: string, id: string, body: UpdateOwnerPropertyDto) {
    const property = await this.getOwnedProperty(ownerId, id);
    this.assertEditable(property);

    const updated = await this.prisma.ownerProperty.update({
      where: { id },
      data: {
        ...this.buildUpdateData(body),
        status: property.status === OwnerPropertyStatus.REJECTED ? OwnerPropertyStatus.DRAFT : property.status,
        rejectionReason: property.status === OwnerPropertyStatus.REJECTED ? null : property.rejectionReason,
      },
      include: this.ownerInclude(),
    });

    return this.serialize(updated);
  }

  async submitMine(ownerId: string, id: string) {
    const property = await this.getOwnedProperty(ownerId, id);

    if (!this.isDraftOrRejected(property.status)) {
      throw new BadRequestException('Solo se pueden enviar a revision propiedades en borrador o rechazadas.');
    }

    this.assertReadyForReview(property);

    const updated = await this.prisma.ownerProperty.update({
      where: { id },
      data: {
        status: OwnerPropertyStatus.PENDING_REVIEW,
        submittedAt: new Date(),
        rejectionReason: null,
      },
      include: this.ownerInclude(),
    });

    return this.serialize(updated);
  }

  async unpublishMine(ownerId: string, id: string) {
    const property = await this.getOwnedProperty(ownerId, id);

    if (!this.isPublishedOrApproved(property.status)) {
      throw new BadRequestException('Solo se pueden despublicar propiedades publicadas o aprobadas.');
    }

    const updated = await this.prisma.ownerProperty.update({
      where: { id },
      data: {
        status: OwnerPropertyStatus.UNPUBLISHED,
        propertyCache: property.propertyCacheId
          ? {
              update: {
                listingStatus: ListingStatus.REMOVED,
              },
            }
          : undefined,
      },
      include: this.ownerInclude(),
    });

    return this.serialize(updated);
  }

  async deleteMine(ownerId: string, id: string) {
    const property = await this.getOwnedProperty(ownerId, id);

    if (property.status !== OwnerPropertyStatus.DRAFT) {
      throw new BadRequestException('Solo se pueden eliminar borradores.');
    }

    await this.prisma.ownerProperty.delete({ where: { id } });
    return { success: true };
  }

  async listAdmin(input: { page: number; limit: number; status?: OwnerPropertyStatus }) {
    const where = input.status ? { status: input.status } : {};

    const [items, total] = await Promise.all([
      this.prisma.ownerProperty.findMany({
        where,
        orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: this.ownerInclude(),
      }),
      this.prisma.ownerProperty.count({ where }),
    ]);

    return {
      items: items.map((item) => this.serialize(item)),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
      },
    };
  }

  async getAdmin(id: string) {
    return this.serialize(await this.getAnyProperty(id));
  }

  async updateAdmin(id: string, body: UpdateOwnerPropertyDto) {
    await this.getAnyProperty(id);

    const updated = await this.prisma.ownerProperty.update({
      where: { id },
      data: this.buildUpdateData(body),
      include: this.ownerInclude(),
    });

    if (this.isPublishedOrApproved(updated.status)) {
      await this.syncPublishedProperty(updated);
    }

    return this.serialize(updated);
  }

  async approveAdmin(id: string) {
    const property = await this.getAnyProperty(id);

    if (property.status !== OwnerPropertyStatus.PENDING_REVIEW) {
      throw new BadRequestException('Solo se pueden aprobar propiedades en revision.');
    }

    const publishedAt = new Date();
    const updated = await this.prisma.ownerProperty.update({
      where: { id },
      data: {
        status: OwnerPropertyStatus.PUBLISHED,
        reviewedAt: publishedAt,
        publishedAt,
        rejectionReason: null,
      },
      include: this.ownerInclude(),
    });

    await this.syncPublishedProperty(updated);

    return this.serialize(await this.getAnyProperty(id));
  }

  async rejectAdmin(id: string, body: ReviewOwnerPropertyDto) {
    const property = await this.getAnyProperty(id);

    if (property.status !== OwnerPropertyStatus.PENDING_REVIEW) {
      throw new BadRequestException('Solo se pueden rechazar propiedades en revision.');
    }

    const reason = this.optionalString(body.rejectionReason);
    if (!reason) {
      throw new BadRequestException('El motivo de rechazo es obligatorio.');
    }

    const updated = await this.prisma.ownerProperty.update({
      where: { id },
      data: {
        status: OwnerPropertyStatus.REJECTED,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
      include: this.ownerInclude(),
    });

    return this.serialize(updated);
  }

  async unpublishAdmin(id: string) {
    const property = await this.getAnyProperty(id);

    if (!this.isPublishedOrApproved(property.status)) {
      throw new BadRequestException('Solo se pueden despublicar propiedades publicadas o aprobadas.');
    }

    const updated = await this.prisma.ownerProperty.update({
      where: { id },
      data: {
        status: OwnerPropertyStatus.UNPUBLISHED,
        propertyCache: property.propertyCacheId
          ? {
              update: {
                listingStatus: ListingStatus.REMOVED,
              },
            }
          : undefined,
      },
      include: this.ownerInclude(),
    });

    return this.serialize(updated);
  }

  private async getOwnedProperty(ownerId: string, id: string) {
    const property = await this.prisma.ownerProperty.findUnique({
      where: { id },
      include: this.ownerInclude(),
    });

    if (!property) {
      throw new NotFoundException('Propiedad no encontrada.');
    }

    if (property.ownerId !== ownerId) {
      throw new ForbiddenException('No tenes acceso a esta propiedad.');
    }

    return property;
  }

  private async getAnyProperty(id: string) {
    const property = await this.prisma.ownerProperty.findUnique({
      where: { id },
      include: this.ownerInclude(),
    });

    if (!property) {
      throw new NotFoundException('Propiedad no encontrada.');
    }

    return property;
  }

  private assertEditable(property: OwnerProperty) {
    if (!this.isDraftOrRejected(property.status)) {
      throw new BadRequestException('Solo se pueden editar propiedades en borrador o rechazadas.');
    }
  }

  private assertReadyForReview(property: OwnerProperty) {
    const images = this.readStringArray(property.images);
    const hasContact = Boolean(property.contactEmail || property.contactPhone || property.contactWhatsapp);

    if (property.price.toNumber() <= 0 || !property.currency || !hasContact || images.length === 0) {
      throw new BadRequestException('Completa precio, moneda, contacto e imagenes antes de enviar a revision.');
    }
  }

  private async syncPublishedProperty(property: OwnerProperty) {
    const payload = this.toPropertyPayload(property);
    const sourceUrl = this.buildOwnerSourceUrl(property.id);

    const propertyCache = await this.prisma.propertyCache.upsert({
      where: { sourceUrl },
      create: {
        source: 'OWNER_SUBMITTED',
        externalId: property.id,
        sourceUrl,
        canonicalHash: this.buildCanonicalHash(property),
        rawPayloadJson: payload,
        normalizedPayloadJson: payload,
        title: property.title,
        description: property.description,
        publisher: property.contactName,
        contactPhone: property.contactPhone,
        contactWhatsApp: property.contactWhatsapp,
        country: 'Argentina',
        province: property.province,
        city: property.city,
        neighborhood: property.neighborhood,
        locationText: this.buildLocationText(property),
        operation: this.mapOperation(property.operationType),
        propertyType: this.mapPropertyType(property.propertyType),
        priceAmount: property.price,
        priceCurrency: property.currency,
        expensesAmount: property.expenses,
        rooms: property.rooms,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        areaTotal: property.totalAreaM2,
        areaCovered: property.coveredAreaM2,
        featuresJson: this.readStringArray(property.features),
        imagesJson: this.readStringArray(property.images),
        listingStatus: ListingStatus.ACTIVE,
        scrapedAt: new Date(),
        publishedAt: property.publishedAt ?? new Date(),
      },
      update: {
        canonicalHash: this.buildCanonicalHash(property),
        rawPayloadJson: payload,
        normalizedPayloadJson: payload,
        title: property.title,
        description: property.description,
        publisher: property.contactName,
        contactPhone: property.contactPhone,
        contactWhatsApp: property.contactWhatsapp,
        province: property.province,
        city: property.city,
        neighborhood: property.neighborhood,
        locationText: this.buildLocationText(property),
        operation: this.mapOperation(property.operationType),
        propertyType: this.mapPropertyType(property.propertyType),
        priceAmount: property.price,
        priceCurrency: property.currency,
        expensesAmount: property.expenses,
        rooms: property.rooms,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        areaTotal: property.totalAreaM2,
        areaCovered: property.coveredAreaM2,
        featuresJson: this.readStringArray(property.features),
        imagesJson: this.readStringArray(property.images),
        listingStatus: ListingStatus.ACTIVE,
        scrapedAt: new Date(),
        publishedAt: property.publishedAt ?? new Date(),
      },
    });

    await this.prisma.ownerProperty.update({
      where: { id: property.id },
      data: { propertyCacheId: propertyCache.id },
    });
  }

  private buildUpdateData(body: UpdateOwnerPropertyDto): Prisma.OwnerPropertyUpdateInput {
    const data: Prisma.OwnerPropertyUpdateInput = {};

    if (body.operationType !== undefined) data.operationType = body.operationType;
    if (body.propertyType !== undefined) data.propertyType = body.propertyType;
    if (body.title !== undefined) data.title = this.compact(body.title);
    if (body.description !== undefined) data.description = this.compact(body.description);
    if (body.province !== undefined) data.province = this.compact(body.province);
    if (body.city !== undefined) data.city = this.compact(body.city);
    if (body.neighborhood !== undefined) data.neighborhood = this.optionalString(body.neighborhood);
    if (body.address !== undefined) data.address = this.optionalString(body.address);
    if (body.showExactAddress !== undefined) data.showExactAddress = body.showExactAddress;
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.price !== undefined) data.price = body.price;
    if (body.expenses !== undefined) data.expenses = body.expenses;
    if (body.acceptsCredit !== undefined) data.acceptsCredit = body.acceptsCredit;
    if (body.rooms !== undefined) data.rooms = body.rooms;
    if (body.bedrooms !== undefined) data.bedrooms = body.bedrooms;
    if (body.bathrooms !== undefined) data.bathrooms = body.bathrooms;
    if (body.coveredAreaM2 !== undefined) data.coveredAreaM2 = body.coveredAreaM2;
    if (body.totalAreaM2 !== undefined) data.totalAreaM2 = body.totalAreaM2;
    if (body.floor !== undefined) data.floor = this.optionalString(body.floor);
    if (body.age !== undefined) data.age = body.age;
    if (body.features !== undefined) data.features = this.normalizeStringArray(body.features);
    if (body.images !== undefined) data.images = this.normalizeStringArray(body.images);
    if (body.mainImageUrl !== undefined) data.mainImageUrl = this.resolveMainImage(body.mainImageUrl, body.images ?? []);
    if (body.contactName !== undefined) data.contactName = this.compact(body.contactName);
    if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail.trim().toLowerCase();
    if (body.contactPhone !== undefined) data.contactPhone = this.optionalString(body.contactPhone);
    if (body.contactWhatsapp !== undefined) data.contactWhatsapp = this.optionalString(body.contactWhatsapp);

    return data;
  }

  private isDraftOrRejected(status: OwnerPropertyStatus) {
    return status === OwnerPropertyStatus.DRAFT || status === OwnerPropertyStatus.REJECTED;
  }

  private isPublishedOrApproved(status: OwnerPropertyStatus) {
    return status === OwnerPropertyStatus.PUBLISHED || status === OwnerPropertyStatus.APPROVED;
  }

  private serialize(property: OwnerPropertyWithOwner) {
    return {
      id: property.id,
      ownerId: property.ownerId,
      owner: property.owner,
      propertyCacheId: property.propertyCacheId,
      sourceType: property.sourceType,
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
      price: Number(property.price),
      expenses: property.expenses === null ? null : Number(property.expenses),
      acceptsCredit: property.acceptsCredit,
      rooms: property.rooms === null ? null : Number(property.rooms),
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      coveredAreaM2: property.coveredAreaM2 === null ? null : Number(property.coveredAreaM2),
      totalAreaM2: property.totalAreaM2 === null ? null : Number(property.totalAreaM2),
      floor: property.floor,
      age: property.age,
      features: this.readStringArray(property.features),
      images: this.readStringArray(property.images),
      mainImageUrl: property.mainImageUrl,
      contactName: property.contactName,
      contactEmail: property.contactEmail,
      contactPhone: property.contactPhone,
      contactWhatsapp: property.contactWhatsapp,
      status: property.status,
      rejectionReason: property.rejectionReason,
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
      submittedAt: property.submittedAt,
      reviewedAt: property.reviewedAt,
      publishedAt: property.publishedAt,
    };
  }

  private ownerInclude() {
    return {
      owner: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    } satisfies Prisma.OwnerPropertyInclude;
  }

  private toPropertyPayload(property: OwnerProperty): Prisma.InputJsonObject {
    return {
      id: property.id,
      sourceType: property.sourceType,
      operationType: property.operationType,
      propertyType: property.propertyType,
      title: property.title,
      description: property.description,
      province: property.province,
      city: property.city,
      neighborhood: property.neighborhood,
      address: property.showExactAddress ? property.address : null,
      currency: property.currency,
      price: Number(property.price),
      expenses: property.expenses === null ? null : Number(property.expenses),
      rooms: property.rooms === null ? null : Number(property.rooms),
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      areaTotal: property.totalAreaM2 === null ? null : Number(property.totalAreaM2),
      areaCovered: property.coveredAreaM2 === null ? null : Number(property.coveredAreaM2),
      features: this.readStringArray(property.features),
      images: this.readStringArray(property.images),
      mainImageUrl: property.mainImageUrl,
      publishedAt: property.publishedAt?.toISOString() ?? null,
    };
  }

  private buildCanonicalHash(property: OwnerProperty) {
    return `owner_submitted::${property.propertyType}::${(property.neighborhood ?? property.city).toLowerCase()}::${Number(property.price)}::${property.title.toLowerCase()}`;
  }

  private buildOwnerSourceUrl(id: string) {
    return `https://owner-submitted.busca.ar/properties/${id}`;
  }

  private buildLocationText(property: OwnerProperty) {
    const visibleAddress = property.showExactAddress ? property.address : null;
    return [visibleAddress, property.neighborhood, property.city, property.province].filter(Boolean).join(', ');
  }

  private mapOperation(value: OwnerPropertyOperationType) {
    return value === OwnerPropertyOperationType.SALE ? OperationType.BUY : OperationType.RENT;
  }

  private mapPropertyType(value: OwnerPropertyType) {
    const map: Record<OwnerPropertyType, PropertyType> = {
      APARTMENT: PropertyType.APARTMENT,
      HOUSE: PropertyType.HOUSE,
      LAND: PropertyType.LAND,
      OFFICE: PropertyType.OFFICE,
      STORE: PropertyType.LOCAL,
    };

    return map[value];
  }

  private compact(value: string) {
    return value.trim().replace(/\s+/g, ' ');
  }

  private optionalString(value: string | undefined | null) {
    const normalized = value?.trim().replace(/\s+/g, ' ') ?? '';
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeStringArray(values: string[]) {
    return Array.from(new Set(values.map((value) => this.optionalString(value)).filter((value): value is string => Boolean(value))));
  }

  private readStringArray(value: Prisma.JsonValue) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private resolveMainImage(mainImageUrl: string | undefined, images: string[]) {
    const normalizedMain = this.optionalString(mainImageUrl);
    if (normalizedMain) {
      return normalizedMain;
    }

    return this.normalizeStringArray(images)[0] ?? null;
  }
}
