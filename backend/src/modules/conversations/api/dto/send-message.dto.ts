import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../../../common/transforms/normalize-string.transform';

export class SendMessageDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}
