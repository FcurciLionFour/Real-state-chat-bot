import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { normalizeEmail } from '../../../../common/transforms/normalize-string.transform';

export class RegisterDto {
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must include at least one letter and one number',
  })
  password!: string;
}
