import {
  CurrencyCode,
  OwnerPropertyOperationType,
  OwnerPropertyType,
} from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateOwnerPropertyDto {
  @IsOptional()
  @IsEnum(OwnerPropertyOperationType)
  operationType?: OwnerPropertyOperationType;

  @IsOptional()
  @IsEnum(OwnerPropertyType)
  propertyType?: OwnerPropertyType;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(30)
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  province?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  neighborhood?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  address?: string;

  @IsOptional()
  @IsBoolean()
  showExactAddress?: boolean;

  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;

  @IsOptional()
  @IsNumber()
  @Min(1)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  expenses?: number;

  @IsOptional()
  @IsBoolean()
  acceptsCredit?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99)
  rooms?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99)
  bedrooms?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99)
  bathrooms?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coveredAreaM2?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAreaM2?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  floor?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  age?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  mainImageUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  contactName?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactWhatsapp?: string;
}
