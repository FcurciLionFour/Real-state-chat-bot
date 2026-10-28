import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitOwnerPropertyDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
