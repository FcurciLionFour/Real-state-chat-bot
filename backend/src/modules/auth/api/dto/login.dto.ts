import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { normalizeEmail } from '../../../../common/transforms/normalize-string.transform';

export class LoginDto {
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
