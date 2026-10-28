import { IsArray, IsBoolean, IsObject, IsOptional } from 'class-validator';

export class PatchSearchStateDto {
  @IsOptional()
  @IsObject()
  filterPatch?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  filtersToUnset?: string[];

  @IsOptional()
  @IsBoolean()
  shouldSearch?: boolean;
}
