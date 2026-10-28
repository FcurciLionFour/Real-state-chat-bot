import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReviewOwnerPropertyDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  rejectionReason?: string;
}
