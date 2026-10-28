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

export class CreateOwnerPropertyDto {
  @IsEnum(OwnerPropertyOperationType)
  operationType!: OwnerPropertyOperationType;

  @IsEnum(OwnerPropertyType)
  propertyType!: OwnerPropertyType;

  @IsString()
  @MinLength(8)
  @MaxLength(140)
  title!: string;

  @IsString()
  @MinLength(30)
  @MaxLength(2000)
  description!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  province!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

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
  showExactAddress = false;

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @IsNumber()
  @Min(1)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  expenses?: number;

  @IsOptional()
  @IsBoolean()
  acceptsCredit = false;

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
  features: string[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  images: string[] = [];

  @IsOptional()
  @IsString()
  mainImageUrl?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  contactName!: string;

  @IsEmail()
  contactEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactWhatsapp?: string;
}
