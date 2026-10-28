import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimStringOrUndefined } from '../../../../common/transforms/normalize-string.transform';

export class CreateConversationDto {
  @Transform(({ value }) => trimStringOrUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;
}
